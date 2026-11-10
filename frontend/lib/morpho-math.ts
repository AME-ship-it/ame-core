import type {MorphoMarket} from './morpho-config.ts';
export const WAD=10n**18n,ORACLE_SCALE=10n**36n,SECONDS_PER_YEAR=31536000n;
export const ceilDiv=(n:bigint,d:bigint)=>{if(n<0n||d<=0n)throw new Error('Invalid unsigned ratio');return(n+d-1n)/d;};
export const assetsDown=(shares:bigint,assets:bigint,totalShares:bigint)=>shares*(assets+1n)/(totalShares+1000000n);
export const assetsUp=(shares:bigint,assets:bigint,totalShares:bigint)=>ceilDiv(shares*(assets+1n),totalShares+1000000n);
// Integer accounting and rounding follow Morpho's documented accrual/share rules.
// Source reference: morpho-blue v1.0.0 MathLib / SharesMathLib / MorphoBalancesLib.
export function accrueMarket(stored:MorphoMarket,rate:bigint,timestamp:bigint):MorphoMarket {
  if(timestamp<stored.lastUpdate||rate<0n)throw new Error('Invalid accrual inputs');
  const elapsed=timestamp-stored.lastUpdate;
  const first=rate*elapsed,second=first*first/(2n*WAD),third=second*first/(3n*WAD);
  const interest=stored.totalBorrowAssets*(first+second+third)/WAD;
  const feeAssets=interest*stored.fee/WAD;
  const supplyAssets=stored.totalSupplyAssets+interest;
  const feeShares=feeAssets*(stored.totalSupplyShares+1000000n)/(supplyAssets-feeAssets+1n);
  return {...stored,totalSupplyAssets:supplyAssets,totalBorrowAssets:stored.totalBorrowAssets+interest,totalSupplyShares:stored.totalSupplyShares+feeShares,lastUpdate:timestamp};
}
export function positionRisk(collateral:bigint,debt:bigint,price:bigint|null,lltv:bigint,liquidity:bigint){
  if(price===null||price<=0n)return {collateralValue:null,capacity:null,health:null};
  const collateralValue=collateral*price/ORACLE_SCALE;
  const limit=collateralValue*lltv/WAD;
  const capacity=limit>debt?limit-debt:0n;
  return {collateralValue,capacity:capacity<liquidity?capacity:liquidity,health:debt===0n?null:limit*WAD/debt};
}
export function annualizedRates(rate:bigint,market:MorphoMarket){
  const utilization=market.totalSupplyAssets>0n?market.totalBorrowAssets*WAD/market.totalSupplyAssets:0n;
  const borrowApr=Number(rate*SECONDS_PER_YEAR)/1e18;
  const supplyRate=rate*utilization/WAD*(WAD-market.fee)/WAD;
  const supplyApy=Math.expm1(Number(supplyRate*SECONDS_PER_YEAR)/1e18);
  return {utilization,borrowApr:Number.isFinite(borrowApr)?borrowApr:null,supplyApy:Number.isFinite(supplyApy)?supplyApy:null};
}
