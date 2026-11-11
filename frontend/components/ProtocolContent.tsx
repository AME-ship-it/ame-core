import Link from 'next/link';
const lifecycle = [
  ['Wallet', 'An address begins the relationship.'],
  ['Identity', 'An NFT gives the agent a persistent ID.'],
  ['Receipts', 'Authorized actors append attestations.'],
  ['Memory', 'History becomes a readable record.'],
  ['Reputation', 'A future interpretation of that record.'],
];
export function DocsContent(){return <><section id="docs" className="editorial-section docs-section" aria-labelledby="docs-title">
        <div className="section-index"><span>01 / DOCS</span><span>FOUNDATIONS</span></div>
        <div className="docs-layout">
          <div><p className="eyebrow">A SYSTEM, BEFORE A SCORE</p><h2 id="docs-title">Identity is the origin.<br /><span>History is the signal.</span></h2><p className="section-copy">A machine needs more than an address. AME gives an agent a persistent identity and a place for its actions to be recorded.</p><Link className="text-link" href="/protocol">Read the architecture <span aria-hidden="true">↗</span></Link></div>
          <div className="research-sheet" aria-label="Protocol state model">
            <div className="sheet-caption"><span>AME / STATE MODEL</span><span>DEFINITION 01</span></div>
            <p className="equation">S<sub>i</sub>(t) = (O<sub>i</sub>, W<sub>i</sub>, U<sub>i</sub>, H<sub>i</sub>(t))</p>
            <dl className="definitions"><div><dt>O · owner</dt><dd>Current ERC-721 owner</dd></div><div><dt>W · wallet</dt><dd>Assigned agent address</dd></div><div><dt>U · metadata</dt><dd>Owner-controlled URI</dd></div><div><dt>H · history</dt><dd>Ordered receipt attestations</dd></div></dl>
            <p className="model-note">Conceptual model. Identity and receipts live in separate contracts; history is derived from their records.</p>
            <div className="state-transition"><span>H(t + 1) = H(t) ∥ r</span><span>APPEND ONLY</span></div>
          </div>
        </div>
      </section></>;}
export function NftContent(){return <><section id="nfts" className="editorial-section nft-section" aria-labelledby="nft-title">
        <div className="section-index"><span>02 / NFTs</span><span>THE IDENTITY LAYER</span></div>
        <div className="nft-layout">
          <div className="identity-diagram" aria-label="ERC-721 identity linked to an owner, wallet and metadata">
            <div className="identity-orbit orbit-outer" /><div className="identity-orbit orbit-inner" />
            <span className="identity-node node-owner">OWNER</span><span className="identity-node node-wallet">WALLET</span><span className="identity-node node-uri">METADATA</span>
            <div className="identity-core"><span>ame.</span><small>ERC — 721</small></div>
            <p>ONE IDENTITY. A CONTINUING RECORD.</p>
          </div>
          <div><p className="eyebrow">OWN THE IDENTITY</p><h2 id="nft-title">An agent.<br />Not just an address.</h2><p className="section-copy">Each AME is an ERC-721 identity. It belongs to an owner, points to an assigned wallet, and carries metadata that can evolve.</p><p className="section-copy secondary-copy">The identity can transfer. Its receipt history remains. A transfer clears the previous wallet assignment, so authority follows ownership.</p><div className="inline-links"><Link href="/deploy" className="text-link">Create an identity <span aria-hidden="true">↗</span></Link><Link href="/agents" className="quiet-link">Your agents ↗</Link></div></div>
        </div>
      </section><section className="closing-section"><p className="eyebrow">A SMALL BEGINNING. A PERSISTENT IDENTITY.</p><h2>Give your agent a place to begin.</h2><Link href="/deploy" className="hero-cta">Create your AME <span aria-hidden="true">↗</span></Link></section></>;}
export function ProtocolContent(){return <><section id="protocol" className="editorial-section protocol-section" aria-labelledby="protocol-title">
        <div className="section-index"><span>03 / PROTOCOL</span><span>FROM ADDRESS TO CONTEXT</span></div>
        <div><div className="protocol-intro"><h2 id="protocol-title">A record of becoming.</h2><p className="section-copy">Identity makes an agent recognizable.<br />History makes it legible.</p></div>
          <ol className="lifecycle">{lifecycle.map(([name, description], index) => <li key={name}><span className="lifecycle-number">0{index + 1}</span><h3>{name}<span aria-hidden="true">{index < 4 ? '→' : '↗'}</span></h3><p>{description}</p>{index > 2 && <small>{index === 3 ? 'DERIVED HISTORY' : 'PLANNED LAYER'}</small>}</li>)}</ol>
          <p className="protocol-note"><span className="status-dot" />Identity &amp; receipt contracts deployed on Robinhood Chain Testnet. Receipts are attestations, not proof of execution. No reputation score is calculated yet.</p>
        </div>
      </section></>;}
