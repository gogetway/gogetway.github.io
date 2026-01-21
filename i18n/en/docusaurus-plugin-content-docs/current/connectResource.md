## 1. `ConnectResource` Interface

Represents a writable resource bound to a network connection, encapsulating writing capabilities, write queues, and underlying locks.

### Method List

| Method | Description |
|--------|-------------|
| `Writer() io.Writer` | Returns a standard `io.Writer` for direct data writing. |
| `WriteFunc() WriteFunc` | Returns a custom write function (typically used for asynchronous or batch writes), usually with the signature `func([]byte) error`. |
| `WriteQueue() *WriteQueue` | Returns a pointer to the associated write queue for managing pending data buffers. |
| `GetLock() lockMap.Lock` | Gets the underlying lock associated with this resource (for synchronizing write operations or state changes). |
| `WriteType() string` | Returns the write type identifier currently used by the resource (such as `"tcp"`, `"websocket"`, `"buffered"`, etc.), for debugging or routing strategies. |

> **Note**: Commented-out methods like `currentIndex()` indicate that internal index structures were once considered but are currently disabled.

---

## 2. `ResourceGroup` Interface

Used to dynamically create and manage `ConnectResource` instances based on context or origin, implementing resource pooling or on-demand initialization.

### Method List

#### `GetResource(ctx context.Context, Connect net.Conn) (resource ConnectResource, err error)`

- **Function**: Obtain the corresponding `ConnectResource` based on the incoming network connection `net.Conn`.
- **Usage**: Called by the framework when a new connection is established to bind resources.
- **Parameters**:
    - `ctx`: Request context, which can be used to pass metadata or control lifecycle.
    - `Connect`: Underlying network connection (e.g., TCP connection).
- **Returns**:
    - `resource`: Resource instance bound to the connection.
    - `err`: Error if initialization fails.

---

#### `NewResourceFunc(ctx context.Context, From string) NewResourceFunc`

- **Function**: Returns a factory function for creating new `ConnectResource` instances.
- **Usage**: Supports custom resource creation logic based on source (`From`) (e.g., different write strategies for different clients).
- **Parameters**:
    - `ctx`: Context.
    - `From`: Source identifier (such as service name, IP, protocol type, etc.).
- **Returns**:
    - `NewResourceFunc`: Function type, typically with the signature `func(net.Conn) (ConnectResource, error)`.

> **Typical Use Case**:  
> In proxy or gateway services, return different `WriteFunc` or `WriteQueue` configurations based on `From` (e.g., `"internal-service"` vs `"external-client"`).

---

## Additional Notes

- **`WriteFunc` and `WriteQueue` Coordination**:  
  Typically, `WriteFunc` pushes data into `WriteQueue`, which is consumed asynchronously by background goroutines that call `Writer().Write()`, thus avoiding blocking business logic.

- **Thread Safety**:  
  All concurrent write operations to `ConnectResource` should acquire the lock via `GetLock()` or rely on the internal synchronization mechanism of `WriteQueue`.

- **Lifecycle**:  
  The lifecycle of `ConnectResource` is typically consistent with `net.Conn`; when the connection closes, its `WriteQueue` should be cleaned up and lock resources released.