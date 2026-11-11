import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { resolveNetwork, validateRPC } from '../lib/environment.ts';

test('identity deployment selects testnet while local development keeps localhost', () => {
  assert.equal(resolveNetwork(undefined, true), 'testnet');
  assert.equal(resolveNetwork('', true), 'testnet');
  assert.equal(resolveNetwork(undefined, false), 'localhost');
  assert.equal(resolveNetwork('mainnet', true), 'mainnet');
});

test('production wallet defaults to mainnet without redirecting identity contracts or adding localhost', () => {
  const env = { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_AME_NETWORK: 'testnet' };
  const source = `const {createWeb3Config}=await import('./lib/web3.ts');const {developmentChain}=await import('./lib/chains.ts');const c=createWeb3Config();console.log(JSON.stringify({default:c.state.chainId,chains:c.chains.map(x=>x.id),identity:developmentChain.id}));`;
  const result = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types','--input-type=module','-e',source], {cwd:new URL('../',import.meta.url),env,encoding:'utf8'}));
  assert.deepEqual(result,{default:4663,chains:[4663,46630],identity:46630});
});

test('production rejects localhost and unknown network values', () => {
  assert.throws(() => resolveNetwork('localhost', true), /development-only/);
  assert.throws(() => resolveNetwork('unexpected', true), /NEXT_PUBLIC_AME_NETWORK/);
});

test('public RPC requires HTTPS and rejects loopback endpoints', () => {
  for (const url of ['http://rpc.example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://0.0.0.0', 'file:///rpc', 'not-a-url']) {
    assert.throws(() => validateRPC(url, true));
  }
  assert.match(validateRPC('https://rpc.testnet.chain.robinhood.com', true), /^https:/);
  assert.equal(validateRPC('http://127.0.0.1:8545', false), 'http://127.0.0.1:8545/');
});

function productionConfiguration(overrides = {}) {
  const env = { ...process.env, NODE_ENV: 'production' };
  for (const key of ['NEXT_PUBLIC_AME_NETWORK', 'NEXT_PUBLIC_AME_AGENT_ADDRESS', 'NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK', 'NEXT_PUBLIC_AME_RECEIPT_ADDRESS', 'NEXT_PUBLIC_AME_RECEIPT_DEPLOYMENT_BLOCK']) delete env[key];
  Object.assign(env, overrides);
  const source = `const {contracts, contractConfigurationIssue, contractsConfigured} = await import('./lib/contracts.ts'); const {developmentChain, network} = await import('./lib/chains.ts'); console.log(JSON.stringify({network, id:developmentChain.id, rpc:developmentChain.rpcUrls.default.http[0], address:contracts.agent.address ?? null, block:String(contracts.agent.deploymentBlock), issue:contractConfigurationIssue, receiptAddress:contracts.receipt.address ?? null, receiptBlock:String(contracts.receipt.deploymentBlock), contractsConfigured}));`;
  return JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', source], { cwd: new URL('../', import.meta.url), env, encoding: 'utf8' }));
}

test('missing public contract config remains visible, disables reads and never uses local deployment', () => {
  const result = productionConfiguration();
  assert.equal(result.id, 46630);
  assert.equal(result.address, null);
  assert.match(result.rpc, /^https:/);
  assert.match(result.issue, /CONTRACT NOT CONFIGURED/);
});

test('malformed/zero contract addresses fail gracefully instead of crashing the build', () => {
  for (const address of ['invalid', '0x0000000000000000000000000000000000000000']) {
    const result = productionConfiguration({ NEXT_PUBLIC_AME_AGENT_ADDRESS: address });
    assert.equal(result.address, null);
    assert.match(result.issue, /CONFIGURATION INVALID/);
  }
});

test('public contracts require a deployment block; explicit valid config is accepted', () => {
  const address = '0x1111111111111111111111111111111111111111';
  for (const block of ['', '-1', 'invalid', '999999999999999999999999']) {
    const result = productionConfiguration({ NEXT_PUBLIC_AME_AGENT_ADDRESS: address, NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK: block });
    assert.equal(result.address, null);
    assert.match(result.issue, /DEPLOYMENT BLOCK/);
  }
  const configured = productionConfiguration({ NEXT_PUBLIC_AME_AGENT_ADDRESS: address, NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK: '123' });
  assert.equal(configured.issue, null);
  assert.equal(configured.address, address);
  assert.equal(configured.block, '123');
});

test('mainnet config is opt-in and does not inherit local contracts', () => {
  const result = productionConfiguration({ NEXT_PUBLIC_AME_NETWORK: 'mainnet' });
  assert.equal(result.id, 4663);
  assert.equal(result.address, null);
  assert.match(result.issue, /CONTRACT NOT CONFIGURED/);
});

test('receipt env mapping is independent, explicit and required for full deployment readiness', () => {
  const agent = { NEXT_PUBLIC_AME_AGENT_ADDRESS: '0x1111111111111111111111111111111111111111', NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK: '123' };
  const missing = productionConfiguration(agent);
  assert.equal(missing.receiptAddress, null); assert.equal(missing.contractsConfigured, false);
  const configured = productionConfiguration({ ...agent, NEXT_PUBLIC_AME_RECEIPT_ADDRESS: '0x2222222222222222222222222222222222222222', NEXT_PUBLIC_AME_RECEIPT_DEPLOYMENT_BLOCK: '124' });
  assert.equal(configured.receiptBlock, '124'); assert.equal(configured.receiptAddress, '0x2222222222222222222222222222222222222222');
  assert.equal(configured.contractsConfigured, true);
});
