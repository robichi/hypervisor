import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants } from 'ethers'
import chai from 'chai'
import { expect } from 'chai'
import { fixture, ichiVaultTestFixture } from "./shared/fixtures"
import { solidity } from "ethereum-waffle"

chai.use(solidity)

import {
    FeeAmount,
    TICK_SPACINGS,
    encodePriceSqrt,
    getPositionKey,
    getMinTick,
    getMaxTick
} from './shared/utilities'

import {
    SwapRouter,
    UniswapV3Factory,
    IUniswapV3Pool,
    ICHIVaultFactory,
    ICHIVault,
    NonfungiblePositionManager,
    TestERC20
} from "../typechain"

describe('Vaults on Mainnet Fork', () => {
    let factory: UniswapV3Factory
    let uniswapPool: IUniswapV3Pool
    // token0 = WETH9
    let wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    // token1 = USDT
    let usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    let usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    let uniswapV3Factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    let whaleAddress = "0x0548F59fEE79f8832C299e01dCA5c76F034F558e"
    let ichiVaultFactory: ICHIVaultFactory
    let ethUsdtVault: ICHIVault
    let usdcEthVault: ICHIVault
    let usdt: TestERC20
    let weth9: TestERC20
    let usdc: TestERC20

    beforeEach('deploy contracts', async () => {
        const ichiVaultFactoryFactory = await ethers.getContractFactory('ICHIVaultFactory')
        ichiVaultFactory = (await ichiVaultFactoryFactory.deploy(uniswapV3Factory)) as ICHIVaultFactory
    
        // let [owner, alice] = await ethers.getSigners()

        await ichiVaultFactory.createICHIVault(wethAddress, true, usdtAddress, true, FeeAmount.MEDIUM)
        await ichiVaultFactory.createICHIVault(usdcAddress, true, wethAddress, true, FeeAmount.MEDIUM)
        
        let ethUsdtVaultAddress = await ichiVaultFactory.getICHIVault(wethAddress, usdtAddress, FeeAmount.MEDIUM, true, true);
        let usdcEthVaultAddress = await ichiVaultFactory.getICHIVault(usdcAddress, wethAddress, FeeAmount.MEDIUM, true, true);

        ethUsdtVault = (await ethers.getContractAt('ICHIVault', ethUsdtVaultAddress)) as ICHIVault
        usdcEthVault = (await ethers.getContractAt('ICHIVault', usdcEthVaultAddress)) as ICHIVault

        factory = (await ethers.getContractAt('UniswapV3Factory', uniswapV3Factory)) as UniswapV3Factory
        const poolAddress = await factory.getPool(wethAddress, usdtAddress, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        usdt = (await ethers.getContractAt('TestERC20', usdtAddress)) as TestERC20
        weth9 = (await ethers.getContractAt('TestERC20', wethAddress)) as TestERC20
        usdc = (await ethers.getContractAt('TestERC20', usdcAddress)) as TestERC20
    })

    it('allows for swaps on ethusdt pair', async () => {

        await ethers.provider.send('hardhat_impersonateAccount', [whaleAddress]);
        const whale = await ethers.provider.getSigner(whaleAddress);
    
        let [owner] = await ethers.getSigners()

        // sanity check ethusdt pool address
        let ethusdtMainnetPool = '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36'
        expect(uniswapPool.address).to.equal(ethusdtMainnetPool)

        await usdt.connect(whale).approve(ethUsdtVault.address, ethers.utils.parseEther('1000000'))
        await weth9.connect(whale).approve(ethUsdtVault.address, ethers.utils.parseEther('1000000'))

        let usdtBalance = await usdt.connect(whale).balanceOf(whaleAddress)
        let weth9Balance = await weth9.connect(whale).balanceOf(whaleAddress)
        let usdcBalance = await usdc.connect(whale).balanceOf(whaleAddress)
        console.log("usdt: " + usdtBalance.toString() + " weth: " + weth9Balance.toString() + " usdc: " + usdcBalance.toString())

        await ethUsdtVault.connect(whale).deposit(100000000, 1000, owner.address)
        await ethUsdtVault.rebalance(19140, 19740, 19440, 19500, -500)

        await usdc.connect(whale).approve(usdcEthVault.address, ethers.utils.parseEther('1000000'))
        await weth9.connect(whale).approve(usdcEthVault.address, ethers.utils.parseEther('1000000'))

        await usdcEthVault.connect(whale).deposit(10000, 0, owner.address)
    })
})
