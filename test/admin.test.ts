import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants } from 'ethers'
import chai from 'chai'
import { expect } from 'chai'
import { fixture, ichiVisorTestFixture } from "./shared/fixtures"
import { solidity } from "ethereum-waffle"
const { expectEvent } = require("@openzeppelin/test-helpers");
const truffleAssert = require('truffle-assertions');

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
    ICHIVisor,
    Hypervisor,
    NonfungiblePositionManager,
    TestERC20,
    HypervisorFactory,
    IHypervisorFactory
} from "../typechain"

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"
const createFixtureLoader = waffle.createFixtureLoader
const smallTokenAmount = ethers.utils.parseEther('1000')
const largeTokenAmount = ethers.utils.parseEther('1000000')
const veryLargeTokenAmount = ethers.utils.parseEther('10000000000')
const giantTokenAmount = ethers.utils.parseEther('1000000000000')

describe('Access Control Checks', () => {
    const [wallet, alice, bob, carol, other,
           user0, user1, user2, user3, user4] = waffle.provider.getWallets()

    let factory: UniswapV3Factory
    let router: SwapRouter
    let nft: NonfungiblePositionManager
    let token0: TestERC20
    let token1: TestERC20
    let token2: TestERC20
    let uniswapPool: IUniswapV3Pool
    let ichiVisorFactory: ICHIVisorFactory
    let hypervisorFactory: HypervisorFactory
    let ichiVisor: ICHIVisor
    let hypervisor: Hypervisor

    let loadFixture: ReturnType<typeof createFixtureLoader>
    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy contracts', async () => {
        ({ token0, token1, token2, factory, router, nft, ichiVisorFactory } = await loadFixture(ichiVisorTestFixture))
        await ichiVisorFactory.connect(wallet).createIchiVisor(token0.address, true, token1.address, true, FeeAmount.MEDIUM)
        
        const res = await ichiVisorFactory.visorKey(token0.address, token1.address, FeeAmount.MEDIUM)
        const key = res[0];
        const ichiVisorAddress = (await ichiVisorFactory.ichiVisor(key)).ichivisor;
        ichiVisor = (await ethers.getContractAt('ICHIVisor', ichiVisorAddress)) as ICHIVisor

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        await uniswapPool.initialize(encodePriceSqrt('1', '1'))
        await ichiVisor.connect(wallet).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

        const hypervisorAddress = await ichiVisor.hypervisor();
        hypervisor = (await ethers.getContractAt('Hypervisor', hypervisorAddress)) as Hypervisor

        const hypervisorFactoryAddress = await ichiVisorFactory.hypervisorFactory();
        hypervisorFactory = (await ethers.getContractAt('HypervisorFactory', hypervisorFactoryAddress)) as HypervisorFactory

        // adding extra liquidity into pool to make sure there's always
        // someone to swap with
        await token0.mint(carol.address, giantTokenAmount)
        await token1.mint(carol.address, giantTokenAmount)

        await token0.connect(carol).approve(nft.address, veryLargeTokenAmount)
        await token1.connect(carol).approve(nft.address, veryLargeTokenAmount)

        await nft.connect(carol).mint({
            token0: token0.address,
            token1: token1.address,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            fee: FeeAmount.MEDIUM,
            recipient: carol.address,
            amount0Desired: veryLargeTokenAmount,
            amount1Desired: veryLargeTokenAmount,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 2000000000,
        })
        
    })

    it('ICHIVisorFactory', async () => {
        let msg1 = "Ownable: caller is not the owner";

        await truffleAssert.reverts(ichiVisorFactory.connect(alice).createIchiVisor(token0.address, true, token0.address, true, FeeAmount.MEDIUM), msg1);
    })

    it('ICHIVisor', async () => {
        let msg1 = "Ownable: caller is not the owner";

        await truffleAssert.reverts(ichiVisor.connect(alice).init(alice.address), msg1);
        await truffleAssert.reverts(ichiVisor.connect(alice).rebalance(-1800, 1800, -600, 0, alice.address, 0), msg1);
        await truffleAssert.reverts(ichiVisor.connect(alice).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000')), msg1);

    })

})

describe('Input Validation Checks', () => {
    const [wallet, alice, bob, carol, other,
           user0, user1, user2, user3, user4] = waffle.provider.getWallets()

    let factory: UniswapV3Factory
    let router: SwapRouter
    let nft: NonfungiblePositionManager
    let token0: TestERC20
    let token1: TestERC20
    let token2: TestERC20
    let uniswapPool: IUniswapV3Pool
    let ichiVisorFactory: ICHIVisorFactory
    let hypervisorFactory: HypervisorFactory
    let ichiVisor: ICHIVisor
    let hypervisor: Hypervisor

    let loadFixture: ReturnType<typeof createFixtureLoader>
    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy contracts', async () => {
        ({ token0, token1, token2, factory, router, nft, ichiVisorFactory } = await loadFixture(ichiVisorTestFixture))
        await ichiVisorFactory.connect(wallet).createIchiVisor(token0.address, true, token1.address, true, FeeAmount.MEDIUM)
        
        const res = await ichiVisorFactory.visorKey(token0.address, token1.address, FeeAmount.MEDIUM)
        const key = res[0];
        const ichiVisorAddress = (await ichiVisorFactory.ichiVisor(key)).ichivisor;
        ichiVisor = (await ethers.getContractAt('ICHIVisor', ichiVisorAddress)) as ICHIVisor

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        await uniswapPool.initialize(encodePriceSqrt('1', '1'))
        await ichiVisor.connect(wallet).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

        const hypervisorAddress = await ichiVisor.hypervisor();
        hypervisor = (await ethers.getContractAt('Hypervisor', hypervisorAddress)) as Hypervisor

        const hypervisorFactoryAddress = await ichiVisorFactory.hypervisorFactory();
        hypervisorFactory = (await ethers.getContractAt('HypervisorFactory', hypervisorFactoryAddress)) as HypervisorFactory

        // adding extra liquidity into pool to make sure there's always
        // someone to swap with
        await token0.mint(carol.address, giantTokenAmount)
        await token1.mint(carol.address, giantTokenAmount)

        await token0.connect(carol).approve(nft.address, veryLargeTokenAmount)
        await token1.connect(carol).approve(nft.address, veryLargeTokenAmount)

        await nft.connect(carol).mint({
            token0: token0.address,
            token1: token1.address,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            fee: FeeAmount.MEDIUM,
            recipient: carol.address,
            amount0Desired: veryLargeTokenAmount,
            amount1Desired: veryLargeTokenAmount,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 2000000000,
        })
        
    })

    it('ICHIVisorFactory - createIchiVisor', async () => {
        let msg1 = "ICHIVisorFactory.createIchiVisor: Identical token addresses",
            msg2 = "ICHIVisorFactory.createIchiVisor: token undefined",
            msg3 = "ICHIVisorFactory.createIchiVisor: At least one token must be allowed",
            msg4 = "ICHIVisorFactory.createIchiVisor:: (500) hypervisor address collision",
            msg5 = "ICHIVisor.constructor: Incorrect Fee";

        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createIchiVisor(token0.address, true, token0.address, true, FeeAmount.MEDIUM), msg1);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createIchiVisor(NULL_ADDRESS, true, token1.address, true, FeeAmount.MEDIUM), msg2);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createIchiVisor(token0.address, true, NULL_ADDRESS, true, FeeAmount.MEDIUM), msg2);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createIchiVisor(token0.address, false, token1.address, false, FeeAmount.MEDIUM), msg3);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createIchiVisor(token0.address, true, token1.address, true, FeeAmount.MEDIUM), msg4);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createIchiVisor(token0.address, true, token1.address, true, FeeAmount.BAD), msg5);
    })

    function msg(text: string) {
        return "VM Exception while processing transaction: reverted with reason string '" + text + "'";
    }

    it('ICHIVisor - create without a factory', async () => {
        let msg1 = "ICHIVisor.constructor: Identical token addresses",
            msg2 = "ICHIVisor.constructor: token undefined",
            msg3 = "ICHIVisor.constructor: At least one token must be allowed",
            msg4 = "ICHIVisor.constructor: Incorrect Fee",
            msg5 = "ICHIVisor.initialied: not initialized",
            msg6 = "HypervisorFactory.createHypervisor: hypervisor exists",
            msg7 = "HypervisorFactory.onlyTrusted: caller wasn't created by the ichiVisorFactory";

        const ichiVisorContract = await ethers.getContractFactory('ICHIVisor')

        await truffleAssert.reverts(
            ichiVisorContract.deploy(hypervisorFactory.address, factory.address,
            token0.address, true, token0.address, true, FeeAmount.HIGH), msg(msg1));
        await truffleAssert.reverts(
            ichiVisorContract.deploy(hypervisorFactory.address, factory.address,
            NULL_ADDRESS, true, token1.address, true, FeeAmount.HIGH), msg(msg2));
        await truffleAssert.reverts(
            ichiVisorContract.deploy(hypervisorFactory.address, factory.address,
            token0.address, true, NULL_ADDRESS, true, FeeAmount.HIGH), msg(msg2));
        await truffleAssert.reverts(
            ichiVisorContract.deploy(hypervisorFactory.address, factory.address,
            token0.address, false, token1.address, false, FeeAmount.HIGH), msg(msg3));
        await truffleAssert.reverts(
            ichiVisorContract.deploy(hypervisorFactory.address, factory.address,
            token0.address, false, token1.address, true, FeeAmount.BAD), msg(msg4));
                
        // now let's create a few for real
        const ichiVisorManualMed = (await ichiVisorContract.deploy(hypervisorFactory.address, factory.address,
            token0.address, true, token1.address, true, FeeAmount.MEDIUM)) as ICHIVisor
        const ichiVisorManualHigh = (await ichiVisorContract.deploy(hypervisorFactory.address, factory.address,
            token0.address, true, token1.address, true, FeeAmount.HIGH)) as ICHIVisor
    
        console.log(ichiVisorManualMed.address);
        console.log(ichiVisorManualHigh.address);

        // can't do anything until the init is called
        await truffleAssert.reverts(ichiVisorManualMed.setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000')), msg5);
        await truffleAssert.reverts(ichiVisorManualMed.deposit(smallTokenAmount, ethers.utils.parseEther('4000'), alice.address), msg5);
        await truffleAssert.reverts(ichiVisorManualMed.withdraw(smallTokenAmount, alice.address, alice.address), msg5);
        await truffleAssert.reverts(ichiVisorManualMed.rebalance(-1800, 1800, -600, 0, alice.address, 0), msg5);

        // now let's try to init the ICHIVisor. Should be failing in all cases
        // hypervisor already exists
        await truffleAssert.reverts(ichiVisorManualMed.init(wallet.address), msg6);
        // ICHIVisor wasn't registered with ICHIVisorFactory, so hypervisor factory refuses to work
        await truffleAssert.reverts(ichiVisorManualHigh.init(wallet.address), msg7);

        //await ichiVisorManualMed.init(wallet.address);

        // should be able to use it now
        //await ichiVisorManualMed.setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

    })
})


