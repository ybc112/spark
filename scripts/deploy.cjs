const fs = require('fs')
const path = require('path')
const hre = require('hardhat')

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const owner = await deployer.getAddress()

  console.log(`Deploying Spark contracts with: ${owner}`)

  const initialSupply = hre.ethers.parseEther('21000000')
  const testSupply = hre.ethers.parseEther('100000000')

  const SparkToken = await hre.ethers.getContractFactory('SparkToken')
  const spe = await SparkToken.deploy('Spark Exchange Token', 'SPE', owner, initialSupply)
  await spe.waitForDeployment()

  const spc = await SparkToken.deploy('Spark Yield Token', 'SPC', owner, 0)
  await spc.waitForDeployment()

  const usdt = await SparkToken.deploy('Mock USDT', 'USDT', owner, testSupply)
  await usdt.waitForDeployment()

  const SparkExchange = await hre.ethers.getContractFactory('SparkExchange')
  const exchange = await SparkExchange.deploy(
    await spe.getAddress(),
    await spc.getAddress(),
    await usdt.getAddress(),
    owner,
    owner,
  )
  await exchange.waitForDeployment()

  await (await spc.setMinter(await exchange.getAddress(), true)).wait()

  const addresses = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: owner,
    spe: await spe.getAddress(),
    spc: await spc.getAddress(),
    usdt: await usdt.getAddress(),
    exchange: await exchange.getAddress(),
  }

  const envText = [
    `VITE_SPARK_EXCHANGE_ADDRESS=${addresses.exchange}`,
    `VITE_SPE_TOKEN_ADDRESS=${addresses.spe}`,
    `VITE_SPC_TOKEN_ADDRESS=${addresses.spc}`,
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
