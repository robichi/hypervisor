import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants } from 'ethers'
import chai from 'chai'
import { expect } from 'chai'
import { fixture, ichiVisorTestFixture } from "./shared/fixtures"
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
    ICHIVisorFactory,
    HypervisorFactory,
    ICHIVisor,
    Hypervisor,
    NonfungiblePositionManager,
    TestERC20
} from "../typechain"

describe('Hypervisors on Mainnet Fork', () => {
    let factory: UniswapV3Factory
    let uniswapPool: IUniswapV3Pool
    // token0 = WETH9
    let wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    // token1 = USDT
    let usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    let usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    let uniswapV3Factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    let whaleAddress = "0x0548F59fEE79f8832C299e01dCA5c76F034F558e"
    let hypervisorFactory: HypervisorFactory
    let ichiVisorFactory: ICHIVisorFactory
    let ethUsdtHypervisor: ICHIVisor
    let usdcEthHypervisor: ICHIVisor
    let usdt: TestERC20
    let weth9: TestERC20
    let usdc: TestERC20

    beforeEach('deploy contracts', async () => {
        const hypervisorFactoryFactory = await ethers.getContractFactory('HypervisorFactory')
        hypervisorFactory = (await hypervisorFactoryFactory.deploy(uniswapV3Factory)) as HypervisorFactory
    
        const ichiVisorFactoryFactory = await ethers.getContractFactory('ICHIVisorFactory')
        ichiVisorFactory = (await ichiVisorFactoryFactory.deploy(uniswapV3Factory, hypervisorFactory.address)) as ICHIVisorFactory
    
        // console.log("initial HV Factory owner " + await hypervisorFactory.owner());
        await hypervisorFactory.init(ichiVisorFactory.address);
        // console.log("later HV Factory owner " + await hypervisorFactory.owner());

        // let [owner, alice] = await ethers.getSigners()

        await ichiVisorFactory.createIchiVisor(wethAddress, true, usdtAddress, true, FeeAmount.MEDIUM)
        await ichiVisorFactory.createIchiVisor(usdcAddress, true, wethAddress, true, FeeAmount.MEDIUM)
        
        let res = await ichiVisorFactory.visorKey(wethAddress, usdtAddress, FeeAmount.MEDIUM)
        let key = res[0];
        const ethUsdtHypervisorAddress = (await ichiVisorFactory.ichiVisor(key)).ichivisor;
        res = await ichiVisorFactory.visorKey(usdcAddress, wethAddress, FeeAmount.MEDIUM)
        key = res[0];
        const usdcEthHypervisorAddress = (await ichiVisorFactory.ichiVisor(key)).ichivisor;

        ethUsdtHypervisor = (await ethers.getContractAt('ICHIVisor', ethUsdtHypervisorAddress)) as ICHIVisor
        usdcEthHypervisor = (await ethers.getContractAt('ICHIVisor', usdcEthHypervisorAddress)) as ICHIVisor

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

        await usdt.connect(whale).approve(ethUsdtHypervisor.address, ethers.utils.parseEther('1000000'))
        await weth9.connect(whale).approve(ethUsdtHypervisor.address, ethers.utils.parseEther('1000000'))

        let usdtBalance = await usdt.connect(whale).balanceOf(whaleAddress)
        let weth9Balance = await weth9.connect(whale).balanceOf(whaleAddress)
        let usdcBalance = await usdc.connect(whale).balanceOf(whaleAddress)
        console.log("usdt: " + usdtBalance.toString() + " weth: " + weth9Balance.toString() + " usdc: " + usdcBalance.toString())

        await ethUsdtHypervisor.connect(whale).deposit(100000000, 1000, owner.address)
        await ethUsdtHypervisor.rebalance(19140, 19740, 19440, 19500, owner.address, -500)

        await usdc.connect(whale).approve(usdcEthHypervisor.address, ethers.utils.parseEther('1000000'))
        await weth9.connect(whale).approve(usdcEthHypervisor.address, ethers.utils.parseEther('1000000'))

        await usdcEthHypervisor.connect(whale).deposit(10000, 0, owner.address)
    })
})
