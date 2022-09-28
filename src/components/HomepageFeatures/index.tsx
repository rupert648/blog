import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Sky Developer',
    Svg: require('@site/static/img/Sky_Group_logo_2020.svg').default,
    description: (
      <>
        Sky Developer Since September 2022. Working on producing the best technologies and services possible to enhance customer experience
      </>
    ),
  },
  {
    title: 'University of St Andrews',
    Svg: require('@site/static/img/University_of_St_Andrews_arms.svg').default,
    description: (
      <>
        Graduate of the University of St Andrews.
        <strong>1st Class BSc (w/ hons) in Computer Science</strong>
      </>
    ),
  },
  {
    title: 'Passionate Clean Coder',
    Svg: require('@site/static/img/browser-coding-svgrepo-com.svg').default,
    description: (
      <>
        A passionate, conscientious clean coder with an aim to build practical, sustainable and expandable software solutions
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
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
