---
sidebar_position: 1
---

# Quick Start

`gogetway` is a Go framework for building TCP/HTTP gateways with traffic recording, replay, and passive mirroring.

This page walks you through the three most common usage patterns in 5 minutes.

---

## 1. Install

```bash
go get github.com/wangshiben/gogetway
```

> If you just want a ready-made proxy CLI, use `cmd/tcp-proxy` — see the [Readme](https://github.com/wangshiben/gogetway/blob/master/Readme.md).

---

## 2. Active Proxy + Recording

The simplest pattern: listen on a local port, forward to an upstream, and persist traffic to a file.

```go
package main

import (
    "context"
    "log"
    "net"
    "os"

    "github.com/wangshiben/gogetway/getwayServer"
)

func main() {
    f, _ := os.Create("./traffic.log")
    defer f.Close()

    writeFunc := func(data []byte, ctx context.Context) (int, error) {
        log.Printf("recorded %d bytes", len(data))
        return len(data), nil
    }

    server := getwayServer.NewSimpleTCPServerWithWriterAndFunc(
        "127.0.0.1:8080", // upstream
        ":9000",           // local listen
        getwayServer.TCPType,
        f,
        writeFunc,
    )

    server.SetConnectTargetFunc(func(ctx context.Context, client net.Conn) (net.Conn, error) {
        return net.Dial("tcp", "127.0.0.1:8080")
    })

    server.StartListen() // blocking
}
```

Next: [SimpleTCPServer in depth](./simpleTCPServer)

---

## 3. Traffic Replay

Replay a recorded file to a target service:

```go
import "github.com/wangshiben/gogetway/tcpPlayback"

count, err := tcpPlayback.ReplayFileToTarget(
    "./traffic.log",
    "127.0.0.1:9999",
    false, // whether to honor original inter-packet timing
    nil,   // optional DataParser
)
log.Printf("replayed=%d err=%v", count, err)
```

Next: [TcpPlayer in depth](./tcpPlayer)

---

## 4. Passive Mirror (Zero-Deploy)

Use pcap-based capture to mirror or sidecar-record an already-deployed service:

```go
mirror := getwayServer.NewGopacketTrafficMirror(getwayServer.GopacketMirrorConfig{
    ObservedPort: 8090,
    TargetAddr:   "127.0.0.1:18090", // sidecar target; empty = record only
    Writer:       recordFile,
})

ctx, cancel := context.WithCancel(context.Background())
defer cancel()
mirror.Start(ctx, mySource) // mySource implements ObservedPacketSource
```

Next: [GopacketTrafficMirror in depth](./gopacketMirror)

---

## 5. Doc Index

| Topic | Page |
|---|---|
| Active proxy (listen + forward + record) | [SimpleTCPServer](./simpleTCPServer) |
| Passive mirror (pcap capture) | [GopacketTrafficMirror](./gopacketMirror) |
| Traffic replay | [TcpPlayer](./tcpPlayer) |
| Resource-pool abstraction | [ConnectResource / ResourceGroup](./connectResource) |
| Lock management | [LockGroup](./lockgroup) |
| Recording protocol format | [proto format](./proto) |
