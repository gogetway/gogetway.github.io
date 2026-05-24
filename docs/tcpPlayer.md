# TcpPlayer 接口说明文档

## 概述

`TcpPlayer` 用于把 `gogetway` 录制下来的流量重新发送给目标服务，支持按时间戳延迟回放、并通过自定义解析器（`DataParser`）在回放前修改包内容。常用于回归测试、流量染色、压力复现等场景。

源码位置：[tcpPlayback/tcpPlayer.go](https://github.com/wangshiben/gogetway/blob/master/tcpPlayback/tcpPlayer.go)

---

## 1. 结构体定义

```go
type TcpPlayer struct {
    Target           string         // 目标地址（匹配录制中的 To 字符串）
    Client           string         // 客户端地址（匹配录制中的 From），可空
    clientConn       net.Conn       // 私有，客户端方向连接
    targetConn       net.Conn       // 私有，目标方向连接
    replayTime       bool           // 是否按原始时间间隔回放
    clientTimeRecord lockMap.Lock   // 私有，时序状态
    targetTimeRecord lockMap.Lock   // 私有，时序状态
}
```

> **约定**：
> - 录制文件中的每个包带有 `from...to` 字段，`Target` / `Client` 用于和这些字段比对，决定包要往哪个连接发。
> - `replayTime = true` 时，`wait` 会根据相邻包的时间差进行 `sleep`，以毫秒级精度模拟真实时序。

---

## 2. 类型定义

### `DataParser`

```go
type DataParser func(data *proto.Packet) (*proto.Packet, error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `data` | `*proto.Packet` | 反序列化后的包，可修改字段 |

| 返回值 | 类型 | 说明 |
|---|---|---|
| `*proto.Packet` | `*proto.Packet` | 返回 `nil` 表示跳过此包 |
| `err` | error | 非 nil 时仅记日志，继续下一个包 |

典型用途：替换录制时的真实地址、token 改写、按比例采样。

```go
parser := func(p *proto.Packet) (*proto.Packet, error) {
    p.Data = bytes.ReplaceAll(p.Data, []byte("Bearer old-token"), []byte("Bearer new-token"))
    p.To = "127.0.0.1:9999"
    return p, nil
}
```

---

## 3. 构造与方法

### 3.1 `NewTCPPlayer`

```go
func NewTCPPlayer(
    target string,
    targetConnect net.Conn,
    Client string,
    ClientConn net.Conn,
    replayTime bool,
) *TcpPlayer
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `target` | string | 目标地址字符串（用于匹配 `packet.To`） |
| `targetConnect` | `net.Conn` | 已建立的目标连接，可为 nil（仅用 `SendSinglePacket` 时） |
| `Client` | string | 客户端标识（用于匹配 `packet.From`） |
| `ClientConn` | `net.Conn` | 客户端连接，可为 nil |
| `replayTime` | bool | true 时按原始间隔 sleep |

---

### 3.2 `ReplayToTarget`（推荐）

```go
func (t *TcpPlayer) ReplayToTarget(
    reader io.Reader,
    recordedTo string,
    parser DataParser,
) (int, error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `reader` | `io.Reader` | 录制文件流 |
| `recordedTo` | string | 录制中目标字符串，用于过滤（`packet.To == recordedTo` 才回放） |
| `parser` | `DataParser` | 可选回放前修改钩子 |

| 返回值 | 类型 | 说明 |
|---|---|---|
| 第一个 | int | 成功回放的包数 |
| 第二个 | error | 第一个写入错误，或 `recordedTo == ""` 等参数错误，或没有任何包被回放 |

---

### 3.3 `ReplayFileToTarget`（一行回放整个文件）

```go
func ReplayFileToTarget(
    filePath, target string,
    replayTime bool,
    parser DataParser,
) (int, error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `filePath` | string | 录制文件路径 |
| `target` | string | 实际要 dial 的目标地址（可与录制时不同） |
| `replayTime` | bool | 是否按原始时间间隔回放 |
| `parser` | `DataParser` | 可选回放前修改钩子 |

返回值：回放的包数 + error。内部会自动调用 `DetectRecordedTargetFromFile` 推断 `recordedTo`。

---

### 3.4 `DetectRecordedTargetFromFile`

```go
func DetectRecordedTargetFromFile(filePath string) (string, error)
```

扫一遍文件，统计每个 `packet.To` 的出现次数，返回出现最多的那个。用于自动识别"原录制时的目标地址"。

---

### 3.5 `SendSinglePacket`（不推荐）

```go
func (t *TcpPlayer) SendSinglePacket(reader io.Reader, to string, parser DataParser)
```

老接口，只发往单一方向。读取错误直接 `panic`，**不建议在生产使用**，请优先选 `ReplayToTarget`。

---

## 4. 时间回放

`NewTCPPlayer(..., replayTime=true)`：根据初始化之间的时间间隔进行 sleep，模拟真实时序。等待逻辑见 `tcpPlayback/tcpPlayer.go` 的 `wait` 函数。

> **注意**：`wait` 在每个 `lockMap.Lock` 的 `Other()` 上挂一个 `map[string]int64` 来记录上一个包时间，与当前时间的差。如果你自己的 lock 实现不允许 `UpdateOther` 覆盖 map，会 panic。

---

## 5. 使用示例

### 5.1 一行回放整个录制文件

```go
parser := func(p *proto.Packet) (*proto.Packet, error) {
    // 替换 token、改写目标地址等
    p.Data = bytes.ReplaceAll(p.Data, []byte("Bearer old"), []byte("Bearer new"))
    return p, nil
}

count, err := tcpPlayback.ReplayFileToTarget(
    "./traffic.log",
    "127.0.0.1:9999",
    false, // 不按原始时间间隔
    parser,
)
if err != nil {
    log.Fatal(err)
}
log.Printf("replayed %d packets", count)
```

### 5.2 自行管理连接 + 流式回放

```go
targetConn, _ := net.Dial("tcp", "127.0.0.1:9999")
defer targetConn.Close()

player := tcpPlayback.NewTCPPlayer(
    "127.0.0.1:8080", // 录制时的目标地址（用于匹配）
    targetConn,
    "",  // 不关心客户端方向
    nil,
    true, // 按原始时间间隔回放
)

f, _ := os.Open("./traffic.log")
defer f.Close()

count, err := player.ReplayToTarget(f, "127.0.0.1:8080", nil)
log.Printf("replayed=%d err=%v", count, err)
```

---

## 6. 注意事项

1. **连接管理**：调用方负责 `clientConn` / `targetConn` 的生命周期，`TcpPlayer` 不会自动关闭。
2. **线程安全**：`lockMap.Lock` 保护时序记录，但 `TcpPlayer` 本身不是完全线程安全，建议每个 player 实例由单一 goroutine 驱动。
3. **回放精度**：`replayTime=true` 时按毫秒级 sleep，亚毫秒精度会被丢失。
4. **多目标录制**：若录制文件里的 `packet.To` 来自多个目标，`ReplayFileToTarget` 只会回放出现次数最多的那个。其它目标请自行用 `proto.ReadProtoFromReader` + `proto.UnMarshal` 全量解析后过滤。

---

> 参考：[proto.Packet 结构](./proto) · [SimpleTCPServer 录制](./simpleTCPServer)
