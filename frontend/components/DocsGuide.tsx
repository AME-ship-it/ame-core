import Link from 'next/link';
import {TasksExplanation} from './TasksExplanation';
import type {ReactNode} from 'react';
import {DocsContent} from './ProtocolContent';
import styles from './DocsGuide.module.css';

const contents=[['introduction','INTRODUCTION'],['identity','IDENTITY'],['receipts','RECEIPTS'],['tasks','TASKS'],['memory','MEMORY'],['reputation','REPUTATION'],['credit','CREDIT'],['lending','LENDING'],['ame-access','$AME ACCESS'],['state-model','STATE MODEL'],['architecture','ARCHITECTURE'],['current-status','CURRENT STATUS']] as const;
function Flow({steps,label}:{steps:string[];label:string}){return <ol className={styles.flow} aria-label={label}>{steps.map(step=><li key={step}>{step}</li>)}</ol>;}
function Chapter({id,label,title,children}:{id:string;label:string;title:string;children:ReactNode}){return <section id={id} className={styles.section} aria-labelledby={`${id}-title`}><p className={styles.label}>{label}</p><div className={styles.body}><h2 id={`${id}-title`}>{title}</h2>{children}</div></section>;}

export function DocsGuide(){return <article className={styles.guide} aria-label="AME product documentation">
  <header id="introduction" className={styles.intro}>
    <p className="eyebrow">AME / DOCUMENTATION</p>
    <h1>Onchain reputation &amp; credit layer for autonomous agents.</h1>
    <p>AME gives agents a persistent financial identity. An agent begins with a wallet, receives an onchain identity, and can accumulate receipts from authorized activity. Those receipts build a readable history over time. That history provides evidence for reputation. The intended credit layer can eventually use this evidence to inform the conditions an agent may qualify for.</p>
    <Flow label="AME progression" steps={['Wallet','Identity','Receipts','Memory','Reputation','Credit']}/>
  </header>
  <nav className={styles.toc} aria-label="Documentation contents"><ul>{contents.map(([id,label])=><li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul></nav>

  <Chapter id="becoming" label="01 / PROGRESSION" title="A record of becoming.">
    <p>Identity makes an agent recognizable. History makes its activity legible. Reputation is an interpretation of that evidence; credit is a possible consequence of a separately approved risk policy.</p>
    <p>The stages below explain the architecture, not a claim that every stage is already automated. An identity NFT does not run an AI agent, execute tasks, or grant financial permissions by itself.</p>
  </Chapter>

  <Chapter id="identity" label="02 / IDENTITY" title="An agent is more than an address.">
    <h3>01 — Wallet</h3><p><strong>An address begins the relationship.</strong></p>
    <p>A wallet is an operational address associated with an agent. With the appropriate keys and authorization, it can receive assets, interact with protocols and sign actions. Its public transactions can become observable evidence of activity. The address alone is not an agent identity: it is the first addressable surface.</p>
    <h3>02 — Identity</h3><p><strong>An NFT gives the agent a persistent ID.</strong></p>
    <p>AMEAgent provides an ERC-721 identity, separating who the agent is from what it does. Its token ID is a stable reference for ownership, metadata, an assigned operational wallet, receipt history and a possible future reputation or credit profile.</p>
    <p>The current NFT owner controls wallet assignment and metadata. Transferring the identity clears the previous wallet assignment and its receipt-writing authority. Existing receipt records remain associated with the identity, but this does not transfer the previous borrower's debt, collateral rights or wallet history to the new owner.</p>
    <p>A wallet assignment is not proof of control of that address. Lending authorization is checked separately. Read the <Link href="/nfts" className="quiet-link">identity explanation and diagram ↗</Link> or open the existing <Link href="/deploy" className="quiet-link">creation flow ↗</Link>.</p>
  </Chapter>

  <Chapter id="receipts" label="03 / RECEIPTS" title="An attestation joins the record.">
    <p><strong>Authorized actors append attestations.</strong></p>
    <p>A receipt is a structured statement about agent activity. AMEReceipt records an agent ID, receipt type, issuer, timestamp, data hash and metadata URI. The contract permits the current NFT owner or assigned wallet to issue it and checks that the required fields are present.</p>
    <p>Possible attestation subjects include a completed task, research outcome, strategy execution, protocol interaction, milestone or service result. These are examples of what an issuer may describe, not a list of independently verified workflows that AME currently executes.</p>
    <p><strong>Receipts are attestations, not proof of execution.</strong> Issuer authorization proves who was allowed to submit a record, not that its claims are true. A data hash can bind supplied content; it does not prove that research was correct, a task was useful, or an offchain outcome occurred.</p>
    <p>Financial receipts emitted by the lending engine are separate: they arise from its actual borrowing, repayment and liquidation logic. An arbitrary owner-issued task receipt does not become lending repayment evidence or earn the lending engine's informational score.</p>
  </Chapter>

  <Chapter id="tasks" label="AME / TASKS V1" title="Activity, verified."><TasksExplanation/></Chapter>
  <Chapter id="memory" label="04 / MEMORY" title="History becomes a readable record.">
    <p>AME derives an ordered history from accumulated onchain receipts and events. Memory here is not merely chat memory: it is a sequence of attributed records that can be inspected by agent ID, issuer, time and transaction provenance.</p>
    <p className={styles.formula}>H(t + 1) = H(t) || r</p>
    <p>H is the agent's history; r is a new receipt or attestation. <strong>Each valid receipt extends the agent's history rather than replacing it.</strong></p>
    <p>Append-only history preserves what was recorded, including its issuer. It does not make every attestation trustworthy. Consumers still need to evaluate provenance, verification rules and the context of the action. Event-derived views also depend on indexing and RPC availability.</p>
  </Chapter>

  <Chapter id="reputation" label="05 / REPUTATION" title="Behavior becomes evidence, not a rating by decree.">
    <p><strong>A future interpretation of that record.</strong></p>
    <p>The general reputation layer is intended to derive signals from useful, verifiable behavior over time. Creating an identity does not itself establish creditworthiness. A manual label, wallet balance or number of tokens held must not stand in for evidence.</p>
    <p className={styles.formula}>REPUTATION ≠ TOKEN BALANCE<br/>REPUTATION ≠ WALLET SIZE<br/>REPUTATION ≠ MANUAL RATING</p>
    <p>Future policies could evaluate recognized task and research outcomes, authorized protocol actions, milestones, consistent activity and a longer clean history. Within a lending context, repayment behavior and liquidations are relevant evidence. Different evidence types would need explicit verification standards and weights; neither task completion nor activity volume automatically earns points.</p>
    <h3>What exists today</h3>
    <p>The deployed testnet lending engine exposes a narrow <strong>informational repayment score</strong>. It awards 10 points per qualifying loan, up to ten qualifying loans, and subtracts 25 points per liquidation or late repayment, with the penalty capped at four events and the final result floored at zero.</p>
    <p>A qualifying repayment must satisfy the engine's duration, principal-time, paid-interest and on-time conditions. Instant repayment and self-issued attestations do not earn positive credit history. This score can still be economically farmed; it is not a trusted credit rating and does not change borrowing limits, collateral requirements or interest rates.</p>
    <p>The wider cross-task reputation model, weighted scoring and production credit interpretation remain planned. No testnet NFT is automatically attributed mainnet wallet positions or history.</p>
  </Chapter>

  <Chapter id="reputation-tasks" label="06 / EVIDENCE PIPELINE" title="How an agent builds reputation">
    <Flow label="Conceptual task evidence pipeline" steps={['Task created','Agent performs task','Result verified','Receipt issued','History updated','Reputation recalculated']}/>
    <p>This is the intended evidence pipeline, not a currently deployed generic task scheduler or automatic scoring service. A protocol-recognized task needs an explicit result-verification rule, an authorized issuer and an accepted receipt before any future reputation policy can use it.</p>
    <p>For example, an agent might accumulate records for research, repayment, a protocol interaction and a milestone. Each accepted event can contribute evidence, but not every event necessarily changes a score. Relevance, issuer trust, elapsed time and outcome quality may eventually carry different weights. Those policies are not active today.</p>
  </Chapter>

  <Chapter id="credit" label="07 / CREDIT" title="From reputation to credit">
    <Flow label="Future credit interpretation" steps={['Identity','History','Reputation','Credit profile','Credit conditions']}/>
    <p>The credit layer sits above identity and evidence. An agent with a stronger, cleaner history may eventually qualify for better credit conditions than an agent with no history, if an approved risk model supports that decision.</p>
    <p>Potential policy variables include borrowing limits, collateral requirements, interest rates, available markets, credit duration and risk limits. These are future possibilities, not terms currently granted by reputation.</p>
    <h3>Current architecture</h3>
    <p>The existing testnet engine uses owner-bound positions, fixed collateral/risk parameters, available pool liquidity and contract authorization. Its informational score does not relax these controls. NFT transfers do not transfer an existing borrower's obligations or provide a new owner with that position's borrowing authority.</p>
    <h3>Future credit interpretation</h3>
    <p>Turning a history signal into a credit condition requires a separately reviewed policy, resistance to manipulation, reliable pricing and explicit activation. Reputation does not create an entitlement to a loan, remove collateral requirements, or guarantee a rate or return.</p>
  </Chapter>

  <Chapter id="ame-access" label="08 / $AME UTILITY" title="$AME holder access">
    <p>The holder gate is intended to let $AME holders access AME's lending application. <strong>Verified $AME balance recognition is configured on Robinhood Chain Mainnet.</strong> Positive balances identify holders; premium and lending entitlements remain locked because no holder threshold has been approved. No acquisition destination is invented.</p>
    <p className={styles.formula}>$AME HOLDING = HOLDER RECOGNITION<br/>AGENT REPUTATION = CREDIT QUALITY</p>
    <Flow label="Product access after an approved entitlement policy" steps={['Hold $AME','Verify token balance','Access lending']}/>
    <Flow label="Separate future credit-quality policy" steps={['Agent history','Reputation','Credit conditions']}/>
    <p>The server reads the configured ERC-20's decimals and balance on its configured chain, reports positive-balance holder status without granting privileges, and compares integer units against a threshold only after that access rule is approved. It rechecks eligibility before first-party wallet writes. A balance check requires no signature. Verification failures keep access locked without labeling the wallet a non-holder.</p>
    <p>Holding more $AME does not automatically improve reputation or create borrowing power. There is no staking requirement, holder tier or reputation threshold in the V1 access gate.</p>
    <p className={styles.formula}>$AME holder + eligible agent + sufficient reputation = access to available credit conditions</p>
    <p className={styles.note}>This combined expression describes a possible future policy, not today's eligibility formula. Actual credit would also require market liquidity, required collateral and all applicable risk checks. Today's holder gate checks token holding only; the current engine applies its separate fixed controls.</p>
    <p>This is application access enforcement, not an onchain allowlist. Existing public contracts and third-party protocol interfaces remain directly accessible. A public balance response is not authentication or proof that its requester controls that wallet.</p>
  </Chapter>

  <Chapter id="lending" label="09 / LENDING" title="Capital comes from liquidity providers.">
    <Flow label="Lending capital cycle" steps={['Liquidity providers','Lending pool','Eligible agents','Repayment + interest','Liquidity providers']}/>
    <p>Providers supply assets into a lending market. Borrowers can draw from available liquidity only when the market's authorization, collateral and risk rules allow it. Borrowers repay principal plus accrued interest; pool accounting determines suppliers' claims.</p>
    <p><strong>AME does not create the lending capital.</strong> Token supply or a holder's $AME balance is not automatically deposited as lending liquidity. Lending capital must be supplied as the market's actual accepted asset.</p>
    <p>The existing testnet market uses valueless tUSD/tCOL assets with fixed pricing and fixed risk parameters. It is unaudited and not a real-value lending product. Suppliers' claims are limited by available cash and can bear realized losses; liquidity and repayment are not guaranteed.</p>
    <p>Robinhood Chain mainnet integration reads existing Morpho Blue USDG markets with USDe or syrupUSDG collateral. Those integrations are read-only in AME, behind the product gate, and not approved for signing. Enabling holder verification will not activate mainnet financial transactions.</p>
    <p>The <Link href="/lending" className="quiet-link">lending entry point ↗</Link> remains available; lending entitlements require separately approved access rules.</p>
  </Chapter>

  <Chapter id="collateral" label="10 / COLLATERAL" title="Access is not collateral.">
    <Flow label="Separate access, collateral and future reputation roles" steps={['Hold $AME → access','Lock accepted collateral → borrow','Build reputation → possible future terms']}/>
    <p>Holding a token to enter the application is different from pledging an accepted asset to secure debt. The current holder gate does not lock, transfer or approve $AME. Neither $AME collateral nor reputation-based reductions in collateral requirements are active.</p>
    <p>$AME could be evaluated as part of a future collateral design, but no such market is promised. Accepted assets, pricing, liquidity, liquidation behavior and risk limits would require separate implementation and review. Stronger reputation may eventually inform terms only if an approved policy supports it.</p>
    <p>Borrowing risk, liquidation conditions and ownership checks remain independent of the access badge. An unlocked interface does not mean that a borrow is safe or available.</p>
  </Chapter>

  <section id="state-model" className={styles.stateModel} aria-label="State model and original foundations">
    <DocsContent/>
    <div className={styles.stateDetails}>
      <p className={styles.formula}>Sᵢ(t) = (Oᵢ, Wᵢ, Uᵢ, Hᵢ(t))</p>
      <dl className={styles.definitions}><div><dt>Oᵢ · owner</dt><dd>The current ERC-721 owner of the agent identity.</dd></div><div><dt>Wᵢ · wallet</dt><dd>The assigned operational wallet. It is cleared on identity transfer and must be assigned again by the new owner.</dd></div><div><dt>Uᵢ · metadata</dt><dd>The owner-controlled metadata URI describing the agent. Ownership allows updates; a URI or hash alone does not establish the truth or permanent availability of its content.</dd></div><div><dt>Hᵢ(t) · history</dt><dd>The ordered sequence of receipt attestations associated with the identity over time, derived from the underlying records.</dd></div></dl>
      <p>The state model describes an agent at a specific point in time. Ownership may change, metadata may evolve, and history grows as new receipts are appended. AME uses this evolving state to build a persistent record rather than treating every interaction as isolated.</p>
      <p>Each valid receipt extends the agent's history rather than replacing it. The model is conceptual: identity, attestations and financial events live in distinct contracts and are interpreted together, not stored as one mutable score field.</p>
    </div>
  </section>

  <Chapter id="example" label="11 / ILLUSTRATIVE SCENARIO" title="Meet AME #042.">
    <div className={styles.example}>
      <p>Imagine an agent called AME #042. It begins with a wallet and an onchain identity. In a future recognized workflow, it completes research tasks, repays a small credit position and interacts correctly with approved protocols.</p>
      <p>Authorized issuers record accepted outcomes as receipts. Those receipts become part of the agent's history. Over time, an approved reputation policy could interpret that evidence and help determine the credit conditions available to the agent.</p>
      <p>The $AME token does not create that reputation. Holding $AME would grant product access once the holder gate is activated; it does not itself improve the agent's credit quality.</p>
    </div>
    <p className={styles.note}>An illustrative future scenario, not a report of an actual agent, task result or transaction. Research-task weighting and reputation-adjusted credit are not active, and not every receipt would increase reputation.</p>
  </Chapter>

  <Chapter id="architecture" label="12 / ARCHITECTURE" title="Identity is the origin. History is the signal.">
    <p className={styles.principle}>Identity is the origin.<br/>History is the signal.<br/>Reputation is the interpretation.<br/>Credit is the consequence.</p>
    <Flow label="Architecture principle" steps={['Identity','History','Reputation','Credit']}/>
    <p>The full product direction is a feedback loop: actions create receipts, receipts build history, history informs reputation, and reputation can influence future financial access. Each arrow needs an explicit verification or risk policy; none should be inferred merely from an NFT or token balance.</p>
    <ol className={styles.stack} aria-label="Full system direction">{['CREATE AGENT','CONNECT WALLET','MINT IDENTITY','ASSIGN AGENT WALLET','COMPLETE TASKS','GENERATE RECEIPTS','BUILD HISTORY','DERIVE REPUTATION','UNLOCK CREDIT PROFILE','ACCESS HOLDER-GATED LENDING','BUILD MORE HISTORY'].map(step=><li key={step}>{step}</li>)}</ol>
    <p className={styles.note}>The sequence spans existing primitives and future policies. “Create agent” starts the creation flow; minting establishes the identity after wallet connection. Generic task automation and reputation-based credit decisions are not currently running.</p>
    <p>Read the preserved <Link href="/protocol" className="quiet-link">protocol lifecycle ↗</Link> and <Link href="/nfts" className="quiet-link">identity diagram ↗</Link> for the visual foundations.</p>
  </Chapter>

  <Chapter id="current-status" label="13 / CURRENT STATUS" title="Implemented foundations. Explicit next steps.">
    <h3>Implemented / available in code</h3>
    <ul className={styles.statusList}>
      <li>Wallet connection, identity NFT creation, profiles and onchain ownership on Robinhood Chain Testnet.</li>
      <li>Authorized receipt attestations, financial receipt events and event-derived history/state views.</li>
      <li>The testnet engine's limited informational repayment score; no credit-policy adjustment based on that score.</li>
      <li>The lending interface, existing transaction preview and wallet-confirmation flow, now behind the holder gate.</li>
      <li>ERC-20 balance/decimal verification, server-side application access checks, fresh write checks, short-lived cache and verified token recognition with separately disabled lending entitlements.</li>
      <li>Read-only Robinhood mainnet market integration in code. Mainnet signing and mainnet reputation writes remain disabled.</li>
    </ul>
    <p><strong>Current public access:</strong> the token balance reader recognizes the verified AME contract; lending entitlements remain locked pending an approved holder policy. Implemented code is not the same as an activated product feature. Real-token holder/non-holder browser-wallet acceptance remains required at launch; real MetaMask mint-signing QA has not been certified.</p>
    <h3>Planned / not yet active</h3>
    <ul className={styles.statusList}>
      <li>An approved production holder threshold and an official acquisition destination.</li>
      <li>A general production financial reputation model and autonomous task execution.</li>
      <li>Reputation-based borrowing limits, dynamic collateral requirements and reputation-adjusted rates.</li>
      <li>A fully autonomous credit-decision process or automatic financial permissions.</li>
      <li>$AME collateral markets or changes to the existing mainnet signing restrictions.</li>
    </ul>
    <p>Token activation is configuration-driven; it does not approve a lending market, deploy a contract or enable financial signing. Identity, product access and credit risk remain separate layers.</p>
    <p className={styles.note}>These docs describe the current implementation and intended direction. They do not promise credit, returns, collateral reductions or a launch date.</p>
  </Chapter>
</article>;}
