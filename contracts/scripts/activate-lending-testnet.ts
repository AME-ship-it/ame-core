import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import hre from 'hardhat';
import {getAddress,getContractAddress,keccak256,type Address,type Hash} from 'viem';
if(process.env.AME_LENDING_TESTNET_APPROVED!=='YES_TEST_ASSETS_ONLY') throw new Error('Explicit test-assets-only authorization required');
const connection=await hre.network.create('robinhoodTestnet');
const {viem}=connection; const client=await viem.getPublicClient();
assert.equal(await client.getChainId(),46630);
const [admin]=await viem.getWalletClients(); assert.ok(admin?.account,'Funded authorized signer required');
const identity=JSON.parse(await readFile(new URL('../deployments/robinhood-testnet.json',import.meta.url),'utf8'));
assert.equal(identity.status,'deployed'); assert.equal(identity.chainId,46630);
for(const name of ['AMEAgent','AMEReceipt']) {
  const code=await client.getCode({address:identity.contracts[name].address}); assert.ok(code && code!=='0x');
  assert.equal(keccak256(code),identity.contracts[name].runtimeCodeHash);
}
const file=new URL('../deployments/lending-robinhood-testnet.json',import.meta.url);
type RecordEntry={address:Address;transactionHash:Hash;blockNumber?:string;runtimeCodeHash?:Hash};
type Manifest={schemaVersion:number;status:string;chainId:number;administrator:Address;agentRegistry:Address;testAssetsOnly:boolean;mockPrices:boolean;contracts:Record<string,RecordEntry>;riskParameters?:unknown;borrowingPaused?:boolean};
let m:Manifest;
try { m=JSON.parse(await readFile(file,'utf8')); assert.equal(m.chainId,46630); assert.equal(getAddress(m.administrator),getAddress(admin.account.address)); }
catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e; m={schemaVersion:2,status:'deploying',chainId:46630,administrator:getAddress(admin.account.address),agentRegistry:getAddress(identity.contracts.AMEAgent.address),testAssetsOnly:true,mockPrices:true,contracts:{}};}
async function save(){await writeFile(file,JSON.stringify(m,null,2)+'\n');}
async function deployed(name:string,artifact:string,args:readonly unknown[]):Promise<Address>{
  let r=m.contracts[name];
  if(!r){
    // Persist the submitted hash/address immediately; retries confirm instead of deploying again.
    const compiled=await hre.artifacts.readArtifact(artifact);
    const nonce=await client.getTransactionCount({address:admin.account.address,blockTag:'pending'});
    const address=getContractAddress({from:admin.account.address,nonce:BigInt(nonce)});
    const hash=await admin.deployContract({abi:compiled.abi,bytecode:compiled.bytecode as Hash,args:args as never});
    r={address,transactionHash:hash};m.contracts[name]=r;await save();
  }
  const receipt=await client.waitForTransactionReceipt({hash:r.transactionHash,confirmations:2});assert.equal(receipt.status,'success');
  assert.equal(getAddress(receipt.contractAddress!),getAddress(r.address));
  const code=await client.getCode({address:r.address});assert.ok(code && code!=='0x');
  const hash=keccak256(code);if(r.runtimeCodeHash)assert.equal(hash,r.runtimeCodeHash);
  r.blockNumber=String(receipt.blockNumber);r.runtimeCodeHash=hash;await save();
  console.log(JSON.stringify({component:name,...r}));return r.address;
}
const loan=await deployed('loanToken','AMEPublicTestToken',['AME TEST USD - NO VALUE','tUSD',6,1000_000000n]);
const col=await deployed('collateralToken','AMEPublicTestToken',['AME TEST COLLATERAL - NO VALUE','tCOL',18,100n*10n**18n]);
const oracle=await deployed('oracle','AMEPublicTestOracle',[loan,col]);
const market=await deployed('market','AMELending',[loan,col,m.agentRegistry,oracle,m.administrator]);
const lending=await viem.getContractAt('AMELending',market);
assert.equal(getAddress(await lending.read.agentRegistry()),m.agentRegistry);
assert.equal(getAddress(await lending.read.owner()),m.administrator);
m.borrowingPaused=await lending.read.borrowingPaused();
m.riskParameters={ltvBps:String(await lending.read.LTV_BPS()),liquidationBps:String(await lending.read.LIQUIDATION_BPS()),bonusBps:String(await lending.read.BONUS_BPS()),aprBps:String(await lending.read.APR_BPS()),borrowCap:String(await lending.read.borrowCap()),minimumBorrow:String(await lending.read.minimumBorrow()),maxPriceAgeSeconds:String(await lending.read.MAX_PRICE_AGE()),loanTermSeconds:String(await lending.read.LOAN_TERM()),faucetIntervalSeconds:86400,loanClaim:'1000 tUSD',collateralClaim:'100 tCOL',mockLoanPrice:'1 synthetic unit',mockCollateralPrice:'2 synthetic units'};
m.status='deployed-test-only';await save();
console.log(JSON.stringify({status:m.status,borrowingPaused:m.borrowingPaused,administrator:m.administrator}));await connection.close();
