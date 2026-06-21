import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers'
import type { Eip1193Provider } from 'ethers'

export const addresses = {
  exchange: import.meta.env.VITE_SPARK_EXCHANGE_ADDRESS || '',
  spe: import.meta.env.VITE_SPE_TOKEN_ADDRESS || '',
  usdt: import.meta.env.VITE_USDT_TOKEN_ADDRESS || '',
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 0),
}

export const isConfigured = Boolean(addresses.exchange && addresses.spe && addresses.usdt)

export const zeroAddress = '0x0000000000000000000000000000000000000000'

export const rankNames = ['游客', '体验矿工', '正式矿工', '节点矿池', '蜂窝矿池', '超级矿池']

export const exchangeAbi = [
  'function bindReferrer(address referrer) external',
  'function buyMiners(uint256 quantity,uint8 payToken,address referrer) external',
  'function burnSpeForPower(uint256 speAmount) external',
  'function stakeSpe(uint256 speAmount,uint8 planId) external',
  'function unstakeSpe() external',
  'function depositCollateral(uint256 amount) external',
  'function withdrawCollateral(uint256 amount) external',
  'function markActive() external',
  'function createLeaseListing(uint256 quantity,uint256 dailyPrice) external returns (uint256)',
  'function cancelLeaseListing(uint256 listingId) external',
  'function rentMiners(uint256 listingId,uint256 durationDays) external',
  'function claim() external returns (uint256)',
  'function pendingRewards(address account) view returns (uint256 miningReward,uint256 referralReward,uint256 nodeReward,uint256 totalReward)',
  'function getAccount(address account) view returns (address referrer,uint256 miners,uint256 directMiners,uint256 teamMiners,uint256 personalPower,uint256 basePower,uint256 referralPower,uint256 nodeFuelPower,uint256 bonusPower,uint256 burnedPower,uint256 burnedSpe,uint256 stakedSpe,uint256 stakePower,uint256 stakeUnlockAt,uint256 collateral,uint256 rentedPower,uint256 rentalExpireAt,uint256 leasedMiners,uint8 rank,uint256 referralRewardExpireAt,uint256 lastActivityAt)',
  'function getLeaseListing(uint256 listingId) view returns (address owner,uint256 quantity,uint256 dailyPrice,bool active)',
  'function leaseListingCount() view returns (uint256)',
  'function stakePlans(uint8 planId) view returns (uint256 lockDuration,uint256 powerPerSpe,bool enabled)',
  'function config() view returns (uint256 stablePricePerMiner,uint256 spePricePerMiner,uint256 minerBasePower,uint256 minerReferralPower,uint256 minerNodeFuelPower,uint256 powerPerSpeBurned,uint256 dailyRewardPerPower,uint256 dailyNodeReward,uint256 referralRewardBase,uint256 claimWindow,uint256 weeklyDecayBps,uint256 activityWindow,uint256 activityBonusBps,uint256 earlyBirdMinerCap,uint256 earlyBirdBonusBps,uint256 bulkMinerThreshold,uint256 bulkBonusBps,uint256 buybackBps)',
  'function currentDecayBps() view returns (uint256)',
  'function rewardPoolBalance() view returns (uint256)',
  'function rankCollateral(uint256 rank) view returns (uint256)',
  'function totalMiners() view returns (uint256)',
  'function totalPower() view returns (uint256)',
  'function totalNodeFuelPower() view returns (uint256)',
  'function totalStakedSpe() view returns (uint256)',
]

export const erc20Abi = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]

export type WalletRuntime = {
  provider: BrowserProvider
  address: string
  exchange: Contract
  spe: Contract
  usdt: Contract
}

export function hasWallet() {
  return Boolean(window.ethereum)
}

export async function createRuntime(): Promise<WalletRuntime> {
  if (!window.ethereum) {
    throw new Error('未检测到钱包，请先安装 MetaMask 或打开钱包浏览器')
  }

  if (!isConfigured) {
    throw new Error('合约地址未配置，请先部署合约并写入 .env.local')
  }

  const provider = new BrowserProvider(window.ethereum)
  await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  return {
    provider,
    address,
    exchange: new Contract(addresses.exchange, exchangeAbi, signer),
    spe: new Contract(addresses.spe, erc20Abi, signer),
    usdt: new Contract(addresses.usdt, erc20Abi, signer),
  }
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatToken(value: bigint | number | string, fractionDigits = 3) {
  const normalized = Number(formatEther(value))
  if (!Number.isFinite(normalized)) {
    return '0.000'
  }
  return normalized.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatPower(value: bigint | number | string) {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value)
  if (!Number.isFinite(numeric)) {
    return '0 T'
  }
  return `${numeric.toLocaleString('en-US')} T`
}

export function formatBps(value: bigint | number | string) {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value)
  if (!Number.isFinite(numeric)) {
    return '0%'
  }
  return `${(numeric / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
}

export function oneSpe() {
  return parseEther('1')
}

export function toTokenAmount(value: string) {
  const normalized = Number(value || 0)
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 0n
  }
  return parseEther(String(normalized))
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: 'accountsChanged' | 'chainChanged', callback: (...args: unknown[]) => void) => void
      removeListener?: (event: 'accountsChanged' | 'chainChanged', callback: (...args: unknown[]) => void) => void
    }
  }
}
