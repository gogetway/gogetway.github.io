import React from 'react';
import { Button, Card, Col, Row } from 'antd';
import { Link } from 'umi';

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '48px', padding: '48px 24px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>GoGetway 网关系统</h1>
        <p style={{ fontSize: '20px', color: '#666', marginBottom: '32px' }}>
          高性能、高可用的微服务网关解决方案，支持多种协议和灵活的路由配置
        </p>
        <div>
          <Link to="/docs/introduction">
            <Button type="primary" size="large" style={{ marginRight: '16px' }}>
              快速开始
            </Button>
          </Link>
          <Link to="/docs/installation">
            <Button size="large">安装指南</Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <Row gutter={[24, 24]} style={{ marginBottom: '48px' }}>
        <Col span={8}>
          <Card hoverable>
            <h3>高性能路由</h3>
            <p>支持HTTP/HTTPS、TCP/UDP等多种协议的高性能路由转发</p>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable>
            <h3>负载均衡</h3>
            <p>内置多种负载均衡算法，支持健康检查和服务发现</p>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable>
            <h3>安全防护</h3>
            <p>提供认证授权、限流熔断等全方位安全防护机制</p>
          </Card>
        </Col>
      </Row>

      {/* Quick Start Guide */}
      <div style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px', padding: '24px', marginBottom: '48px' }}>
        <h2>快速开始</h2>
        <ol style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>安装GoGetway网关系统</li>
          <li style={{ marginBottom: '8px' }}>配置路由规则和服务发现</li>
          <li style={{ marginBottom: '8px' }}>启动网关服务</li>
          <li>开始使用API网关功能</li>
        </ol>
        <Link to="/docs/quickstart">
          <Button type="primary">查看详细教程</Button>
        </Link>
      </div>

      {/* Documentation Links */}
      <div>
        <h2>核心功能文档</h2>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Link to="/docs/routing">
              <Card hoverable>
                <h4>路由管理</h4>
              </Card>
            </Link>
          </Col>
          <Col span={6}>
            <Link to="/docs/loadbalancing">
              <Card hoverable>
                <h4>负载均衡</h4>
              </Card>
            </Link>
          </Col>
          <Col span={6}>
            <Link to="/docs/security">
              <Card hoverable>
                <h4>安全认证</h4>
              </Card>
            </Link>
          </Col>
          <Col span={6}>
            <Link to="/docs/tcpPlayer">
              <Card hoverable>
                <h4>TCP流量回放</h4>
              </Card>
            </Link>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default HomePage;