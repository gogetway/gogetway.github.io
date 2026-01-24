# 快速开始

## 开发快速引导

使用 `getwayserver.NewSimpleTCPServer` 函数创建一个简单的TCP流量转发服务器。

`TCPServer` 的结构如下:

```go
// SimpleTCPServer : Simple TCP Server 简单TCP转发服务，实现监听，转发，写入功能
type SimpleTCPServer struct {
	// Forward : Forward IP 转发地址
	Forward string
	// Port : Listen Port 本地监听端口
	Port string
	// ListenType : Listen Type 监听类型: TCP / HTTP
	ListenType Types.ClientType
	// WriteType : Write Type 写入类型: File / Other TODO: // File类型和Other类型待实现，自定义写入方式写入/插件化接入
	WriteType string
	// ClientRespParse : Client Response Parse 客户端响应解析函数 TODO: 当startAnalyze时候才启用
	ClientRespParse ClientRespParse
	// ForwardRespParse : Forward Response Parse 转发响应解析函数 TODO: 当startAnalyze时候才启用
	ForwardRespParse ClientRespParse
	// default Writer in your disk as default writer
	Writer *os.File //TODO: multi writer

	startAnalyze *UsefullStructs.LockValue[bool] // analyze

	listener      net.Listener
	resourceGroup ResourceGroup
	bufferPool    *UsefullStructs.BufferPool
	contextPool   *UsefullStructs.ContextPool

	writeFunc         WriteFunc                         // 写入函数，可以写入 文件/数据库
	currentIndex      *UsefullStructs.LockValue[uint64] // startFrom uint 1
	writeQueue        *WriteQueue
	connectTargetFunc ConnectTarget // connect target,动态发送包
}

```

同时`getwayserver`中有其他函数支持导入不同组件，可供定制化开发，详情请查看其他组件文档。