import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import hre from 'hardhat';
import {createWalletClient,getContract,http,parseEventLogs,getAddress,type Address,type Hash} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
if(process.env.AME_LENDING_TESTNET_APPROVED!=='YES_TEST_ASSETS_ONLY')throw new Error('Explicit testnet authorization required');
if(!process.env.AME_TEST_WALLETS_FILE)throw new Error('Private disposable-wallet file path required outside frontend');
const connection=await hre.network.create('robinhoodTestnet');const {viem}=connection;
const client=await viem.getPublicClient();assert.equal(await client.getChainId(),46630);
const [admin]=await viem.getWalletClients();assert.ok(admin?.account);
const manifestFile=new URL('../deployments/lending-robinhood-testnet.json',import.meta.url);
const m=JSON.parse(await readFile(manifestFile,'utf8'));
assert.equal(m.chainId,46630);assert.equal(getAddress(admin.account.address),getAddress(m.administrator));
const reportFile=new URL('../deployments/lending-testnet-verification.json',import.meta.url);
// Refuse to repeat a completed funded lifecycle accidentally.
try{const old=JSON.parse(await readFile(reportFile,'utf8'));if(old.status==='PASS')throw new Error('Lifecycle already passed; inspect saved evidence, do not repeat');}
catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
let keys:{lender:Hash;borrower:Hash};
try{keys=JSON.parse(await readFile(process.env.AME_TEST_WALLETS_FILE,'utf8'));}
catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;keys={lender:generatePrivateKey(),borrower:generatePrivateKey()};await writeFile(process.env.AME_TEST_WALLETS_FILE,JSON.stringify(keys),{flag:'wx',mode:0o600});}
const wallet=(key:Hash)=>createWalletClient({account:privateKeyToAccount(key),chain:admin.chain,transport:http(process.env.AME_TESTNET_RPC_URL||'https://rpc.testnet.chain.robinhood.com')});
const lender=wallet(keys.lender),borrower=wallet(keys.borrower);
const artifacts=await Promise.all(['AMELending','AMEPublicTestToken','AMEPublicTestOracle','AMEAgent'].map(n=>hre.artifacts.readArtifact(n)));
const contract=(name:string,index:number,w:any=admin)=>getContract({address:m.contracts[name]?.address||m.agentRegistry,abi:artifacts[index].abi,client:{public:client,wallet:w}});
const market=contract('market',0),loan=contract('loanToken',1),col=contract('collateralToken',1),oracle=contract('oracle',2),agent=contract('agent',3,borrower);
const lm=contract('market',0,lender),bm=contract('market',0,borrower),ll=contract('loanToken',1,lender),bl=contract('loanToken',1,borrower),bc=contract('collateralToken',1,borrower);
const evidence:any={status:'RUNNING',chainId:46630,market:m.contracts.market.address,administrator:admin.account.address,lender:lender.account.address,borrower:borrower.account.address,metaMaskQA:'NOT VERIFIED',transactions:[],checks:{}};
async function save(){await writeFile(reportFile,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?String(v):v,2)+'\n');}
async function confirmed(label:string,hash:Hash){
  evidence.transactions.push({label,hash,state:'submitted'});await save();
  const r=await client.waitForTransactionReceipt({hash,confirmations:2});assert.equal(r.status,'success',label);
  Object.assign(evidence.transactions.at(-1),{state:'confirmed',blockNumber:r.blockNumber});await save();console.log(label,hash);return r;
}
async function tx(label:string,c:any,fn:string,args:readonly unknown[]=[]){return confirmed(label,await c.write[fn](args));}
const U=10n**6n,C=10n**18n;
let passed=false;
try{
  await tx('pause before validation',market,'setBorrowingPaused',[true]);assert.equal(await market.read.borrowingPaused(),true);
  for(const w of [lender,borrower]){
    if(await client.getBalance({address:w.account.address})<100000000000000n)
      await confirmed('fund disposable test wallet',await admin.sendTransaction({to:w.account.address,value:200000000000000n}));
  }
  await tx('lender faucet claim',ll,'claim');await tx('borrower loan faucet claim',bl,'claim');await tx('borrower collateral faucet claim',bc,'claim');
  assert.equal(await ll.read.balanceOf([lender.account.address]),1000n*U);assert.equal(await bc.read.balanceOf([borrower.account.address]),100n*C);
  await assert.rejects(client.simulateContract({address:loan.address,abi:artifacts[1].abi,functionName:'claim',account:lender.account}));
  evidence.checks.faucet='PASS: balances and same-wallet cooldown verified';await save();
  await tx('approve supply',ll,'approve',[market.address,500n*U]);await tx('supply liquidity',lm,'depositWithMinShares',[500n*U,lender.account.address,500n*U*1000000n]);
  assert.equal(await market.read.availableLiquidity(),500n*U);assert.equal(await lm.read.balanceOf([lender.account.address]),500n*U*1000000n);
  evidence.checks.supply='PASS';
  const minted=await tx('mint disposable tester identity',agent,'mint',[borrower.account.address,'data:application/json,%7B%22name%22%3A%22AME%20testnet%20lending%20QA%22%7D']);
  const [mint]=parseEventLogs({abi:artifacts[3].abi,logs:minted.logs,eventName:'AgentMinted'});assert.ok(mint);
  const agentId=(mint.args as any).agentId;
  const opened=await tx('open borrower position',bm,'openPosition',[agentId]);
  const [event]=parseEventLogs({abi:artifacts[0].abi,logs:opened.logs,eventName:'PositionOpened'});assert.ok(event);const id=(event.args as any).positionId;
  evidence.agentId=agentId;evidence.positionId=id;await save();
  await tx('approve collateral',bc,'approve',[market.address,100n*C]);await tx('deposit collateral',bm,'addCollateral',[id,100n*C]);
  assert.equal((await bm.read.position([id]) as any).collateral,100n*C);assert.equal(await market.read.totalCollateral(),100n*C);evidence.checks.collateral='PASS';
  await assert.rejects(client.simulateContract({address:market.address,abi:artifacts[0].abi,functionName:'borrow',args:[id,10n*U],account:borrower.account}));
  evidence.checks.pausedBorrow='PASS';
  await tx('refresh fixed mock quotes',oracle,'refresh');await tx('enable controlled testnet borrowing',market,'setBorrowingPaused',[false]);
  assert.equal(await market.read.borrowingPaused(),false);
  await assert.rejects(client.simulateContract({address:market.address,abi:artifacts[0].abi,functionName:'borrow',args:[id,10n*U],account:admin.account}));
  await assert.rejects(client.simulateContract({address:market.address,abi:artifacts[0].abi,functionName:'borrow',args:[id,101n*U],account:borrower.account}));
  evidence.checks.authorizationAndLtv='PASS';
  const before=await bl.read.balanceOf([borrower.account.address]) as bigint;
  const borrow=await tx('small controlled borrow',bm,'borrow',[id,10n*U]);
  assert.equal(await bl.read.balanceOf([borrower.account.address]),before+10n*U);assert.equal(await market.read.totalPrincipal(),10n*U);
  assert.ok((await market.read.healthFactor([id]) as bigint)>10n**18n);
  assert.equal(parseEventLogs({abi:artifacts[0].abi,logs:borrow.logs,eventName:'Borrowed'}).length,1);evidence.checks.borrow='PASS';
  await assert.rejects(client.simulateContract({address:market.address,abi:artifacts[0].abi,functionName:'removeCollateral',args:[id,100n*C],account:borrower.account}));
  await assert.rejects(client.simulateContract({address:market.address,abi:artifacts[0].abi,functionName:'withdraw',args:[500n*U,lender.account.address,lender.account.address],account:lender.account}));
  evidence.checks.withdrawalSolvency='PASS';
  await tx('pause with active debt',market,'setBorrowingPaused',[true]);
  await tx('approve repayment',bl,'approve',[market.address,20n*U]);const repaid=await tx('repay while paused',bm,'repay',[id,20n*U]);
  assert.equal(await bm.read.debtOf([id]),0n);assert.equal(await market.read.totalPrincipal(),0n);
  const history=await market.read.history([agentId]) as readonly bigint[];assert.equal(history[0],1n);assert.equal(history[2],10n*U);
  const receipts=parseEventLogs({abi:artifacts[0].abi,logs:repaid.logs,eventName:'FinancialReceipt'});assert.equal(receipts.length,1);assert.equal((receipts[0].args as any).kind,1);
  assert.equal(await market.read.reputationScore([agentId]),0n);evidence.checks.repay='PASS';evidence.checks.reputation='PASS: verified completion; instant repayment earns zero reputation';
  await tx('release collateral',bm,'removeCollateral',[id,100n*C]);assert.equal(await market.read.totalCollateral(),0n);
  await tx('withdraw supplied liquidity',lm,'withdrawWithMaxShares',[500n*U,lender.account.address,lender.account.address,(await lm.read.balanceOf([lender.account.address]))]);
  assert.equal(await ll.read.balanceOf([lender.account.address]),1000n*U);evidence.checks.withdraw='PASS';
  // Seed a small pool of valueless public tester liquidity after the full lifecycle succeeds.
  if(await loan.read.balanceOf([admin.account.address]) as bigint<200n*U) await tx('administrator test faucet claim',loan,'claim');
  await tx('approve public test liquidity',loan,'approve',[market.address,200n*U]);await tx('seed public test liquidity',market,'depositWithMinShares',[200n*U,admin.account.address,1n]);
  await tx('refresh public mock quotes',oracle,'refresh');await tx('enable validated public testnet borrowing',market,'setBorrowingPaused',[false]);
  assert.equal(await market.read.borrowingPaused(),false);assert.ok((await market.read.availableLiquidity() as bigint)>=200n*U);
  evidence.status='PASS';evidence.borrowingPaused=false;evidence.finalCash=await market.read.availableLiquidity();evidence.finalPrincipal=await market.read.totalPrincipal();
  m.borrowingPaused=false;m.status='deployed-tested-active-test-only';await writeFile(manifestFile,JSON.stringify(m,null,2)+'\n');passed=true;await save();
}catch(error){evidence.status='FAIL';evidence.error=error instanceof Error?error.message:'Unknown failure';throw error;}
finally{
  if(!passed){try{await tx('FAILSAFE pause',market,'setBorrowingPaused',[true]);evidence.borrowingPaused=await market.read.borrowingPaused();}catch{evidence.pauseRecovery='UNCONFIRMED — administrator action required';}await save();}
  await connection.close();
}
