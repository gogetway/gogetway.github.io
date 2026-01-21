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
            to="/docs/intro">
            Get Started - 5min ⏱️
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
      description="GoGetway is a powerful network gateway framework for building high-performance TCP/IP applications">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <section className={styles.features}>
          <div className="container">
            <h2>Key Features</h2>
            <div className="row">
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>ConnectResource Management</h3>
                  </div>
                  <div className="card__body">
                    <p>Flexible resource management for network connections with built-in write queues and synchronization mechanisms.</p>
                  </div>
                </div>
              </div>
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>LockGroup System</h3>
                  </div>
                  <div className="card__body">
                    <p>Advanced locking mechanisms for concurrent access control and resource synchronization.</p>
                  </div>
                </div>
              </div>
              <div className="col col--4">
                <div className="card">
                  <div className="card__header">
                    <h3>TcpPlayer Replay</h3>
                  </div>
                  <div className="card__body">
                    <p>TCP traffic replay capabilities for testing and simulating network interactions.</p>
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
