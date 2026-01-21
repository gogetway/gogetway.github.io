// 文档配置文件
export const docsConfig = [
  {
    title: 'GoGetway 网关系统',
    children: [
      {
        title: '介绍',
        path: '/docs/introduction'
      },
      {
        title: '快速开始',
        path: '/docs/quickstart'
      },
      {
        title: '安装指南',
        path: '/docs/installation'
      },
      {
        title: '配置说明',
        path: '/docs/configuration'
      }
    ]
  },
  {
    title: '功能特性',
    children: [
      {
        title: '路由管理',
        path: '/docs/routing'
      },
      {
        title: '负载均衡',
        path: '/docs/loadbalancing'
      },
      {
        title: '安全认证',
        path: '/docs/security'
      },
      {
        title: '监控告警',
        path: '/docs/monitoring'
      }
    ]
  },
  {
    title: '资源连接',
    children: [
      {
        title: '连接资源',
        path: '/docs/connectResource'
      },
      {
        title: '资源池管理',
        path: '/docs/resourcePool'
      },
      {
        title: '健康检查',
        path: '/docs/healthCheck'
      }
    ]
  },
  {
    title: 'API 参考',
    children: [
      {
        title: '网关 API',
        path: '/docs/gatewayApi'
      },
      {
        title: '管理 API',
        path: '/docs/adminApi'
      },
      {
        title: 'TCP Player',
        path: '/docs/tcpPlayer'
      }
    ]
  },
  {
    title: '部署运维',
    children: [
      {
        title: '集群部署',
        path: '/docs/clusterDeployment'
      },
      {
        title: '性能调优',
        path: '/docs/performance'
      },
      {
        title: '故障排查',
        path: '/docs/troubleshooting'
      }
    ]
  }
];