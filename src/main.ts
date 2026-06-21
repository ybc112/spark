import './style.css'
import { Contract, isAddress } from 'ethers'
import { createIcons, icons } from 'lucide'
import {
  addresses,
  createRuntime,
  formatPower,
  formatToken,
  hasWallet,
  isConfigured,
  oneSpe,
  rankNames,
  shortAddress,
  type WalletRuntime,
  zeroAddress,
} from './contracts'

type RuntimeState = WalletRuntime | null

const ranks = [
  { name: '体验矿工', condition: '完成新手任务', bonus: '免费 1,000 T', share: '-' },
  { name: '正式矿工', condition: '激活 1 台矿机 + 个人算力 >= 50,000 T', bonus: '+20%', share: '-' },
  { name: '节点矿池', condition: '直推 5 名矿工，团队 >= 20 台', bonus: '+25%', share: '团队矿池 1.2%' },
  { name: '蜂窝矿池', condition: '团队 >= 2,000 台，自持 200 台', bonus: '+30%', share: '团队矿池 2.0%' },
]

const incomeRows = [
  ['直推 1 代', '20%', '永久有效'],
  ['间推 2 代', '8%', '自动结算'],
  ['间推 3 代', '6%', '自动结算'],
  ['间推 4 代', '4%', '自动结算'],
  ['间推 5 代', '2%', '自动结算'],
  ['6 代及以后', '0.5%', '全网微分润池'],
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
        <button type="button" data-menu-view="token"><i data-lucide="flame"></i><span>SPE 销毁</span></button>
      </div>
      <div class="menu-panel">
        <span>链上状态</span>
        <strong id="menuStatus">等待连接钱包</strong>
      </div>
      <div class="menu-cta">
        <button type="button" id="menuWalletBtn"><i data-lucide="wallet"></i> 连接钱包</button>
        <button type="button" id="menuClaimBtn"><i data-lucide="zap"></i> 领取收益</button>
      </div>
    </aside>

    <div class="chain-banner" id="chainBanner"></div>


    <section class="hero-panel">
      <div class="ticker-row">
        <span>MY SPE</span>
        <strong><i data-lucide="trending-up"></i> +0.1</strong>
      </div>
      <div class="balance-line">
        <div>
          <p class="eyebrow">SPE 总数量</p>
          <h1 id="speBalance">21.45</h1>
        </div>
        <button class="wallet-btn" id="walletBtn" type="button"><i data-lucide="wallet"></i> 连接钱包</button>
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
        <div class="claim-value"><span id="claimAmount">+2.205</span><small>YBT</small></div>
        <p id="claimHint">推荐好友已签到收益，48 小时未领取即关闭</p>
      </div>

      <div class="action-grid">
        <button class="primary-btn" id="claimBtn" type="button"><i data-lucide="zap"></i> 领取全部</button>
        <button class="secondary-btn" id="minerBtn" type="button"><i data-lucide="pickaxe"></i> 购买矿机</button>
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
    </section>

    <nav class="mode-tabs" aria-label="页面模块">
      <button class="tab active" type="button" data-view="mine"><i data-lucide="gem"></i> 矿机</button>
      <button class="tab" type="button" data-view="node"><i data-lucide="crown"></i> 节点</button>
      <button class="tab" type="button" data-view="invite"><i data-lucide="share-2"></i> 代收</button>
      <button class="tab" type="button" data-view="token"><i data-lucide="pie-chart"></i> SPE</button>
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
          <div><span>总算力</span><strong>100,000 T</strong><small>最优性价比</small></div>
          <div><span>算力分配</span><strong>70% / 20% / 10%</strong><small>基础算力 / 直推红包 / 节点燃料</small></div>
          <div><span>回本周期</span><strong>8-15 天</strong><small>后期稳定 30-60 天</small></div>
        </div>
        <div class="trade-box">
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
      </article>

      <article class="glass-card view-panel" data-panel="token">
        <div class="card-head">
          <div>
            <p class="eyebrow">Tokenomics</p>
            <h2>SPE 销毁与分配</h2>
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
          <button class="inline-action" id="burnBtn" type="button"><i data-lucide="flame"></i> 销毁 1 SPE 换算力</button>
          <div class="bars">
            <label><span>挖矿产出</span><i style="--w:55%"></i><b>55%</b></label>
            <label><span>生态发展</span><i style="--w:25%"></i><b>25%</b></label>
            <label><span>社区建设</span><i style="--w:10%"></i><b>10%</b></label>
            <label><span>早期投资</span><i style="--w:10%"></i><b>10%</b></label>
          </div>
        </div>
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
        <li><strong>高级</strong><span>50 台 + 大量销毁 SPE，进入蜂窝矿池</span></li>
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
const menuStatus = document.querySelector<HTMLElement>('#menuStatus')!
const walletBtn = document.querySelector<HTMLButtonElement>('#walletBtn')!
const claimBtn = document.querySelector<HTMLButtonElement>('#claimBtn')!
const minerBtn = document.querySelector<HTMLButtonElement>('#minerBtn')!
const burnBtn = document.querySelector<HTMLButtonElement>('#burnBtn')!
const speBalance = document.querySelector<HTMLHeadingElement>('#speBalance')!
const rankName = document.querySelector<HTMLSpanElement>('#rankName')!
const claimAmount = document.querySelector<HTMLSpanElement>('#claimAmount')!
const claimMeta = document.querySelector<HTMLElement>('#claimMeta')!
const claimHint = document.querySelector<HTMLParagraphElement>('#claimHint')!
const minerPrice = document.querySelector<HTMLElement>('#minerPrice')!
const powerStat = document.querySelector<HTMLElement>('#powerStat')!
const minerStat = document.querySelector<HTMLElement>('#minerStat')!
const teamStat = document.querySelector<HTMLElement>('#teamStat')!
const minerQty = document.querySelector<HTMLInputElement>('#minerQty')!
const payToken = document.querySelector<HTMLSelectElement>('#payToken')!
const referrerInput = document.querySelector<HTMLInputElement>('#referrerInput')!
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab')
const panels = document.querySelectorAll<HTMLElement>('.view-panel')

function setStatus(message: string, tone: 'info' | 'ok' | 'warn' = 'info') {
  chainBanner.textContent = message
  chainBanner.dataset.tone = tone
  menuStatus.textContent = message
}

function setBusy(nextBusy: boolean, label = '处理中...') {
  busy = nextBusy
  claimBtn.disabled = nextBusy
  minerBtn.disabled = nextBusy
  burnBtn.disabled = nextBusy
  menuWalletBtn.disabled = nextBusy
  menuClaimBtn.disabled = nextBusy
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

function getQuantity() {
  const value = Math.max(1, Math.floor(Number(minerQty.value || 1)))
  minerQty.value = String(value)
  return BigInt(value)
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

  const [account, rewards, spe, config] = await Promise.all([
    runtime.exchange.getAccount(runtime.address),
    runtime.exchange.pendingRewards(runtime.address),
    runtime.spe.balanceOf(runtime.address),
    runtime.exchange.config(),
  ])

  speBalance.textContent = formatToken(spe, 2)
  claimAmount.textContent = `+${formatToken(rewards.totalReward ?? rewards[3], 3)}`
  rankName.textContent = rankNames[Number(account.rank ?? account[10])] || '未知等级'
  powerStat.textContent = formatPower(account.personalPower ?? account[4])
  minerStat.textContent = `${Number(account.miners ?? account[1]).toLocaleString('en-US')} 台`
  teamStat.textContent = `${Number(account.teamMiners ?? account[3]).toLocaleString('en-US')} 台`
  minerPrice.textContent = `${formatToken(config.stablePricePerMiner ?? config[0], 2)} USDT / 台`

  const expireAt = Number(account.referralRewardExpireAt ?? account[11])
  if (expireAt > 0) {
    const seconds = Math.max(0, expireAt - Math.floor(Date.now() / 1000))
    const hours = Math.floor(seconds / 3600)
    claimHint.textContent = `推荐收益剩余约 ${hours} 小时，过期未领取将关闭`
  } else {
    claimHint.textContent = '挖矿收益按算力实时累积，推荐收益 48 小时未领取即关闭'
  }

  claimMeta.textContent = runtime ? shortAddress(runtime.address) : '15 / 15'
  setStatus('链上数据已同步', 'ok')
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
    const quantity = getQuantity()
    const mode = Number(payToken.value)
    const referrerValue = referrerInput.value.trim()
    const referrer = referrerValue && isAddress(referrerValue) ? referrerValue : zeroAddress
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

walletBtn.addEventListener('click', connectWallet)
minerBtn.addEventListener('click', buyMiner)
claimBtn.addEventListener('click', claimRewards)
burnBtn.addEventListener('click', burnSpe)
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
  setStatus('合约地址未配置：部署后把 deployments/*.env 写入 .env', 'warn')
} else {
  setStatus('请连接钱包以读取链上数据')
}
