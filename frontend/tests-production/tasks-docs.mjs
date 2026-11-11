import assert from 'node:assert/strict';
import {test} from 'node:test';
const origin=process.env.AME_QA_ORIGIN||'http://127.0.0.1:3000';
test('Tasks documentation and protocol explain activity scoring without financial permissions',async()=>{
 for(const path of ['/docs','/protocol']){const r=await fetch(origin+path);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('id="tasks"'));assert.ok(html.includes('href="/tasks"'));assert.ok(html.includes('Task XP'));}
});
