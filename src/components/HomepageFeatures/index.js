import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '高性能',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        基于 Go 构建，原生协程 + 写队列零拷贝路径，单实例即可承载高并发 TCP/HTTP 流量代理与录制。
      </>
    ),
  },
  {
    title: '主动 + 被动双模式',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        既能作为 SimpleTCPServer 主动代理监听端口，也能通过 gopacket 抓包实现被动镜像，零修改部署即可上线。
      </>
    ),
  },
  {
    title: '可回放、可改写',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        TcpPlayer 支持按原始时序重放录制流量，DataParser 钩子可在回放前任意改写包内容，覆盖回归、压测、染色等场景。
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
