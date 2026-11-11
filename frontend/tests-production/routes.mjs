import assert from 'node:assert/strict';
import { test } from 'node:test';

// Supports the safe unconfigured build and the real configured testnet build.
const origin = process.env.AME_QA_ORIGIN || 'http://127.0.0.1:3000';
const tokenActive=process.env.AME_QA_TOKEN_ACTIVE==='1';
const configured = process.env.AME_QA_CONTRACTS_CONFIGURED === '1';
const identityConfigured = process.env.AME_QA_IDENTITY_CONFIGURED === '1';
const cases = [
  ['/', 'Onchain reputation &amp; credit layer for autonomous agents.'], ['/deploy', 'DEPLOY AN AME'], ['/agents', 'YOUR AGENTS'],
  ['/agent/1', 'AME_0001'], ['/activity', 'ACTIVITY'], ['/treasury', 'TREASURY'], ['/score', 'SCORE'], ['/lending', 'Lending_'],
];
for (const [route, text] of cases) {
  test(`production ${route} responds with the real page (${configured ? 'testnet configured' : 'unconfigured'})`, async () => {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(!html.includes('https://github.com/AME-ship-it/ame-protocol'), 'Public pages must not link to the obsolete AME repository');
    assert.ok(html.includes(text));
    if(route !== '/') assert.equal(html.includes('CONTRACT NOT CONFIGURED'), !identityConfigured);
    // Network requirements belong to the identity flow, not every shared wallet modal.
    if (route === '/deploy') assert.match(html.replace(/<[^>]*>/g,''), /AGENT INITIALIZATION \/\s+ROBINHOOD CHAIN(?! TESTNET)/);
    if (['/activity', '/treasury', '/score'].includes(route)) assert.ok(html.includes('NOT AVAILABLE'));
    if (route === '/deploy') assert.match(html, /disabled=""/);
    assert.ok(!html.includes('ipfs://ame-local-agent-1'));
    assert.ok(!html.includes('Start the local node'));
  });
}

test('public lending is locked before wallet verification and has no actionable terminal',async()=>{
  const response=await fetch(origin+'/lending');assert.equal(response.status,200);const html=await response.text();
  for(const phrase of ['Holder-gated lending for autonomous agents.','CONNECT WALLET TO ACCESS LENDING','Product access follows the approved holder rules.'])assert.ok(html.includes(phrase));
  for(const marker of ['id="action-deposit"','id="terminal-amount"','Open owner-bound position','Refresh mock test quotes','id="mainnet-market-title"'])assert.ok(!html.includes(marker),marker);
  assert.ok(!html.includes('HOLDER VERIFIED'));assert.ok(!html.includes('Get $AME'));
});

test('holder endpoint is independently fail-closed before launch and rejects client authority',async()=>{
  const post=body=>fetch(origin+'/api/holder-access',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({walletAddress:'invalid'})).status,400);
  assert.equal((await post({walletAddress:'0x1000000000000000000000000000000000000001',isHolder:true})).status,400);
  const r=await post({walletAddress:'0x1000000000000000000000000000000000000001'}),d=await r.json();
  assert.equal(r.status,200);assert.equal(d.access,'locked');if(tokenActive){assert.equal(d.reason,'NOT_HOLDER');assert.equal(d.isHolder,false);assert.equal(d.tokenAddress.toLowerCase(),'0x5c5607a98e663e74590386dc7fa46de3cc7eb1b1');assert.equal(d.threshold,null);}else{assert.equal(d.reason,'PRE_LAUNCH');assert.equal(d.isHolder,null);assert.equal(d.tokenAddress,null);}assert.equal(d.tokenURL,null);assert.match(r.headers.get('cache-control'),/no-store/);
  assert.equal((await post({walletAddress:d.wallet,intent:'action'})).status,403);
});

for (const route of ['/', '/lending', '/nfts', '/protocol', '/docs']) {
  test(`shared header on ${route} exposes ordered lending navigation and accurate active state`, async () => {
    const response = await fetch(`${origin}${route}`); assert.equal(response.status, 200);
    const html = await response.text();
    const nav = html.match(/<nav\b[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, 'Shared navigation must exist');
    const links = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    assert.deepEqual(links.map(link => link[1].match(/href="([^"]+)"/)?.[1]), ['/nfts', '/protocol', '/lending', '/docs', 'https://x.com/ame_runtime', 'https://github.com/AME-ship-it/ame-core']);
    for(const [index,path] of [[0,'/nfts'],[1,'/protocol'],[2,'/lending'],[3,'/docs']]) assert.equal(links[index][1].includes('aria-current="page"'),route===path);
    assert.match(links[4][1], /target="_blank"/); assert.match(links[4][1], /rel="noopener noreferrer"/);
    assert.match(links[5][1], /target="_blank"/); assert.match(links[5][1], /rel="noopener noreferrer"/);
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ');
    assert.ok(!/\bexperiment(?:al)?\b/i.test(visible), 'Product UI must not contain experimental labels');
    assert.ok(html.includes('CONNECT WALLET'));
  });
}

test('homepage contains only the unchanged hero and functional creation CTA',async()=>{
  const html=await (await fetch(origin+'/')).text();
  const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];assert.ok(main);
  const text=main.replace(/<[^>]*>/g,' ').replaceAll('&amp;','&').replace(/\s+/g,' ');
  const heading=main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g,'').replaceAll('&amp;','&');
  assert.equal(heading,'Onchain reputation & credit layer for autonomous agents.');
  assert.ok(!text.includes('A presence.'));assert.ok(!text.includes('A history. An AME.'));
  assert.equal((main.match(/<section\b/g)||[]).length,2);
  assert.ok(text.includes('A SMALL BEGINNING. A PERSISTENT IDENTITY.'));
  assert.ok(text.includes('Give your agent a place to begin.'));
  const cta=main.match(/<section\b[^>]*aria-labelledby="create-title"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(cta);assert.match(cta,/<a\b[^>]*href="\/deploy"[^>]*>Create your AME/);
  assert.match(main,/<\/section>\s*$/,'Nothing follows the creation CTA inside main');
  for(const marker of ['editorial-section','identity-diagram','research-sheet','lifecycle','closing-section','id="docs"','id="nfts"','id="protocol"'])assert.ok(!main.includes(marker),marker);
  assert.match(main,/src="\/ame-cloud.png"/);assert.match(main,/class="cloud-mascot"/);assert.match(html,/CONNECT WALLET/);
});

for(const [route,markers] of [
  ['/docs',['Identity is the origin.','History is the signal.','Protocol state model','Current ERC-721 owner','H(t + 1) = H(t) ∥ r','/protocol']],
  ['/nfts',['An agent.','Not just an address.','identity-diagram','OWNER','METADATA','A transfer clears the previous wallet assignment','Give your agent a place to begin.']],
  ['/protocol',['A record of becoming.','lifecycle','Authorized actors append attestations.','DERIVED HISTORY','CONCEPTUAL MODEL','Receipts are attestations']],
])test(`${route} preserves the relocated documentation`,async()=>{
  const response=await fetch(origin+route);assert.equal(response.status,200);const html=await response.text();
  for(const marker of markers)assert.ok(html.includes(marker),marker);
  assert.ok(!html.includes('data-reveal'),'Documentation must be visible without reveal observers');
});

test('canonical docs expose working, unique contents anchors and preserve visual foundations',async()=>{
  const r=await fetch(origin+'/docs');assert.equal(r.status,200);const html=await r.text();
  const toc=html.match(/<nav\b[^>]*aria-label="Documentation contents"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(toc);
  for(const id of ['introduction','identity','receipts','memory','reputation','credit','lending','ame-access','state-model','architecture','current-status']){
    assert.ok(toc.includes(`href="#${id}"`),id);
    assert.equal([...html.matchAll(new RegExp(`\\bid="${id}"`,'g'))].length,1,`${id} must have one anchor target`);
  }
  for(const marker of ['A record of becoming.','Identity is the origin.','History is the signal.','Protocol state model','research-sheet','H(t + 1) = H(t) ∥ r','Each valid receipt extends'])assert.ok(html.includes(marker),marker);
});

test('docs distinguish attestation, informational scoring, product access and future credit policies',async()=>{
  const html=await (await fetch(origin+'/docs')).text();
  const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replaceAll('&amp;','&').replace(/\s+/g,' ');
  for(const phrase of ['Receipts are attestations, not proof of execution.','informational repayment score','Instant repayment and self-issued attestations do not earn positive credit history.','does not change borrowing limits, collateral requirements or interest rates.','REPUTATION ≠ TOKEN BALANCE','AGENT REPUTATION = CREDIT QUALITY','not an onchain allowlist','Verified $AME balance recognition is configured on Robinhood Chain Mainnet.','Mainnet signing and mainnet reputation writes remain disabled.'])assert.ok(text.includes(phrase),phrase);
});

test('docs explain the complete evidence and capital flows without inventing active task or token utility',async()=>{
  const html=await (await fetch(origin+'/docs')).text();
  for(const id of ['reputation-tasks','collateral','example','current-status'])assert.ok(html.includes(`id="${id}"`));
  for(const phrase of ['Task created','Agent performs task','Result verified','Receipt issued','History updated','Reputation recalculated','not a currently deployed generic task scheduler','Liquidity providers','Repayment + interest','AME does not create the lending capital.','Neither $AME collateral nor reputation-based reductions','illustrative future scenario','UNLOCK CREDIT PROFILE'])assert.ok(html.includes(phrase),phrase);
});

test('wallet status is contextual and docs opening has no obsolete global launch disclaimer',async()=>{
  const html=await (await fetch(origin+'/docs')).text();
  assert.ok(!html.includes('Identity and receipt primitives are implemented.'));
  assert.ok(html.includes('Connected network:'));
  assert.ok(html.includes('AME network:'));
  assert.ok(!html.includes('WRONG NETWORK'));
  assert.ok(!html.includes('Target:'));
});

test('Protocol V2 renders six labelled chapters, accessible diagrams and bounded financial claims',async()=>{
  const html=await (await fetch(origin+'/protocol')).text();
  const nav=html.match(/<nav[^>]*aria-label="Protocol chapters"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(nav);
  for(const id of ['identity','architecture','evidence','reputation','credit','lifecycle']){
    assert.ok(nav.includes('href="#'+id+'"'));
    assert.equal([...html.matchAll(new RegExp(' id="'+id+'"','g'))].length,1);
    assert.ok(html.includes('aria-labelledby="'+id+'-title"'));
    assert.ok(html.includes('id="'+id+'-title"'));
  }
  for(const label of ['Identity architecture','Agent to credit architecture','Conceptual reputation evaluation model','Lending capital and repayment flow','Protocol lifecycle stages'])assert.ok(html.includes('aria-label="'+label+'"'));
  const text=html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').replaceAll('&amp;','&').replace(/\s+/g,' ');
  for(const phrase of ['ERC-721 identity, not an executable runtime','Receipts are attestations, not proof of execution.','narrow informational repayment score','does not adjust borrowing limits','Mainnet transaction signing remains disabled.','reputation does not create capital or guarantee a loan.','an NFT transfer does not transfer a borrower','CONCEPTUAL MODEL'])assert.ok(text.includes(phrase),phrase);
  assert.ok(html.includes('href="/docs"'));assert.ok(html.includes('href="/nfts"'));assert.ok(html.includes('href="/lending"'));
  const header=html.match(/<nav[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(header);
  assert.deepEqual([...header.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim().replace(' ↗','')),['NFT','Protocol','Lending','Docs','X','GitHub']);
});

test('shared header exposes the exact AME token contract address without changing navigation destinations',async()=>{
  for(const route of ['/','/protocol','/lending']){
    const html=await (await fetch(origin+route)).text();const header=html.match(/<header[^>]*>([\s\S]*?)<\/header>/)?.[1];assert.ok(header);
    assert.ok(header.includes('0x5c5607a98e663e74590386dc7fa46de3cc7eb1b1'));
    assert.ok(header.includes('aria-label="Copy AME token contract address 0x5c5607a98e663e74590386dc7fa46de3cc7eb1b1"'));
  }
});

test('token API stays unactivated and rejects caller-selected tokens or authority',async()=>{
  const post=body=>fetch(origin+'/api/token-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const r=await post({walletAddress:'0x1000000000000000000000000000000000000001'}),d=await r.json();assert.equal(r.status,200);if(tokenActive){assert.equal(d.status,'synchronized');assert.equal(d.holderStatus,'NON_HOLDER');assert.equal(d.decimals,18);assert.equal(d.symbol,'AME');assert.equal(d.token.toLowerCase(),'0x5c5607a98e663e74590386dc7fa46de3cc7eb1b1');}else{assert.equal(d.status,'disabled');assert.equal(d.balance,null);assert.equal(d.token,null);}assert.equal(d.chainId,4663);assert.ok(!('access'in d));
  for(const b of [{walletAddress:'invalid'},{walletAddress:d.wallet,tokenAddress:'0x3000000000000000000000000000000000000003'}])assert.equal((await post(b)).status,400);
});
test('health is read-only, freshness-aware and does not disclose provider URLs',async()=>{
  const r=await fetch(origin+'/api/health'),d=await r.json();assert.ok([200,503].includes(r.status));assert.equal(d.chainId,4663);assert.ok(['available','unavailable'].includes(d.status));assert.ok(!JSON.stringify(d).includes('https://'));assert.match(r.headers.get('server-timing'),/app;dur=/);
});
test('performance ingestion accepts bounded numeric metrics, never wallet or arbitrary payload fields',async()=>{
  const post=body=>fetch(origin+'/api/performance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({name:'LCP',value:1000,rating:'good'})).status,204);
  assert.equal((await post({name:'LCP',value:1000,rating:'good',wallet:'private'})).status,400);
});

test('activated positive-balance holder is recognized while premium action preparation remains denied',{skip:!tokenActive},async()=>{
  const walletAddress='0x643eA4a6C540E26CfF04e7BC7f130B8810bB784B';
  const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const token=await (await post('/api/token-state',{walletAddress})).json();assert.equal(token.status,'synchronized');assert.equal(token.holderStatus,'HOLDER');assert.ok(BigInt(token.balance)>0n);
  const status=await (await post('/api/holder-access',{walletAddress})).json();assert.equal(status.isHolder,true);assert.equal(status.access,'locked');assert.equal(status.reason,'ENTITLEMENTS_DISABLED');assert.equal(status.threshold,null);
  assert.equal((await post('/api/holder-access',{walletAddress,intent:'action'})).status,403);
});
