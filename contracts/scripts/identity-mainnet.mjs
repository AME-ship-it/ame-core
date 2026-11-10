// Default is preparation only. No testnet key is ever read by this tool.
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createPublicClient,createWalletClient,defineChain,http,encodeDeployData,keccak256,toHex,getAddress,getContractAddress} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
const dir=new URL('../deployments/',import.meta.url);
const rpc=process.env.AME_MAINNET_IDENTITY_RPC_URL||'https://rpc.mainnet.chain.robinhood.com';
assert.equal(new URL(rpc).protocol,'https:','Remote HTTPS RPC required');
const chain=defineChain({id:4663,name:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[rpc]}}});
const client=createPublicClient({chain,transport:http(rpc,{retryCount:0,timeout:15000})});
const artifact=JSON.parse(await readFile(new URL('../artifacts/contracts/AMEAgent.sol/AMEAgent.json',import.meta.url),'utf8'));
const data=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode,args:[]});
const runtimeHash=keccak256(artifact.deployedBytecode);
const digest=keccak256(toHex(JSON.stringify({chainId:4663,contract:'AMEAgent',data,runtimeHash})));
const pendingFile=new URL('identity-mainnet.pending.json',dir),finalFile=new URL('identity-mainnet.json',dir);
async function verify(address,hash){
  assert.equal(await client.getChainId(),4663,'Wrong chain');
  const code=await client.getCode({address});assert.ok(code&&keccak256(code)===runtimeHash,'Runtime mismatch');
  const tx=await client.getTransaction({hash}),receipt=await client.getTransactionReceipt({hash});
  assert.equal(tx.to,null);assert.equal(tx.input,data);assert.equal(tx.value,0n);assert.equal(receipt.status,'success');assert.equal(getAddress(receipt.contractAddress),getAddress(address));
  const name=await client.readContract({address,abi:artifact.abi,functionName:'name'});assert.equal(name,'AME Agent');
  return {chainId:4663,contract:'AMEAgent',address:getAddress(address),transactionHash:hash,block:String(receipt.blockNumber),runtimeHash,digest,sourceVerification:'Local creation/runtime match; submit exported standard JSON to a supported source verifier separately',financialPermissionsEnabled:false};
}
async function run(){
  const mode=process.argv[2]||'--prepare';assert.equal(await client.getChainId(),4663,'Wrong chain');
  if(mode==='--prepare'){
    const buildDir=new URL('../artifacts/build-info/',import.meta.url);
    const inputs=await readdir(buildDir);let build;
    for(const file of inputs.filter(f=>f.endsWith('.json')&&!f.endsWith('.output.json'))){const j=JSON.parse(await readFile(new URL(file,buildDir),'utf8'));if(Object.keys(j.input?.sources||{}).some(k=>k.endsWith('/contracts/AMEAgent.sol'))){build=j;break;}}
    assert.ok(build,'Compile existing contracts first');
    // Reproduce the artifact from the exact compiler input, without changing any source.
    const {default:solc}=await import('solc');assert.ok(solc.version().startsWith(build.solcVersion));
    const compiled=JSON.parse(solc.compile(JSON.stringify(build.input)));
    assert.ok(!compiled.errors?.some(e=>e.severity==='error'),'Source reproduction failed');
    const sourceName=Object.keys(build.input.sources).find(k=>k.endsWith('/contracts/AMEAgent.sol'));
    const output=compiled.contracts[sourceName].AMEAgent;
    assert.equal('0x'+output.evm.bytecode.object,artifact.bytecode,'Creation reproduction mismatch');
    assert.equal('0x'+output.evm.deployedBytecode.object,artifact.deployedBytecode,'Runtime reproduction mismatch');
    const estimate=await client.estimateGas({data});const gasLimit=estimate*12n/10n;const price=await client.getGasPrice();
    await writeFile(new URL('identity-mainnet.standard-json.json',dir),JSON.stringify(build.input,null,2)+'\n');
    const plan={status:'PREPARED_NOT_AUTHORIZED',chainId:4663,contract:'AMEAgent',constructorArgs:[],compiler:build.solcLongVersion,settings:build.input.settings,digest,runtimeHash,gasEstimate:String(estimate),gasLimit:String(gasLimit),observedGasPrice:String(price),estimatedFeeWei:String(gasLimit*price),creationData:data,newContractsBroadcast:0,financialPermissionsEnabled:false};
    await writeFile(new URL('identity-mainnet.plan.json',dir),JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({status:plan.status,digest,runtimeHash,sourceReproduced:true,newContractsBroadcast:0}));return;
  }
  if(mode==='--verify'){console.log(JSON.stringify(await verify(getAddress(process.argv[3]),process.argv[4])));return;}
  assert.equal(mode,'--broadcast-approved','Unknown mode');
  // Requires a separately reviewed, expiring approval file and a dedicated mainnet signer.
  // Preparing this script does not constitute authorization to invoke this mode.
  const approval=JSON.parse(await readFile(process.argv[3],'utf8'));
  assert.equal(approval.action,'DEPLOY_AME_AGENT_ONLY');assert.equal(approval.chainId,4663);assert.equal(approval.digest,digest);assert.equal(approval.allowBroadcast,true);
  assert.ok(Number.isFinite(Date.parse(approval.expiresAt))&&Date.parse(approval.expiresAt)>Date.now(),'Approval expired');
  const account=privateKeyToAccount(process.env.AME_MAINNET_IDENTITY_PRIVATE_KEY||'');assert.equal(account.address,getAddress(approval.deployer));
  const wallet=createWalletClient({account,chain,transport:http(rpc,{retryCount:0})});
  let saved;try{saved=JSON.parse(await readFile(finalFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(saved){assert.equal(saved.digest,digest);console.log(JSON.stringify(await verify(saved.address,saved.transactionHash)));return;}
  let pending;try{pending=JSON.parse(await readFile(pendingFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(pending){assert.equal(pending.digest,digest);assert.equal(pending.deployer,account.address);const result=await verify(pending.address,pending.hash);await writeFile(finalFile,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return;}
  const gas=(await client.estimateGas({account:account.address,data}))*12n/10n,gasPrice=(await client.getGasPrice())*2n;
  assert.ok(gas*gasPrice<=BigInt(approval.maxTotalFeeWei),'Approved fee cap exceeded');assert.ok(await client.getBalance({address:account.address})>=gas*gasPrice,'Insufficient approved signer balance');
  const nonce=await client.getTransactionCount({address:account.address,blockTag:'pending'});
  const signed=await wallet.signTransaction({data,value:0n,gas,gasPrice,nonce});const hash=keccak256(signed),address=getContractAddress({from:account.address,nonce:BigInt(nonce)});
  // Persist the deterministic hash before broadcast; never silently repeat an uncertain deployment.
  await writeFile(pendingFile,JSON.stringify({digest,deployer:account.address,address,hash,nonce},null,2)+'\n',{flag:'wx'});
  assert.equal(await client.sendRawTransaction({serializedTransaction:signed}),hash);
  await client.waitForTransactionReceipt({hash,confirmations:2,timeout:180000});const result=await verify(address,hash);
  await writeFile(finalFile,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
run().catch(error=>{console.error(JSON.stringify({status:'FAILED_NO_AUTOMATIC_RETRY',reason:error instanceof assert.AssertionError?error.message:'Check RPC, input, approval and saved transaction evidence. Signer/request details are not logged.'}));process.exitCode=1;});
