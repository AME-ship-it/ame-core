// Mainnet read-only acceptance. No wallet client, key, send method or mint transaction.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {getAddress,keccak256,zeroAddress} from 'viem';
const manifest=JSON.parse(await readFile(new URL('../../contracts/deployments/identity-mainnet.json',import.meta.url),'utf8'));
process.env.NODE_ENV='production';
process.env.NEXT_PUBLIC_AME_MAINNET_AGENT_ADDRESS=manifest.address;
process.env.NEXT_PUBLIC_AME_MAINNET_AGENT_DEPLOYMENT_BLOCK=manifest.block;
const {agentClient,verifyDeployment,readOwnedAgentIds,readAgent,isMissingAgent}=await import('../lib/agents.ts');
const {identityChain}=await import('../lib/chains.ts');
const {contracts}=await import('../lib/identity-contracts.ts');
const {mintInputs}=await import('../lib/mint.ts');
const config={address:contracts.agent.address,abi:contracts.agent.abi};
test('actual mainnet creation receipt, sender, constructor data and runtime match approved deployment',async()=>{
 assert.equal(identityChain.id,4663);assert.equal(await agentClient.getChainId(),4663);
 const [receipt,tx]=await Promise.all([agentClient.getTransactionReceipt({hash:manifest.transactionHash}),agentClient.getTransaction({hash:manifest.transactionHash})]);
 assert.equal(receipt.status,'success');assert.equal(receipt.blockNumber,BigInt(manifest.block));assert.equal(getAddress(receipt.contractAddress),manifest.address);assert.equal(receipt.blockHash,manifest.blockHash);
 assert.equal(tx.to,null);assert.equal(tx.value,0n);assert.equal(tx.nonce,1);assert.equal(getAddress(tx.from),manifest.deployer);assert.equal(keccak256(tx.input),'0x45b4f2e10a6393e8055c1cfd54aacdf62f95bab92ab9300cbe3a6f981497259d');
 assert.equal(keccak256(await agentClient.getCode({address:config.address})),manifest.runtimeHash);await verifyDeployment();
});
test('permissionless ERC721 has no owner/admin role and mint simulation changes no public state',async()=>{
 assert.equal(await agentClient.readContract({...config,functionName:'name'}),'AME Agent');assert.equal(await agentClient.readContract({...config,functionName:'symbol'}),'AME');
 assert.equal(await agentClient.readContract({...config,functionName:'supportsInterface',args:['0x80ac58cd']}),true);
 for(const name of ['owner','transferOwnership','upgradeTo','setMintFee'])assert.ok(!config.abi.some(x=>x.type==='function'&&x.name===name));
 const before=await agentClient.readContract({...config,functionName:'nextAgentId'});const owner=manifest.deployer;const inputs=mintInputs(owner,'',{name:'AME identity read-only verification'});
 const result=await agentClient.simulateContract({...config,functionName:'mint',args:[inputs.agentWallet,inputs.metadataURI],account:owner,value:0n});assert.equal(result.result,before);assert.equal(getAddress(result.request.address),manifest.address);assert.equal(result.request.account.address.toLowerCase(),owner.toLowerCase());
 const other='0x1000000000000000000000000000000000000001';assert.equal((await agentClient.simulateContract({...config,functionName:'mint',args:[other,inputs.metadataURI],account:other})).result,before);
 assert.equal(await agentClient.readContract({...config,functionName:'nextAgentId'}),before,'eth_call must not create a public agent');
 await assert.rejects(agentClient.simulateContract({...config,functionName:'mint',args:[zeroAddress,inputs.metadataURI],account:owner}),/InvalidAgentWallet/);
 await assert.rejects(agentClient.simulateContract({...config,functionName:'mint',args:[owner,''],account:owner}),/EmptyMetadataURI/);
});
test('mainnet owner directory and profiles reflect real registry state without fabricating NFTs',async()=>{
 const ids=await readOwnedAgentIds(manifest.deployer);assert.equal(BigInt(ids.length),await agentClient.readContract({...config,functionName:'balanceOf',args:[manifest.deployer]}));
 for(const id of ids){const agent=await readAgent(id);assert.equal(getAddress(agent.owner),manifest.deployer);assert.equal(agent.metadataURI,await agentClient.readContract({...config,functionName:'tokenURI',args:[id]}));}
 const next=await agentClient.readContract({...config,functionName:'nextAgentId'});await assert.rejects(readAgent(next),error=>isMissingAgent(error));
});
