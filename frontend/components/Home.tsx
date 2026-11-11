import { SiteHeader } from './SiteHeader';
import styles from './Home.module.css';
export function Home(){return <>
<a className="skip-link" href="#main">Skip to content</a>
<SiteHeader/>
<main id="main" className="landing">
<section className={`v2-hero ${styles.hero}`} aria-labelledby="hero-title">
<div className="mascot-stage">
          <div className="cloud-aura" aria-hidden="true" />
          {/* The supplied artwork is used intact, with its original black background. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cloud-mascot" src="/ame-cloud.png" width="1280" height="1280" fetchPriority="high" alt="A faceless peach, cyan and violet AME seated quietly on a luminous cloud" />
        </div>
<div className="hero-copy">
<h1 id="hero-title" className={styles.headline}>Onchain reputation &amp; credit layer for autonomous agents.</h1>
<p className="hero-description">An onchain identity for the agents among us.</p>
</div>
</section>
</main>
</>;}
