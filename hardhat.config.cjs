require('dotenv').config()
require('@nomicfoundation/hardhat-ethers')

const { PRIVATE_KEY = '', RPC_URL = '' } = process.env

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    local: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    custom: {
      url: RPC_URL || 'http://127.0.0.1:8545',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
}
