# Interface Documentation

## 1. `LockGroup` Interface

Used to manage a group of locks (`Lock`), supporting dynamic creation, traversal, filtering, and destruction.

### Method List

#### `GetLockedGroup(ctx context.Context, From string) (nextGroup LockGroup, isContinue bool, err error)`

- **Function**: Get the next sub-lock group.
- **Usage**: Avoid blocking the entire lock system due to frequent lock creation. When the current lock group resources are exhausted, this method can be called to get a new sub-lock group.
- **Parameters**:
    - `ctx`: Context for controlling timeouts or cancellations.
    - `From`: Calling source identifier (such as module name, IP, etc.).
- **Returns**:
    - `nextGroup`: Next available `LockGroup`.
    - `isContinue`: Whether more lock groups can still be obtained (`false` indicates the end).
    - `err`: Error information.

---

#### `GetLock(ctx context.Context, From string) (lock Lock, err error)`

- **Function**: Obtain a lock from the current lock group.
- **Usage**: After obtaining a new `LockGroup`, prioritize attempting to get a specific lock instance using this method.
- **Parameters**: Same as above.
- **Returns**:
    - `lock`: The acquired lock; returns `nil` if no available lock exists.
    - `err`: Error information.

---

#### `NewLockOrGroup(ctx context.Context, From string) (lock Lock, lockGroup LockGroup, err error)`

- **Function**: Create a lock or a lock group (one of two).
- **Recommendation**: Usually only one of these needs to be created to meet requirements.
- **Returns**:
    - If creation is successful, either `lock` or `lockGroup` is non-nil.
    - `err`: Error information.

---

#### `CreateLockGroup(ctx context.Context, From string) (lockGroup LockGroup, err error)`

- **Function**: Explicitly create a new lock group.
- **Trigger Condition**: When `GetLockedGroup` returns `isContinue = false` and `GetLock` returns `nil`, decide whether to create a new lock group.
- **Returns**: A newly created `LockGroup` instance.

---

#### `CreateLock(ctx context.Context, From string) (lock Lock, err error)`

- **Function**: Explicitly create an independent lock.
- **Use Cases**: Directly create a single lock without relying on lock groups.

---

#### `Destroy()`

- **Function**: Destroy the current lock group.
- **Note**: Only call when `CheckLocks` detects that the lock group is not in use. **Exercise caution**, avoid accidentally deleting active lock groups.

---

#### `CanDestroy() bool`

- **Function**: Determine whether the current lock group can be safely destroyed.
- **Returns**: `true` means no active locks, can be destroyed.

---

#### `DefaultLock() RWLock`

- **Function**: Get a default read-write lock.
- **Usage**: Provide a basic lock implementation before calling `NewLockOrGroup`.

---

#### `FilterChains() []FilterChain`

- **Function**: Return a set of packet filter chains.
- **Trigger Time**: Called when entering a new `LockGroup` and packet filtering is enabled.
- **Returns**: An ordered list of `FilterChain` functions to execute sequentially.

---

#### `CheckLocks(ctx context.Context)`

- **Function**: Check the usage status of locks in the lock group.
- **Call Timing**:
    1. When system memory is insufficient;
    2. Periodically executed (such as every 1 minute or 10 minutes, depending on configuration).
- **Function**: Clean up unused locks or lock groups to release resources.

---

## 2. `Lock` Interface

Represents a basic mutex lock supporting state queries, reference counting, and metadata management.

| Method | Description |
|--------|-------------|
| `Lock()` | Acquire exclusive lock (blocking). |
| `Unlock()` | Release the lock. |
| `Other() interface{}` | Get additional metadata object. |
| `UpdateOther(other interface{}) error` | Update metadata, may fail (such as type incompatibility). |
| `IsLocked() bool` | Check if currently locked. |
| `GetIndex() uint64` | Get the unique index of the lock (for tracking). |
| `LastCalled() int64` | Return the last access timestamp (Unix nanoseconds). |
| `Release(count uint)` | Decrease reference count (for reference-counted locks). |
| `CanRelease() bool` | Determine if it can be safely released (reference count is 0, etc.). |
| `IncreaseGetIndex() uint64` | Atomically increment and return the new acquisition index (for debugging/tracking concurrent acquisition counts). |
| `AddRelease()` | Add one "pending release" count (used in conjunction with `Release`). |

---

## 3. `RWLock` Interface

Extends `Lock` to support read-write separation.

| Method | Description |
|--------|-------------|
| `RLock()` | Acquire shared read lock (allows multiple readers). |
| `RUnlock()` | Release read lock. |

> **Inheritance Relationship**: `RWLock` includes all methods of `Lock`, so it also supports exclusive operations such as `Lock()` / `Unlock()`.

---

## 4. `CtxWithValue` Interface

Extends the standard `context.Context` to support runtime dynamic injection of key-value pairs.

| Method | Description |
|--------|-------------|
| `Put(key string, value any)` | Store key-value pairs in the context (not thread-safe, only for use in the current goroutine). |
| `Clear()` | Clear all custom key-value pairs (use with caution). |

> **Note**: This interface is primarily used for internal context enhancement and is not recommended for exposure in public APIs.

---

## 5. `FilterChain` Type