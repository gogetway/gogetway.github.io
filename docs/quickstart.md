---
sidebar_position: 1
---

# 快速开始

`gogetway` 是一个用于构建 TCP/HTTP 网关、流量录制、流量重放与被动镜像的 Go 框架。

本页面带你 5 分钟跑通最常用的三种姿势。

---

## 1. 安装

```bash
go get github.com/wangshiben/gogetway
```

> 普通用户只想直接使用现成的二次代理工具，请用 `cmd/tcp-proxy`，参考 [Readme](https://github.com/wangshiben/gogetway/blob/master/Readme.md)。

---

## 2. 主动代理 + 录制

最简单的姿势：监听本地端口，向上游转发，并把流量写入文件。

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
        "127.0.0.1:8080", // 上游
        ":9000",           // 本地监听
        getwayServer.TCPType,
        f,
        writeFunc,
    )

    server.SetConnectTargetFunc(func(ctx context.Context, client net.Conn) (net.Conn, error) {
        return net.Dial("tcp", "127.0.0.1:8080")
    })

    server.StartListen() // 阻塞
}
```

接下来：[SimpleTCPServer 详解](./simpleTCPServer)

---

## 3. 流量回放

将录制好的文件回放到目标服务：

```go
import "github.com/wangshiben/gogetway/tcpPlayback"

count, err := tcpPlayback.ReplayFileToTarget(
    "./traffic.log",
    "127.0.0.1:9999",
    false, // 是否按原始时间间隔回放
    nil,   // 可选 DataParser
)
log.Printf("replayed=%d err=%v", count, err)
```

接下来：[TcpPlayer 详解](./tcpPlayer)

---

## 4. 被动镜像（不改部署）

通过 pcap 抓包对已部署服务做镜像录制 / 旁路转发：

```go
mirror := getwayServer.NewGopacketTrafficMirror(getwayServer.GopacketMirrorConfig{
    ObservedPort: 8090,
    TargetAddr:   "127.0.0.1:18090", // 旁路目标，留空只录不转
    Writer:       recordFile,
})

ctx, cancel := context.WithCancel(context.Background())
defer cancel()
mirror.Start(ctx, mySource) // mySource 实现 ObservedPacketSource
```

接下来：[GopacketTrafficMirror 详解](./gopacketMirror)

---

## 5. 文档导航

| 主题 | 文档 |
|---|---|
| 主动代理（监听 + 转发 + 录制） | [SimpleTCPServer](./simpleTCPServer) |
| 被动镜像（pcap 抓包） | [GopacketTrafficMirror](./gopacketMirror) |
| 流量回放 | [TcpPlayer](./tcpPlayer) |
| 资源池抽象 | [ConnectResource / ResourceGroup](./connectResource) |
| 锁管理 | [LockGroup](./lockgroup) |
| 录制协议格式 | [proto 协议格式](./proto) |
