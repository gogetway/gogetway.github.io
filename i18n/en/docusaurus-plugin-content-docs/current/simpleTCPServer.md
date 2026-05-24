# SimpleTCPServer — Active Proxy

`SimpleTCPServer` listens on a local port, accepts client connections, dials an upstream, then bidirectionally copies traffic while recording it (in serial order) to any `io.Writer` / `WriteFunc`. This is the core of the active-proxy mode in `gogetway`.

Source: [getwayServer/simpleTCPserver.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/simpleTCPserver.go)

---

## 1. Struct

```go
type SimpleTCPServer struct {
    Forward          string                  // upstream forward address, e.g. "127.0.0.1:8080"
    Port             string                  // local listen address, e.g. ":9000"
    ListenType       Types.ClientType        // protocol type: TCPType=1 / HTTPType=2
    WriteType        string                  // reserved write-type tag (File / Other)
    ClientRespParse  ClientRespParse         // client-direction traffic-analysis hook
    ForwardRespParse ClientRespParse         // forward-direction traffic-analysis hook
    Writer           *os.File                // default writer (already wrapped by ResourceGroup, prefer WithWriterAndFunc constructor)

    // private fields omitted
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `Forward` | string | yes | Upstream target, used by `net.Dial("tcp", ...)` |
| `Port` | string | yes | Local listen address, must include colon (`":9000"`) |
| `ListenType` | `Types.ClientType` | yes | One of `getwayServer.TCPType` / `HTTPType`; affects packet-format tag |
| `ClientRespParse` | `ClientRespParse` | no | Hook on the client→upstream direction; needs `startAnalyze` enabled |
| `ForwardRespParse` | `ClientRespParse` | no | Hook on the upstream→client direction |
| `Writer` | `*os.File` | no | Deprecated; prefer the constructor variants |

---

## 2. Constructors

### 2.1 `NewSimpleTCPServer`

```go
func NewSimpleTCPServer(ForwardAdd, LocalAdd string, ListenType Types.ClientType) *SimpleTCPServer
```

Simplest constructor; creates `log1.txt` in the current directory as the record file. **Not recommended in production** — pollutes the working directory.

### 2.2 `NewSimpleTCPServerWithWriterAndFunc` (recommended)

```go
func NewSimpleTCPServerWithWriterAndFunc(
    ForwardAdd, LocalAdd string,
    ListenType Types.ClientType,
    writer io.Writer,
    writeFunc WriteFunc,
) *SimpleTCPServer
```

| Param | Type | Notes |
|---|---|---|
| `ForwardAdd` | string | Upstream address |
| `LocalAdd` | string | Local listen address |
| `ListenType` | `Types.ClientType` | Listen type |
| `writer` | `io.Writer` | Default writer; pass `io.Discard` to disable persistence |
| `writeFunc` | `WriteFunc` | Custom writer; **takes precedence over `writer`** (when non-nil, only this is invoked) |

### 2.3 `NewSimpleTCPServerWithLockGroup`

```go
func NewSimpleTCPServerWithLockGroup(
    ForwardAdd, LocalAdd string,
    ListenType Types.ClientType,
    lockGroup lockMap.LockGroup,
) *SimpleTCPServer
```

For scenarios that need custom lock allocation (per-tenant isolation, throttling, etc.).

### 2.4 `NewSimpleTcpServerWithResourceGroup`

```go
func NewSimpleTcpServerWithResourceGroup(
    ForwardAdd, LocalAdd string,
    ListenType Types.ClientType,
    group ResourceGroup,
) *SimpleTCPServer
```

Use this when you want full control over the resource pool (connection-pool integration, per-tenant file split, etc.).

---

## 3. Instance Methods

### 3.1 `StartListen()`

```go
func (s *SimpleTCPServer) StartListen()
```

- Inputs: none
- Returns: none (blocks until receiving SIGINT/SIGTERM, then calls `os.Exit(0)`)
- Side effects: listens on `s.Port`, spawns a goroutine per connection

> **Heads up**: `StartListen` installs a signal handler internally and calls `os.Exit` directly. If you embed this in your own process, you need to reimplement that section using an upstream `context`.

### 3.2 `SetConnectTargetFunc(connectFunc ConnectTarget)`

```go
func (s *SimpleTCPServer) SetConnectTargetFunc(connectFunc ConnectTarget)
```

Injects custom "dial upstream" logic. See [ConnectTarget](#43-connecttarget).

### 3.3 `UpdateResourceGroup(resourceGroup ResourceGroup)`

```go
func (s *SimpleTCPServer) UpdateResourceGroup(resourceGroup ResourceGroup)
```

- Inputs: `resourceGroup` must not be nil (otherwise panics)
- Use: replace the default `DefaultResourceGroup` before starting

---

## 4. Hook Types

### 4.1 `WriteFunc` — Custom Write Behavior

```go
type WriteFunc func(data []byte, ctx context.Context) (offset int, err error)
```

| Param | Type | Notes |
|---|---|---|
| `data` | `[]byte` | Byte stream already wrapped by `proto.WriteProto` |
| `ctx` | `context.Context` | Lets you read `ListenType` / `FromIP` / `ToIP` / `FromTo` (see [getwayServer/consts.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/consts.go)) |

| Return | Type | Notes |
|---|---|---|
| `offset` | int | Bytes written (need not be exact; used only for logging) |
| `err` | error | Non-nil: logged only, does not interrupt traffic |

Typical use: write to a database, Kafka, custom log format, per-link file split.

```go
writeFunc := func(data []byte, ctx context.Context) (int, error) {
    fromTo, _ := ctx.Value(getwayServer.FromTo).(string)
    log.Printf("link=%s bytes=%d", fromTo, len(data))
    return kafkaProducer.Send(data)
}
```

### 4.2 `ClientRespParse` — Traffic-Analysis Hook

```go
type ClientRespParse func(ctx context.Context, DataPaket *proto.Packet) (isContinue bool, err error)
```

| Param | Type | Notes |
|---|---|---|
| `ctx` | `context.Context` | Carries `FromIP` / `ToIP` / `FromTo` / `ListenType` |
| `DataPaket` | `*proto.Packet` | Snapshot of the current stream |

| Return | Type | Notes |
|---|---|---|
| `isContinue` | bool | `false` drops the current packet (no record/forward) |
| `err` | error | Non-nil: terminates the stream immediately (error surfaces in `NetTeeReader.Read`) |

> Only fires when `s.startAnalyze.Get() == true`. There is no public setter today — you would need to wire it through an upstream PR.

### 4.3 `ConnectTarget`

```go
type ConnectTarget func(ctx context.Context, client net.Conn) (net.Conn, error)
```

| Param | Type | Notes |
|---|---|---|
| `ctx` | `context.Context` | Reused ctx from `contextPool` |
| `client` | `net.Conn` | Inbound client connection; read `RemoteAddr` for routing |

Typical use: pick upstream based on client info, TLS termination, connection-pool integration.

```go
server.SetConnectTargetFunc(func(ctx context.Context, client net.Conn) (net.Conn, error) {
    if strings.HasPrefix(client.RemoteAddr().String(), "10.") {
        return net.Dial("tcp", "internal-upstream:8080")
    }
    return tls.Dial("tcp", "external-upstream:443", tlsConfig)
})
```

---

## 5. End-to-End Example

```go
recordFile, _ := os.Create("./traffic.log")
defer recordFile.Close()

writeFunc := func(data []byte, ctx context.Context) (int, error) {
    fromTo, _ := ctx.Value(getwayServer.FromTo).(string)
    log.Printf("recorded %d bytes from %s", len(data), fromTo)
    return len(data), nil
}

server := getwayServer.NewSimpleTCPServerWithWriterAndFunc(
    "127.0.0.1:8080",
    ":9000",
    getwayServer.TCPType,
    recordFile,
    writeFunc,
)

server.SetConnectTargetFunc(func(ctx context.Context, client net.Conn) (net.Conn, error) {
    return net.Dial("tcp", "127.0.0.1:8080")
})

server.StartListen() // blocks
```

---

## 6. Common Pitfalls

1. **`NewSimpleTCPServer` (paramless)** creates `log1.txt` in the working directory. In production, use `NewSimpleTCPServerWithWriterAndFunc` and pass the writer explicitly.
2. **`writeFunc` overrides `writer`**: if both are passed, only `writeFunc` is called. If you want both, write to `writer` from inside `writeFunc`.
3. **`StartListen` calls `os.Exit` directly** — when embedding into an existing process, rewrite the signal handling.
4. **`WriteQueue` guarantees per-connection ordering**: each client connection gets its own `WriteQueue`; cross-connection ordering is not guaranteed.

---

> See also: [ConnectResource / ResourceGroup](./connectResource) · [GopacketTrafficMirror](./gopacketMirror)
