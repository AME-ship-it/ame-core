import Link from 'next/link';
import styles from './ProtocolOverview.module.css';

const chapters = [
  ['identity','Identity layer'],['architecture','Protocol architecture'],['evidence','Evidence & receipts'],
  ['reputation','Reputation engine'],['credit','Credit infrastructure'],['lifecycle','Protocol lifecycle'],['tasks','Verified task activity'],
] as const;
const architecture = [
  ['AGENT','An actor operating through a wallet.'],['IDENTITY NFT','A persistent ERC-721 reference.'],
  ['VERIFIABLE ACTIVITY','Evidence evaluated against its source.'],['RECEIPTS','Authorized attestations associated with the identity.'],
  ['FINANCIAL HISTORY','Ordered records derived from onchain events.'],['REPUTATION','An interpretation under an explicit evaluation model.'],
  ['CREDIT INFRASTRUCTURE','Market rules, liquidity and risk constraints.'],
];
const lifecycle = ['IDENTITY CREATED','WALLET ASSOCIATED','ACTIVITY VERIFIED','RECEIPT RECORDED','HISTORY EXPANDED','REPUTATION EVALUATED','CREDIT INTERACTION'];

function Chapter({id,number,title,children}:{id:string;number:string;title:string;children:React.ReactNode}) {
  return <section id={id} className={styles.chapter} aria-labelledby={`${id}-title`}>
    <div className={styles.index}><span>{number} / {title.toUpperCase()}</span><span>AME PROTOCOL</span></div>
    <div className={styles.layout}><h2 id={`${id}-title`}>{title}</h2><div className={styles.content}>{children}</div></div>
  </section>;
}

export function ProtocolOverview(){return <article className={styles.overview}>
  <header className={styles.intro}><p className="eyebrow">AME / SYSTEM ARCHITECTURE</p>
    <h1>A record of becoming.</h1><p>Identity is the origin.<br/><span>History is the signal.</span></p>
    <p className={styles.lead}>A persistent identity connects an agent to its record. Evidence gives that record context. Reputation interprets the context; credit remains subject to the rules of the market.</p>
  </header>
  <nav className={styles.contents} aria-label="Protocol chapters"><ol>{chapters.map(([id,label],i)=><li key={id}><a href={`#${id}`}><span aria-hidden="true">0{i+1}</span>{label}</a></li>)}</ol></nav>

  <Chapter id="identity" number="01" title="Identity layer">
    <p>An AME is an ERC-721 identity, not an executable runtime. Its token ID provides a stable reference while the owner, assigned agent wallet and metadata describe its current state.</p>
    <figure className={styles.identity} aria-label="Identity architecture"><div className={styles.identityTop}><span>OWNER WALLET</span><span aria-hidden="true">↓</span><strong>IDENTITY NFT</strong><small>ERC-721 / TOKEN ID</small></div>
      <dl className={styles.branches}><div><dt>AUTHORITY</dt><dd>Assigned agent wallet</dd></div><div><dt>DESCRIPTION</dt><dd>Owner-controlled metadata</dd></div><div><dt>RECORD</dt><dd>Associated attestations & events</dd></div></dl>
      <figcaption>Ownership controls the identity. Wallet assignment delegates only the permissions defined by each contract.</figcaption>
    </figure>
    <p>A transfer changes the owner and clears the previous wallet assignment. Core receipt history remains associated with the identity. Lending positions and repayment obligations remain bound to their contract-defined accounts; an NFT transfer does not transfer a borrower’s obligations or authorize a new operator.</p>
    <Link className={styles.link} href="/nfts">Explore agent identity <span aria-hidden="true">↗</span></Link>
  </Chapter>

  <Chapter id="architecture" number="02" title="Protocol architecture">
    <p>Contracts define ownership and permitted writes. Wallet authorization determines who can act. Events expose the records from which the frontend builds readable views.</p>
    <figure className={styles.architecture} aria-label="Agent to credit architecture"><ol>{architecture.map(([name,description],i)=><li key={name}><span className={styles.stepNumber}>0{i+1}</span><div><strong>{name}</strong><p>{description}</p></div>{i<architecture.length-1&&<span className={styles.down} aria-hidden="true">↓</span>}</li>)}</ol><figcaption>Identity and receipt contracts are implemented primitives. General reputation evaluation and reputation-conditioned credit are architectural layers, not a deployed automatic pipeline.</figcaption></figure>
    <dl className={styles.roles}><div><dt>CONTRACTS</dt><dd>Enforce ownership, issuance and market-specific rules.</dd></div><div><dt>AUTHORIZATION</dt><dd>Checks the signer’s permissions in the relevant contract; connecting a wallet grants no financial authority.</dd></div><div><dt>EVENTS</dt><dd>Provide ordered, chain-specific evidence of accepted contract interactions.</dd></div><div><dt>FRONTEND</dt><dd>Reads, indexes and presents state; prepares eligible actions without custody of user keys.</dd></div></dl>
  </Chapter>

  <Chapter id="evidence" number="03" title="Evidence & receipts">
    <h3>An assertion needs a source.</h3><p>An interaction begins with an identifiable origin: a wallet action, a contract event or an external result. Verification must be appropriate to that origin. A confirmed repayment event can establish a contract transition; an external task outcome requires a verifier and an explicit trust model.</p>
    <ol className={styles.evidence}><li><span>ORIGIN</span>Identify the actor, network and action.</li><li><span>VERIFICATION</span>Check source evidence and the verifier’s authority.</li><li><span>ISSUANCE</span>Accept only contract-authorized receipt writers.</li><li><span>ASSOCIATION</span>Attach the attestation to the correct identity.</li><li><span>INTEGRITY</span>Retain transaction order, issuer and referenced data.</li></ol>
    <p>Authorized actors append attestations. In the core receipt contract, the current NFT owner or assigned agent wallet can issue a receipt. That permission does not make a self-issued claim independently verified.</p>
    <p className={styles.emphasis}>Receipts are attestations, not proof of execution.</p>
    <p>Onchain inclusion establishes who recorded an attestation and when. It does not establish the truth of every asserted outcome or the permanent availability of externally referenced content. Financial engine events and core identity receipts are distinct sources, each with its own authority and trust assumptions.</p>
    <div className={styles.transition}><span>H(t + 1) = H(t) ∥ r</span><small>DERIVED HISTORY / APPEND ONLY</small></div>
  </Chapter>

  <Chapter id="reputation" number="04" title="Reputation engine">
    <h3>Evidence in. Interpretation out.</h3><p>Identity continuity makes activity attributable over time. Repayment history, verified outcomes, liquidation events and the provenance of each record can become inputs to a defined evaluation model.</p>
    <figure className={styles.model} aria-label="Conceptual reputation evaluation model"><p className={styles.formula}>Rᵢ(t; M) = Fₘ(Hᵢ(t), Pᵢ(t), Vᵢ(t))</p><dl className={styles.roles}><div><dt>Hᵢ(t)</dt><dd>Ordered, identity-associated attestation history.</dd></div><div><dt>Pᵢ(t)</dt><dd>Financial events attributed to verified accounts.</dd></div><div><dt>Vᵢ(t)</dt><dd>Verification provenance and evidence quality.</dd></div><div><dt>M</dt><dd>The evaluation policy: accepted sources, weights and time horizon.</dd></div></dl><figcaption>CONCEPTUAL MODEL / No general automatic scoring engine is implied by this notation.</figcaption></figure>
    <p>A credible model must distinguish accepted evidence from unverified claims, retain provenance and account for negative outcomes. Token balance, wallet size and NFT ownership alone are not measures of credit quality. Historical account control must be verified before attributing wallet activity to an identity.</p>
    <p>The existing testnet lending engine has a narrow informational repayment score. It does not adjust borrowing limits, collateral requirements or interest rates. General task weighting and reputation-driven credit policies remain separate, unimplemented models.</p>
  </Chapter>

  <Chapter id="credit" number="05" title="Credit infrastructure">
    <h3>History informs risk.<br/>Markets define access.</h3><p>Liquidity providers supply assets to a market. An authorized borrower interacts under that market’s collateral, oracle, liquidation and repayment rules. Available liquidity limits borrowing and withdrawals; reputation does not create capital or guarantee a loan.</p>
    <figure className={styles.capital} aria-label="Lending capital and repayment flow"><ol><li>LIQUIDITY PROVIDERS</li><li>MARKET LIQUIDITY</li><li>COLLATERALIZED BORROWER</li><li>REPAYMENT + INTEREST</li></ol><figcaption>Capital and interest return according to the market’s accounting. Loss, liquidation and liquidity risks remain.</figcaption></figure>
    <p>Wallet ownership, token balances, allowances and account authorization are checked for the relevant action. Collateral value, debt and risk limits depend on the actual market and verified oracle inputs. Financial events extend the borrower’s history; linking that history to an NFT requires verified attribution.</p>
    <dl className={styles.roles}><div><dt>MORPHO</dt><dd>Robinhood Chain Mainnet market reads cover USDG / USDe and USDG / syrupUSDG. Mainnet transaction signing remains disabled.</dd></div><div><dt>IDENTITY</dt><dd>Current identity minting uses Robinhood Chain Testnet (46630). Mainnet market reads use chain 4663 independently.</dd></div><div><dt>ACCESS</dt><dd>Verified $AME balances identify holders. The lending application retains its holder gate; premium and lending entitlements require separately approved access rules. Product access is separate from market solvency and borrower eligibility.</dd></div><div><dt>RISK</dt><dd>A future reputation policy may inform eligibility; collateral, oracle validity, liquidity and market-specific safeguards still constrain any credit decision.</dd></div></dl>
    <Link className={styles.link} href="/lending">View lending access <span aria-hidden="true">↗</span></Link>
  </Chapter>

  <Chapter id="lifecycle" number="06" title="Protocol lifecycle">
    <h3>One identity.<br/>A continuing record.</h3><ol className={styles.lifecycle} aria-label="Protocol lifecycle stages">{lifecycle.map((stage,i)=><li key={stage}><span>0{i+1}</span><strong>{stage}</strong>{i<lifecycle.length-1&&<span aria-hidden="true">→</span>}</li>)}</ol>
    <p>Identity creation and wallet assignment establish the reference and its permitted actors. Accepted attestations and financial events expand the readable history. Verification depends on the source; reputation evaluation and reputation-conditioned credit are model-dependent stages, not automatic consequences of minting an NFT.</p>
    <p className={styles.emphasis}>Identity is the origin.<br/>History is the signal.<br/>Reputation is the interpretation.<br/>Credit is the consequence of an eligible market interaction.</p>
    <Link className={styles.link} href="/docs">Read the technical documentation <span aria-hidden="true">↗</span></Link>
  </Chapter>
<Chapter id="tasks" number="07" title="Verified task activity"><p>Tasks V2 adds wallet-authorized, user-assisted activity to agent history. Signed submissions are graded against confirmed chain evidence. Six guided categories cover identity, research, transaction analysis, classification, event decoding and protocol risk. The versioned policy offers 140 Task XP across these categories after durable recording is enabled; transfers do not reset category rewards.</p><p>Task XP is independent from repayment-based financial reputation. It grants no lending permission and changes no rates or credit limits. Persistent rewards require an active tester authorization, a verified wallet signature and a committed task record. Records are offchain attestations, not onchain receipts or autonomous execution claims.</p><Link className={styles.link} href="/tasks">Explore Tasks V2 ↗</Link></Chapter>
</article>;}
