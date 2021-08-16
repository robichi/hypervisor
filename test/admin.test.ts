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
    NonfungiblePositionManager,
    TestERC20
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
    let ichiVisor: ICHIVisor

    let loadFixture: ReturnType<typeof createFixtureLoader>
    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy contracts', async () => {
        ({ token0, token1, token2, factory, router, nft, ichiVisorFactory } = await loadFixture(ichiVisorTestFixture))
        await ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, true, token1.address, true, FeeAmount.MEDIUM)
        
        const ichiVisorAddress = await ichiVisorFactory.ichiVisorAtIndex(0);
        ichiVisor = (await ethers.getContractAt('ICHIVisor', ichiVisorAddress)) as ICHIVisor

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        await uniswapPool.initialize(encodePriceSqrt('1', '1'))
        await ichiVisor.connect(wallet).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

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

        await truffleAssert.reverts(ichiVisorFactory.connect(alice).createICHIVisor(token0.address, true, token0.address, true, FeeAmount.MEDIUM), msg1);
    })

    it('ICHIVisor', async () => {
        let msg1 = "ICHIVisor.onlyOwner: only owner";

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
    let ichiVisor: ICHIVisor

    let loadFixture: ReturnType<typeof createFixtureLoader>
    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy contracts', async () => {
        ({ token0, token1, token2, factory, router, nft, ichiVisorFactory } = await loadFixture(ichiVisorTestFixture))
        await ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, true, token1.address, true, FeeAmount.MEDIUM)
        
        const ichiVisorAddress = await ichiVisorFactory.ichiVisorAtIndex(0);
        ichiVisor = (await ethers.getContractAt('ICHIVisor', ichiVisorAddress)) as ICHIVisor

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        await uniswapPool.initialize(encodePriceSqrt('1', '1'))
        await ichiVisor.connect(wallet).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

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
        let msg1 = "ICHIVisorFactory.createICHIVisor: Identical token addresses",
            msg2 = "ICHIVisorFactory.createICHIVisor: zero address",
            msg3 = "ICHIVisorFactory.createICHIVisor: At least one token must be allowed",
            msg4 = "ICHIVisorFactory.createICHIVisor: ICHIVisor exists",
            msg5 = "ICHIVisorFactory.createICHIVisor: fee incorrect";

        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, true, token0.address, true, FeeAmount.MEDIUM), msg1);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createICHIVisor(NULL_ADDRESS, true, token1.address, true, FeeAmount.MEDIUM), msg2);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, true, NULL_ADDRESS, true, FeeAmount.MEDIUM), msg2);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, false, token1.address, false, FeeAmount.MEDIUM), msg3);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, true, token1.address, true, FeeAmount.MEDIUM), msg4);
        await truffleAssert.reverts(ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, true, token1.address, true, FeeAmount.BAD), msg5);
    })

    function msg(text: string) {
        return "VM Exception while processing transaction: reverted with reason string '" + text + "'";
    }

    it('ICHIVisor - deposit', async () => {
        let msg1 = "ICHIVisor.deposit: token0 prohibited by ICHIVisor policy",
            msg2 = "ICHIVisor.deposit: token1 prohibited by ICHIVisor policy";

        await ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, true, token1.address, false, FeeAmount.HIGH)
        await ichiVisorFactory.connect(wallet).createICHIVisor(token0.address, false, token1.address, true, FeeAmount.LOW)

        let ichiVisorAddress = await ichiVisorFactory.getICHIVisor(token0.address, token1.address, FeeAmount.HIGH, true, false);
        ichiVisor = (await ethers.getContractAt('ICHIVisor', ichiVisorAddress)) as ICHIVisor

        await truffleAssert.reverts(
            ichiVisor.deposit(smallTokenAmount, ethers.utils.parseEther('4000'), alice.address), msg2);
                
        ichiVisorAddress = await ichiVisorFactory.getICHIVisor(token0.address, token1.address, FeeAmount.LOW, false, true);
        ichiVisor = (await ethers.getContractAt('ICHIVisor', ichiVisorAddress)) as ICHIVisor

        await truffleAssert.reverts(
            ichiVisor.deposit(smallTokenAmount, ethers.utils.parseEther('4000'), alice.address), msg1);
    })

})


