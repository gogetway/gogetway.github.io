# proto 录制格式与协议解析

`gogetway` 把所有捕获的字节流以自定义二进制格式串到一个文件里。`proto` 包负责"写入"与"读回"。

源码：[proto/writeProto.go](https://github.com/wangshiben/gogetway/blob/master/proto/writeProto.go) · [proto/readProto.go](https://github.com/wangshiben/gogetway/blob/master/proto/readProto.go)

---

## 1. 二进制格式

```
MagicHeader("--benbens--\nt") + TimeStamp(8B LE) + Type(1B) + Length(8B LE) + "from...to" + "\n" + Body
```

| 段 | 长度 | 说明 |
|---|---|---|
| MagicHeader | 13B | 固定 `--benbens--\nt`，用作切分定界 |
| TimeStamp | 8B | 纳秒级 Unix 时间戳，小端 |
| Type | 1B | `Types.ClientType`（TCP=1 / HTTP=2 等） |
| Length | 8B | body 长度，小端 |
| FromTo | 变长 | `from-host:port...to-host:port` |
| `\n` | 1B | 分隔符 |
| Body | Length B | 原始字节流 |

> **转义**：body 中若出现 `\nt` 序列，会被 `handleDataBody` 替换为 `\n\nt`（避免与 MagicHeader 冲突），`UnMarshal` 时通过 `removeNewlineAfter` 还原。

---

## 2. `Packet` 结构

```go
type Packet struct {
    Data         []byte           // 还原后的载荷
    Type         Types.ClientType // 与写入时的 ListenType 对应
    From         string           // 源地址
    To           string           // 目标地址
    reqTimestamp int64            // 私有，写入时的纳秒时间戳
}

func (p *Packet) Marshal() []byte
func (p *Packet) Timestamp() int64
func NewPacket(data []byte, From, To string, PacketType Types.ClientType) *Packet
```

> **注意**：`reqTimestamp` 是私有字段，`NewPacket` 创建出来的 Packet 的 `Timestamp()` 永远返回 0，只有从 `UnMarshal` 出来的 Packet 才带真实时间戳。

---

## 3. 关键函数

### 3.1 `WriteProto`

```go
func WriteProto(src []byte, PacType Types.ClientType, FromTo string) []byte
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `src` | `[]byte` | 原始载荷 |
| `PacType` | `Types.ClientType` | 包类型 |
| `FromTo` | string | 形如 `"127.0.0.1:54321...127.0.0.1:8080"` |

返回：已封装好的字节流，可直接写入文件。

### 3.2 `UnMarshal`

```go
func UnMarshal(data []byte) (*Packet, error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `data` | `[]byte` | 单个完整的录制块（由 `ReadProtoFromReader` 切出） |

| 返回值 | 类型 | 说明 |
|---|---|---|
| `*Packet` | `*Packet` | 解析结果 |
| `err` | error | `"packet too short"` / `"not my packet"` / `"packet length error"` 等 |

### 3.3 `ReadProtoFromReader`

```go
func ReadProtoFromReader(reader io.Reader) (*bufio.Scanner, error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `reader` | `io.Reader` | 任意流（文件/网络） |

| 返回值 | 类型 | 说明 |
|---|---|---|
| `*bufio.Scanner` | `*bufio.Scanner` | 每次 `Scan()` 返回一个完整包的字节（含 MagicHeader），最大单包 64MB |
| `err` | error | 当前实现总是 nil |

---

## 4. 典型读取用法

```go
file, _ := os.Open("./traffic.log")
defer file.Close()

scanner, _ := proto.ReadProtoFromReader(file)
for scanner.Scan() {
    pkt, err := proto.UnMarshal(scanner.Bytes())
    if err != nil { continue }
    fmt.Printf("[%d] %s -> %s len=%d\n", pkt.Timestamp(), pkt.From, pkt.To, len(pkt.Data))
}
```

---

## 5. `Pack` 接口

```go
type Pack interface {
    Marshal() []byte
    Timestamp() int64
    Type() Types.ClientType
    Data() []byte
    From() string
    To() string
}
```

`*proto.Packet` 部分实现了这个接口（`Marshal` / `Timestamp`），其它方法目前通过字段直接访问。
如果你要换一种录制格式（例如 pcapng / JSON line），只要保证读写一对函数即可，其它模块都基于 `[]byte` / `*Packet` 工作。

---

## 6. 上下文 key 速查

主动代理写入时，`context.Context` 里可用的 key 定义在 [getwayServer/consts.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/consts.go)：

```go
const (
    ListenType = "ListenType"  // value: Types.ClientType
    FromTo     = "FromTo"      // value: "from-host:port...to-host:port"
    FromIP     = "FromIP"      // value: "host:port"
    ToIP       = "ToIP"        // value: "host:port"
)
```

读取示例：

```go
writeFunc := func(data []byte, ctx context.Context) (int, error) {
    fromTo, _ := ctx.Value(getwayServer.FromTo).(string)
    listenType, _ := ctx.Value(getwayServer.ListenType).(Types.ClientType)
    _ = listenType
    return n, nil
}
```

被动镜像写入时也注入这四个 key，所以同一份 `WriteFunc` 可以同时给主动代理和被动镜像复用。

---

> 参考：[SimpleTCPServer](./simpleTCPServer) · [TcpPlayer](./tcpPlayer)
