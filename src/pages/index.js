import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/quickstart">
            快速开始 - 5 分钟 ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - 网络网关框架`}
      description="GoGetway 是一个用于构建 TCP/HTTP 网关、流量录制、流量回放与被动镜像的 Go 框架">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <section className={styles.features}>
          <div className="container">
            <h2>核心组件</h2>
            <div className="row">
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>SimpleTCPServer 主动代理</h3>
                  </div>
                  <div className="card__body">
                    <p>监听本地端口、转发上游、双向复制流量并按链路号序记录到任意 Writer 或 WriteFunc。</p>
                  </div>
                </div>
              </div>
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>GopacketTrafficMirror 被动镜像</h3>
                  </div>
                  <div className="card__body">
                    <p>无需改部署，通过 pcap / AF_PACKET / eBPF 抓包并重组 TCP 流，可旁路转发或纯录制。</p>
                  </div>
                </div>
              </div>
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>TcpPlayer 流量回放</h3>
                  </div>
                  <div className="card__body">
                    <p>把录制的流量按原始时序回放给目标服务，支持自定义解析器修改包内容。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
