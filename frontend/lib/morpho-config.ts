import {parseAbi,type Address,type Hex} from 'viem';
// Canonical deployment: https://docs.morpho.org/developers/contracts/addresses/
export const MORPHO_CHAIN_ID=4663;
export const MORPHO_ADDRESS='0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010' as const;
export const MORPHO_RUNTIME_HASH='0x753b54fdb48c87c9c1ba1dcc3a330faac1a401a3bd23b43104b7b92409ecb424' as const;
// There is deliberately no environment-variable switch for live mainnet signing.
export const MAINNET_WRITES_APPROVED=false;
export type MorphoParams={loanToken:Address;collateralToken:Address;oracle:Address;irm:Address;lltv:bigint};
export type MorphoMarket={totalSupplyAssets:bigint;totalSupplyShares:bigint;totalBorrowAssets:bigint;totalBorrowShares:bigint;lastUpdate:bigint;fee:bigint};
export type MainnetCandidate={id:Hex;label:string;params:MorphoParams;loanDecimals:number;collateralDecimals:number;creationBlock:bigint;feeds:readonly Address[]};
const loanToken='0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const;
const irm='0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1' as const;
export const MAINNET_CANDIDATES:readonly MainnetCandidate[]=[
  {id:'0xc845da65a020ddca5f132efa8fea79676d8edfdea504226a4c01e7a9e34cddd6',label:'USDe / USDG',params:{loanToken,collateralToken:'0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34',oracle:'0xE64849bd4AD03DfaBbe02bb521de19997a19055f',irm,lltv:915000000000000000n},loanDecimals:6,collateralDecimals:18,creationBlock:45057n,feeds:['0xd9B1f2958298F25bf1289B5aaB7fB6d1B7416c95']},
  {id:'0x919a9b6b94dae7c86620eaf7a08e597aae8a4c3a9e9c7671771fbaf62b6b61c7',label:'syrupUSDG / USDG',params:{loanToken,collateralToken:'0x40858070814a57FdF33a613ae84fE0a8b4a874f7',oracle:'0x152c638fad68913739Ee19Ba8eF47fAEB09DCa91',irm,lltv:915000000000000000n},loanDecimals:6,collateralDecimals:6,creationBlock:43404n,feeds:['0x3bEdEA9CE3ead0Db4EA60dC497568DEdDe85dBa3']},
];
// Interface subset from morpho-org/morpho-blue v1.0.0; no wrapper contract.
export const morphoABI=parseAbi([
  'struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }',
  'function idToMarketParams(bytes32) view returns(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)',
  'function market(bytes32) view returns(uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee)',
  'function position(bytes32,address) view returns(uint256 supplyShares,uint128 borrowShares,uint128 collateral)',
  'function isAuthorized(address,address) view returns(bool)',
  'function isIrmEnabled(address) view returns(bool)',
  'function isLltvEnabled(uint256) view returns(bool)',
  'function owner() view returns(address)',
  'function feeRecipient() view returns(address)',
  'function supply(MarketParams,uint256 assets,uint256 shares,address onBehalf,bytes data) returns(uint256 assetsSupplied,uint256 sharesSupplied)',
  'function withdraw(MarketParams,uint256 assets,uint256 shares,address onBehalf,address receiver) returns(uint256 assetsWithdrawn,uint256 sharesWithdrawn)',
  'function borrow(MarketParams,uint256 assets,uint256 shares,address onBehalf,address receiver) returns(uint256 assetsBorrowed,uint256 sharesBorrowed)',
  'function repay(MarketParams,uint256 assets,uint256 shares,address onBehalf,bytes data) returns(uint256 assetsRepaid,uint256 sharesRepaid)',
  'function supplyCollateral(MarketParams,uint256 assets,address onBehalf,bytes data)',
  'function withdrawCollateral(MarketParams,uint256 assets,address onBehalf,address receiver)',
  'event Borrow(bytes32 indexed id,address caller,address indexed onBehalf,address indexed receiver,uint256 assets,uint256 shares)',
  'event Repay(bytes32 indexed id,address indexed caller,address indexed onBehalf,uint256 assets,uint256 shares)',
]);
export const morphoIrmABI=parseAbi([
  'struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }',
  'struct Market { uint128 totalSupplyAssets; uint128 totalSupplyShares; uint128 totalBorrowAssets; uint128 totalBorrowShares; uint128 lastUpdate; uint128 fee; }',
  'function borrowRateView(MarketParams,Market) view returns(uint256)',
]);
export const morphoOracleABI=parseAbi(['function price() view returns(uint256)']);
export const feedRoundABI=parseAbi(['function latestRoundData() view returns(uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)']);
