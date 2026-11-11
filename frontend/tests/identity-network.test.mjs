import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {resolveIdentityNetwork} from '../lib/identity-network.ts';
import {readFileSync} from 'node:fs';
const load=(extra={})=>{
 const env={...process.env,NODE_ENV:'production',NEXT_PUBLIC_AME_NETWORK:'testnet',NEXT_PUBLIC_AME_AGENT_ADDRESS:'0x1111111111111111111111111111111111111111',NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK:'123',NEXT_PUBLIC_AME_IDENTITY_NETWORK:'testnet'};
 for(const key of ['NEXT_PUBLIC_AME_MAINNET_AGENT_ADDRESS','NEXT_PUBLIC_AME_MAINNET_AGENT_DEPLOYMENT_BLOCK','NEXT_PUBLIC_AME_MAINNET_RECEIPT_ADDRESS','NEXT_PUBLIC_AME_MAINNET_RECEIPT_DEPLOYMENT_BLOCK'])delete env[key];
 return JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`const {identityChain,developmentChain}=await import('./lib/chains.ts');const {contracts,contractConfigurationIssue}=await import('./lib/identity-contracts.ts');const {contracts:legacy}=await import('./lib/contracts.ts');const {agentClient}=await import('./lib/lending-client.ts');console.log(JSON.stringify({identity:identityChain.id,lending:developmentChain.id,lendingClient:agentClient.chain.id,identityAddress:contracts.agent.address??null,legacyAddress:legacy.agent.address,issue:contractConfigurationIssue}));`],{cwd:new URL('../',import.meta.url),env:{...env,...extra},encoding:'utf8'}));
};
test('production identity is mainnet even with legacy testnet env; no testnet address fallback',()=>{
 const d=load();assert.equal(d.identity,4663);assert.equal(d.lending,46630);assert.equal(d.lendingClient,46630);assert.equal(d.identityAddress,null);assert.equal(d.legacyAddress,'0x1111111111111111111111111111111111111111');assert.match(d.issue,/Robinhood Chain/);
});
test('mainnet configuration requires its own valid address and deployment block',()=>{
 for(const extra of [{NEXT_PUBLIC_AME_MAINNET_AGENT_ADDRESS:'invalid'},{NEXT_PUBLIC_AME_MAINNET_AGENT_ADDRESS:'0x0000000000000000000000000000000000000000'},{NEXT_PUBLIC_AME_MAINNET_AGENT_ADDRESS:'0x2222222222222222222222222222222222222222'}])assert.equal(load(extra).identityAddress,null);
 const d=load({NEXT_PUBLIC_AME_MAINNET_AGENT_ADDRESS:'0x2222222222222222222222222222222222222222',NEXT_PUBLIC_AME_MAINNET_AGENT_DEPLOYMENT_BLOCK:'456'});assert.equal(d.identityAddress,'0x2222222222222222222222222222222222222222');assert.equal(d.issue,null);
});
test('development retains separate local and testnet identity modes',()=>{
 assert.equal(resolveIdentityNetwork(undefined,false,'localhost'),'localhost');assert.equal(resolveIdentityNetwork('testnet',false,'localhost'),'testnet');assert.equal(resolveIdentityNetwork('mainnet',false,'testnet'),'mainnet');assert.equal(resolveIdentityNetwork('testnet',true,'testnet'),'mainnet');
});
test('mint entry remains guarded, uses real ABI and verifies runtime before simulation',()=>{
 const ui=readFileSync(new URL('../components/DeployAgent.tsx',import.meta.url),'utf8');assert.match(ui,/identityChain as developmentChain/);assert.match(ui,/if \(contractConfigurationIssue \|\|/);assert.match(ui,/disabled=\{!connected.*!contracts.agent.address/);assert.match(ui,/IDENTITY UNAVAILABLE/);
 const mint=readFileSync(new URL('../lib/mint.ts',import.meta.url),'utf8');assert.ok(mint.indexOf('await verifyDeployment(client)')<mint.indexOf('await client.simulateContract'));assert.match(mint,/chainId !== developmentChain.id/);
 const agents=readFileSync(new URL('../lib/agents.ts',import.meta.url),'utf8');assert.match(agents,/CONTRACT BYTECODE MISMATCH/);
});
