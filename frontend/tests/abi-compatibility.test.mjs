import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { agentABI, agentRuntimeBytecode } from '../lib/generated/agent.ts';

test('frontend mint/read/event ABI exactly matches the unchanged compiled AMEAgent', async () => {
  const artifact = JSON.parse(await readFile(new URL('../../contracts/artifacts/contracts/AMEAgent.sol/AMEAgent.json', import.meta.url), 'utf8'));
  assert.deepEqual(agentABI, artifact.abi);
  assert.equal(agentRuntimeBytecode, artifact.deployedBytecode);
});
