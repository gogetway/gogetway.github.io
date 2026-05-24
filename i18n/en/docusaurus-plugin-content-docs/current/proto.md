# proto — Recording Format and Codec

`gogetway` serializes all captured byte streams into one file using a custom binary format. The `proto` package handles writing and parsing.

Source: [proto/writeProto.go](https://github.com/wangshiben/gogetway/blob/master/proto/writeProto.go) · [proto/readProto.go](https://github.com/wangshiben/gogetway/blob/master/proto/readProto.go)

---

## 1. Binary Layout

```
MagicHeader("--benbens--\nt") + TimeStamp(8B LE) + Type(1B) + Length(8B LE) + "from...to" + "\n" + Body
```

| Segment | Length | Notes |
|---|---|---|
| MagicHeader | 13B | Constant `--benbens--\nt`; acts as a frame delimiter |
| TimeStamp | 8B | Unix nanoseconds, little-endian |
| Type | 1B | `Types.ClientType` (TCP=1 / HTTP=2, etc.) |
| Length | 8B | Body length, little-endian |
| FromTo | variable | `from-host:port...to-host:port` |
| `\n` | 1B | Separator |
| Body | Length B | Raw bytes |

> **Escaping**: if the body contains `\nt`, `handleDataBody` replaces it with `\n\nt` to avoid colliding with the MagicHeader; `UnMarshal` restores it via `removeNewlineAfter`.

---

## 2. `Packet` Struct

```go
type Packet struct {
    Data         []byte           // restored payload
    Type         Types.ClientType // matches the ListenType used during recording
    From         string           // source address
    To           string           // destination address
    reqTimestamp int64            // private: nanosecond timestamp at record time
}

func (p *Packet) Marshal() []byte
func (p *Packet) Timestamp() int64
func NewPacket(data []byte, From, To string, PacketType Types.ClientType) *Packet
```

> **Note**: `reqTimestamp` is private. `NewPacket`-constructed packets always return 0 from `Timestamp()`; only packets produced by `UnMarshal` carry the real timestamp.

---

## 3. Key Functions

### 3.1 `WriteProto`

```go
func WriteProto(src []byte, PacType Types.ClientType, FromTo string) []byte
```

| Param | Type | Notes |
|---|---|---|
| `src` | `[]byte` | Raw payload |
| `PacType` | `Types.ClientType` | Packet type |
| `FromTo` | string | e.g. `"127.0.0.1:54321...127.0.0.1:8080"` |

Returns: a framed byte stream ready to be written to a file.

### 3.2 `UnMarshal`

```go
func UnMarshal(data []byte) (*Packet, error)
```

| Param | Type | Notes |
|---|---|---|
| `data` | `[]byte` | One complete recording chunk (as emitted by `ReadProtoFromReader`) |

| Return | Type | Notes |
|---|---|---|
| `*Packet` | `*Packet` | Parsed packet |
| `err` | error | `"packet too short"` / `"not my packet"` / `"packet length error"` etc. |

### 3.3 `ReadProtoFromReader`

```go
func ReadProtoFromReader(reader io.Reader) (*bufio.Scanner, error)
```

| Param | Type | Notes |
|---|---|---|
| `reader` | `io.Reader` | Any stream (file / network) |

| Return | Type | Notes |
|---|---|---|
| `*bufio.Scanner` | `*bufio.Scanner` | Each `Scan()` yields one complete packet bytes (including MagicHeader); max single-packet size is 64MB |
| `err` | error | Always nil in the current implementation |

---

## 4. Typical Read Loop

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

## 5. `Pack` Interface

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

`*proto.Packet` partially implements this (`Marshal` / `Timestamp`); the rest are accessed via struct fields directly.
To swap in another recording format (pcapng, JSON Lines, etc.), keep the read/write pair shape and the other modules — all of which work over `[]byte` / `*Packet` — keep working unchanged.

---

## 6. Context Key Cheat Sheet

When the active proxy writes, the keys available on `context.Context` are defined in [getwayServer/consts.go](https://github.com/wangshiben/gogetway/blob/master/getwayServer/consts.go):

```go
const (
    ListenType = "ListenType"  // value: Types.ClientType
    FromTo     = "FromTo"      // value: "from-host:port...to-host:port"
    FromIP     = "FromIP"      // value: "host:port"
    ToIP       = "ToIP"        // value: "host:port"
)
```

Reading them:

```go
writeFunc := func(data []byte, ctx context.Context) (int, error) {
    fromTo, _ := ctx.Value(getwayServer.FromTo).(string)
    listenType, _ := ctx.Value(getwayServer.ListenType).(Types.ClientType)
    _ = listenType
    return n, nil
}
```

The passive mirror injects the same four keys, so one `WriteFunc` can be reused by both the active proxy and the mirror.

---

> See also: [SimpleTCPServer](./simpleTCPServer) · [TcpPlayer](./tcpPlayer)
