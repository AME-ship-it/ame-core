import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {getAddress,keccak256} from 'viem';
import {agentClient} from '../lib/agents.ts';
import {readLendingMarket} from '../lib/lending.ts';
const manifest=JSON.parse(await readFile(new URL('../../contracts/deployments/lending-robinhood-testnet.json',import.meta.url),'utf8'));
const proof=JSON.parse(await readFile(new URL('../../contracts/deployments/lending-testnet-verification.json',import.meta.url),'utf8'));
test('all configured lending components have confirmed testnet receipts and matching bytecode',async()=>{
  assert.equal(await agentClient.getChainId(),46630);assert.equal(proof.status,'PASS');
  for(const entry of Object.values(manifest.contracts)){
    const receipt=await agentClient.getTransactionReceipt({hash:entry.transactionHash});assert.equal(receipt.status,'success');
    assert.equal(String(receipt.blockNumber),entry.blockNumber);
    const code=await agentClient.getCode({address:entry.address});assert.ok(code && code!=='0x');assert.equal(keccak256(code),entry.runtimeCodeHash);
  }
});
test('frontend SDK reads genuine seeded liquidity, faucet limits and verified repayment after a fresh load',async()=>{
  const data=await readLendingMarket(getAddress(manifest.administrator),BigInt(proof.positionId));
  assert.equal(data.address,getAddress(manifest.contracts.market.address));assert.equal(data.paused,false);
  assert.ok(data.cash>=200_000000n);assert.ok(data.supplyBalance>=199_000000n);assert.equal(data.credit.debt,0n);
  assert.equal(data.credit.position.closed,true);assert.equal(data.credit.history[0],1n);assert.equal(data.credit.history[2],10_000000n);
  assert.equal(data.credit.reputation,0n);assert.equal(data.faucet.loanClaim,1000_000000n);assert.equal(data.faucet.collateralClaim,100n*10n**18n);
});
