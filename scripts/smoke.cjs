const fs = require('fs')
const path = require('path')
const hre = require('hardhat')

async function main() {
  const deploymentPath = path.join(__dirname, '..', 'deployments', 'local.json')
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Missing deployments/local.json. Run npm run deploy:local first.')
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
  const [owner, user, renter] = await hre.ethers.getSigners()
  const userAddress = await user.getAddress()
  const renterAddress = await renter.getAddress()

  const spe = await hre.ethers.getContractAt('SparkToken', deployment.spe)
  const usdt = await hre.ethers.getContractAt('SparkToken', deployment.usdt)
  const exchange = await hre.ethers.getContractAt('SparkExchange', deployment.exchange)

  await (await usdt.connect(owner).transfer(userAddress, hre.ethers.parseEther('1000'))).wait()
  await (await usdt.connect(owner).transfer(renterAddress, hre.ethers.parseEther('100'))).wait()
  await (await spe.connect(owner).transfer(userAddress, hre.ethers.parseEther('100'))).wait()

  await (await usdt.connect(user).approve(deployment.exchange, hre.ethers.parseEther('20'))).wait()
  await (await exchange.connect(user).buyMiners(2, 0, hre.ethers.ZeroAddress)).wait()

  await (await spe.connect(user).approve(deployment.exchange, hre.ethers.parseEther('2'))).wait()
  await (await exchange.connect(user).burnSpeForPower(hre.ethers.parseEther('1'))).wait()
  await (await exchange.connect(user).stakeSpe(hre.ethers.parseEther('1'), 0)).wait()

  await (await usdt.connect(user).approve(deployment.exchange, hre.ethers.parseEther('500'))).wait()
  await (await exchange.connect(user).depositCollateral(hre.ethers.parseEther('500'))).wait()

  await (await exchange.connect(user).createLeaseListing(1, hre.ethers.parseEther('1'))).wait()
  await (await usdt.connect(renter).approve(deployment.exchange, hre.ethers.parseEther('7'))).wait()
  await (await exchange.connect(renter).rentMiners(0, 7)).wait()

  await hre.network.provider.send('evm_increaseTime', [24 * 60 * 60])
  await hre.network.provider.send('evm_mine')

  const beforeClaim = await exchange.pendingRewards(userAddress)
  await (await exchange.connect(user).claim()).wait()

  const account = await exchange.getAccount(userAddress)
  const renterAccount = await exchange.getAccount(renterAddress)
  const speBalance = await spe.balanceOf(userAddress)
  const rewardPool = await exchange.rewardPoolBalance()

  console.log(JSON.stringify({
    user: userAddress,
    miners: account.miners.toString(),
    personalPower: account.personalPower.toString(),
    collateral: hre.ethers.formatEther(account.collateral),
    stakedSpe: hre.ethers.formatEther(account.stakedSpe),
    rank: Number(account.rank),
    pendingBeforeClaim: hre.ethers.formatEther(beforeClaim.totalReward),
    speBalance: hre.ethers.formatEther(speBalance),
    renterPower: renterAccount.personalPower.toString(),
    rewardPool: hre.ethers.formatEther(rewardPool),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
