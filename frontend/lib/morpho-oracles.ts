import {parseAbi,keccak256,type Address} from 'viem';
import type {mainnetReadClient} from './lending-history.ts';
const metaABI=parseAbi([
  'function primaryOracle() view returns(address)','function backupOracle() view returns(address)','function currentOracle() view returns(address)',
  'function deviationThreshold() view returns(uint256)','function challengeTimelockDuration() view returns(uint256)','function healingTimelockDuration() view returns(uint256)',
]);
const chainlinkABI=parseAbi(['function BASE_FEED_1() view returns(address)','function SCALE_FACTOR() view returns(uint256)']);
export async function readOracleConfiguration(client:typeof mainnetReadClient,oracle:Address,blockNumber:bigint,isMeta:boolean){
  if(isMeta){
    const core={address:oracle,abi:metaABI,blockNumber} as const;
    const [primary,backup,current,threshold,challenge,healing]=await Promise.all([
      client.readContract({...core,functionName:'primaryOracle'}),client.readContract({...core,functionName:'backupOracle'}),client.readContract({...core,functionName:'currentOracle'}),
      client.readContract({...core,functionName:'deviationThreshold'}),client.readContract({...core,functionName:'challengeTimelockDuration'}),client.readContract({...core,functionName:'healingTimelockDuration'}),
    ]);
    const code=await client.getCode({address:oracle,blockNumber});
    const clone=/^0x363d3d373d3d3d363d73([a-f0-9]{40})5af43d82803e903d91602b57fd5bf3$/i.exec(code??'');
    const implementation=clone?`0x${clone[1]}` as Address:undefined;
    const implCode=implementation?await client.getCode({address:implementation,blockNumber}):undefined;
    const sourceMatchedImplementation=!!implCode&&implementation?.toLowerCase()==='0x6a16d6fe1ba26e6ba52fda03972b1fe2e31ca729'&&keccak256(implCode)==='0xdf8ac65460bf9a997f353a153f8236d0dfa31d917d0cb894f74a4a2f8449ee14';
    const [feed,scale]=await Promise.all([client.readContract({address:backup,abi:chainlinkABI,functionName:'BASE_FEED_1',blockNumber}),client.readContract({address:backup,abi:chainlinkABI,functionName:'SCALE_FACTOR',blockNumber})]);
    return {kind:'META_ORACLE',primary,backup,current,threshold,challenge,healing,implementation,sourceMatchedImplementation,feed,scale};
  }
  const core={address:oracle,abi:chainlinkABI,blockNumber} as const;
  const [feed,scale]=await Promise.all([client.readContract({...core,functionName:'BASE_FEED_1'}),client.readContract({...core,functionName:'SCALE_FACTOR'})]);
  return {kind:'EXCHANGE_RATE',feed,scale,primary:undefined,backup:undefined,current:undefined,threshold:undefined,challenge:undefined,healing:undefined,implementation:undefined,sourceMatchedImplementation:false};
}
