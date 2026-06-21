# Spark Exchange DApp

Spark Exchange is a mobile-first DePIN mining, referral, node, and SPE token economy DApp prototype.

## Current Scope

- Single SPE token model for rewards, burn-to-power, staking, and reward pool funding
- Mock USDT token for local demos
- Miner purchase with USDT or SPE
- 10 USDT per miner, 100,000 T per miner, split as 70,000 / 20,000 / 10,000
- SPE burn-to-power rule: 1 SPE = 12,000 T permanent power
- SPE staking plans: 30 / 90 / 180 days = 8,000 / 10,000 / 13,000 T per SPE
- Early-bird and bulk purchase power bonuses
- Six-level referral rewards: 20%, 8%, 6%, 4%, 2%, then 0.5%
- Node collateral thresholds: 500 / 5,000 / 30,000 USDT
- Dynamic weekly power decay and active-user bonus
- Miner leasing market
- Treasury and buyback treasury split for miner purchases
- Frontend wallet connection, allowance, purchase, claim, burn, stake, collateral, activity, and leasing flows

## Deployment Inputs

For production deployment you should prepare:

- `TREASURY_ADDRESS`: main receiving address for USDT miner purchase revenue
- `BUYBACK_TREASURY_ADDRESS`: address that receives the configured buyback share
- `PRIVATE_KEY`: deployer/admin wallet private key
- `RPC_URL`: chain RPC endpoint
- `INITIAL_REWARD_POOL_SPE`: optional SPE amount pre-funded into the exchange reward pool

The exchange can pay rewards from its SPE reward pool first. If the pool is empty, the current test version mints SPE because the exchange is granted minter permission. For production, decide whether to keep mint fallback, cap it, or pre-fund the reward pool and remove mint authority after audit.

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
Restart Vite after deployment:

```bash
npm run dev
```

## Contract Commands

```bash
npm run compile
npm run deploy:local
npm run deploy:hardhat
npm run smoke:local
```

## Notes

This is a functional test version, not an audited production contract. Before mainnet use, review token economics, stable-token decimals, reward funding, mint authority, treasury controls, admin key security, anti-sybil rules, DAO/season ranking mechanics, and legal/compliance requirements.
