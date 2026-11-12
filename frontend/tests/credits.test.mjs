import assert from 'node:assert/strict';import {test} from 'node:test';
import {createCreditLedger,CREDIT_POLICY} from '../lib/tasks/credits.ts';
import {REGISTRY} from '../lib/tasks/chain.ts';
test('credits are a separate disabled utility ledger, not XP, tokens or borrowing capacity',async()=>{
 assert.equal(CREDIT_POLICY.issuanceEnabled,false);assert.equal(CREDIT_POLICY.spendingEnabled,false);assert.equal(CREDIT_POLICY.xpConversion,null);assert.equal(CREDIT_POLICY.tokenConversion,null);assert.equal(CREDIT_POLICY.transferable,false);
 let called=false;const ledger=createCreditLedger({store:{command:async()=>{called=true;throw Error('must not write');}},registry:REGISTRY,authorize:async()=>true});
 await assert.rejects(ledger.transact({}),/POLICY_NOT_APPROVED/);assert.equal(called,false);
});
