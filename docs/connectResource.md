# ConnectResource / ResourceGroup

`ConnectResource` 是每条 TCP 连接绑定的"写资源"抽象，`ResourceGroup` 是产生它们的工厂。
默认实现位于 [getwayServer/Resource.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/Resource.go) 与 [getwayServer/resourceGroup.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/resourceGroup.go)，按"按客户端地址映射并复用"工作。

如果你需要按租户隔离、给不同客户端用不同 writer、或者把数据写入 DB/Kafka，只需实现这两个接口即可。

---

## 1. `ConnectResource` 接口

```go
type ConnectResource interface {
    Writer() io.Writer
    WriteFunc() WriteFunc
    WriteQueue() *WriteQueue
    GetLock() lockMap.Lock
    WriteType() string
}
```

| 方法 | 返回值 | 用途 |
|---|---|---|
| `Writer()` | `io.Writer` | 默认 writer，**仅在 `WriteFunc()` 返回 nil 时使用** |
| `WriteFunc()` | `WriteFunc` | 自定义写入函数，**优先级高于 `Writer()`**；非 nil 时直接调用它 |
| `WriteQueue()` | `*WriteQueue` | 串行写入队列，保证多 goroutine 不穿插 |
| `GetLock()` | `lockMap.Lock` | 连接锁，用于 `IncreaseGetIndex` 生成顺序号 |
| `WriteType()` | string | 标识用，目前不参与逻辑（如 `"File"`/`"Other"`） |

默认实现：`DefaultResource`，见 [getwayServer/Resource.go:8](https://github.com/wangshiben/gogetway/blob/master/getwayServer/Resource.go#L8)。

---

## 2. `ResourceGroup` 接口

```go
type ResourceGroup interface {
    io.Closer
    GetResource(ctx context.Context, Connect net.Conn) (ConnectResource, ConnectionCloseHook, error)
    NewResourceFunc(ctx context.Context, From string) NewResourceFunc
}

type NewResourceFunc func(ctx context.Context, From string) (resource ConnectResource, err error)
```

| 方法 | 入参 | 返回值 | 用途 |
|---|---|---|---|
| `Close()` | 无 | `error` | 进程退出时被调用，负责 flush/关闭底层 writer |
| `GetResource(ctx, conn)` | ctx + 客户端连接 | resource + closeHook + error | 每条连接获取一份资源，通常按地址复用 |
| `NewResourceFunc(ctx, from)` | ctx + 客户端地址 | `NewResourceFunc` | 在该地址首次创建时被调用，生成新的 `ConnectResource` |

### 2.1 `ConnectionCloseHook`

```go
type ConnectionCloseHook func(resource ConnectResource)
```

由 `GetResource` 一并返回，每条 client 连接结束时由 `StartListen` 主循环调用。
默认实现：`lock.Release(1)` —— 引用计数减 1，触发 `LockGroup.CheckLocks` 时可被回收。

```go
func (g *CustomResourceGroup) GetResource(ctx context.Context, conn net.Conn) (ConnectResource, ConnectionCloseHook, error) {
    res := newResource()
    return res, func(r ConnectResource) {
        res.Flush()
        metrics.Inc("connection_closed")
    }, nil
}
```

---

## 3. 注入方式

有两种方式接入自定义 `ResourceGroup`：

1. 调用 `server.UpdateResourceGroup(rg)` 替换已有 server 的资源组（`rg` 不能为 nil，否则 panic）；
2. 直接用 `NewSimpleTcpServerWithResourceGroup(forward, local, listenType, rg)` 构造 server。

---

## 4. 默认实现要点

- `DefaultResourceGroup` 基于 `lockMap.LockGroup`，按 client 地址（`net.Conn.RemoteAddr()`）映射并复用资源。
- 同一地址多次连接共享同一份 `ConnectResource` + 写队列，保证文件中包顺序一致。
- 引用计数为 0 且超过 `CheckLocks` 周期时，资源会被回收。

---

## 5. 配套：`WriteFunc`、`WriteQueue`

### `WriteFunc`

```go
type WriteFunc func(data []byte, ctx context.Context) (offset int, err error)
```

`data` 已经过 `proto.WriteProto` 封装（MagicHeader+时间戳+Type+长度+from...to+\n+正文），可直接落库 / 发 Kafka / 自定义日志格式。
`ctx` 可读出 `ListenType` / `FromIP` / `ToIP` / `FromTo`（常量见 [getwayServer/consts.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/consts.go)）。

```go
writeFunc := func(data []byte, ctx context.Context) (int, error) {
    fromTo, _ := ctx.Value(getwayServer.FromTo).(string)
    log.Printf("link=%s bytes=%d", fromTo, len(data))
    return kafkaProducer.Send(data)
}
```

### `WriteQueue`

```go
func NewWriteQueue(ctx context.Context) *WriteQueue
func (w *WriteQueue) AddItem(ctx context.Context, Data []byte, Index uint64, HookWrite WriteFunc)
```

按 `Index` 顺序串行调用 `HookWrite`，保证多 goroutine 写入不穿插。`Index` 由 `lock.IncreaseGetIndex()` 提供。

---

## 6. 补充说明

- **线程安全**：所有对 `ConnectResource` 的并发写应通过 `GetLock()` 获取锁，或依赖 `WriteQueue` 的内部同步。
- **生命周期**：`ConnectResource` 通常与一组同地址的 `net.Conn` 共享生命周期，引用计数为 0 后由 `CheckLocks` 回收。
- **被动镜像复用**：`GopacketTrafficMirror` 注入的 ctx 也带 `FromTo` 等 key，同一份 `WriteFunc` 可同时给主动代理和被动镜像使用。

---

> 参考：[SimpleTCPServer](./simpleTCPServer) · [LockGroup](./lockgroup)
