import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import hre from 'hardhat';
import {createPublicClient,http,erc20Abi,getAddress,encodeFunctionData,type Address} from 'viem';
import {MAINNET_CANDIDATES,MORPHO_ADDRESS,morphoABI} from '../../frontend/lib/morpho-config.ts';
import {readMorphoMarket} from '../../frontend/lib/morpho-mainnet.ts';
import {prepareMainnetAction,simulateMainnetAction,type MainnetAction} from '../../frontend/lib/morpho-adapter.ts';
// The network override is EDR simulated only. There is no mainnet wallet or signer.
const rpc=process.env.AME_MAINNET_FORK_RPC_URL||'https://rpc.mainnet.chain.robinhood.com';
const upstream=createPublicClient({transport:http(rpc,{retryCount:0,timeout:15000})});assert.equal(await upstream.getChainId(),4663);
const block=await upstream.getBlockNumber();
const connection=await hre.network.create({network:'hardhat',override:{chainId:4663,hardfork:'cancun',forking:{url:rpc,blockNumber:block}}});
// Execute on a newly mined local block; EDR has no historical hardfork schedule for chain 4663.
await connection.provider.request({method:'evm_mine',params:[]});
const c=await connection.viem.getPublicClient();const [wallet,outsider]=await connection.viem.getWalletClients();
const report={status:'RUNNING',forkBlock:String(block),publicBroadcasts:0,markets:[] as {label:string;checks:Record<string,string>}[],error:undefined as string|undefined};
const readClient=c as unknown as Parameters<typeof readMorphoMarket>[2];
async function send(call:{to:Address;data:`0x${string}`;value:bigint}){const hash=await wallet.sendTransaction({...call,chain:wallet.chain});const receipt=await c.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt;}
async function fund(token:Address,amount:bigint){
  const {keccak256,encodeAbiParameters,toHex}=await import('viem');
  for(let slot=0;slot<100;slot++){
    const key=keccak256(encodeAbiParameters([{type:'address'},{type:'uint256'}],[wallet.account.address,BigInt(slot)]));
    const prior=await c.getStorageAt({address:token,slot:key});
    await connection.provider.request({method:'hardhat_setStorageAt',params:[token,key,toHex(amount,{size:32})]});
    if(await c.readContract({address:token,abi:erc20Abi,functionName:'balanceOf',args:[wallet.account.address]})===amount)return;
    await connection.provider.request({method:'hardhat_setStorageAt',params:[token,key,prior||toHex(0n,{size:32})]});
  }
  throw new Error('Could not fund isolated fork token inventory');
}
try{
  for(const market of MAINNET_CANDIDATES){
    const checks:Record<string,string>={};report.markets.push({label:market.label,checks});
    const params=market.params,U=10n**6n,C=10n**BigInt(market.collateralDecimals);
    await fund(params.loanToken,2000n*U);await fund(params.collateralToken,1000n*C);
    const snapshot=()=>readMorphoMarket(market.id,wallet.account.address,readClient);
    const initial=await snapshot();assert.equal(initial.loanDecimals,6);assert.equal(initial.collateralDecimals,market.collateralDecimals);checks.discoveryAndBalances='PASS';
    async function action(name:MainnetAction,value:bigint){
      let draft=prepareMainnetAction(await snapshot(),name,value,wallet.account.address,4663);
      if(draft.approvals.length){assert.equal((await simulateMainnetAction(draft,readClient)).status,'APPROVAL_REQUIRED');for(const approval of draft.approvals)await send(approval);draft=prepareMainnetAction(await snapshot(),name,value,wallet.account.address,4663);assert.equal(draft.approvals.length,0);}
      assert.equal((await simulateMainnetAction(draft,readClient)).status,'SIMULATED_ONLY');
      const before=await snapshot();await send(draft.call);const after=await snapshot();
      if(name==='withdraw')assert.equal(before.position!.supplyShares-after.position!.supplyShares,draft.maxShares);
      return after;
    }
    await action('supply',500n*U);checks.supplyAdapterAndFiniteAllowance='PASS';
    await action('addCollateral',100n*C);checks.collateralAdapter='PASS';
    await assert.rejects(c.call({account:outsider.account,to:MORPHO_ADDRESS,data:encodeFunctionData({abi:morphoABI,functionName:'borrow',args:[params,10n*U,0n,wallet.account.address,outsider.account.address]})}));checks.authorizationRejection='PASS';
    const borrowed=await action('borrow',10n*U);assert.ok(borrowed.position!.debt>=10n*U);checks.borrowAdapterAndSimulation='PASS';
    await assert.rejects(c.simulateContract({address:MORPHO_ADDRESS,abi:morphoABI,functionName:'withdrawCollateral',args:[params,100n*C,wallet.account.address,wallet.account.address],account:wallet.account}));checks.healthRevert='PASS';
    const repaid=await action('repay',20n*U);assert.equal(repaid.position!.borrowShares,0n);checks.fullShareRepayAndRefresh='PASS';
    await action('removeCollateral',100n*C);checks.collateralRemoval='PASS';
    const withdrawn=await action('withdraw',100n*U);assert.ok(withdrawn.position!.supplied<410n*U);checks.withdrawShareBound='PASS';
    // Revoke residual finite fork-only approvals; no transaction is sent to upstream.
    for(const token of [params.loanToken,params.collateralToken])await send({to:token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[MORPHO_ADDRESS,0n]}),value:0n});
    const final=await snapshot();assert.equal(final.position!.loanAllowance,0n);assert.equal(final.position!.collateralAllowance,0n);checks.allowanceCleanup='PASS';
  }
  report.status='PASS';
}catch(error){report.status='FAIL';report.error=error instanceof Error?error.message.split('\n')[0]:'Unknown error';throw error;}
finally{await writeFile(new URL('../deployments/morpho-mainnet-fork.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await connection.close();console.log(JSON.stringify(report));}
