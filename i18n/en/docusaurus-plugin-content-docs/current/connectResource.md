# ConnectResource / ResourceGroup

`ConnectResource` abstracts the "write resource" bound to a TCP connection; `ResourceGroup` is the factory that produces them. Default implementations live in [getwayServer/Resource.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/Resource.go) and [getwayServer/resourceGroup.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/resourceGroup.go), and they work by "map-by-client-address and reuse".

If you need per-tenant isolation, per-client writers, or want to ship traffic into a DB/Kafka, implementing these two interfaces is all you need.

---

## 1. `ConnectResource` Interface

```go
type ConnectResource interface {
    Writer() io.Writer
    WriteFunc() WriteFunc
    WriteQueue() *WriteQueue
    GetLock() lockMap.Lock
    WriteType() string
}
```

| Method | Return | Notes |
|---|---|---|
| `Writer()` | `io.Writer` | Default writer — **only used when `WriteFunc()` returns nil** |
| `WriteFunc()` | `WriteFunc` | Custom write function — **takes precedence over `Writer()`**; called directly when non-nil |
| `WriteQueue()` | `*WriteQueue` | Serial write queue to avoid interleaving across goroutines |
| `GetLock()` | `lockMap.Lock` | Connection lock; used by `IncreaseGetIndex` to generate ordering numbers |
| `WriteType()` | string | Tag only; currently does not affect logic (`"File"` / `"Other"`) |

Default impl: `DefaultResource` — see [getwayServer/Resource.go:8](https://github.com/wangshiben/gogetway/blob/master/getwayServer/Resource.go#L8).

---

## 2. `ResourceGroup` Interface

```go
type ResourceGroup interface {
    io.Closer
    GetResource(ctx context.Context, Connect net.Conn) (ConnectResource, ConnectionCloseHook, error)
    NewResourceFunc(ctx context.Context, From string) NewResourceFunc
}

type NewResourceFunc func(ctx context.Context, From string) (resource ConnectResource, err error)
```

| Method | Inputs | Returns | Notes |
|---|---|---|---|
| `Close()` | none | `error` | Called at process shutdown; flushes / closes the underlying writer |
| `GetResource(ctx, conn)` | ctx + client conn | resource + closeHook + error | One resource per connection (usually reused per client address) |
| `NewResourceFunc(ctx, from)` | ctx + client address | `NewResourceFunc` | Called on the first connection from a new address; produces a fresh `ConnectResource` |

### 2.1 `ConnectionCloseHook`

```go
type ConnectionCloseHook func(resource ConnectResource)
```

Returned alongside the resource by `GetResource`. The main loop in `StartListen` invokes it when each client connection ends.
Default behavior: `lock.Release(1)` — decrements the refcount; the resource becomes reclaimable when `LockGroup.CheckLocks` next runs.

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

## 3. Wiring it In

Two ways to install a custom `ResourceGroup`:

1. Call `server.UpdateResourceGroup(rg)` to swap an existing server's resource group (`rg` must not be nil — otherwise panics).
2. Construct directly with `NewSimpleTcpServerWithResourceGroup(forward, local, listenType, rg)`.

---

## 4. Default Implementation Highlights

- `DefaultResourceGroup` is backed by `lockMap.LockGroup`; it maps + reuses by client address (`net.Conn.RemoteAddr()`).
- Multiple connections from the same address share one `ConnectResource` + write queue, so the on-disk packet order matches the link order.
- When the refcount drops to 0 and the `CheckLocks` cycle elapses, the resource is reclaimed.

---

## 5. Companion: `WriteFunc`, `WriteQueue`

### `WriteFunc`

```go
type WriteFunc func(data []byte, ctx context.Context) (offset int, err error)
```

`data` has already been framed by `proto.WriteProto` (MagicHeader + timestamp + Type + Length + from...to + `\n` + body) — you can write directly to a DB, Kafka, or a custom log format.
`ctx` exposes `ListenType` / `FromIP` / `ToIP` / `FromTo` (constants in [getwayServer/consts.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/consts.go)).

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

Calls `HookWrite` in `Index` order so concurrent writes do not interleave. `Index` comes from `lock.IncreaseGetIndex()`.

---

## 6. Additional Notes

- **Thread safety**: concurrent writes to a `ConnectResource` should go through `GetLock()` or rely on the internal sync of `WriteQueue`.
- **Lifecycle**: a `ConnectResource` typically shares its lifecycle with the set of same-address `net.Conn` instances; `CheckLocks` reclaims it when the refcount reaches 0.
- **Shared with the passive mirror**: `GopacketTrafficMirror` injects the same `FromTo` / `ListenType` / etc. keys into ctx — so one `WriteFunc` can serve both the active proxy and the passive mirror.

---

> See also: [SimpleTCPServer](./simpleTCPServer) · [LockGroup](./lockgroup)
