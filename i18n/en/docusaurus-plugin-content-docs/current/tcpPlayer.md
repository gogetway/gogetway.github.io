# TcpPlayer

## Overview

`TcpPlayer` replays traffic recorded by `gogetway` back to a target service. It supports timestamp-driven inter-packet delays and a `DataParser` hook for mutating each packet before sending — useful for regression tests, traffic shadowing, and load reproduction.

Source: [tcpPlayback/tcpPlayer.go](https://github.com/wangshiben/gogetway/blob/master/tcpPlayback/tcpPlayer.go)

---

## 1. Struct

```go
type TcpPlayer struct {
    Target           string         // target address (matches `To` in the recording)
    Client           string         // client address (matches `From` in the recording); may be empty
    clientConn       net.Conn       // private: client-side connection
    targetConn       net.Conn       // private: target-side connection
    replayTime       bool           // whether to honor original inter-packet timing
    clientTimeRecord lockMap.Lock   // private: timing bookkeeping
    targetTimeRecord lockMap.Lock   // private: timing bookkeeping
}
```

> **Conventions**:
> - Each recorded packet carries a `from...to` field; `Target` / `Client` are matched against those fields to decide which connection to write to.
> - When `replayTime = true`, the internal `wait` function sleeps for the time delta between adjacent packets at millisecond precision.

---

## 2. Type: `DataParser`

```go
type DataParser func(data *proto.Packet) (*proto.Packet, error)
```

| Param | Type | Notes |
|---|---|---|
| `data` | `*proto.Packet` | Deserialized packet; fields may be mutated |

| Return | Type | Notes |
|---|---|---|
| `*proto.Packet` | `*proto.Packet` | Returning `nil` skips the packet |
| `err` | error | Non-nil is logged only; replay continues with the next packet |

Typical uses: rewrite the original target address, replace tokens, sample by ratio.

```go
parser := func(p *proto.Packet) (*proto.Packet, error) {
    p.Data = bytes.ReplaceAll(p.Data, []byte("Bearer old-token"), []byte("Bearer new-token"))
    p.To = "127.0.0.1:9999"
    return p, nil
}
```

---

## 3. Constructor and Methods

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

| Param | Type | Notes |
|---|---|---|
| `target` | string | Target-address string (used to match `packet.To`) |
| `targetConnect` | `net.Conn` | Established target connection; may be nil (only with `SendSinglePacket`) |
| `Client` | string | Client identifier (used to match `packet.From`) |
| `ClientConn` | `net.Conn` | Client connection; may be nil |
| `replayTime` | bool | When true, sleeps according to original inter-packet timing |

---

### 3.2 `ReplayToTarget` (recommended)

```go
func (t *TcpPlayer) ReplayToTarget(
    reader io.Reader,
    recordedTo string,
    parser DataParser,
) (int, error)
```

| Param | Type | Notes |
|---|---|---|
| `reader` | `io.Reader` | Recording stream |
| `recordedTo` | string | The original target string in the recording; only packets where `packet.To == recordedTo` are replayed |
| `parser` | `DataParser` | Optional pre-send mutator |

| Return | Type | Notes |
|---|---|---|
| first | int | Number of packets successfully replayed |
| second | error | First write error, an argument error (e.g. `recordedTo == ""`), or "no packet matched" |

---

### 3.3 `ReplayFileToTarget` (one-liner)

```go
func ReplayFileToTarget(
    filePath, target string,
    replayTime bool,
    parser DataParser,
) (int, error)
```

| Param | Type | Notes |
|---|---|---|
| `filePath` | string | Path to the recording file |
| `target` | string | The actual dial target (may differ from the address used during recording) |
| `replayTime` | bool | Whether to honor original timing |
| `parser` | `DataParser` | Optional pre-send mutator |

Internally calls `DetectRecordedTargetFromFile` to infer `recordedTo`.

---

### 3.4 `DetectRecordedTargetFromFile`

```go
func DetectRecordedTargetFromFile(filePath string) (string, error)
```

Scans the file, counts occurrences of each `packet.To`, and returns the most frequent value — used to auto-detect "the target address present at recording time".

---

### 3.5 `SendSinglePacket` (not recommended)

```go
func (t *TcpPlayer) SendSinglePacket(reader io.Reader, to string, parser DataParser)
```

Legacy API that only sends in one direction. Read errors `panic` directly — **avoid in production**. Prefer `ReplayToTarget`.

---

## 4. Timed Replay

`NewTCPPlayer(..., replayTime=true)`: sleeps according to the time delta between adjacent packets to simulate the original timing. See the `wait` function in `tcpPlayback/tcpPlayer.go`.

> **Note**: `wait` stores a `map[string]int64` inside each `lockMap.Lock`'s `Other()` to track the previous packet time. If your custom lock implementation forbids `UpdateOther` from overwriting a map, it will panic.

---

## 5. Examples

### 5.1 One-liner: replay a whole recording

```go
parser := func(p *proto.Packet) (*proto.Packet, error) {
    // Token rewrite, target rewrite, etc.
    p.Data = bytes.ReplaceAll(p.Data, []byte("Bearer old"), []byte("Bearer new"))
    return p, nil
}

count, err := tcpPlayback.ReplayFileToTarget(
    "./traffic.log",
    "127.0.0.1:9999",
    false, // ignore original timing
    parser,
)
if err != nil {
    log.Fatal(err)
}
log.Printf("replayed %d packets", count)
```

### 5.2 Manual connection control + streaming replay

```go
targetConn, _ := net.Dial("tcp", "127.0.0.1:9999")
defer targetConn.Close()

player := tcpPlayback.NewTCPPlayer(
    "127.0.0.1:8080", // recorded target string (for matching)
    targetConn,
    "",  // no client direction
    nil,
    true, // honor original timing
)

f, _ := os.Open("./traffic.log")
defer f.Close()

count, err := player.ReplayToTarget(f, "127.0.0.1:8080", nil)
log.Printf("replayed=%d err=%v", count, err)
```

---

## 6. Notes

1. **Connection lifecycle**: the caller owns `clientConn` / `targetConn`; `TcpPlayer` does not close them.
2. **Thread safety**: `lockMap.Lock` protects timing state, but `TcpPlayer` itself is not fully thread-safe — drive each instance from a single goroutine.
3. **Replay precision**: with `replayTime=true`, delays are millisecond-granular; sub-millisecond timing is lost.
4. **Multi-target recordings**: if the recording contains packets to several targets, `ReplayFileToTarget` only replays the most frequent `packet.To`. For finer control, decode manually with `proto.ReadProtoFromReader` + `proto.UnMarshal`.

---

> See also: [proto.Packet format](./proto) · [SimpleTCPServer (recording)](./simpleTCPServer)
