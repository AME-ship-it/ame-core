import assert from 'node:assert/strict';
import { test } from 'node:test';

// Supports the safe unconfigured build and the real configured testnet build.
const origin = process.env.AME_QA_ORIGIN || 'http://127.0.0.1:3000';
const configured = process.env.AME_QA_CONTRACTS_CONFIGURED === '1';
const cases = [
  ['/', 'FINANCIAL REPUTATION'], ['/deploy', 'DEPLOY AN AME'], ['/agents', 'YOUR AGENTS'],
  ['/agent/1', 'AME_0001'], ['/activity', 'ACTIVITY'], ['/treasury', 'TREASURY'], ['/score', 'SCORE'], ['/lending', 'Lending_'],
];
for (const [route, text] of cases) {
  test(`production ${route} responds with the real page (${configured ? 'testnet configured' : 'unconfigured'})`, async () => {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(!html.includes('https://github.com/AME-ship-it/ame-protocol'), 'Public pages must not link to the obsolete AME repository');
    assert.ok(html.includes(text));
    assert.equal(html.includes('CONTRACT NOT CONFIGURED'), !configured);
    if (route !== '/') assert.ok(html.includes('Robinhood Chain Testnet'));
    if (['/activity', '/treasury', '/score'].includes(route)) assert.ok(html.includes('NOT AVAILABLE'));
    if (route === '/deploy') assert.match(html, /disabled=""/);
    assert.ok(!html.includes('ipfs://ame-local-agent-1'));
    assert.ok(!html.includes('Start the local node'));
  });
}

test('public lending reflects explicit market configuration and keeps disconnected actions disabled', async () => {
  if (process.env.AME_QA_LENDING_CONFIGURED === '1') {
    const response=await fetch(`${origin}/lending`);const html=await response.text();
    assert.equal(response.status,200);assert.ok(!html.includes('No lending market is deployed/configured'));
    assert.ok(html.includes('Reading the configured onchain market'));
    return;
  }
  const response = await fetch(`${origin}/lending`); const html = await response.text();
  assert.equal(response.status, 200); assert.ok(html.includes('LENDING UNAVAILABLE'));
  for (const label of ['Supply','Withdraw','Borrow','Repay up to amount','Add collateral','Remove collateral']) {
    // Conditional position controls need not render until an actual position exists.
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(match=>match[2].includes(label) && !/\brole="tab"/.test(match[1]));
    for (const match of buttons) assert.ok(match[1].includes('disabled'));
  }
  assert.match(html, /Borrow APR \/ simple<\/dt><dd>Unavailable<\/dd>/); // Inspect the APR field, not the unrelated 0.5% share-slippage disclosure.
});

test('lending terminal exposes all action panels, honest charts and safe mainnet navigation',async()=>{
  const response=await fetch(`${origin}/lending`);const html=await response.text();assert.equal(response.status,200);
  for(const action of ['deposit','borrow','repay','withdraw','addCollateral','removeCollateral'])assert.ok(html.includes(`id="action-${action}"`));
  assert.ok(html.includes('Market history'));assert.ok(html.includes('Asset allocation'));
  assert.ok(html.includes('Robinhood Mainnet · Read only'));assert.ok(html.includes('READY FOR INPUT'));
  const submit=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(m=>m[2].replace(/<!--.*?-->/g,'').replace(/<[^>]*>/g,'').trim()==='Supply ↗');
  assert.ok(submit && submit[1].includes('disabled'));
  assert.ok(!html.includes('MAINNET LENDING ENABLED'));
});


for (const route of ['/', '/lending']) {
  test(`shared header on ${route} exposes ordered lending navigation and accurate active state`, async () => {
    const response = await fetch(`${origin}${route}`); assert.equal(response.status, 200);
    const html = await response.text();
    const nav = html.match(/<nav\b[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, 'Shared navigation must exist');
    const links = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    assert.deepEqual(links.map(link => link[1].match(/href="([^"]+)"/)?.[1]), ['/lending', '/#nfts', '/#protocol', '/#docs', 'https://x.com/ame_runtime', 'https://github.com/AME-ship-it/ame-core']);
    assert.equal(links[0][1].includes('aria-current="page"'), route === '/lending');
    assert.match(links[4][1], /target="_blank"/); assert.match(links[4][1], /rel="noopener noreferrer"/);
    assert.match(links[5][1], /target="_blank"/); assert.match(links[5][1], /rel="noopener noreferrer"/);
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ');
    assert.ok(!/\bexperiment(?:al)?\b/i.test(visible), 'Product UI must not contain experimental labels');
    assert.ok(html.includes('CONNECT WALLET'));
  });
}
