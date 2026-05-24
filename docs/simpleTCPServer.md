# SimpleTCPServer 主动代理

`SimpleTCPServer` 监听一个本地端口，接受客户端连接后向上游 dial，再双向复制流量并按链路号序记录到任意 `io.Writer` / `WriteFunc`。这是 `gogetway` 主动代理模式的核心结构。

源码：[getwayServer/simpleTCPserver.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/simpleTCPserver.go)

---

## 1. 结构体

```go
type SimpleTCPServer struct {
    Forward          string                  // 上游转发地址，如 "127.0.0.1:8080"
    Port             string                  // 本地监听地址，如 ":9000"
    ListenType       Types.ClientType        // 监听协议类型：TCPType=1 / HTTPType=2
    WriteType        string                  // 预留：写入类型标识（File / Other）
    ClientRespParse  ClientRespParse         // 客户端方向流量分析钩子
    ForwardRespParse ClientRespParse         // 转发方向流量分析钩子
    Writer           *os.File                // 默认 Writer（已由 ResourceGroup 接管，推荐用 WithWriterAndFunc 注入）

    // 私有字段省略
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `Forward` | string | 是 | 上游目标，`net.Dial("tcp", ...)` 使用 |
| `Port` | string | 是 | 本地监听地址，需带冒号（`":9000"`） |
| `ListenType` | `Types.ClientType` | 是 | 通过 `getwayServer.TCPType` / `HTTPType` 选择，影响包格式标记 |
| `ClientRespParse` | `ClientRespParse` | 否 | 客户端→上游 方向的流量分析钩子，需手动开启 `startAnalyze` |
| `ForwardRespParse` | `ClientRespParse` | 否 | 上游→客户端 方向的流量分析钩子 |
| `Writer` | `*os.File` | 否 | 已弱化，建议通过构造函数传入 |

---

## 2. 构造函数

### 2.1 `NewSimpleTCPServer`

```go
func NewSimpleTCPServer(ForwardAdd, LocalAdd string, ListenType Types.ClientType) *SimpleTCPServer
```

最简单的构造，会在当前目录创建 `log1.txt` 作为录制文件。**生产不推荐**，会污染当前目录。

### 2.2 `NewSimpleTCPServerWithWriterAndFunc`（推荐）

```go
func NewSimpleTCPServerWithWriterAndFunc(
    ForwardAdd, LocalAdd string,
    ListenType Types.ClientType,
    writer io.Writer,
    writeFunc WriteFunc,
) *SimpleTCPServer
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ForwardAdd` | string | 上游地址 |
| `LocalAdd` | string | 本地监听地址 |
| `ListenType` | `Types.ClientType` | 监听类型 |
| `writer` | `io.Writer` | 默认写入器，可传 `io.Discard` 表示不落盘 |
| `writeFunc` | `WriteFunc` | 自定义写入函数，**优先级高于 `writer`**（非 nil 时只调用它） |

### 2.3 `NewSimpleTCPServerWithLockGroup`

```go
func NewSimpleTCPServerWithLockGroup(
    ForwardAdd, LocalAdd string,
    ListenType Types.ClientType,
    lockGroup lockMap.LockGroup,
) *SimpleTCPServer
```

需要自定义锁分配（如 per-tenant 隔离/限流）时使用。

### 2.4 `NewSimpleTcpServerWithResourceGroup`

```go
func NewSimpleTcpServerWithResourceGroup(
    ForwardAdd, LocalAdd string,
    ListenType Types.ClientType,
    group ResourceGroup,
) *SimpleTCPServer
```

完全自定义资源池（连接池接入、按租户分文件等）用这个。

---

## 3. 实例方法

### 3.1 `StartListen()`

```go
func (s *SimpleTCPServer) StartListen()
```

- 入参：无
- 返回：无（阻塞，直到收到 SIGINT/SIGTERM 调用 `os.Exit(0)`）
- 副作用：监听 `s.Port`，每条连接 spawn 一个 goroutine

> **注意**：`StartListen` 内部会安装信号处理器并直接 `os.Exit`。如果你需要在自己的进程里集成，应当自行重新实现这一段，改成上层 `context` 控制。

### 3.2 `SetConnectTargetFunc(connectFunc ConnectTarget)`

```go
func (s *SimpleTCPServer) SetConnectTargetFunc(connectFunc ConnectTarget)
```

注入自定义的"上游 dial"逻辑，详见下面的 [ConnectTarget](#43-connecttarget)。

### 3.3 `UpdateResourceGroup(resourceGroup ResourceGroup)`

```go
func (s *SimpleTCPServer) UpdateResourceGroup(resourceGroup ResourceGroup)
```

- 入参：`resourceGroup` 不能为 nil（否则 panic）
- 用途：启动前替换默认的 `DefaultResourceGroup`

---

## 4. Hook 类型

### 4.1 `WriteFunc` — 自定义写入行为

```go
type WriteFunc func(data []byte, ctx context.Context) (offset int, err error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `data` | `[]byte` | 已经过 `proto.WriteProto` 封装的字节流 |
| `ctx` | `context.Context` | 可读取 `ListenType` / `FromIP` / `ToIP` / `FromTo`（[getwayServer/consts.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/consts.go)） |

| 返回值 | 类型 | 说明 |
|---|---|---|
| `offset` | int | 已写入字节数（可不返回准确值，只用作日志） |
| `err` | error | 非 nil 时仅记日志，不会中断流量 |

典型用途：写数据库、Kafka、自定义日志格式、按链路分文件。

```go
writeFunc := func(data []byte, ctx context.Context) (int, error) {
    fromTo, _ := ctx.Value(getwayServer.FromTo).(string)
    log.Printf("link=%s bytes=%d", fromTo, len(data))
    return kafkaProducer.Send(data)
}
```

### 4.2 `ClientRespParse` — 流量分析钩子

```go
type ClientRespParse func(ctx context.Context, DataPaket *proto.Packet) (isContinue bool, err error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | `context.Context` | 含 `FromIP`/`ToIP`/`FromTo`/`ListenType` |
| `DataPaket` | `*proto.Packet` | 当前流的快照 |

| 返回值 | 类型 | 说明 |
|---|---|---|
| `isContinue` | bool | `false` 表示丢弃当前包，不继续记录 |
| `err` | error | 非 nil 时立刻终止流（从 `NetTeeReader.Read` 返回错误） |

> 仅在 `s.startAnalyze.Get() == true` 时才生效，目前没有公开 setter，需要自己向上层提后续 PR 暴露。

### 4.3 `ConnectTarget`

```go
type ConnectTarget func(ctx context.Context, client net.Conn) (net.Conn, error)
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | `context.Context` | 来自 `contextPool` 的复用 ctx |
| `client` | `net.Conn` | 客户端入站连接，可读取 `RemoteAddr` 做路由 |

典型用途：基于 client 信息动态选择上游、TLS 卸载、连接池接入。

```go
server.SetConnectTargetFunc(func(ctx context.Context, client net.Conn) (net.Conn, error) {
    if strings.HasPrefix(client.RemoteAddr().String(), "10.") {
        return net.Dial("tcp", "internal-upstream:8080")
    }
    return tls.Dial("tcp", "external-upstream:443", tlsConfig)
})
```

---

## 5. 完整示例

```go
recordFile, _ := os.Create("./traffic.log")
defer recordFile.Close()

writeFunc := func(data []byte, ctx context.Context) (int, error) {
    fromTo, _ := ctx.Value(getwayServer.FromTo).(string)
    log.Printf("recorded %d bytes from %s", len(data), fromTo)
    return len(data), nil
}

server := getwayServer.NewSimpleTCPServerWithWriterAndFunc(
    "127.0.0.1:8080", // 上游
    ":9000",           // 本地监听
    getwayServer.TCPType,
    recordFile,
    writeFunc,
)

server.SetConnectTargetFunc(func(ctx context.Context, client net.Conn) (net.Conn, error) {
    return net.Dial("tcp", "127.0.0.1:8080")
})

server.StartListen() // 阻塞
```

---

## 6. 常见坑

1. **`NewSimpleTCPServer`（无参版本）** 会在当前目录创建 `log1.txt`，生产环境请用 `NewSimpleTCPServerWithWriterAndFunc` 显式传 writer。
2. **`writeFunc` 优先于 `writer`**：两者都传时只调用 `writeFunc`。需要双写时请自己在 `writeFunc` 里同时写 `writer`。
3. **`StartListen` 直接 `os.Exit`**：嵌入到现有进程时要重写信号处理。
4. **`WriteQueue` 保证写入顺序**：每条 client 连接独立的 `WriteQueue`，跨连接顺序不保证。

---

> 参考：[ConnectResource / ResourceGroup](./connectResource) · [GopacketTrafficMirror](./gopacketMirror)
