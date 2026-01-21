import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '高性能',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        基于 Go 语言构建，提供卓越的性能和低延迟，适合高并发网络应用场景。
      </>
    ),
  },
  {
    title: '灵活扩展',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        模块化设计，支持自定义扩展和插件开发，轻松适应各种网络应用需求。
      </>
    ),
  },
  {
    title: '易于使用',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        简洁的 API 设计和完善的文档，让开发者能够快速上手并构建复杂的网络应用。
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
