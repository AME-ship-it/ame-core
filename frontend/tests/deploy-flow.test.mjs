// Integration tests use actual transactions on the configured local Hardhat node.
// The injected transport bridge is test-only and does not certify MetaMask QA.
import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { EventEmitter } from 'node:events';
import { createWalletClient, http, encodeFunctionData, getAddress, zeroAddress } from 'viem';
import { connect, disconnect, writeContract } from 'wagmi/actions';
import { createWeb3Config } from '../lib/web3.ts';
import { developmentChain } from '../lib/chains.ts';
import { contracts } from '../lib/contracts.ts';
import { agentClient, agentContract, readAgent, readOwnedAgentIds, parseAgentId, verifyDeployment, mintedAgentId, AgentNotFound } from '../lib/agents.ts';
import {parseIdentityMetadata} from '../lib/agent-metadata.ts';
import { createMintController, mintInputs, confirmMint, transactionError } from '../lib/mint.ts';

const walletClient = createWalletClient({ chain: developmentChain, transport: http() });
let accounts, owner, assigned, config, connector;
const rpc = async (method, params = []) => {
  const response = await fetch(developmentChain.rpcUrls.default.http[0], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const result = await response.json();
  if (result.error) throw Object.assign(new Error(result.error.message), result.error);
  return result.result;
};
class LocalInjectedBridge extends EventEmitter {
  rejectTransaction = false;
  async request({ method, params }) {
    if (method === 'wallet_requestPermissions') return [{ caveats: [{ value: [owner] }] }];
    if (method === 'wallet_revokePermissions') return null;
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [owner];
    if (this.rejectTransaction && method === 'eth_sendTransaction') throw Object.assign(new Error('User rejected'), { code: 4001 });
    return rpc(method, params);
  }
}
const bridge = new LocalInjectedBridge();
before(async () => {
  assert.equal(developmentChain.id, 31337);
  accounts = await walletClient.getAddresses(); owner = accounts[3]; assigned = accounts[4];
  await verifyDeployment();
  const stored = new Map();
  globalThis.window = Object.assign(new EventTarget(), { ethereum: bridge, localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) } });
  config = createWeb3Config(); connector = config.connectors[0];
  await connect(config, { connector });
});

const submit = (controller, overrides = {}) => controller.submit({
  owner, chainId: developmentChain.id, optionalWallet: '', client: agentClient,
  write: (agentWallet, metadataURI) => writeContract(config, { ...agentContract(), functionName: 'mint', args: [agentWallet, metadataURI], account: owner, chainId: developmentChain.id }),
  onPhase: () => {}, onHash: () => {}, ...overrides,
});

test('real injected Wagmi mint retrieves event ID, current ownership, optional wallet and inline metadata; fresh reads preserve state', async () => {
  const phases = []; let submitted;
  const nextId = await agentClient.readContract({ ...agentContract(), functionName: 'nextAgentId' });
  const result = await submit(createMintController(), { optionalWallet: assigned, onPhase: phase => phases.push(phase), onHash: hash => { submitted = hash; } });
  assert.equal(result.id, nextId); assert.equal(result.hash, submitted);
  assert.deepEqual(phases, ['waiting', 'submitted', 'pending', 'confirmed']);
  const profile = await readAgent(result.id);
  assert.equal(profile.owner, getAddress(owner)); assert.equal(profile.wallet, getAddress(assigned));
  assert.ok(profile.createdAt > 0n); assert.equal(profile.status, 'REGISTERED');
  assert.equal(JSON.parse(decodeURIComponent(profile.metadataURI.split(',')[1])).agentWallet, getAddress(assigned));
  assert.deepEqual(await readAgent(result.id), profile);
  const recovered = await confirmMint(agentClient, submitted, owner, () => {});
  assert.equal(recovered.id, result.id);
  assert.equal(await agentClient.readContract({ ...agentContract(), functionName: 'nextAgentId' }), nextId + 1n);
});

test('omitted agent wallet defaults to owner and one controller blocks duplicate submission', async () => {
  const controller = createMintController();
  const next = await agentClient.readContract({ ...agentContract(), functionName: 'nextAgentId' });
  const first = submit(controller);
  await assert.rejects(submit(controller), /MINT ALREADY IN PROGRESS/);
  const result = await first;
  assert.equal((await readAgent(result.id)).wallet, getAddress(owner));
  assert.equal(await agentClient.readContract({ ...agentContract(), functionName: 'nextAgentId' }), next + 1n);
});

test('rejected transaction does not mint, exposes rejection and permits a controlled retry', async () => {
  const next = await agentClient.readContract({ ...agentContract(), functionName: 'nextAgentId' });
  bridge.rejectTransaction = true;
  try {
    await assert.rejects(submit(createMintController()), error => transactionError(error).phase === 'rejected');
    assert.equal(await agentClient.readContract({ ...agentContract(), functionName: 'nextAgentId' }), next);
  } finally { bridge.rejectTransaction = false; }
});

test('wrong network and invalid wallet are rejected before requesting a transaction', async () => {
  let writes = 0;
  await assert.rejects(submit(createMintController(), { chainId: 1, write: async () => { writes++; } }), /WRONG NETWORK/);
  assert.equal(writes, 0);
  assert.throws(() => mintInputs(owner, zeroAddress), /INVALID AGENT WALLET/);
  assert.throws(() => mintInputs(owner, 'invalid-address'), /INVALID AGENT WALLET/);
});

test('invalid and nonexistent IDs produce clean not-found errors', async () => {
  for (const value of ['0', '-1', 'abc', '1.2', '0x1', '9'.repeat(79)]) assert.throws(() => parseAgentId(value), AgentNotFound);
  await assert.rejects(readAgent(999999999n), AgentNotFound);
});

test('event-derived owner list checks current ownership after transfer', async () => {
  const result = await submit(createMintController());
  assert.ok((await readOwnedAgentIds(owner)).includes(result.id));
  const hash = await walletClient.writeContract({ ...agentContract(), functionName: 'transferFrom', args: [owner, accounts[5], result.id], account: owner });
  await agentClient.waitForTransactionReceipt({ hash });
  assert.ok(!(await readOwnedAgentIds(owner)).includes(result.id));
  assert.ok((await readOwnedAgentIds(accounts[5])).includes(result.id));
  assert.equal((await readAgent(result.id)).wallet, zeroAddress);
});

test('a mined reverted transaction produces the reverted state and never a success ID', async () => {
  // Queue before mining so the local node returns the hash even for a transaction that reverts.
  await rpc('evm_setAutomine', [false]);
  let hash;
  try {
    hash = await walletClient.sendTransaction({ account: owner, to: contracts.agent.address, data: encodeFunctionData({ abi: contracts.agent.abi, functionName: 'mint', args: [zeroAddress, 'ipfs://invalid'] }), gas: 500000n });
    await rpc('evm_mine');
  } finally { await rpc('evm_setAutomine', [true]); }
  await assert.rejects(confirmMint(agentClient, hash, owner, () => {}), error => transactionError(error).phase === 'reverted');
});

test('RPC outage is distinguished from a nonexistent agent', async () => {
  const unreachable = { getChainId: async () => { throw Object.assign(new Error('RPC unavailable'), { name: 'HttpRequestError' }); } };
  await assert.rejects(verifyDeployment(unreachable), error => transactionError(error).phase === 'rpc-failure');
});

test('wallet change after simulation aborts before any write; gas and uncertain-send errors are distinct',async()=>{
  let writes=0;
  await assert.rejects(submit(createMintController(),{beforeWrite:()=>{throw Error('WALLET CHANGED');},write:async()=>{writes++;}}),e=>transactionError(e).phase==='wallet-changed');assert.equal(writes,0);
  await assert.rejects(submit(createMintController(),{write:async()=>{throw Object.assign(Error('insufficient funds'),{name:'InsufficientFundsError'});}}),e=>transactionError(e).phase==='insufficient-funds');
  await assert.rejects(submit(createMintController(),{write:async()=>{throw Object.assign(Error('response lost'),{name:'HttpRequestError'});}}),e=>transactionError(e).phase==='submission-unknown');
});
test('confirmation requires matching target, sender, arguments and ERC721 mint Transfer',async()=>{
  const result=await submit(createMintController(),{metadata:{name:'Verified identity',description:'NFT only'}});
  const receipt=await agentClient.getTransactionReceipt({hash:result.hash});
  const profile=await readAgent(result.id);assert.equal(parseIdentityMetadata(profile.metadataURI).name,'Verified identity');
  const filtered={...receipt,logs:receipt.logs.filter(log=>log.topics.length!==4||log.topics[0]!== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')};
  assert.throws(()=>mintedAgentId(filtered,owner),/Transfer/);
  assert.throws(()=>mintedAgentId(receipt,owner,{agentWallet:assigned,metadataURI:'different'}),/ARGUMENT/);
  await assert.rejects(confirmMint(agentClient,result.hash,assigned,()=>{}),/OWNER MISMATCH/);
  await assert.rejects(confirmMint(agentClient,result.hash,owner,()=>{},()=>{},{agentWallet:owner,metadataURI:'different'}),/ARGUMENT/);
  const replacementClient={...agentClient,waitForTransactionReceipt:async({onReplaced})=>{onReplaced({reason:'cancelled',transaction:{hash:result.hash}});return receipt;}};
  await assert.rejects(confirmMint(replacementClient,result.hash,owner,()=>{}),/REPLACED/);
});
test('unavailable history cannot hide valid owner/metadata reads; mismatched runtime always fails closed',async()=>{
  const minted=await submit(createMintController());
  const limited={...agentClient,getContractEvents:async()=>{throw Error('log RPC unavailable');}};
  const p=await readAgent(minted.id,limited);assert.equal(p.owner,getAddress(owner));assert.equal(p.createdAt,null);assert.ok(p.historyIssue);
  await assert.rejects(verifyDeployment({...agentClient,getCode:async()=>'0x6000'}),/BYTECODE MISMATCH/);
});
test('disconnect ends the automated injected session', async () => {
  await disconnect(config);
  assert.equal(config.state.status, 'disconnected');
});
