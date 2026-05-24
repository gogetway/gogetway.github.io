# GopacketTrafficMirror 被动镜像

被动镜像在不修改部署的情况下监听任意端口（pcap / AF_PACKET / eBPF），通过 gopacket 抓包 + tcpassembly 重组 TCP 流，再走自定义钩子转发 / 记录。

源码：[getwayServer/gopacket_mirror.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/gopacket_mirror.go)

---

## 1. 配置结构 `GopacketMirrorConfig`

```go
type GopacketMirrorConfig struct {
    ObservedPort uint16
    TargetAddr   string
    Writer       io.Writer
    WriteFunc    WriteFunc

    ForwardHook TrafficMirrorHook
    RecordHook  TrafficMirrorHook
    DialContext func(ctx context.Context, network, address string) (net.Conn, error)
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ObservedPort` | uint16 | 是 | 被监听服务的端口，决定 `TrafficDirection`（0 时所有方向都为 unknown 并被忽略） |
| `TargetAddr` | string | 否 | 转发目标，空字符串表示只录不转 |
| `Writer` | `io.Writer` | 二选一 | 录制 writer，与 `WriteFunc` 二选一 |
| `WriteFunc` | `WriteFunc` | 二选一 | 自定义写入，非 nil 时优先于 `Writer` |
| `ForwardHook` | `TrafficMirrorHook` | 否 | 转发方向钩子，nil 时用 `DefaultForwardTrafficMirrorHook`（只转发到被监听服务的方向） |
| `RecordHook` | `TrafficMirrorHook` | 否 | 录制方向钩子，nil 时用 `DefaultRecordTrafficMirrorHook`（只录到被监听服务的方向） |
| `DialContext` | dial 函数 | 否 | 转发上游用的 dialer，nil 时默认 `&net.Dialer{Timeout: 5*time.Second}.DialContext` |

行为约定：

- `Writer` 与 `WriteFunc` 都为 nil 时不执行录制写入，但 `RecordHook` 仍会被调用（可用于做侧信道导出）。
- `TargetAddr` 为空时跳过转发，但 `ForwardHook` 不会被调用。

---

## 2. 构造与启动

### 2.1 `NewGopacketTrafficMirror`

```go
func NewGopacketTrafficMirror(config GopacketMirrorConfig) *GopacketTrafficMirror
```

会自动为缺省的 `ForwardHook` / `RecordHook` / `DialContext` 填充默认值。

### 2.2 `Start`

```go
func (m *GopacketTrafficMirror) Start(ctx context.Context, source ObservedPacketSource) error
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | `context.Context` | 取消时 `assembler.FlushAll()` 并返回 `ctx.Err()` |
| `source` | `ObservedPacketSource` | 抓包源，nil 时返回 `errors.New("packet source is nil")` |

| 返回值 | 说明 |
|---|---|
| `error` | ctx 取消、source 关闭、或 hook/写入返回的第一个错误 |

> `source.Close()` 会被 `defer` 调用，无需调用方自行关闭。

---

## 3. Hook：`TrafficMirrorHook`

```go
type TrafficMirrorHook interface {
    Handle(ctx context.Context, chunk *ObservedTrafficChunk) (data []byte, keep bool, err error)
}

type TrafficMirrorHookFunc func(ctx context.Context, chunk *ObservedTrafficChunk) (data []byte, keep bool, err error)
func (f TrafficMirrorHookFunc) Handle(ctx context.Context, chunk *ObservedTrafficChunk) ([]byte, bool, error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | `context.Context` | 来自 `Start` 的根 ctx |
| `chunk` | `*ObservedTrafficChunk` | 重组后的单方向流量 |

| 返回值 | 类型 | 说明 |
|---|---|---|
| `data` | `[]byte` | 可以返回 `chunk.Data` 原值或修改后的拷贝；长度为 0 时跳过此次写入/转发 |
| `keep` | bool | `false` 表示丢弃 |
| `err` | error | 非 nil 时整个 `Start` 返回该错误 |

### `ObservedTrafficChunk`

```go
type ObservedTrafficChunk struct {
    Data      []byte           // 重组后的连续字节
    From      string           // 源 host:port
    To        string           // 目标 host:port
    Direction TrafficDirection // to_observed / from_observed / unknown
    Type      Types.ClientType // 默认 TCPType
    SeenAt    time.Time        // 抓包时间戳
}
```

`TrafficDirection` 取值：

- `TrafficDirectionToObserved` — 客户端→被监听服务
- `TrafficDirectionFromObserved` — 被监听服务→客户端
- `TrafficDirectionUnknown` — 端口不匹配，通常被忽略

---

## 4. 默认 Hook

| 名称 | 行为 |
|---|---|
| `DefaultTrafficMirrorHook` | 全部保留，做一次拷贝 |
| `DefaultForwardTrafficMirrorHook` | 仅保留 `TrafficDirectionToObserved`，其它丢弃 |
| `DefaultRecordTrafficMirrorHook` | 同上（只记录请求方向） |

想同时记录双向流量？把 `RecordHook` 替换为 `DefaultTrafficMirrorHook{}` 即可。

---

## 5. 抓包源：`ObservedPacketSource`

```go
type ObservedPacketSource interface {
    Packets() <-chan gopacket.Packet
    Close() error
}
```

底层抽象不绑定具体抓包实现，可接入：

- pcap（参考 `cmd/tcp-proxy/live_capture.go`）
- AF_PACKET / eBPF
- pcap 文件回放
- 测试用的内存 channel —— 用 `NewChannelObservedPacketSource(ch)`

### `NewChannelObservedPacketSource`

```go
func NewChannelObservedPacketSource(packets <-chan gopacket.Packet) *ChannelObservedPacketSource
```

返回的 `*ChannelObservedPacketSource` 的 `Close()` 是 no-op，channel 生命周期由调用方控制。

---

## 6. 完整示例

```go
recordFile, _ := os.Create("./mirror.log")
defer recordFile.Close()

mirror := getwayServer.NewGopacketTrafficMirror(getwayServer.GopacketMirrorConfig{
    ObservedPort: 8090,
    TargetAddr:   "127.0.0.1:18090",
    Writer:       recordFile,

    // 转发前在请求里追加一个 X-Mirror 头，只对发往被监听服务的方向生效
    ForwardHook: getwayServer.TrafficMirrorHookFunc(func(ctx context.Context, chunk *getwayServer.ObservedTrafficChunk) ([]byte, bool, error) {
        if chunk.Direction != getwayServer.TrafficDirectionToObserved {
            return nil, false, nil
        }
        injected := bytes.Replace(chunk.Data, []byte("\r\n\r\n"), []byte("\r\nX-Mirror: 1\r\n\r\n"), 1)
        return injected, true, nil
    }),

    // 录制时去掉 Authorization 头
    RecordHook: getwayServer.TrafficMirrorHookFunc(func(ctx context.Context, chunk *getwayServer.ObservedTrafficChunk) ([]byte, bool, error) {
        if chunk.Direction != getwayServer.TrafficDirectionToObserved {
            return nil, false, nil
        }
        sanitized := redactAuthHeader(chunk.Data)
        return sanitized, true, nil
    }),
})

ctx, cancel := context.WithCancel(context.Background())
defer cancel()
if err := mirror.Start(ctx, mySource); err != nil {
    log.Fatal(err)
}
```

---

## 7. 常见坑

1. **`WriteFunc` 默认串行**：被动镜像里默认通过 `recordMu` 全局互斥，与主动代理由每条连接独立的 `WriteQueue` 不同。如果你的 `WriteFunc` 自身已是并发安全的，会变成主线程瓶颈，可考虑去掉这个互斥（需修改源码）。
2. **`ForwardHook` 修改 `data` 不影响 `RecordHook`**：`Reassembled` 在两个 hook 之间会做一次拷贝。
3. **`ObservedPacketSource.Packets()` 关闭 channel** 才能让 `Start` 优雅返回，仅 `Close()` 不够。
4. **`ObservedPort = 0`** 时所有方向都被识别为 unknown 并丢弃，必须显式指定。

---

> 参考：[SimpleTCPServer](./simpleTCPServer) · [proto 协议格式](./proto)
