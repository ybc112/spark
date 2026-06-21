const fs = require('fs')
const path = require('path')
const hre = require('hardhat')

function envAddress(name, fallback) {
  const value = process.env[name]
  return value && hre.ethers.isAddress(value) ? value : fallback
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const owner = await deployer.getAddress()
  const treasury = envAddress('TREASURY_ADDRESS', owner)
  const buybackTreasury = envAddress('BUYBACK_TREASURY_ADDRESS', owner)
  const rewardPoolSpe = hre.ethers.parseEther(process.env.INITIAL_REWARD_POOL_SPE || '0')

  console.log(`Deploying Spark contracts with: ${owner}`)
  console.log(`Treasury: ${treasury}`)
  console.log(`Buyback treasury: ${buybackTreasury}`)

  const initialSupply = hre.ethers.parseEther('21000000')
  const testSupply = hre.ethers.parseEther('100000000')

  const SparkToken = await hre.ethers.getContractFactory('SparkToken')
  const spe = await SparkToken.deploy('Spark Exchange Token', 'SPE', owner, initialSupply)
  await spe.waitForDeployment()

  const usdt = await SparkToken.deploy('Mock USDT', 'USDT', owner, testSupply)
  await usdt.waitForDeployment()

  const SparkExchange = await hre.ethers.getContractFactory('SparkExchange')
  const exchange = await SparkExchange.deploy(
    await spe.getAddress(),
    await usdt.getAddress(),
    treasury,
    buybackTreasury,
    owner,
  )
  await exchange.waitForDeployment()

  await (await spe.setMinter(await exchange.getAddress(), true)).wait()

  if (rewardPoolSpe > 0n) {
    await (await spe.transfer(await exchange.getAddress(), rewardPoolSpe)).wait()
  }

  const addresses = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: owner,
    treasury,
    buybackTreasury,
    spe: await spe.getAddress(),
    usdt: await usdt.getAddress(),
    exchange: await exchange.getAddress(),
    rewardPoolSpe: hre.ethers.formatEther(rewardPoolSpe),
  }

  const envText = [
    `VITE_SPARK_EXCHANGE_ADDRESS=${addresses.exchange}`,
    `VITE_SPE_TOKEN_ADDRESS=${addresses.spe}`,
    `VITE_USDT_TOKEN_ADDRESS=${addresses.usdt}`,
    `VITE_CHAIN_ID=${addresses.chainId}`,
    '',
  ].join('\n')

  const outputDir = path.join(__dirname, '..', 'deployments')
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, `${hre.network.name}.json`), `${JSON.stringify(addresses, null, 2)}\n`)
  fs.writeFileSync(path.join(outputDir, `${hre.network.name}.env`), envText)
  fs.writeFileSync(path.join(__dirname, '..', '.env.local'), envText)

  console.log(JSON.stringify(addresses, null, 2))
  console.log(`Frontend env written to deployments/${hre.network.name}.env`)
  console.log('Frontend env also written to .env.local')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
