# Spark Exchange DApp

Spark Exchange is a mobile-first DePIN mining and referral DApp prototype.

## Current Scope

- SPC token and SPC reward token
- Test USDT token for local demos
- Miner purchase with USDT or SPC
- 100,000 T power per miner split as 70,000 / 20,000 / 10,000
- Referral binding and six-level referral rewards
- 48-hour referral reward claim window
- Mining rewards based on personal power and elapsed time
- Node pool rewards for qualified node ranks
- SPC burn-to-power rule: 1 SPC = 12,000 T
- Owner-managed treasury, payment token, rank, and economic parameters
- Frontend wallet connection, allowance, purchase, claim, burn, and dashboard reads

## Local Run

Install dependencies:

```bash
npm install
```

Start a local chain:

```bash
npm run node
```

In another terminal, deploy contracts:

```bash
npm run deploy:local
```

The deploy script writes addresses to `deployments/local.env` and `.env.local`.
Restart Vite after deployment so the frontend can load the addresses:

```bash
npm run dev
```

## Contract Commands

```bash
npm run compile
npm run deploy:local
npm run deploy:hardhat
```

## Important Notes

This is a functional test version, not an audited production contract. Before mainnet use, review token economics, parameter governance, oracle/pricing rules, treasury controls, admin key security, anti-sybil rules, and reward funding/mint authority.
