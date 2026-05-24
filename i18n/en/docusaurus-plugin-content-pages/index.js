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
            Get Started - 5 min ⏱️
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
      title={`${siteConfig.title} - Network Gateway Framework`}
      description="GoGetway is a Go framework for building TCP/HTTP gateways with traffic recording, replay, and passive mirroring">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <section className={styles.features}>
          <div className="container">
            <h2>Core Components</h2>
            <div className="row">
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>SimpleTCPServer (Active Proxy)</h3>
                  </div>
                  <div className="card__body">
                    <p>Listens locally, forwards upstream, and records bidirectional traffic in link order to any Writer or WriteFunc.</p>
                  </div>
                </div>
              </div>
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>GopacketTrafficMirror (Passive Mirror)</h3>
                  </div>
                  <div className="card__body">
                    <p>Zero-deploy capture via pcap / AF_PACKET / eBPF, with TCP reassembly for sidecar forwarding or pure recording.</p>
                  </div>
                </div>
              </div>
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>TcpPlayer (Traffic Replay)</h3>
                  </div>
                  <div className="card__body">
                    <p>Replays recorded traffic to a target service with original timing, plus a custom parser hook for packet mutation.</p>
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
