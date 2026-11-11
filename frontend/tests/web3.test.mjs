import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { connect, disconnect, getConnection, reconnect, switchChain } from 'wagmi/actions';
import { createWeb3Config } from '../lib/web3.ts';
import { developmentChain, robinhoodMainnet, robinhoodTestnet } from '../lib/chains.ts';
import { walletNetworkStatus } from '../lib/wallet-network.ts';
import { walletErrorMessage } from '../lib/wallet-errors.ts';

const account = '0x1234567890123456789012345678901234567890';
class TestProvider extends EventEmitter {
  isMetaMask = true;
  chainId = 1;
  accounts = [account];
  reject = false;
  rejectSwitch = false;
  unknownChain = false;
  requests = [];
  async request({ method, params }) {
    this.requests.push(method);
    if ((this.reject && ['wallet_requestPermissions', 'eth_requestAccounts'].includes(method)) || (this.rejectSwitch && method === 'wallet_switchEthereumChain')) {
      throw Object.assign(new Error('User rejected request'), { code: 4001 });
    }
    switch (method) {
      case 'wallet_requestPermissions': return [{ caveats: [{ value: this.accounts }] }];
      case 'wallet_revokePermissions': return null;
      case 'eth_accounts': case 'eth_requestAccounts': return this.accounts;
      case 'eth_chainId': return `0x${this.chainId.toString(16)}`;
      case 'wallet_addEthereumChain':
        this.unknownChain = false;
        this.chainId = Number(params[0].chainId);
        this.emit('chainChanged', params[0].chainId);
        return null;
      case 'wallet_switchEthereumChain':
        if (this.unknownChain) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
        this.chainId = Number(params[0].chainId);
        this.emit('chainChanged', params[0].chainId);
        return null;
      default: throw new Error(`Unexpected method: ${method}`);
    }
  }
}

function setup() {
  const provider = new TestProvider();
  const stored = new Map();
  globalThis.window = Object.assign(new EventTarget(), {
    ethereum: provider,
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: key => stored.delete(key),
    },
  });
  const config = createWeb3Config();
  return { config, connector: config.connectors[0], provider };
}

test('general wallet defaults to mainnet while identity/local chains remain available', () => {
  const { config } = setup();
  assert.equal(developmentChain.id, 31337);
  assert.deepEqual(config.chains.map(chain => chain.id), [4663, 46630, 31337]);
  assert.equal(config.state.chainId, 4663);
  assert.equal(robinhoodMainnet.id, 4663);
});

test('injected connection, wrong chain, rejected switch, successful switch, account change and disconnect', async () => {
  const { config, connector, provider } = setup();
  await connect(config, { connector });
  assert.equal(getConnection(config).address, account);
  assert.equal(getConnection(config).chainId, 1);
  provider.rejectSwitch = true;
  await assert.rejects(switchChain(config, { chainId: developmentChain.id }), error => walletErrorMessage(error).startsWith('REQUEST REJECTED'));
  assert.equal(getConnection(config).chainId, 1);
  provider.rejectSwitch = false;
  await switchChain(config, { chainId: developmentChain.id });
  assert.equal(getConnection(config).chainId, developmentChain.id);
  const changed = '0x2222222222222222222222222222222222222222';
  provider.accounts = [changed];
  provider.emit('accountsChanged', [changed]);
  assert.equal(getConnection(config).address, changed);
  await disconnect(config);
  assert.equal(getConnection(config).status, 'disconnected');
  assert.deepEqual(await reconnect(config), []);
  assert.ok(!provider.requests.some(method => /sign|sendTransaction/i.test(method)));
});

test('rejected connection leaves app disconnected and allows retry', async () => {
  const { config, connector, provider } = setup();
  provider.reject = true;
  await assert.rejects(connect(config, { connector }), error => walletErrorMessage(error).startsWith('REQUEST REJECTED'));
  assert.equal(getConnection(config).status, 'disconnected');
  provider.reject = false;
  await connect(config, { connector });
  assert.equal(getConnection(config).isConnected, true);
  await disconnect(config);
});

test('missing provider yields actionable error', async () => {
  const { config, connector } = setup();
  window.ethereum = undefined;
  await assert.rejects(connect(config, { connector }), error => walletErrorMessage(error).startsWith('PROVIDER UNAVAILABLE'));
});

test('reload restores authorized connection without another permissions request', async () => {
  const { config, connector, provider } = setup();
  await connect(config, { connector });
  await new Promise(resolve => setTimeout(resolve, 20));
  const count = provider.requests.filter(method => method === 'wallet_requestPermissions').length;
  const reloaded = createWeb3Config();
  await reloaded._internal.store.persist.rehydrate();
  await reconnect(reloaded);
  assert.equal(getConnection(reloaded).address, account);
  assert.equal(provider.requests.filter(method => method === 'wallet_requestPermissions').length, count);
  await disconnect(reloaded);
});

test('account revocation updates connection state', async () => {
  const { config, connector, provider } = setup();
  await connect(config, { connector });
  provider.emit('accountsChanged', []);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(getConnection(config).isConnected, false);
});

test('unknown testnet can be added through the injected connector', async () => {
  const { config, connector, provider } = setup();
  provider.unknownChain = true;
  await connect(config, { connector });
  await switchChain(config, { chainId: developmentChain.id });
  assert.equal(getConnection(config).chainId, developmentChain.id);
  assert.ok(provider.requests.includes('wallet_addEthereumChain'));
  await disconnect(config);
});

test('wallet-side chain changes update detected network', async () => {
  const { config, connector, provider } = setup();
  provider.chainId = developmentChain.id;
  await connect(config, { connector });
  assert.equal(getConnection(config).chainId, developmentChain.id);
  provider.chainId = 1;
  provider.emit('chainChanged', '0x1');
  assert.equal(getConnection(config).chainId, 1);
  await disconnect(config);
});

test('pending requests and provider offline errors have actionable messages', () => {
  assert.match(walletErrorMessage({ cause: { code: -32002 } }), /REQUEST PENDING/);
  assert.match(walletErrorMessage({ code: 4900 }), /PROVIDER OFFLINE/);
  assert.match(walletErrorMessage(new Error('RPC unavailable')), /REQUEST FAILED/);
});


for (const [id, name] of [[1,'Ethereum Mainnet'],[4663,'Robinhood Chain'],[46630,'Robinhood Chain Testnet'],[999999,'Unrecognized network']]) {
  test('connection on chain '+id+' is accepted without an automatic switch', async()=>{
    const {config,connector,provider}=setup();provider.chainId=id;
    await connect(config,{connector});
    assert.equal(getConnection(config).isConnected,true);
    assert.equal(getConnection(config).chainId,id);
    assert.equal(getConnection(config).address,account);
    const state=walletNetworkStatus(true,id);
    assert.equal(state.label,name+' · '+id);
    assert.equal(state.canSwitchToMainnet,id!==4663);
    assert.ok(!provider.requests.includes('wallet_switchEthereumChain'));
    provider.rejectSwitch=true;
    await assert.rejects(switchChain(config,{chainId:4663}),e=>walletErrorMessage(e).startsWith('REQUEST REJECTED'));
    assert.equal(getConnection(config).chainId,id);
    provider.rejectSwitch=false;
    await switchChain(config,{chainId:4663});
    assert.equal(getConnection(config).chainId,4663);
    await switchChain(config,{chainId:46630});
    assert.equal(getConnection(config).chainId,46630);
    await disconnect(config);
    assert.equal(walletNetworkStatus(false).label,'Not connected');
    assert.equal(walletNetworkStatus(false).canSwitchToMainnet,false);
    assert.ok(!provider.requests.some(method=>/sign|sendTransaction/i.test(method)));
  });
}
