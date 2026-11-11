import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HolderAccessBoundary} from '../components/HolderAccessBoundary.ts';
for(const state of ['disconnected','checking','prelaunch','unavailable','not-holder','holder-no-entitlements'])test(`${state} never renders actionable lending children`,()=>{
  const html=renderToStaticMarkup(h(HolderAccessBoundary,{state,canRefresh:true},h('button',null,'PRIVATE LENDING ACTION')));
  assert.ok(!html.includes('PRIVATE LENDING ACTION'));assert.ok(html.includes('LOCKED'));
});
test('verified holder can reach the existing lending children',()=>{
  const html=renderToStaticMarkup(h(HolderAccessBoundary,{state:'unlocked'},h('button',null,'PRIVATE LENDING ACTION')));assert.ok(html.includes('PRIVATE LENDING ACTION'));assert.ok(!html.includes('LOCKED'));
});
test('prelaunch hides acquisition addresses even if one is supplied to the presentation layer',()=>{
  const html=renderToStaticMarkup(h(HolderAccessBoundary,{state:'prelaunch',tokenURL:'https://example.com/fixture-only'}));assert.ok(html.includes('Holder access rules are not activated.'));assert.ok(!html.includes('Get $AME'));assert.ok(!html.includes('fixture-only'));
});
test('non-holder CTA uses only the supplied configured link and is absent without one',()=>{
  const html=renderToStaticMarkup(h(HolderAccessBoundary,{state:'not-holder',tokenURL:'https://example.com/fixture-only'}));assert.ok(html.includes('Get $AME'));assert.ok(html.includes('rel="noopener noreferrer"'));assert.ok(html.includes('target="_blank"'));
  assert.ok(!renderToStaticMarkup(h(HolderAccessBoundary,{state:'not-holder'})).includes('Get $AME'));
});
test('disconnected screen delegates wallet connection to existing header, not another auth flow',()=>{
  const html=renderToStaticMarkup(h(HolderAccessBoundary,{state:'disconnected'}));assert.ok(html.includes('CONNECT WALLET TO ACCESS LENDING'));assert.ok(!html.includes('<button'));assert.ok(!html.includes('<input'));
});
