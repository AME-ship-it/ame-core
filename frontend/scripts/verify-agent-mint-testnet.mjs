// Explicit, single-mint QA with an EXISTING disposable testnet signer. Never creates/stores keys.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createWalletClient,http,encodeFunctionData,keccak256,getAddress} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {agentClient,agentContract,readAgent,readOwnedAgentIds} from '../lib/agents.ts';
import {createMintController,confirmMint} from '../lib/mint.ts';
import {developmentChain} from '../lib/chains.ts';
const pendingFile=new URL('../../contracts/deployments/agent-mint-qa.pending.json',import.meta.url);
const reportFile=new URL('../../contracts/deployments/agent-mint-qa.json',import.meta.url);
async function run(){
  assert.equal(developmentChain.id,46630);assert.equal(await agentClient.getChainId(),46630);
  let pending;try{pending=JSON.parse(await readFile(pendingFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  let result,owner;
  if(pending){owner=getAddress(pending.owner);result=await confirmMint(agentClient,pending.hash,owner,()=>{});}
  else{
    assert.ok(process.argv.includes('--mint-testnet'),'Explicit --mint-testnet flag required');
    const keyFile=process.env.AME_DISPOSABLE_TESTNET_WALLETS_FILE;assert.ok(keyFile,'Existing disposable test-wallet file required');
    const keys=JSON.parse(await readFile(keyFile,'utf8'));
    const account=privateKeyToAccount(keys.lender);owner=account.address;
    const wallet=createWalletClient({account,chain:developmentChain,transport:http(undefined,{retryCount:0})});
    result=await createMintController().submit({owner,chainId:46630,optionalWallet:'',metadata:{name:'AME Deploy Agent QA',description:'Confirmed testnet NFT identity. No autonomous runtime or financial permissions.'},client:agentClient,onPhase:()=>{},onHash:()=>{},write:async(agentWallet,metadataURI)=>{
      const config=agentContract();const data=encodeFunctionData({abi:config.abi,functionName:'mint',args:[agentWallet,metadataURI]});
      const gas=(await agentClient.estimateGas({account:owner,to:config.address,data}))*12n/10n,gasPrice=(await agentClient.getGasPrice())*2n;
      assert.ok(gas*gasPrice<=100000000000000n,'Testnet QA fee budget exceeded');assert.ok(await agentClient.getBalance({address:owner})>=gas*gasPrice,'Insufficient testnet gas');
      const nonce=await agentClient.getTransactionCount({address:owner,blockTag:'pending'});
      const signed=await wallet.signTransaction({to:config.address,data,value:0n,gas,gasPrice,nonce});const hash=keccak256(signed);
      await writeFile(pendingFile,JSON.stringify({chainId:46630,owner,hash},null,2)+'\n',{flag:'wx'});
      assert.equal(await agentClient.sendRawTransaction({serializedTransaction:signed}),hash);return hash;
    }});
  }
  const receipt=await agentClient.waitForTransactionReceipt({hash:result.hash,confirmations:2});assert.equal(receipt.status,'success');
  const profile=await readAgent(result.id),owned=await readOwnedAgentIds(owner);assert.equal(profile.owner,owner);assert.equal(profile.wallet,owner);assert.ok(owned.includes(result.id));
  const report={status:'PASS',chainId:46630,contract:agentContract().address,transactionHash:result.hash,block:String(receipt.blockNumber),tokenId:String(result.id),owner,agentWallet:profile.wallet,metadataURI:profile.metadataURI,ownerVerified:true,directoryContainsMint:true,explorerUrl:`${developmentChain.blockExplorers.default.url}/tx/${result.hash}`,profileUrl:`https://ame-rosy.vercel.app/agent/${result.id}`,signerType:'Existing disposable testnet CLI signer',realMetaMaskQA:'NOT VERIFIED',mainnetBroadcasts:0};
  await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
run().catch(()=>{console.error('TESTNET MINT QA INCOMPLETE — inspect saved public pending hash and configuration before retrying. No signer details are logged.');process.exitCode=1;});
