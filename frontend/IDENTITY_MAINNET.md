# Mainnet identity activation

AMEAgent on Robinhood Chain Mainnet (4663): `0x3E5D2c59fc968DAE8Fc58AB1B46F3b3eB03d969c`.

- Deployment transaction: `0xfba21e075fb63d817188fa18e2b93d16e812f205c36f71a3bbdf7ae64046f649`.
- Deployment block: 112023846.
- Deployer: `0xB8e4D5f2Bb9ca611791b8f2655352A516630f07D`; nonce 1.
- Runtime keccak256: `0x00fed62d536de73f266a6a4f6a9be09141c481aa745a33ad8034829ae71ad5f6`.
- Creation-data keccak256: `0x45b4f2e10a6393e8055c1cfd54aacdf62f95bab92ab9300cbe3a6f981497259d`.
- Compiler: Solidity 0.8.28, optimizer 200, Cancun; no constructor arguments.

Source compilation reproduces the approved creation and deployed runtime exactly. Explorer source publication is separate and is not claimed by this verification. Public chain evidence is recorded in `contracts/deployments/identity-mainnet.json`.

## Existing frontend configuration

Set these public production build variables, then rebuild the existing frontend:

```
NEXT_PUBLIC_AME_MAINNET_AGENT_ADDRESS=0x3E5D2c59fc968DAE8Fc58AB1B46F3b3eB03d969c
NEXT_PUBLIC_AME_MAINNET_AGENT_DEPLOYMENT_BLOCK=112023846
```

Production identity targets 4663 independently of `NEXT_PUBLIC_AME_NETWORK`, which remains the legacy lending/development setting. Testnet identities and lending addresses remain separate. Do not set a mainnet receipt address to a testnet contract. No mainnet receipt contract is required for identity minting. The token and Morpho signing restrictions are unchanged.

`/deploy` simulates against the runtime-verified registry, checks the selected wallet/network again before requesting the signature, and requires confirmed transaction arguments, mint events and NFT ownership before success. `/agents` derives owned IDs from Transfer events starting at the deployment block and verifies ownerOf. `/agent/[id]` reads ownership, wallet and metadata directly; a missing ID is not fabricated.

Minting is permissionless with zero contract fee, plus native ETH gas. There is no Ownable administrator or upgrade proxy. Only the NFT owner can change its metadata or assigned wallet; ERC-721 operators can transfer it. Ownership transfers clear the assigned wallet. An assigned wallet is not proof of control, autonomous execution or financial authority. Metadata is mutable by the owner and external URIs are not guaranteed available.

## Read-only verification

Run `node --use-system-ca --experimental-strip-types --test tests-public/identity-mainnet.mjs` from `frontend`. These checks verify actual deployment receipts, runtime, permissions, mint preparation and directory/profile reads. They never sign, broadcast or mint. Existing local/fork tests cover confirmed-event decoding, ownership, transfer and failure handling.

The contract deployment was manually signed by the user. Real mainnet minting through the public browser wallet is **NOT VERIFIED** until the user performs the first mint. No automatic mint is authorized. To record it: connect MetaMask, select Robinhood Mainnet, enter identity fields, click DEPLOY AME, review and sign, wait for confirmation, then open VIEW AGENT and Your agents. Rejecting a request must not show success; a pending transaction must be rechecked rather than submitted again.

Rollback: remove only the two mainnet identity build variables and redeploy to return to the unavailable identity state. Never replace them with a predicted address or testnet contract.
