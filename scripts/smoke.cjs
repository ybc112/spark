const fs = require('fs')
const path = require('path')
const hre = require('hardhat')

async function main() {
  const deploymentPath = path.join(__dirname, '..', 'deployments', 'local.json')
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Missing deployments/local.json. Run npm run deploy:local first.')
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
  const [owner, user] = await hre.ethers.getSigners()
  const userAddress = await user.getAddress()

  const spe = await hre.ethers.getContractAt('SparkToken', deployment.spe)
  const ybt = await hre.ethers.getContractAt('SparkToken', deployment.ybt)
  const usdt = await hre.ethers.getContractAt('SparkToken', deployment.usdt)
  const exchange = await hre.ethers.getContractAt('SparkExchange', deployment.exchange)

  await (await usdt.connect(owner).transfer(userAddress, hre.ethers.parseEther('1000'))).wait()
  await (await spe.connect(owner).transfer(userAddress, hre.ethers.parseEther('100'))).wait()

  await (await usdt.connect(user).approve(deployment.exchange, hre.ethers.parseEther('20'))).wait()
  await (await exchange.connect(user).buyMiners(2, 0, hre.ethers.ZeroAddress)).wait()

  await (await spe.connect(user).approve(deployment.exchange, hre.ethers.parseEther('1'))).wait()
  await (await exchange.connect(user).burnSpeForPower(hre.ethers.parseEther('1'))).wait()

  await hre.network.provider.send('evm_increaseTime', [24 * 60 * 60])
  await hre.network.provider.send('evm_mine')

  const beforeClaim = await exchange.pendingRewards(userAddress)
  await (await exchange.connect(user).claim()).wait()
  const account = await exchange.getAccount(userAddress)
  const ybtBalance = await ybt.balanceOf(userAddress)

  console.log(JSON.stringify({
    user: userAddress,
    miners: account.miners.toString(),
    personalPower: account.personalPower.toString(),
    rank: Number(account.rank),
    pendingBeforeClaim: hre.ethers.formatEther(beforeClaim.totalReward),
    ybtBalance: hre.ethers.formatEther(ybtBalance),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
