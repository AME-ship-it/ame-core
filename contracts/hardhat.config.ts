import { configVariable, defineConfig } from 'hardhat/config';
import hardhatViem from '@nomicfoundation/hardhat-viem';
import hardhatNodeTestRunner from '@nomicfoundation/hardhat-node-test-runner';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [hardhatViem, hardhatNodeTestRunner],
  solidity: {
    version: '0.8.28',
    path: require.resolve('solc/soljson.js'),
    preferWasm: true,
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
  networks: {
    hardhat: { type: 'edr-simulated', chainType: 'l1', chainId: 31337 },
    localhost: { type: 'http', chainType: 'l1', url: 'http://127.0.0.1:8545', chainId: 31337 },
    robinhoodTestnet: {
      type: 'http', chainType: 'generic', chainId: 46630,
      url: process.env.AME_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com',
      accounts: process.env.AME_TESTNET_PRIVATE_KEY ? [configVariable('AME_TESTNET_PRIVATE_KEY')] : [],
    },
  },
});
