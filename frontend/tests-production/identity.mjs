import assert from 'node:assert/strict';
import {test} from 'node:test';
const configured=process.env.AME_QA_IDENTITY_CONFIGURED==='1';
const origin=process.env.AME_QA_ORIGIN||'http://127.0.0.1:3000';
test('production identity targets mainnet and enforces configured deployment readiness',async()=>{
 const response=await fetch(origin+'/deploy');assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/4663<!-- --> \/ <!-- -->Robinhood Chain|4663 \/ Robinhood Chain/);
 if(configured){assert.doesNotMatch(html,/IDENTITY UNAVAILABLE|CONTRACT NOT CONFIGURED/);}else{assert.match(html,/IDENTITY UNAVAILABLE/);assert.match(html,/Identity creation is unavailable on/);}
 assert.doesNotMatch(html,/AGENT INITIALIZATION \/[^<]*TESTNET|testnet ETH gas is required/);
 assert.match(html,/<button[^>]*disabled=""[^>]*>DEPLOY AME/);
});
