import assert from 'node:assert/strict';
import {test} from 'node:test';
import {identityMetadata,parseIdentityMetadata} from '../lib/agent-metadata.ts';
test('identity metadata remains self-contained UTF-8 JSON, bounded and explicit about no runtime',()=>{
  const uri=identityMetadata('0x1111111111111111111111111111111111111111',{name:'AME café ☁',description:'NFT identity'});
  assert.equal(parseIdentityMetadata(uri).name,'AME café ☁');assert.equal(parseIdentityMetadata(uri).description,'NFT identity');
  assert.match(parseIdentityMetadata(identityMetadata('wallet')).description,/No autonomous runtime/);
  assert.throws(()=>identityMetadata('wallet',{name:'a'.repeat(65)}));assert.throws(()=>identityMetadata('wallet',{description:'a'.repeat(501)}));
});
test('untrusted/external/invalid metadata is never fetched or interpreted as HTML',()=>{
  for(const uri of ['https://example.invalid/metadata','javascript:alert(1)','ipfs://unknown','data:application/json,%bad','data:application/json,[]','a'.repeat(32769)])assert.ok(parseIdentityMetadata(uri).issue);
  const json=Buffer.from(JSON.stringify({name:'<script>not executed</script>',description:'☁'}),'utf8').toString('base64');
  assert.equal(parseIdentityMetadata('data:application/json;base64,'+json).description,'☁');
});
