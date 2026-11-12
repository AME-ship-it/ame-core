import assert from 'node:assert/strict';import {test} from 'node:test';
import {writeScope,requireWriteGrant,NFT_WRITE_GRANT} from '../lib/tasks/activation.ts';
test('explicit NFT-based activation replaces the temporary allowlist without removing configuration guards',()=>{
 const env={AME_TASKS_WRITES_ENABLED:'1',AME_TASKS_ACCESS_MODE:'eligible-nft'};
 assert.equal(writeScope(env).mode,'eligible-nft');assert.equal(writeScope(env).agents.length,0);
 for(const id of ['1','2','987654'])assert.deepEqual(requireWriteGrant(id,'0x1000000000000000000000000000000000000001','risk','0x'+'a'.repeat(64),env),NFT_WRITE_GRANT);
 assert.equal(writeScope({...env,AME_TASKS_WRITES_ENABLED:'0'}),null);assert.equal(writeScope({...env,AME_TASKS_ACCESS_MODE:'typo'}),null);
 assert.throws(()=>requireWriteGrant('0','0x1000000000000000000000000000000000000001','wallet','0x'+'a'.repeat(64),env));
 assert.throws(()=>requireWriteGrant('2','0x1000000000000000000000000000000000000001','wallet','bad-epoch',env));
});
