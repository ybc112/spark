import './style.css'
import { isAddress } from 'ethers'
import type { Contract } from 'ethers'
import { createIcons, icons } from 'lucide'
import {
  addresses,
  createRuntime,
  formatBps,
  formatPower,
  formatToken,
  hasWallet,
  isConfigured,
  oneSpe,
  rankNames,
  shortAddress,
  toTokenAmount,
  type WalletRuntime,
  zeroAddress,
} from './contracts'

type RuntimeState = WalletRuntime | null

const ranks = [
  { name: '体验矿工', condition: '完成新手任务', bonus: '免费 1,000 T', share: '-' },
  { name: '正式矿工', condition: '激活 1 台矿机 + 个人算力 >= 50,000 T', bonus: '+20%', share: '-' },
  { name: '节点矿池', condition: '直推 5 名矿工，团队 >= 20 台，自持 5 台，质押 >= 500 USDT', bonus: '+25%', share: '团队矿池 1.2%' },
  { name: '蜂窝矿池', condition: '团队 >= 2,000 台，自持 200 台，质押 >= 5,000 USDT', bonus: '+30%', share: '团队矿池 2.0%' },
  { name: '超级矿池', condition: '团队 >= 20,000 台，自持 2,000 台，质押 >= 30,000 USDT', bonus: '+40%', share: '全网 2.5% 上限 + 治理权' },
]

const incomeRows = [
  ['直推 1 代', '20%', '永久有效'],
  ['间推 2 代', '8%', '自动结算'],
  ['间推 3 代', '6%', '自动结算'],
  ['间推 4 代', '4%', '自动结算'],
  ['间推 5 代', '2%', '自动结算'],
  ['6 代及以后', '0.5%', '全网微分润池'],
]

const stakePlans = [
  { id: 0, label: '30 天', power: '8,000 T / SPE' },
  { id: 1, label: '90 天', power: '10,000 T / SPE' },
  { id: 2, label: '180 天', power: '13,000 T / SPE' },
]

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="shell">
  <section class="phone">
    <div class="orbital-bg" aria-hidden="true">
      <span class="node node-a"></span>
      <span class="node node-b"></span>
      <span class="node node-c"></span>
    </div>

    <header class="topbar">
      <a class="brand" href="#" aria-label="Spark Exchange">
        <span class="spark-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="img">
            <defs>
              <linearGradient id="sparkLogo" x1="8" x2="52" y1="10" y2="58" gradientUnits="userSpaceOnUse">
                <stop stop-color="#ffcc43"/>
                <stop offset=".48" stop-color="#ff7a1a"/>
                <stop offset="1" stop-color="#f11f4e"/>
              </linearGradient>
            </defs>
            <path fill="url(#sparkLogo)" d="M27.7 4.8 34.9 23l19.6-1.2-15.2 12.4 7.2 18.3-16.6-10.4-15.2 12.4 4.8-19L2.8 25.1l19.6-1.2 5.3-19.1Z"/>
            <path fill="#070711" d="M34.2 9.2c5.8 6.4 7.2 12.8 3.9 19.2 4.2-2 7.7-5.4 9.8-10.1 1.9 8.1-.8 14.4-8.1 18.9-7.7 4.8-7 10.7-2.7 17.1-10.6-3.6-16.4-10-14.3-19.2.8-3.7 3.3-6.8 6.2-9.3 4.6-4.1 6.1-9.1 5.2-16.6Z"/>
            <path fill="url(#sparkLogo)" d="M31.8 31.2c2.7 2.6 2.9 5.5.7 8.6 2.7-1 4.6-2.9 5.8-5.5 1.2 6.1-1.4 10.2-6.4 12.6-4.8-3.4-5.2-8.1-1-13.9.4-.6.7-1.2.9-1.8Z"/>
          </svg>
        </span>
        <span>
          <strong>Spark</strong>
          <small>Exchange</small>
        </span>
      </a>
      <button class="icon-btn" id="menuBtn" type="button" aria-label="打开菜单" aria-expanded="false" aria-controls="appMenu"><i data-lucide="menu"></i></button>
    </header>

    <div class="menu-backdrop" id="menuBackdrop" aria-hidden="true"></div>
    <aside class="app-menu" id="appMenu" aria-hidden="true">
      <div class="menu-head">
        <div>
          <p class="eyebrow">Spark Console</p>
          <h2>快捷菜单</h2>
        </div>
        <button class="menu-close" id="menuCloseBtn" type="button" aria-label="关闭菜单"><i data-lucide="x"></i></button>
      </div>
      <div class="menu-actions">
        <button type="button" data-menu-view="mine"><i data-lucide="gem"></i><span>矿机配置</span></button>
        <button type="button" data-menu-view="node"><i data-lucide="crown"></i><span>节点权益</span></button>
        <button type="button" data-menu-view="invite"><i data-lucide="share-2"></i><span>代际收益</span></button>
        <button type="button" data-menu-view="token"><i data-lucide="flame"></i><span>SPE 经济</span></button>
        <button type="button" data-menu-view="market"><i data-lucide="repeat-2"></i><span>租赁市场</span></button>
        <button type="button" data-action id="menuActiveBtn"><i data-lucide="activity"></i><span>活跃签到</span></button>
      </div>
      <div class="menu-panel">
        <span>链上状态</span>
        <strong id="menuStatus">等待连接钱包</strong>
      </div>
      <div class="menu-cta">
        <button type="button" data-action id="menuWalletBtn"><i data-lucide="wallet"></i> 连接钱包</button>
        <button type="button" data-action id="menuClaimBtn"><i data-lucide="zap"></i> 领取收益</button>
      </div>
    </aside>

    <div class="chain-banner" id="chainBanner"></div>

    <section class="hero-panel">
      <div class="ticker-row">
        <span>MY SPE</span>
        <strong><i data-lucide="trending-up"></i> <span id="rewardPoolMini">奖励池 --</span></strong>
      </div>
      <div class="balance-line">
        <div>
          <p class="eyebrow">SPE 总数量</p>
          <h1 id="speBalance">21.45</h1>
        </div>
        <button class="wallet-btn" data-action id="walletBtn" type="button"><i data-lucide="wallet"></i> 连接钱包</button>
      </div>
      <button class="rank-pill" type="button">
        <i data-lucide="badge-check"></i>
        <span id="rankName">Pre-Crypto KOL</span>
        <i data-lucide="chevrons-right"></i>
      </button>

      <div class="claim-block">
        <div class="claim-head">
          <span>待领取</span>
          <small id="claimMeta">15 / 15</small>
        </div>
        <div class="claim-value"><span id="claimAmount">+2.205</span><small>SPE</small></div>
        <p id="claimHint">挖矿收益、代际收益与节点收益按链上规则累计</p>
      </div>

      <div class="action-grid">
        <button class="primary-btn" data-action id="claimBtn" type="button"><i data-lucide="zap"></i> 领取全部</button>
        <button class="secondary-btn" data-action id="minerBtn" type="button"><i data-lucide="pickaxe"></i> 购买矿机</button>
      </div>
    </section>

    <section class="stats-grid" aria-label="账户概览">
      <article class="stat-card cyan">
        <span>个人算力</span>
        <strong id="powerStat">188,600 T</strong>
      </article>
      <article class="stat-card gold">
        <span>矿机数量</span>
        <strong id="minerStat">12 台</strong>
      </article>
      <article class="stat-card green">
        <span>团队矿工</span>
        <strong id="teamStat">86 台</strong>
      </article>
      <article class="stat-card rose">
        <span>节点质押</span>
        <strong id="collateralStat">0 USDT</strong>
      </article>
    </section>

    <nav class="mode-tabs" aria-label="页面模块">
      <button class="tab active" type="button" data-view="mine"><i data-lucide="gem"></i> 矿机</button>
      <button class="tab" type="button" data-view="node"><i data-lucide="crown"></i> 节点</button>
      <button class="tab" type="button" data-view="invite"><i data-lucide="share-2"></i> 代收</button>
      <button class="tab" type="button" data-view="token"><i data-lucide="pie-chart"></i> SPE</button>
      <button class="tab" type="button" data-view="market"><i data-lucide="repeat-2"></i> 租赁</button>
    </nav>

    <section class="content-stack">
      <article class="glass-card view-panel active" data-panel="mine">
        <div class="card-head">
          <div>
            <p class="eyebrow">Mining Core</p>
            <h2>单台矿机核心配置</h2>
          </div>
          <i data-lucide="cpu"></i>
        </div>
        <div class="metric-list">
          <div><span>矿机售价</span><strong id="minerPrice">10 USDT / 台</strong><small>支持 USDT 或等值 SPE</small></div>
          <div><span>总算力</span><strong>100,000 T</strong><small>10,000 T / USDT</small></div>
          <div><span>算力分配</span><strong>70% / 20% / 10%</strong><small>基础算力 / 直推红包 / 节点燃料</small></div>
          <div><span>回本周期</span><strong>8-15 天</strong><small>后期稳定 30-60 天</small></div>
        </div>
        <div class="control-box">
          <div class="field-row">
            <label>
              <span>数量</span>
              <input id="minerQty" type="number" min="1" step="1" value="1" />
            </label>
            <label>
              <span>支付</span>
              <select id="payToken">
                <option value="0">USDT</option>
                <option value="1">SPE</option>
              </select>
            </label>
          </div>
          <label class="full-field">
            <span>推荐人地址</span>
            <input id="referrerInput" type="text" placeholder="可选，首次购买时绑定" />
          </label>
        </div>
        <div class="mini-metrics">
          <div><span>全网矿机</span><strong id="totalMinersStat">--</strong></div>
          <div><span>全网算力</span><strong id="totalPowerStat">--</strong></div>
          <div><span>动态衰减</span><strong id="decayStat">--</strong></div>
          <div><span>回购比例</span><strong id="buybackStat">--</strong></div>
        </div>
      </article>

      <article class="glass-card view-panel" data-panel="node">
        <div class="card-head">
          <div>
            <p class="eyebrow">Node Rank</p>
            <h2>节点等级与权益</h2>
          </div>
          <i data-lucide="shield-check"></i>
        </div>
        <div class="rank-table">
          ${ranks.map((rank) => `
            <div class="rank-row">
              <strong>${rank.name}</strong>
              <span>${rank.condition}</span>
              <em>${rank.bonus}</em>
              <small>${rank.share}</small>
            </div>
          `).join('')}
        </div>
        <div class="control-box">
          <label>
            <span>抵押数量</span>
            <input id="collateralAmount" type="number" min="0" step="1" value="500" />
          </label>
          <div class="tool-actions">
            <button class="inline-action" data-action id="depositCollateralBtn" type="button"><i data-lucide="lock"></i> 抵押 USDT</button>
            <button class="inline-action subtle" data-action id="withdrawCollateralBtn" type="button"><i data-lucide="unlock"></i> 取回 USDT</button>
          </div>
          <p class="status-line" id="nodeStatus">节点质押用于判断节点矿池、蜂窝矿池、超级矿池资格</p>
        </div>
      </article>

      <article class="glass-card view-panel" data-panel="invite">
        <div class="card-head">
          <div>
            <p class="eyebrow">Referral</p>
            <h2>无限代收益分配</h2>
          </div>
          <i data-lucide="users"></i>
        </div>
        <div class="income-table">
          ${incomeRows.map((row) => `
            <div>
              <span>${row[0]}</span>
              <strong>${row[1]}</strong>
              <small>${row[2]}</small>
            </div>
          `).join('')}
        </div>
        <div class="control-box">
          <label>
            <span>推荐人地址</span>
            <input id="bindReferrerInput" type="text" placeholder="首次绑定后不可修改" />
          </label>
          <button class="inline-action" data-action id="bindReferrerBtn" type="button"><i data-lucide="link"></i> 绑定推荐人</button>
          <p class="status-line" id="referrerStatus">当前推荐人：未绑定</p>
        </div>
      </article>

      <article class="glass-card view-panel" data-panel="token">
        <div class="card-head">
          <div>
            <p class="eyebrow">Tokenomics</p>
            <h2>SPE 销毁、质押与分配</h2>
          </div>
          <i data-lucide="flame"></i>
        </div>
        <div class="token-card">
          <div class="supply">
            <span>总供应量</span>
            <strong>2100万 SPE</strong>
          </div>
          <div class="burn-rule">
            <span>每销毁 1 SPE</span>
            <strong>12,000 T 永久算力</strong>
          </div>
          <button class="inline-action" data-action id="burnBtn" type="button"><i data-lucide="flame"></i> 销毁 1 SPE 换算力</button>
          <div class="control-box token-ops">
            <div class="field-row">
              <label>
                <span>质押 SPE</span>
                <input id="stakeAmount" type="number" min="0" step="1" value="1" />
              </label>
              <label>
                <span>周期</span>
                <select id="stakePlan">
                  ${stakePlans.map((plan) => `<option value="${plan.id}">${plan.label} · ${plan.power}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="tool-actions">
              <button class="inline-action" data-action id="stakeBtn" type="button"><i data-lucide="landmark"></i> 质押 SPE</button>
              <button class="inline-action subtle" data-action id="unstakeBtn" type="button"><i data-lucide="rotate-ccw"></i> 解锁取回</button>
            </div>
            <p class="status-line" id="stakeStatus">30 / 90 / 180 天对应 8,000 / 10,000 / 13,000 T</p>
          </div>
          <div class="bars">
            <label><span>挖矿产出</span><i style="--w:55%"></i><b>55%</b></label>
            <label><span>生态发展</span><i style="--w:25%"></i><b>25%</b></label>
            <label><span>社区建设</span><i style="--w:10%"></i><b>10%</b></label>
            <label><span>早期投资</span><i style="--w:10%"></i><b>10%</b></label>
          </div>
        </div>
      </article>

      <article class="glass-card view-panel" data-panel="market">
        <div class="card-head">
          <div>
            <p class="eyebrow">Optimization</p>
            <h2>租赁市场与活跃加成</h2>
          </div>
          <i data-lucide="repeat-2"></i>
        </div>
        <div class="optimization-list">
          <div><span>活跃加成</span><strong id="activityBonusStat">--</strong><small>活跃窗口内增加个人算力</small></div>
          <div><span>奖励池</span><strong id="rewardPoolStat">--</strong><small>不含用户质押 SPE</small></div>
          <div><span>全网质押</span><strong id="totalStakedStat">--</strong><small>SPE 锁仓算力来源</small></div>
        </div>
        <button class="inline-action" data-action id="activeBtn" type="button"><i data-lucide="activity"></i> 活跃签到</button>
        <div class="control-box">
          <div class="field-row">
            <label>
              <span>出租数量</span>
              <input id="leaseQty" type="number" min="1" step="1" value="1" />
            </label>
            <label>
              <span>日租金 USDT</span>
              <input id="leaseDailyPrice" type="number" min="0" step="1" value="1" />
            </label>
          </div>
          <button class="inline-action" data-action id="createLeaseBtn" type="button"><i data-lucide="plus"></i> 发布出租</button>
        </div>
        <div class="control-box">
          <div class="field-row">
            <label>
              <span>租赁编号</span>
              <input id="rentListingId" type="number" min="0" step="1" value="0" />
            </label>
            <label>
              <span>天数</span>
              <input id="rentDays" type="number" min="1" step="1" value="7" />
            </label>
          </div>
          <button class="inline-action" data-action id="rentLeaseBtn" type="button"><i data-lucide="shopping-bag"></i> 租用矿机</button>
        </div>
        <div class="lease-headline">
          <span>最近租赁单</span>
          <strong id="leaseCount">0</strong>
        </div>
        <div class="lease-list" id="leaseList"></div>
      </article>
    </section>

    <section class="growth-card">
      <div>
        <p class="eyebrow">Growth Path</p>
        <h2>用户成长路径建议</h2>
      </div>
      <ol>
        <li><strong>新手</strong><span>买 1-3 台矿机，快速上手</span></li>
        <li><strong>中级</strong><span>10-20 台 + 拉 3-5 人，冲节点矿池</span></li>
        <li><strong>高级</strong><span>50 台 + 大量销毁 SPE，进入蜂窝矿池 / 超级矿池</span></li>
      </ol>
    </section>
  </section>
</main>
`

createIcons({ icons })

let runtime: RuntimeState = null
let busy = false

const chainBanner = document.querySelector<HTMLDivElement>('#chainBanner')!
const menuBtn = document.querySelector<HTMLButtonElement>('#menuBtn')!
const menuBackdrop = document.querySelector<HTMLDivElement>('#menuBackdrop')!
const appMenu = document.querySelector<HTMLElement>('#appMenu')!
const menuCloseBtn = document.querySelector<HTMLButtonElement>('#menuCloseBtn')!
const menuWalletBtn = document.querySelector<HTMLButtonElement>('#menuWalletBtn')!
const menuClaimBtn = document.querySelector<HTMLButtonElement>('#menuClaimBtn')!
const menuActiveBtn = document.querySelector<HTMLButtonElement>('#menuActiveBtn')!
const menuStatus = document.querySelector<HTMLElement>('#menuStatus')!
const walletBtn = document.querySelector<HTMLButtonElement>('#walletBtn')!
const claimBtn = document.querySelector<HTMLButtonElement>('#claimBtn')!
const minerBtn = document.querySelector<HTMLButtonElement>('#minerBtn')!
const burnBtn = document.querySelector<HTMLButtonElement>('#burnBtn')!
const stakeBtn = document.querySelector<HTMLButtonElement>('#stakeBtn')!
const unstakeBtn = document.querySelector<HTMLButtonElement>('#unstakeBtn')!
const depositCollateralBtn = document.querySelector<HTMLButtonElement>('#depositCollateralBtn')!
const withdrawCollateralBtn = document.querySelector<HTMLButtonElement>('#withdrawCollateralBtn')!
const bindReferrerBtn = document.querySelector<HTMLButtonElement>('#bindReferrerBtn')!
const activeBtn = document.querySelector<HTMLButtonElement>('#activeBtn')!
const createLeaseBtn = document.querySelector<HTMLButtonElement>('#createLeaseBtn')!
const rentLeaseBtn = document.querySelector<HTMLButtonElement>('#rentLeaseBtn')!
const speBalance = document.querySelector<HTMLHeadingElement>('#speBalance')!
const rankName = document.querySelector<HTMLSpanElement>('#rankName')!
const claimAmount = document.querySelector<HTMLSpanElement>('#claimAmount')!
const claimMeta = document.querySelector<HTMLElement>('#claimMeta')!
const claimHint = document.querySelector<HTMLParagraphElement>('#claimHint')!
const minerPrice = document.querySelector<HTMLElement>('#minerPrice')!
const powerStat = document.querySelector<HTMLElement>('#powerStat')!
const minerStat = document.querySelector<HTMLElement>('#minerStat')!
const teamStat = document.querySelector<HTMLElement>('#teamStat')!
const collateralStat = document.querySelector<HTMLElement>('#collateralStat')!
const totalMinersStat = document.querySelector<HTMLElement>('#totalMinersStat')!
const totalPowerStat = document.querySelector<HTMLElement>('#totalPowerStat')!
const decayStat = document.querySelector<HTMLElement>('#decayStat')!
const buybackStat = document.querySelector<HTMLElement>('#buybackStat')!
const activityBonusStat = document.querySelector<HTMLElement>('#activityBonusStat')!
const rewardPoolStat = document.querySelector<HTMLElement>('#rewardPoolStat')!
const rewardPoolMini = document.querySelector<HTMLElement>('#rewardPoolMini')!
const totalStakedStat = document.querySelector<HTMLElement>('#totalStakedStat')!
const nodeStatus = document.querySelector<HTMLParagraphElement>('#nodeStatus')!
const referrerStatus = document.querySelector<HTMLParagraphElement>('#referrerStatus')!
const stakeStatus = document.querySelector<HTMLParagraphElement>('#stakeStatus')!
const leaseCount = document.querySelector<HTMLElement>('#leaseCount')!
const leaseList = document.querySelector<HTMLDivElement>('#leaseList')!
const minerQty = document.querySelector<HTMLInputElement>('#minerQty')!
const payToken = document.querySelector<HTMLSelectElement>('#payToken')!
const referrerInput = document.querySelector<HTMLInputElement>('#referrerInput')!
const collateralAmount = document.querySelector<HTMLInputElement>('#collateralAmount')!
const bindReferrerInput = document.querySelector<HTMLInputElement>('#bindReferrerInput')!
const stakeAmount = document.querySelector<HTMLInputElement>('#stakeAmount')!
const stakePlan = document.querySelector<HTMLSelectElement>('#stakePlan')!
const leaseQty = document.querySelector<HTMLInputElement>('#leaseQty')!
const leaseDailyPrice = document.querySelector<HTMLInputElement>('#leaseDailyPrice')!
const rentListingId = document.querySelector<HTMLInputElement>('#rentListingId')!
const rentDays = document.querySelector<HTMLInputElement>('#rentDays')!
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab')
const panels = document.querySelectorAll<HTMLElement>('.view-panel')
const actionButtons = document.querySelectorAll<HTMLButtonElement>('[data-action]')

function setStatus(message: string, tone: 'info' | 'ok' | 'warn' = 'info') {
  chainBanner.textContent = message
  chainBanner.dataset.tone = tone
  menuStatus.textContent = message
}

function setBusy(nextBusy: boolean, label = '处理中...') {
  busy = nextBusy
  actionButtons.forEach((button) => {
    button.disabled = nextBusy
  })
  if (nextBusy) {
    setStatus(label)
  }
}

function toggleMenu(open: boolean) {
  appMenu.classList.toggle('open', open)
  menuBackdrop.classList.toggle('open', open)
  appMenu.setAttribute('aria-hidden', String(!open))
  menuBackdrop.setAttribute('aria-hidden', String(!open))
  menuBtn.setAttribute('aria-expanded', String(open))
}

function selectView(target: string | undefined) {
  if (!target) return
  tabs.forEach((item) => item.classList.toggle('active', item.dataset.view === target))
  panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === target))
  document.querySelector<HTMLElement>('.content-stack')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function getPositiveInteger(input: HTMLInputElement, fallback = 1) {
  const value = Math.max(fallback, Math.floor(Number(input.value || fallback)))
  input.value = String(value)
  return value
}

function getAddressInput(input: HTMLInputElement) {
  const value = input.value.trim()
  return value && isAddress(value) ? value : zeroAddress
}

function unixTimeText(value: bigint | number | string) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '未锁定'
  }
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function ensureRuntime() {
  if (runtime) {
    return runtime
  }

  runtime = await createRuntime()
  walletBtn.innerHTML = `<i data-lucide="wallet"></i> ${shortAddress(runtime.address)}`
  createIcons({ icons })
  await validateNetwork(runtime)
  await refreshDashboard()
  return runtime
}

async function validateNetwork(current: WalletRuntime) {
  if (!addresses.chainId) {
    return
  }

  const network = await current.provider.getNetwork()
  if (Number(network.chainId) !== addresses.chainId) {
    setStatus(`当前链 ID ${network.chainId}，请切换到 ${addresses.chainId}`, 'warn')
  }
}

async function refreshDashboard() {
  if (!runtime || !isConfigured) {
    return
  }

  const [account, rewards, balance, config, decay, rewardPool, totalMiners, totalPower, totalStaked] = await Promise.all([
    runtime.exchange.getAccount(runtime.address),
    runtime.exchange.pendingRewards(runtime.address),
    runtime.spe.balanceOf(runtime.address),
    runtime.exchange.config(),
    runtime.exchange.currentDecayBps(),
    runtime.exchange.rewardPoolBalance(),
    runtime.exchange.totalMiners(),
    runtime.exchange.totalPower(),
    runtime.exchange.totalStakedSpe(),
  ])

  speBalance.textContent = formatToken(balance, 2)
  claimAmount.textContent = `+${formatToken(rewards.totalReward ?? rewards[3], 3)}`
  rankName.textContent = rankNames[Number(account.rank ?? account[18])] || '未知等级'
  powerStat.textContent = formatPower(account.personalPower ?? account[4])
  minerStat.textContent = `${Number(account.miners ?? account[1]).toLocaleString('en-US')} 台`
  teamStat.textContent = `${Number(account.teamMiners ?? account[3]).toLocaleString('en-US')} 台`
  collateralStat.textContent = `${formatToken(account.collateral ?? account[14], 2)} USDT`
  minerPrice.textContent = `${formatToken(config.stablePricePerMiner ?? config[0], 2)} USDT / 台`
  totalMinersStat.textContent = `${Number(totalMiners).toLocaleString('en-US')} 台`
  totalPowerStat.textContent = formatPower(totalPower)
  decayStat.textContent = formatBps(decay)
  buybackStat.textContent = formatBps(config.buybackBps ?? config[17])
  activityBonusStat.textContent = formatBps(config.activityBonusBps ?? config[12])
  rewardPoolStat.textContent = `${formatToken(rewardPool, 2)} SPE`
  rewardPoolMini.textContent = `奖励池 ${formatToken(rewardPool, 1)}`
  totalStakedStat.textContent = `${formatToken(totalStaked, 2)} SPE`
  nodeStatus.textContent = `已抵押 ${formatToken(account.collateral ?? account[14], 2)} USDT，当前等级：${rankNames[Number(account.rank ?? account[18])] || '未知等级'}`
  stakeStatus.textContent = `已质押 ${formatToken(account.stakedSpe ?? account[11], 2)} SPE，质押算力 ${formatPower(account.stakePower ?? account[12])}，解锁 ${unixTimeText(account.stakeUnlockAt ?? account[13])}`

  const referrer = String(account.referrer ?? account[0])
  referrerStatus.textContent = referrer === zeroAddress ? '当前推荐人：未绑定' : `当前推荐人：${shortAddress(referrer)}`

  const expireAt = Number(account.referralRewardExpireAt ?? account[19])
  if (expireAt > 0) {
    const seconds = Math.max(0, expireAt - Math.floor(Date.now() / 1000))
    const hours = Math.floor(seconds / 3600)
    claimHint.textContent = `推荐收益剩余约 ${hours} 小时，过期未领取将关闭`
  } else {
    claimHint.textContent = '挖矿收益按算力实时累积，推荐收益 48 小时未领取即关闭'
  }

  claimMeta.textContent = shortAddress(runtime.address)
  await refreshLeases()
  setStatus('链上数据已同步', 'ok')
}

async function refreshLeases() {
  if (!runtime || !isConfigured) {
    return
  }

  const count = Number(await runtime.exchange.leaseListingCount())
  leaseCount.textContent = `${count}`
  if (count === 0) {
    leaseList.innerHTML = '<p class="empty-line">暂无租赁单</p>'
    return
  }

  const start = Math.max(0, count - 3)
  const rows = await Promise.all(
    Array.from({ length: count - start }, (_, index) => {
      const listingId = start + index
      return runtime!.exchange.getLeaseListing(listingId).then((listing: { owner: string; quantity: bigint; dailyPrice: bigint; active: boolean }) => ({
        listingId,
        listing,
      }))
    }),
  )

  leaseList.innerHTML = rows.reverse().map(({ listingId, listing }) => {
    const owner = String(listing.owner)
    const isOwner = owner.toLowerCase() === runtime!.address.toLowerCase()
    return `
      <div class="lease-row">
        <div>
          <strong>#${listingId} · ${Number(listing.quantity).toLocaleString('en-US')} 台</strong>
          <span>${shortAddress(owner)} · ${formatToken(listing.dailyPrice, 2)} USDT/天</span>
        </div>
        ${listing.active && isOwner ? `<button type="button" data-action data-cancel-listing="${listingId}"><i data-lucide="x"></i></button>` : `<em>${listing.active ? '可租' : '已关闭'}</em>`}
      </div>
    `
  }).join('')

  leaseList.querySelectorAll<HTMLButtonElement>('[data-cancel-listing]').forEach((button) => {
    button.addEventListener('click', () => {
      const listingId = Number(button.dataset.cancelListing)
      void cancelLease(listingId)
    })
  })
  createIcons({ icons })
}

async function approveIfNeeded(token: Contract, owner: string, spender: string, amount: bigint) {
  const allowance: bigint = await token.allowance(owner, spender)
  if (allowance >= amount) {
    return
  }

  setStatus('正在授权代币...')
  const tx = await token.approve(spender, amount)
  await tx.wait()
}

async function connectWallet() {
  try {
    setBusy(true, '正在连接钱包...')
    await ensureRuntime()
  } catch (error) {
    runtime = null
    setStatus(error instanceof Error ? error.message : '钱包连接失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function buyMiner() {
  if (busy) return

  try {
    setBusy(true, '正在准备购买矿机...')
    const current = await ensureRuntime()
    const quantity = BigInt(getPositiveInteger(minerQty))
    const mode = Number(payToken.value)
    const referrer = getAddressInput(referrerInput)
    const config = await current.exchange.config()
    const unitPrice: bigint = mode === 0 ? (config.stablePricePerMiner ?? config[0]) : (config.spePricePerMiner ?? config[1])
    const cost = unitPrice * quantity
    const token = mode === 0 ? current.usdt : current.spe

    await approveIfNeeded(token, current.address, addresses.exchange, cost)

    setStatus('正在提交购买交易...')
    const tx = await current.exchange.buyMiners(quantity, mode, referrer)
    await tx.wait()
    setStatus('矿机购买成功', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '购买矿机失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function claimRewards() {
  if (busy) return

  try {
    setBusy(true, '正在领取收益...')
    const current = await ensureRuntime()
    const tx = await current.exchange.claim()
    await tx.wait()
    setStatus('收益领取成功', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '领取失败，可能暂无可领收益', 'warn')
  } finally {
    setBusy(false)
  }
}

async function burnSpe() {
  if (busy) return

  try {
    setBusy(true, '正在准备销毁 SPE...')
    const current = await ensureRuntime()
    const amount = oneSpe()

    await approveIfNeeded(current.spe, current.address, addresses.exchange, amount)

    setStatus('正在提交销毁交易...')
    const tx = await current.exchange.burnSpeForPower(amount)
    await tx.wait()
    setStatus('已销毁 1 SPE，新增 12,000 T 算力', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '销毁失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function stakeSpe() {
  if (busy) return

  try {
    setBusy(true, '正在准备质押 SPE...')
    const current = await ensureRuntime()
    const amount = toTokenAmount(stakeAmount.value)
    if (amount <= 0n) {
      throw new Error('请输入质押数量')
    }

    await approveIfNeeded(current.spe, current.address, addresses.exchange, amount)

    setStatus('正在提交质押交易...')
    const tx = await current.exchange.stakeSpe(amount, Number(stakePlan.value))
    await tx.wait()
    setStatus('SPE 质押成功', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '质押失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function unstakeSpe() {
  if (busy) return

  try {
    setBusy(true, '正在取回质押 SPE...')
    const current = await ensureRuntime()
    const tx = await current.exchange.unstakeSpe()
    await tx.wait()
    setStatus('SPE 已取回', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '取回失败，可能仍在锁定期', 'warn')
  } finally {
    setBusy(false)
  }
}

async function depositCollateral() {
  if (busy) return

  try {
    setBusy(true, '正在准备节点抵押...')
    const current = await ensureRuntime()
    const amount = toTokenAmount(collateralAmount.value)
    if (amount <= 0n) {
      throw new Error('请输入抵押数量')
    }

    await approveIfNeeded(current.usdt, current.address, addresses.exchange, amount)

    setStatus('正在提交抵押交易...')
    const tx = await current.exchange.depositCollateral(amount)
    await tx.wait()
    setStatus('节点抵押成功', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '抵押失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function withdrawCollateral() {
  if (busy) return

  try {
    setBusy(true, '正在取回节点抵押...')
    const current = await ensureRuntime()
    const amount = toTokenAmount(collateralAmount.value)
    if (amount <= 0n) {
      throw new Error('请输入取回数量')
    }

    const tx = await current.exchange.withdrawCollateral(amount)
    await tx.wait()
    setStatus('节点抵押已取回', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '取回失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function bindReferrer() {
  if (busy) return

  try {
    setBusy(true, '正在绑定推荐人...')
    const current = await ensureRuntime()
    const referrer = getAddressInput(bindReferrerInput)
    if (referrer === zeroAddress) {
      throw new Error('请输入有效推荐人地址')
    }

    const tx = await current.exchange.bindReferrer(referrer)
    await tx.wait()
    setStatus('推荐人绑定成功', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '绑定失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function markActive() {
  if (busy) return

  try {
    setBusy(true, '正在签到...')
    const current = await ensureRuntime()
    const tx = await current.exchange.markActive()
    await tx.wait()
    setStatus('活跃状态已更新', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '签到失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function createLeaseListing() {
  if (busy) return

  try {
    setBusy(true, '正在发布租赁单...')
    const current = await ensureRuntime()
    const quantity = getPositiveInteger(leaseQty)
    const dailyPrice = toTokenAmount(leaseDailyPrice.value)
    if (dailyPrice <= 0n) {
      throw new Error('请输入日租金')
    }

    const tx = await current.exchange.createLeaseListing(quantity, dailyPrice)
    await tx.wait()
    setStatus('租赁单已发布', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '发布失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function rentLease() {
  if (busy) return

  try {
    setBusy(true, '正在准备租用矿机...')
    const current = await ensureRuntime()
    const listingId = getPositiveInteger(rentListingId, 0)
    const durationDays = getPositiveInteger(rentDays)
    const listing = await current.exchange.getLeaseListing(listingId)
    const dailyPrice: bigint = listing.dailyPrice ?? listing[2]
    const totalPrice = dailyPrice * BigInt(durationDays)

    await approveIfNeeded(current.usdt, current.address, addresses.exchange, totalPrice)

    setStatus('正在提交租赁交易...')
    const tx = await current.exchange.rentMiners(listingId, durationDays)
    await tx.wait()
    setStatus('矿机租赁成功', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '租赁失败', 'warn')
  } finally {
    setBusy(false)
  }
}

async function cancelLease(listingId: number) {
  if (busy) return

  try {
    setBusy(true, '正在取消租赁单...')
    const current = await ensureRuntime()
    const tx = await current.exchange.cancelLeaseListing(listingId)
    await tx.wait()
    setStatus('租赁单已取消', 'ok')
    await refreshDashboard()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '取消失败', 'warn')
  } finally {
    setBusy(false)
  }
}

walletBtn.addEventListener('click', connectWallet)
minerBtn.addEventListener('click', buyMiner)
claimBtn.addEventListener('click', claimRewards)
burnBtn.addEventListener('click', burnSpe)
stakeBtn.addEventListener('click', stakeSpe)
unstakeBtn.addEventListener('click', unstakeSpe)
depositCollateralBtn.addEventListener('click', depositCollateral)
withdrawCollateralBtn.addEventListener('click', withdrawCollateral)
bindReferrerBtn.addEventListener('click', bindReferrer)
activeBtn.addEventListener('click', markActive)
menuActiveBtn.addEventListener('click', () => {
  toggleMenu(false)
  void markActive()
})
createLeaseBtn.addEventListener('click', createLeaseListing)
rentLeaseBtn.addEventListener('click', rentLease)
menuBtn.addEventListener('click', () => toggleMenu(!appMenu.classList.contains('open')))
menuCloseBtn.addEventListener('click', () => toggleMenu(false))
menuBackdrop.addEventListener('click', () => toggleMenu(false))
menuWalletBtn.addEventListener('click', () => {
  toggleMenu(false)
  void connectWallet()
})
menuClaimBtn.addEventListener('click', () => {
  toggleMenu(false)
  void claimRewards()
})

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    selectView(tab.dataset.view)
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-menu-view]').forEach((button) => {
  button.addEventListener('click', () => {
    selectView(button.dataset.menuView)
    toggleMenu(false)
  })
})

const initialView = new URLSearchParams(window.location.search).get('view')
if (initialView) {
  selectView(initialView)
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    toggleMenu(false)
  }
})

window.ethereum?.on?.('accountsChanged', () => {
  runtime = null
  walletBtn.innerHTML = '<i data-lucide="wallet"></i> 连接钱包'
  createIcons({ icons })
  setStatus('钱包账户已变化，请重新连接', 'warn')
})

window.ethereum?.on?.('chainChanged', () => {
  runtime = null
  setStatus('网络已变化，请重新连接钱包', 'warn')
})

if (!hasWallet()) {
  setStatus('未检测到浏览器钱包，当前为静态预览模式', 'warn')
} else if (!isConfigured) {
  setStatus('合约地址未配置：部署后把 deployments/*.env 写入 .env.local', 'warn')
} else {
  setStatus('请连接钱包以读取链上数据')
}
