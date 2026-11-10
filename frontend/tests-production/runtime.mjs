import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function scripts(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) result.push(...await scripts(path));
    else if (entry.name.endsWith('.js')) result.push(path);
  }
  return result;
}
test('production client chunks contain no local deployment endpoints/files, Hardhat chain or Windows workspace paths', async () => {
  const files = await scripts(new URL('../.next/static/chunks/', import.meta.url));
  assert.ok(files.length > 0, 'Production build is required');
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const forbidden of ['127.0.0.1:8545', 'localhost:8545', '31337', 'localDeployment', 'deployments/localhost.json', 'C:/Users/tobia', 'C:\\\\Users\\\\tobia']) {
      assert.ok(!source.includes(forbidden), `${file.pathname.split('/').pop()} includes forbidden local runtime reference`);
    }
  }
});
