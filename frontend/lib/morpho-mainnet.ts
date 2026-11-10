import {encodeAbiParameters,erc20Abi,getAddress,keccak256,type Address,type Hex} from 'viem';
import {mainnetReadClient} from './lending-history.ts';
import {MAINNET_CANDIDATES,MORPHO_ADDRESS,MORPHO_CHAIN_ID,MORPHO_RUNTIME_HASH,morphoABI,morphoIrmABI,morphoOracleABI,feedRoundABI,type MainnetCandidate,type MorphoMarket,type MorphoParams} from './morpho-config.ts';
import {accrueMarket,annualizedRates,assetsDown,assetsUp,positionRisk} from './morpho-math.ts';
import {readOracleConfiguration} from './morpho-oracles.ts';
export const paramsComponents=[{name:'loanToken',type:'address'},{name:'collateralToken',type:'address'},{name:'oracle',type:'address'},{name:'irm',type:'address'},{name:'lltv',type:'uint256'}] as const;
export function marketId(params:MorphoParams){return keccak256(encodeAbiParameters([{type:'tuple',components:paramsComponents}],[params]));}
export function candidateFor(id:Hex):MainnetCandidate {
  const candidate=MAINNET_CANDIDATES.find(m=>m.id.toLowerCase()===id.toLowerCase());
  if(!candidate||marketId(candidate.params)!==candidate.id)throw new Error('Market is not in the verified read-only candidate registry.');return candidate;
}
export function assertParams(expected:MorphoParams,actual:readonly [Address,Address,Address,Address,bigint]){
  for(const [i,key]of ['loanToken','collateralToken','oracle','irm'].entries())if(getAddress(expected[key as keyof MorphoParams] as Address)!==getAddress(actual[i] as Address))throw new Error('Onchain market parameters do not match the verified registry.');
  if(actual[4]!==expected.lltv)throw new Error('Onchain liquidation LTV mismatch.');
}
export async function verifyMainnetCore(client=mainnetReadClient){
  if(await client.getChainId()!==MORPHO_CHAIN_ID)throw new Error('Mainnet RPC chain mismatch.');
  const code=await client.getCode({address:MORPHO_ADDRESS});
  if(!code||keccak256(code)!==MORPHO_RUNTIME_HASH)throw new Error('Canonical Morpho runtime hash mismatch; reads blocked.');
}
export async function readMorphoMarket(id:Hex,account?:Address,mainnetReadClientOverride=mainnetReadClient){
  const mainnetReadClient=mainnetReadClientOverride;
  const candidate=candidateFor(id);await verifyMainnetCore(mainnetReadClient);
  const block=await mainnetReadClient.getBlock();
  const core={address:MORPHO_ADDRESS,abi:morphoABI,blockNumber:block.number} as const;
  const [params,tuple,owner,feeRecipient,irmEnabled,lltvEnabled]=await Promise.all([
    mainnetReadClient.readContract({...core,functionName:'idToMarketParams',args:[id]}),mainnetReadClient.readContract({...core,functionName:'market',args:[id]}),
    mainnetReadClient.readContract({...core,functionName:'owner'}),mainnetReadClient.readContract({...core,functionName:'feeRecipient'}),
    mainnetReadClient.readContract({...core,functionName:'isIrmEnabled',args:[candidate.params.irm]}),mainnetReadClient.readContract({...core,functionName:'isLltvEnabled',args:[candidate.params.lltv]}),
  ]);assertParams(candidate.params,params);
  if(!irmEnabled||!lltvEnabled||tuple[4]===0n)throw new Error('Market dependency is not enabled or market does not exist.');
  const stored:MorphoMarket={totalSupplyAssets:tuple[0],totalSupplyShares:tuple[1],totalBorrowAssets:tuple[2],totalBorrowShares:tuple[3],lastUpdate:tuple[4],fee:tuple[5]};
  const dependencyHashes:Record<string,Hex>={};
  for(const [name,address]of Object.entries({loan:candidate.params.loanToken,collateral:candidate.params.collateralToken,oracle:candidate.params.oracle,irm:candidate.params.irm})){
    const code=await mainnetReadClient.getCode({address,blockNumber:block.number});if(!code||code==='0x')throw new Error(`${name} dependency bytecode missing.`);dependencyHashes[name]=keccak256(code);
  }
  const token=(address:Address)=>({address,abi:erc20Abi,blockNumber:block.number} as const);
  const [loanSymbol,loanDecimals,collateralSymbol,collateralDecimals,rate,price,poolCash]=await Promise.all([
    mainnetReadClient.readContract({...token(params[0]),functionName:'symbol'}),mainnetReadClient.readContract({...token(params[0]),functionName:'decimals'}),
    mainnetReadClient.readContract({...token(params[1]),functionName:'symbol'}),mainnetReadClient.readContract({...token(params[1]),functionName:'decimals'}),
    mainnetReadClient.readContract({address:params[3],abi:morphoIrmABI,functionName:'borrowRateView',args:[candidate.params,stored],blockNumber:block.number}),
    mainnetReadClient.readContract({address:params[2],abi:morphoOracleABI,functionName:'price',blockNumber:block.number}).catch(()=>null),
    mainnetReadClient.readContract({...token(params[0]),functionName:'balanceOf',args:[MORPHO_ADDRESS]}),
  ]);
  if(loanDecimals!==candidate.loanDecimals||collateralDecimals!==candidate.collateralDecimals)throw new Error('Asset precision differs from verified configuration.');
  const market=accrueMarket(stored,rate,block.timestamp);
  const accounted=market.totalSupplyAssets>market.totalBorrowAssets?market.totalSupplyAssets-market.totalBorrowAssets:0n;
  const liquidity=accounted<poolCash?accounted:poolCash;
  const feeds=await Promise.all(candidate.feeds.map(async address=>{
    try {const round=await mainnetReadClient.readContract({address,abi:feedRoundABI,functionName:'latestRoundData',blockNumber:block.number});return {address,answer:round[1],updatedAt:round[3],roundConsistent:round[1]>0n&&round[3]>0n&&round[3]<=block.timestamp&&round[4]>=round[0]};}
    catch{return {address,answer:null,updatedAt:null,roundConsistent:false};}
  }));
  let position=null;
  if(account){
    const [p,loanBalance,collateralBalance,loanAllowance,collateralAllowance]=await Promise.all([
      mainnetReadClient.readContract({...core,functionName:'position',args:[id,account]}),
      mainnetReadClient.readContract({...token(params[0]),functionName:'balanceOf',args:[account]}),mainnetReadClient.readContract({...token(params[1]),functionName:'balanceOf',args:[account]}),
      mainnetReadClient.readContract({...token(params[0]),functionName:'allowance',args:[account,MORPHO_ADDRESS]}),mainnetReadClient.readContract({...token(params[1]),functionName:'allowance',args:[account,MORPHO_ADDRESS]}),
    ]);
    const supplyShares=p[0]+(getAddress(account)===getAddress(feeRecipient)?market.totalSupplyShares-stored.totalSupplyShares:0n);
    const supplied=assetsDown(supplyShares,market.totalSupplyAssets,market.totalSupplyShares);
    const debt=assetsUp(p[1],market.totalBorrowAssets,market.totalBorrowShares);
    position={account:getAddress(account),supplyShares,borrowShares:p[1],collateral:p[2],supplied,debt,loanBalance,collateralBalance,loanAllowance,collateralAllowance,...positionRisk(p[2],debt,price,candidate.params.lltv,liquidity)};
  }
  const oracleConfiguration=await readOracleConfiguration(mainnetReadClient,candidate.params.oracle,block.number,candidate.id===MAINNET_CANDIDATES[0].id);
  if(oracleConfiguration.feed&&candidate.feeds[0]?.toLowerCase()!==oracleConfiguration.feed.toLowerCase())throw new Error('Oracle feed differs from the reviewed configuration.');
  return {candidate,block:block.number,timestamp:block.timestamp,stored,market,owner,feeRecipient,dependencyHashes,loanSymbol,loanDecimals,collateralSymbol,collateralDecimals,rate,price,liquidity,poolCash,feeds,oracleConfiguration,position,...annualizedRates(rate,market),writesApproved:false as const,oracleReview:'PENDING — oracle configuration is observed; market-specific freshness, depeg, governance and liquidation policies are not approved.'};
}
export type MorphoSnapshot=Awaited<ReturnType<typeof readMorphoMarket>>;
export async function readMorphoWalletHistory(id:Hex,account:Address){
  candidateFor(id);await verifyMainnetCore();const last=await mainnetReadClient.getBlockNumber();const first=last>4999n?last-4999n:0n;
  const common={address:MORPHO_ADDRESS,abi:morphoABI,args:{id,onBehalf:account},fromBlock:first,toBlock:last,strict:true} as const;
  const [borrow,repay]=await Promise.all([
    mainnetReadClient.getContractEvents({...common,eventName:'Borrow'}),mainnetReadClient.getContractEvents({...common,eventName:'Repay'}),
  ]);
  return [...borrow,...repay].sort((a,b)=>a.blockNumber<b.blockNumber?-1:a.blockNumber>b.blockNumber?1:a.logIndex-b.logIndex);
}
