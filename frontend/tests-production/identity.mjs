import assert from 'node:assert/strict';
import {test} from 'node:test';
const origin=process.env.AME_QA_ORIGIN||'http://127.0.0.1:3000';
test('production identity targets mainnet and remains unavailable without a deployed registry',async()=>{
 const response=await fetch(origin+'/deploy');assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/4663<!-- --> \/ <!-- -->Robinhood Chain|4663 \/ Robinhood Chain/);
 assert.match(html,/IDENTITY UNAVAILABLE/);assert.match(html,/Identity creation is unavailable on/);
 assert.doesNotMatch(html,/AGENT INITIALIZATION \/[^<]*TESTNET|testnet ETH gas is required/);
 assert.match(html,/<button[^>]*disabled=""[^>]*>DEPLOY AME/);
});
