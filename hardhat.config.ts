import 'hardhat-typechain'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import './scripts/copy-uniswap-v3-artifacts.ts'
import { parseUnits } from 'ethers/lib/utils'
require('dotenv').config()
const mnemonic = process.env.DEV_MNEMONIC || ''
const archive_node = process.env.ETHEREUM_ARCHIVE_URL || ''

export default {
  networks: {
      hardhat: {
          allowUnlimitedContractSize: false,
      },
      goerli: {
        url: 'https://goerli.infura.io/v3/' + process.env.INFURA_ID,
        accounts: {
          mnemonic,
        },
        gasPrice: parseUnits('130', 'gwei').toNumber(),
      },
      mainnet: {
        url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_ID,
        accounts: {
          mnemonic,
        },
      }
  },
  watcher: {
      compilation: {
          tasks: ["compile"],
      }
  },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_APIKEY,
  },
  mocha: {
    timeout: 2000000
  }
}
