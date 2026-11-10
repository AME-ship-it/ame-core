# AME Protocol security and review

Use `main` as the stable branch. Create a focused `feature/<topic>` or `fix/<topic>` branch, open a pull request, obtain review and merge after required QA passes. Avoid force pushes to `main` and unrelated refactors.

Run the README checks. Frontend tests need the local Hardhat node and identity/lending fixtures; compile contracts before ABI checks. CI runs contract compilation/typecheck/tests, actual local frontend integration tests, frontend typecheck and a configured Webpack production build. No public deployer credentials are needed.

Describe the behavior, test evidence and limitations in each PR. Preserve approved visuals unless a design change is requested. Review authorization, network selection, finite approvals, slippage, oracle freshness and transaction replacement/error handling when relevant.

Contract, faucet, oracle, lending and risk changes require focused security review of accounting, authorization, collateral, liquidation and repayment. Add meaningful regression tests for changed behavior. Code owners are requested on sensitive paths; one approval is a minimum, not an independent audit. Source changes do not alter deployed immutable contracts.

Never commit private keys, seeds, tokens, signer wallets, credential stores or actual `.env` files. Templates contain placeholders only. Report suspected exposure privately to the maintainer through an established private channel, without pasting credentials into issues, PRs or logs. Credential rotation, contract deployment, market activation and real-value transactions are outside routine PR work.

Operational lending is testnet-only, with valueless tokens and simulated prices. Mainnet lending remains read-only, with signing disabled. Do not claim audit status or real-value operational readiness. Collaborators require explicit authorization. No repository-wide license is implied by publication; existing file-level notices are preserved.
