import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createPublicClient,createWalletClient,erc20Abi,formatUnits,http} from 'viem';
import {createHolderVerifier,readHolderConfig,handleHolderAccess} from '../lib/server/holder-access.ts';
import {holderPresentation,isUnlockedForWallet,holderGuardedAction} from '../lib/holder-access.ts';
const wallet='0x1000000000000000000000000000000000000001',other='0x2000000000000000000000000000000000000002',token='0x3000000000000000000000000000000000000003';
const cfg={token,chainId:1,threshold:'1.25',rpc:'https://ethereum.publicnode.com',tokenURL:null};
function setup({balance=1250000n,decimals=6,chain=1,config=()=>cfg}={}){
  let amount=balance,clock=1000,reads=0;
  const client={chain:async()=>chain,block:async()=>123n,code:async()=> '0x6000',decimals:async()=>decimals,balance:async()=>{reads++;return amount;}};
  const verify=createHolderVerifier({config,client:()=>client,now:()=>clock});
  return {verify,client,setBalance:v=>amount=v,tick:v=>clock+=v,reads:()=>reads};
}
const request=(body)=>new Request('https://ame.example/api/holder-access',{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'}});
test('disconnected wallet is locked even if previous holder data exists',async()=>{
  const data=await setup().verify(wallet);
  assert.equal(holderPresentation({connected:false,wallet,data,now:1001}),'disconnected');
  assert.equal(isUnlockedForWallet(data,undefined,1001),false);
});
test('malformed and zero wallets are rejected before an RPC read',async()=>{
  const s=setup();for(const address of ['garbage','0x123','0x'+'0'.repeat(40)]){const r=await handleHolderAccess(request({walletAddress:address}),s.verify);assert.equal(r.status,400);}assert.equal(s.reads(),0);
});
test('prelaunch stays locked and action preparation is denied without inventing a token',async()=>{
  const s=setup({config:()=>null});const response=await handleHolderAccess(request({walletAddress:wallet}),s.verify),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.reason,'PRE_LAUNCH');assert.equal(data.access,'locked');assert.equal(data.isHolder,null);assert.equal(data.tokenAddress,null);assert.equal(data.tokenURL,null);assert.equal(s.reads(),0);
  assert.equal((await handleHolderAccess(request({walletAddress:wallet,intent:'action'}),s.verify)).status,403);
});
test('RPC failures are unavailable, not a fabricated non-holder result',async()=>{
  const s=setup();s.client.balance=async()=>{throw new Error('private RPC error must not leak');};const response=await handleHolderAccess(request({walletAddress:wallet}),s.verify),data=await response.json();assert.equal(response.status,503);assert.equal(data.reason,'VERIFICATION_UNAVAILABLE');assert.equal(data.isHolder,null);assert.equal(data.balance,null);assert.ok(!JSON.stringify(data).includes('private RPC'));
});
for(const [balance,eligible] of [[0n,false],[1249999n,false],[1250000n,true],[1250001n,true],[9007199254740993000000n,true]])test(`integer balance ${balance} produces holder=${eligible}`,async()=>{
  const data=await setup({balance}).verify(wallet);assert.equal(data.isHolder,eligible);assert.equal(data.balance,String(balance));assert.equal(data.threshold,'1250000');assert.equal(data.access,eligible?'unlocked':'locked');assert.equal(isUnlockedForWallet(data,wallet,1001),eligible);
});
test('token decimals are read, not assumed to be 18',async()=>{
  const a=await setup({decimals:18,balance:1250000000000000000n}).verify(wallet);assert.equal(a.threshold,'1250000000000000000');assert.equal(a.isHolder,true);
  const b=await setup({decimals:0,balance:2n,config:()=>({...cfg,threshold:'2'})}).verify(wallet);assert.equal(b.threshold,'2');assert.equal(b.isHolder,true);
});
test('excess threshold precision is a configuration failure, never rounded',async()=>{
  const d=await setup({config:()=>({...cfg,threshold:'1.2500001'})}).verify(wallet);assert.equal(d.reason,'CONFIGURATION_ERROR');assert.equal(d.isHolder,null);
});
test('wrong chain, missing bytecode and invalid decimals fail closed',async()=>{
  assert.equal((await setup({chain:8453}).verify(wallet)).reason,'CONFIGURATION_ERROR');
  const a=setup();a.client.code=async()=> '0x';assert.equal((await a.verify(wallet)).reason,'CONFIGURATION_ERROR');
  assert.equal((await setup({decimals:256}).verify(wallet)).reason,'CONFIGURATION_ERROR');
});
test('partial, zero-threshold, fake-address and unknown-network configuration is rejected',()=>{
  assert.equal(readHolderConfig({}),null);
  assert.equal(readHolderConfig({AME_TOKEN_URL:'https://example.com'}),null);
  const env={AME_TOKEN_ADDRESS:token,AME_TOKEN_CHAIN_ID:'8453',AME_HOLDER_THRESHOLD:'1.25'};
  assert.equal(readHolderConfig(env).chainId,8453);assert.equal(readHolderConfig(env).tokenURL,null);
  for(const patch of [{AME_TOKEN_ADDRESS:''},{AME_HOLDER_THRESHOLD:'0'},{AME_HOLDER_THRESHOLD:'1e3'},{AME_TOKEN_CHAIN_ID:'999999'},{AME_TOKEN_ADDRESS:'0x'+'0'.repeat(40)},{AME_TOKEN_RPC_URL:'http://127.0.0.1:8545'},{AME_TOKEN_URL:'javascript:alert(1)'}])assert.throws(()=>readHolderConfig({...env,...patch}));
  assert.equal(readHolderConfig({...env,AME_TOKEN_CHAIN_ID:'999999',AME_TOKEN_RPC_URL:'https://rpc.example.com'}).chainId,999999);
});
test('frontend holder flags, thresholds and chain overrides cannot influence the endpoint',async()=>{
  const s=setup({balance:0n});for(const flags of [{isHolder:true},{holder:true},{threshold:'0'},{chainId:1},{access:'unlocked'}])assert.equal((await handleHolderAccess(request({walletAddress:wallet,...flags}),s.verify)).status,400);
  const r=await handleHolderAccess(request({walletAddress:wallet,intent:'action'}),s.verify);assert.equal(r.status,403);assert.equal((await r.json()).isHolder,false);
});
test('refresh and expiry observe a sold token balance, without stale success after RPC failure',async()=>{
  const s=setup();assert.equal((await s.verify(wallet)).access,'unlocked');s.setBalance(0n);assert.equal((await s.verify(wallet)).access,'unlocked');assert.equal(s.reads(),1);
  assert.equal((await s.verify(wallet,true)).access,'locked');s.setBalance(2000000n);s.tick(30001);assert.equal((await s.verify(wallet)).access,'unlocked');
  s.client.balance=async()=>{throw new Error('offline');};assert.equal((await s.verify(wallet,true)).reason,'VERIFICATION_UNAVAILABLE');assert.equal((await s.verify(wallet)).reason,'VERIFICATION_UNAVAILABLE');
});
test('cache isolates wallets, token addresses, chains and thresholds',async()=>{
  let c={...cfg};const s=setup({config:()=>c});await s.verify(wallet);await s.verify(other);assert.equal(s.reads(),2);c={...cfg,token:other};await s.verify(wallet);c={...cfg,threshold:'2'};await s.verify(wallet);assert.equal(s.reads(),4);
  c={...cfg,chainId:8453};assert.equal((await s.verify(wallet)).reason,'CONFIGURATION_ERROR');
});
test('eligibility cannot be reused for another account, expired response, failure, or spoofed boolean',async()=>{
  const d=await setup().verify(wallet);assert.equal(holderPresentation({connected:true,wallet,data:d,now:1001}),'unlocked');
  for(const value of [{...d,balance:'0'},{...d,threshold:'0'},{...d,status:'unavailable'},{...d,expiresAt:1000},{...d,isHolder:false}])assert.equal(isUnlockedForWallet(value,wallet,1001),false);
  assert.equal(isUnlockedForWallet(d,other,1001),false);assert.equal(holderPresentation({connected:true,wallet:other,data:d,now:1001}),'unavailable');
  assert.equal(holderPresentation({connected:true,wallet,data:d,failed:true,now:1001}),'unavailable');
});
test('wallet action callback runs only after a fresh independent server approval for the current account',async()=>{
  const s=setup();let writes=0,lastBody;const old=globalThis.fetch;
  globalThis.fetch=async(_url,init)=>{lastBody=JSON.parse(init.body);return handleHolderAccess(new Request('https://ame.example/api/holder-access',init),s.verify);};
  // Use current wall clock because the production client deliberately rejects expired test fixtures.
  const live=createHolderVerifier({config:()=>cfg,client:()=>s.client});
  globalThis.fetch=async(_url,init)=>{lastBody=JSON.parse(init.body);return handleHolderAccess(new Request('https://ame.example/api/holder-access',init),live);};
  try{
    assert.equal(await holderGuardedAction(wallet,()=>wallet,async()=>++writes),1);assert.equal(lastBody.intent,'action');
    s.setBalance(0n);await assert.rejects(holderGuardedAction(wallet,()=>wallet,async()=>++writes));assert.equal(writes,1);
    s.setBalance(2000000n);await assert.rejects(holderGuardedAction(wallet,()=>other,async()=>++writes));assert.equal(writes,1);
    s.client.balance=async()=>{throw new Error('offline');};await assert.rejects(holderGuardedAction(wallet,()=>wallet,async()=>++writes));assert.equal(writes,1);
  }finally{globalThis.fetch=old;}
});
test('acquisition CTA comes only from validated real launch configuration',async()=>{
  const s=setup({balance:0n,config:()=>({...cfg,tokenURL:'https://example.com/official-token'})});assert.equal((await s.verify(wallet)).tokenURL,'https://example.com/official-token');
});
test('verification pins token reads to the same actual block',async()=>{
  const s=setup();const seen=[];s.client.code=async(_token,block)=>{seen.push(block);return '0x6000';};s.client.decimals=async(_token,block)=>{seen.push(block);return 6;};s.client.balance=async(_token,_wallet,block)=>{seen.push(block);return 2000000n;};await s.verify(wallet);assert.deepEqual(seen,[123n,123n,123n]);
});
test('existing local ERC20 fixture is verified with real chain reads (no AME token is invented)',{skip:process.env.NEXT_PUBLIC_AME_NETWORK!=='localhost'},async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../contracts/deployments/lending-localhost.json',import.meta.url),'utf8'));
  const rpc=createPublicClient({transport:http('http://127.0.0.1:8545')}),accounts=await createWalletClient({transport:http('http://127.0.0.1:8545')}).getAddresses();
  const token=manifest.contracts.loanToken.address,owner=accounts[1],block=await rpc.getBlockNumber();
  const decimals=await rpc.readContract({address:token,abi:erc20Abi,functionName:'decimals',blockNumber:block});
  const balance=await rpc.readContract({address:token,abi:erc20Abi,functionName:'balanceOf',args:[owner],blockNumber:block});assert.ok(balance>0n);
  const verify=createHolderVerifier({config:()=>({token,chainId:31337,threshold:formatUnits(balance,decimals),rpc:'http://127.0.0.1:8545',tokenURL:null}),client:()=>({chain:()=>rpc.getChainId(),block:async()=>block,code:(address,blockNumber)=>rpc.getCode({address,blockNumber}),decimals:(address,blockNumber)=>rpc.readContract({address,abi:erc20Abi,functionName:'decimals',blockNumber}),balance:(address,wallet,blockNumber)=>rpc.readContract({address,abi:erc20Abi,functionName:'balanceOf',args:[wallet],blockNumber})})});
  const result=await verify(owner);assert.equal(result.access,'unlocked');assert.equal(result.balance,String(balance));assert.equal(result.threshold,String(balance));
});
