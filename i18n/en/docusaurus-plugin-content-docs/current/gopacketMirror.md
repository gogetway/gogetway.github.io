# GopacketTrafficMirror — Passive Mirror

The passive mirror captures traffic on any port without changing the existing deployment (pcap / AF_PACKET / eBPF). Packets are captured via gopacket and reassembled with tcpassembly, then forwarded / recorded through pluggable hooks.

Source: [getwayServer/gopacket_mirror.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/gopacket_mirror.go)

---

## 1. Config: `GopacketMirrorConfig`

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

| Field | Type | Required | Notes |
|---|---|---|---|
| `ObservedPort` | uint16 | yes | Port of the observed service; drives `TrafficDirection`. When 0, every direction becomes `unknown` and is dropped |
| `TargetAddr` | string | no | Forward target; empty string disables forwarding (record-only) |
| `Writer` | `io.Writer` | one of | Record writer; mutually exclusive with `WriteFunc` |
| `WriteFunc` | `WriteFunc` | one of | Custom writer; takes precedence over `Writer` when non-nil |
| `ForwardHook` | `TrafficMirrorHook` | no | Forward-direction hook; defaults to `DefaultForwardTrafficMirrorHook` (forwards only client→observed direction) |
| `RecordHook` | `TrafficMirrorHook` | no | Record-direction hook; defaults to `DefaultRecordTrafficMirrorHook` (records only client→observed direction) |
| `DialContext` | dial func | no | Dialer for forwarding; defaults to `&net.Dialer{Timeout: 5*time.Second}.DialContext` |

Behavioral contracts:

- When both `Writer` and `WriteFunc` are nil, no record write happens — but `RecordHook` still fires (useful for side-channel export).
- When `TargetAddr` is empty, forwarding is skipped — and `ForwardHook` is not called.

---

## 2. Construct and Start

### 2.1 `NewGopacketTrafficMirror`

```go
func NewGopacketTrafficMirror(config GopacketMirrorConfig) *GopacketTrafficMirror
```

Fills in defaults for missing `ForwardHook` / `RecordHook` / `DialContext`.

### 2.2 `Start`

```go
func (m *GopacketTrafficMirror) Start(ctx context.Context, source ObservedPacketSource) error
```

| Param | Type | Notes |
|---|---|---|
| `ctx` | `context.Context` | On cancel: flushes the assembler and returns `ctx.Err()` |
| `source` | `ObservedPacketSource` | Capture source; nil returns `errors.New("packet source is nil")` |

| Return | Notes |
|---|---|
| `error` | First error from ctx cancel, source close, hook, or write |

> `source.Close()` is `defer`-ed inside `Start` — the caller does not need to close it manually.

---

## 3. Hook: `TrafficMirrorHook`

```go
type TrafficMirrorHook interface {
    Handle(ctx context.Context, chunk *ObservedTrafficChunk) (data []byte, keep bool, err error)
}

type TrafficMirrorHookFunc func(ctx context.Context, chunk *ObservedTrafficChunk) (data []byte, keep bool, err error)
func (f TrafficMirrorHookFunc) Handle(ctx context.Context, chunk *ObservedTrafficChunk) ([]byte, bool, error)
```

| Param | Type | Notes |
|---|---|---|
| `ctx` | `context.Context` | Root ctx from `Start` |
| `chunk` | `*ObservedTrafficChunk` | Reassembled, single-direction traffic |

| Return | Type | Notes |
|---|---|---|
| `data` | `[]byte` | Either the original `chunk.Data` or a modified copy; length 0 skips this write/forward |
| `keep` | bool | `false` drops the chunk |
| `err` | error | Non-nil aborts the entire `Start` |

### `ObservedTrafficChunk`

```go
type ObservedTrafficChunk struct {
    Data      []byte           // reassembled contiguous bytes
    From      string           // source host:port
    To        string           // destination host:port
    Direction TrafficDirection // to_observed / from_observed / unknown
    Type      Types.ClientType // defaults to TCPType
    SeenAt    time.Time        // capture timestamp
}
```

`TrafficDirection` values:

- `TrafficDirectionToObserved` — client → observed service
- `TrafficDirectionFromObserved` — observed service → client
- `TrafficDirectionUnknown` — port did not match; usually dropped

---

## 4. Default Hooks

| Name | Behavior |
|---|---|
| `DefaultTrafficMirrorHook` | Keep everything; one copy |
| `DefaultForwardTrafficMirrorHook` | Keep only `TrafficDirectionToObserved`; drop the rest |
| `DefaultRecordTrafficMirrorHook` | Same as above (records only the request direction) |

Want to record both directions? Swap `RecordHook` for `DefaultTrafficMirrorHook{}`.

---

## 5. Capture Source: `ObservedPacketSource`

```go
type ObservedPacketSource interface {
    Packets() <-chan gopacket.Packet
    Close() error
}
```

The base abstraction is not tied to any specific capture impl — plug in:

- pcap (see `cmd/tcp-proxy/live_capture.go`)
- AF_PACKET / eBPF
- pcap file replay
- An in-memory channel for tests — use `NewChannelObservedPacketSource(ch)`

### `NewChannelObservedPacketSource`

```go
func NewChannelObservedPacketSource(packets <-chan gopacket.Packet) *ChannelObservedPacketSource
```

`Close()` on the returned value is a no-op; the channel lifecycle is owned by the caller.

---

## 6. End-to-End Example

```go
recordFile, _ := os.Create("./mirror.log")
defer recordFile.Close()

mirror := getwayServer.NewGopacketTrafficMirror(getwayServer.GopacketMirrorConfig{
    ObservedPort: 8090,
    TargetAddr:   "127.0.0.1:18090",
    Writer:       recordFile,

    // Inject an X-Mirror header before forwarding, but only for the request direction
    ForwardHook: getwayServer.TrafficMirrorHookFunc(func(ctx context.Context, chunk *getwayServer.ObservedTrafficChunk) ([]byte, bool, error) {
        if chunk.Direction != getwayServer.TrafficDirectionToObserved {
            return nil, false, nil
        }
        injected := bytes.Replace(chunk.Data, []byte("\r\n\r\n"), []byte("\r\nX-Mirror: 1\r\n\r\n"), 1)
        return injected, true, nil
    }),

    // Strip the Authorization header before recording
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

## 7. Common Pitfalls

1. **`WriteFunc` is serialized by default**: the passive mirror uses a global `recordMu` mutex, unlike the active proxy where each connection has its own `WriteQueue`. If your `WriteFunc` is already concurrency-safe, that mutex can become a main-thread bottleneck — removing it requires a source edit.
2. **Modifying `data` in `ForwardHook` does not affect `RecordHook`**: `Reassembled` makes a copy between the two hooks.
3. **`ObservedPacketSource.Packets()` channel must be closed** for `Start` to return cleanly — `Close()` alone is not enough.
4. **`ObservedPort = 0`** makes every direction `unknown`, so all traffic is dropped — always set it explicitly.

---

> See also: [SimpleTCPServer](./simpleTCPServer) · [proto format](./proto)
