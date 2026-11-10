import {writeFile} from 'node:fs/promises';
import {MAINNET_CANDIDATES,MORPHO_ADDRESS,MORPHO_RUNTIME_HASH} from '../lib/morpho-config.ts';
import {readMorphoMarket,verifyMainnetCore} from '../lib/morpho-mainnet.ts';
await verifyMainnetCore();
const records=[];
for(const c of MAINNET_CANDIDATES){
  const m=await readMorphoMarket(c.id);
  records.push({id:c.id,label:c.label,params:c.params,block:m.block,timestamp:m.timestamp,loanDecimals:m.loanDecimals,collateralDecimals:m.collateralDecimals,liquidity:m.liquidity,market:m.market,borrowApr:m.borrowApr,supplyApy:m.supplyApy,price:m.price,feeds:m.feeds,dependencyHashes:m.dependencyHashes,owner:m.owner,feeRecipient:m.feeRecipient,oracleReview:m.oracleReview});
}
const report={status:'VERIFIED_READS_ONLY',chainId:4663,core:MORPHO_ADDRESS,coreRuntimeHash:MORPHO_RUNTIME_HASH,officialDeploymentSource:'https://docs.morpho.org/developers/contracts/addresses/',discoverySource:'https://api.morpho.org/graphql',auditSource:'https://docs.morpho.org/get-started/resources/audits/',securityApproved:false,mainnetSigningEnabled:false,publicBroadcasts:0,markets:records};
await writeFile(new URL('../../contracts/deployments/morpho-robinhood-mainnet.json',import.meta.url),JSON.stringify(report,(_,v)=>typeof v==='bigint'?String(v):v,2)+'\n');
console.log(JSON.stringify({status:report.status,markets:records.map(r=>({label:r.label,liquidity:String(r.liquidity),block:String(r.block)})),publicBroadcasts:0}));
