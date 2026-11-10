import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import hre from 'hardhat';
import { getAddress, keccak256, parseEventLogs, stringToHex, zeroAddress, zeroHash } from 'viem';

const { viem } = await hre.network.create();
const publicClient = await viem.getPublicClient();
const [owner, agentWallet, outsider, nextOwner] = await viem.getWalletClients();
const metadata = 'ipfs://ame-agent-1';
const receiptURI = 'ipfs://ame-receipt-1';
const dataHash = keccak256(stringToHex('completed activity'));

async function fixture() {
  const agent = await viem.deployContract('AMEAgent');
  const receipt = await viem.deployContract('AMEReceipt', [agent.address]);
  await agent.write.mint([agentWallet.account.address, metadata]);
  return { agent, receipt };
}

describe('AMEAgent', () => {
  it('mints sequential IDs to the caller with ownership, assigned wallet, metadata and events', async () => {
    const agent = await viem.deployContract('AMEAgent');
    const hash = await agent.write.mint([agentWallet.account.address, metadata]);
    const tx = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(tx.status, 'success');
    assert.equal(await agent.read.ownerOf([1n]), getAddress(owner.account.address));
    assert.equal(await agent.read.agentWalletOf([1n]), getAddress(agentWallet.account.address));
    assert.equal(await agent.read.tokenURI([1n]), metadata);
    assert.equal(await agent.read.balanceOf([owner.account.address]), 1n);
    const events = parseEventLogs({ abi: agent.abi, logs: tx.logs, eventName: 'AgentMinted' });
    assert.equal(events.length, 1);
    assert.equal(events[0].args.agentId, 1n);
    assert.equal(events[0].args.owner, getAddress(owner.account.address));
    assert.equal(events[0].args.agentWallet, getAddress(agentWallet.account.address));
    assert.equal(events[0].args.metadataURI, metadata);
    assert.equal(parseEventLogs({ abi: agent.abi, logs: tx.logs, eventName: 'Transfer' }).length, 1);
    await agent.write.mint([outsider.account.address, 'ipfs://second'], { account: outsider.account });
    assert.equal(await agent.read.ownerOf([2n]), getAddress(outsider.account.address));
    assert.equal(await agent.read.nextAgentId(), 3n);
    assert.equal(await agent.read.supportsInterface(['0x80ac58cd']), true);
    assert.equal(await agent.read.supportsInterface(['0x5b5e139f']), true);
  });

  it('rejects zero wallet and empty metadata without consuming IDs', async () => {
    const agent = await viem.deployContract('AMEAgent');
    await assert.rejects(agent.write.mint([zeroAddress, metadata]), /InvalidAgentWallet/);
    await assert.rejects(agent.write.mint([agentWallet.account.address, '']), /EmptyMetadataURI/);
    assert.equal(await agent.read.nextAgentId(), 1n);
  });

  it('allows the owner to update wallet and metadata and emits exact changes', async () => {
    const { agent } = await fixture();
    const hash = await agent.write.setAgentWallet([1n, nextOwner.account.address]);
    const tx = await publicClient.waitForTransactionReceipt({ hash });
    const [event] = parseEventLogs({ abi: agent.abi, logs: tx.logs, eventName: 'AgentWalletUpdated' });
    assert.equal(event.args.previousWallet, getAddress(agentWallet.account.address));
    assert.equal(event.args.newWallet, getAddress(nextOwner.account.address));
    assert.equal(await agent.read.agentWalletOf([1n]), getAddress(nextOwner.account.address));
    const updated = 'ipfs://updated-agent';
    const metadataHash = await agent.write.setMetadataURI([1n, updated]);
    const metadataTx = await publicClient.waitForTransactionReceipt({ hash: metadataHash });
    const [metadataEvent] = parseEventLogs({ abi: agent.abi, logs: metadataTx.logs, eventName: 'AgentMetadataUpdated' });
    assert.equal(metadataEvent.args.metadataURI, updated);
    assert.equal(await agent.read.tokenURI([1n]), updated);
  });

  it('rejects mutations from strangers, assigned wallets and approved token operators', async () => {
    const { agent } = await fixture();
    await agent.write.approve([outsider.account.address, 1n]);
    for (const caller of [outsider, agentWallet]) {
      await assert.rejects(agent.write.setAgentWallet([1n, caller.account.address], { account: caller.account }), /NotAgentOwner/);
      await assert.rejects(agent.write.setMetadataURI([1n, 'ipfs://unauthorized'], { account: caller.account }), /NotAgentOwner/);
    }
    assert.equal(await agent.read.tokenURI([1n]), metadata);
    assert.equal(await agent.read.agentWalletOf([1n]), getAddress(agentWallet.account.address));
  });

  it('rejects invalid agent IDs across reads and owner mutations', async () => {
    const { agent } = await fixture();
    for (const id of [0n, 2n, 999n]) {
      await assert.rejects(agent.read.ownerOf([id]), /ERC721NonexistentToken/);
      await assert.rejects(agent.read.agentWalletOf([id]), /ERC721NonexistentToken/);
      await assert.rejects(agent.read.tokenURI([id]), /ERC721NonexistentToken/);
      await assert.rejects(agent.write.setAgentWallet([id, agentWallet.account.address]), /ERC721NonexistentToken/);
      await assert.rejects(agent.write.setMetadataURI([id, metadata]), /ERC721NonexistentToken/);
    }
  });

  it('rejects invalid owner updates without altering the agent', async () => {
    const { agent } = await fixture();
    await assert.rejects(agent.write.setAgentWallet([1n, zeroAddress]), /InvalidAgentWallet/);
    await assert.rejects(agent.write.setMetadataURI([1n, '']), /EmptyMetadataURI/);
    assert.equal(await agent.read.tokenURI([1n]), metadata);
  });

  it('transfers ownership, clears wallet authority, and lets only the new owner reassign it', async () => {
    const { agent, receipt } = await fixture();
    await receipt.write.createReceipt([1n, 0, dataHash, receiptURI], { account: agentWallet.account });
    const hash = await agent.write.transferFrom([owner.account.address, nextOwner.account.address, 1n]);
    const tx = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(await agent.read.ownerOf([1n]), getAddress(nextOwner.account.address));
    assert.equal(await agent.read.agentWalletOf([1n]), zeroAddress);
    assert.equal(await agent.read.tokenURI([1n]), metadata);
    const [event] = parseEventLogs({ abi: agent.abi, logs: tx.logs, eventName: 'AgentWalletUpdated' });
    assert.equal(event.args.newWallet, zeroAddress);
    for (const caller of [owner, agentWallet]) {
      await assert.rejects(receipt.write.createReceipt([1n, 0, dataHash, receiptURI], { account: caller.account }), /UnauthorizedIssuer/);
      await assert.rejects(agent.write.setAgentWallet([1n, caller.account.address], { account: caller.account }), /NotAgentOwner/);
    }
    await agent.write.setAgentWallet([1n, outsider.account.address], { account: nextOwner.account });
    await receipt.write.createReceipt([1n, 3, dataHash, receiptURI], { account: outsider.account });
    assert.equal((await receipt.read.getReceipt([1n])).issuer, getAddress(agentWallet.account.address));
  });

  it('rejects unauthorized transfers', async () => {
    const { agent } = await fixture();
    await assert.rejects(agent.write.transferFrom([owner.account.address, outsider.account.address, 1n], { account: outsider.account }), /ERC721InsufficientApproval/);
    assert.equal(await agent.read.ownerOf([1n]), getAddress(owner.account.address));
  });
});

describe('AMEReceipt', () => {
  it('records TASK, PAYMENT, SWAP and ACTION with sequential IDs, hashes, timestamps and events', async () => {
    const { receipt } = await fixture();
    for (const kind of [0, 1, 2, 3]) {
      const caller = kind % 2 === 0 ? owner : agentWallet;
      const hash = await receipt.write.createReceipt([1n, kind, dataHash, receiptURI], { account: caller.account });
      const tx = await publicClient.waitForTransactionReceipt({ hash });
      const id = BigInt(kind + 1);
      const record = await receipt.read.getReceipt([id]);
      assert.equal(record.agentId, 1n);
      assert.equal(record.receiptType, kind);
      assert.equal(record.issuer, getAddress(caller.account.address));
      assert.equal(record.dataHash, dataHash);
      assert.equal(record.metadataURI, receiptURI);
      assert.equal(record.timestamp, (await publicClient.getBlock({ blockNumber: tx.blockNumber })).timestamp);
      const [event] = parseEventLogs({ abi: receipt.abi, logs: tx.logs, eventName: 'ReceiptCreated' });
      assert.equal(event.args.receiptId, id);
      assert.equal(event.args.agentId, 1n);
      assert.equal(event.args.issuer, getAddress(caller.account.address));
      assert.equal(event.args.receiptType, kind);
      assert.equal(event.args.dataHash, dataHash);
      assert.equal(event.args.metadataURI, receiptURI);
    }
    assert.equal(await receipt.read.nextReceiptId(), 5n);
  });

  it('rejects receipt issuance for nonexistent agent IDs without consuming receipt IDs', async () => {
    const { receipt } = await fixture();
    for (const id of [0n, 2n, 999n]) await assert.rejects(receipt.write.createReceipt([id, 0, dataHash, receiptURI]), /ERC721NonexistentToken/);
    assert.equal(await receipt.read.nextReceiptId(), 1n);
  });

  it('rejects strangers and token-approved operators as issuers', async () => {
    const { agent, receipt } = await fixture();
    await agent.write.setApprovalForAll([outsider.account.address, true]);
    await assert.rejects(receipt.write.createReceipt([1n, 1, dataHash, receiptURI], { account: outsider.account }), /UnauthorizedIssuer/);
    assert.equal(await receipt.read.nextReceiptId(), 1n);
  });

  it('revokes receipt issuance from replaced agent wallets immediately', async () => {
    const { agent, receipt } = await fixture();
    await agent.write.setAgentWallet([1n, outsider.account.address]);
    await assert.rejects(receipt.write.createReceipt([1n, 0, dataHash, receiptURI], { account: agentWallet.account }), /UnauthorizedIssuer/);
    await receipt.write.createReceipt([1n, 0, dataHash, receiptURI], { account: outsider.account });
  });

  it('rejects empty hash/URI and invalid receipt enum values', async () => {
    const { receipt } = await fixture();
    await assert.rejects(receipt.write.createReceipt([1n, 0, zeroHash, receiptURI]), /EmptyDataHash/);
    await assert.rejects(receipt.write.createReceipt([1n, 0, dataHash, '']), /EmptyMetadataURI/);
    await assert.rejects(receipt.write.createReceipt([1n, 4, dataHash, receiptURI]));
    assert.equal(await receipt.read.nextReceiptId(), 1n);
  });

  it('rejects nonexistent receipt IDs and provides no receipt edit/delete methods', async () => {
    const { receipt } = await fixture();
    for (const id of [0n, 1n, 99n]) await assert.rejects(receipt.read.getReceipt([id]), /InvalidReceiptId/);
    const mutations = receipt.abi.flatMap(item => item.type === 'function' && ['nonpayable', 'payable'].includes(item.stateMutability) ? [item.name] : []);
    assert.deepEqual(mutations, ['createReceipt']);
  });

  it('rejects zero and non-contract registries at deployment', async () => {
    await assert.rejects(viem.deployContract('AMEReceipt', [zeroAddress]), /InvalidAgentRegistry/);
    await assert.rejects(viem.deployContract('AMEReceipt', [owner.account.address]), /InvalidAgentRegistry/);
  });
});
