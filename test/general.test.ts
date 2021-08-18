import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants } from 'ethers'
import chai from 'chai'
import { expect } from 'chai'
import { fixture, ichiVaultTestFixture } from "./shared/fixtures"
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
    ICHIVaultFactory,
    ICHIVault,
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
    let ichiVaultFactory: ICHIVaultFactory
    let ichiVault: ICHIVault

    let loadFixture: ReturnType<typeof createFixtureLoader>
    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy contracts', async () => {
        ({ token0, token1, token2, factory, router, nft, ichiVaultFactory } = await loadFixture(ichiVaultTestFixture))
        await ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, token1.address, true, FeeAmount.MEDIUM)
        
        const ichiVaultAddress = await ichiVaultFactory.vaultSet(0);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        await uniswapPool.initialize(encodePriceSqrt('1', '1'))
        await ichiVault.connect(wallet).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

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

    it('ICHIVault', async () => {
        let msg1 = "Ownable: caller is not the owner";

        await truffleAssert.reverts(ichiVault.connect(alice).rebalance(-1800, 1800, -600, 0, 0), msg1);
        await truffleAssert.reverts(ichiVault.connect(alice).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000')), msg1);
        await truffleAssert.reverts(ichiVault.connect(alice).setMaxTotalSupply(ethers.utils.parseEther('100000')), msg1);

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
    let ichiVaultFactory: ICHIVaultFactory
    let ichiVault: ICHIVault

    let loadFixture: ReturnType<typeof createFixtureLoader>
    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy contracts', async () => {
        ({ token0, token1, token2, factory, router, nft, ichiVaultFactory } = await loadFixture(ichiVaultTestFixture))
        await ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, token1.address, true, FeeAmount.MEDIUM)
        
        const ichiVaultAddress = await ichiVaultFactory.vaultSet(0);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        await uniswapPool.initialize(encodePriceSqrt('1', '1'))
        await ichiVault.connect(wallet).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

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

    it('ICHIVaultFactory - createIchiVault', async () => {
        let msg1 = "IVF.createICHIVault: Identical token addresses",
            msg2 = "IVF.createICHIVault: zero address",
            msg3 = "IVF.createICHIVault: At least one token must be allowed",
            msg4 = "IVF.createICHIVault: ICHIVault exists",
            msg5 = "IVF.createICHIVault: fee incorrect";

        await truffleAssert.reverts(ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, token0.address, true, FeeAmount.MEDIUM), msg1);
        await truffleAssert.reverts(ichiVaultFactory.connect(wallet).createICHIVault(NULL_ADDRESS, true, token1.address, true, FeeAmount.MEDIUM), msg2);
        await truffleAssert.reverts(ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, NULL_ADDRESS, true, FeeAmount.MEDIUM), msg2);
        await truffleAssert.reverts(ichiVaultFactory.connect(wallet).createICHIVault(token0.address, false, token1.address, false, FeeAmount.MEDIUM), msg3);
        await truffleAssert.reverts(ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, token1.address, true, FeeAmount.MEDIUM), msg4);
        await truffleAssert.reverts(ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, token1.address, true, FeeAmount.BAD), msg5);
    })

    function msg(text: string) {
        return "VM Exception while processing transaction: reverted with reason string '" + text + "'";
    }

    it('ICHIVault - deposit', async () => {
        let msg1 = "IV.deposit: token0 prohibited by ICHIVault policy",
            msg2 = "IV.deposit: token1 prohibited by ICHIVault policy",
            msg3 = "IV.deposit: deposits must be nonzero",
            msg4 = "IV.deposit: deposits must be less than maximum amounts",
            msg5 = "IV.deposit: to",
            msg6 = "IV.deposit: maxTotalSupply";


        await ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, token1.address, false, FeeAmount.HIGH)
        await ichiVaultFactory.connect(wallet).createICHIVault(token0.address, false, token1.address, true, FeeAmount.LOW)

        // check allowToken policy
        let ichiVaultAddress = await ichiVaultFactory.getICHIVault(wallet.address, token0.address, token1.address, FeeAmount.HIGH, true, false);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault

        await truffleAssert.reverts(
            ichiVault.deposit(smallTokenAmount, ethers.utils.parseEther('4000'), alice.address), msg2);
                
        ichiVaultAddress = await ichiVaultFactory.getICHIVault(wallet.address, token0.address, token1.address, FeeAmount.LOW, false, true);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault

        await truffleAssert.reverts(
            ichiVault.deposit(smallTokenAmount, ethers.utils.parseEther('4000'), alice.address), msg1);
    
        // check deposit values
        ichiVaultAddress = await ichiVaultFactory.getICHIVault(wallet.address, token0.address, token1.address, FeeAmount.HIGH, true, false);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault
        await truffleAssert.reverts(
            ichiVault.deposit(0, 0, alice.address), msg3);

        ichiVaultAddress = await ichiVaultFactory.getICHIVault(wallet.address, token0.address, token1.address, FeeAmount.LOW, false, true);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault
        await truffleAssert.reverts(
            ichiVault.deposit(0, 0, alice.address), msg3);

        // check against max deposit amounts
        ichiVaultAddress = await ichiVaultFactory.getICHIVault(wallet.address, token0.address, token1.address, FeeAmount.MEDIUM, true, true);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault
        await truffleAssert.reverts(
            ichiVault.deposit(ethers.utils.parseEther('200000'), ethers.utils.parseEther('4000'), alice.address), msg4);
        await truffleAssert.reverts(
            ichiVault.deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('200000'), alice.address), msg4);
    
        //check against max total supply
        await ichiVault.connect(wallet).setMaxTotalSupply(ethers.utils.parseEther('100'))
        // alice approves the ICHIVault to transfer her tokens
        await token0.connect(alice).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(alice).approve(ichiVault.address, largeTokenAmount)
        // mint tokens to alice
        await token0.mint(alice.address, largeTokenAmount)
        await token1.mint(alice.address, largeTokenAmount)

        await truffleAssert.reverts(
            ichiVault.connect(alice).deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('4000'), alice.address), msg6);
        await ichiVault.connect(wallet).setMaxTotalSupply(0)

        //check 'to' address
        await truffleAssert.reverts(
            ichiVault.connect(alice).deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('4000'), NULL_ADDRESS), msg5);
        await truffleAssert.reverts(
            ichiVault.connect(alice).deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('4000'), ichiVaultAddress), msg5);
    
    })

    it('ICHIVault - withdraw', async () => {
        let msg1 = "IV.withdraw: to",
            msg2 = "IV.withdraw: shares";

        // alice approves the ICHIVault to transfer her tokens
        await token0.connect(alice).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(alice).approve(ichiVault.address, largeTokenAmount)
        // mint tokens to alice
        await token0.mint(alice.address, largeTokenAmount)
        await token1.mint(alice.address, largeTokenAmount)

        await ichiVault.connect(alice).deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('4000'), alice.address);

        //check 'to' address
        await truffleAssert.reverts(
            ichiVault.connect(alice).withdraw(ethers.utils.parseEther('4000'), NULL_ADDRESS), msg1);
        //check shares
        await truffleAssert.reverts(
            ichiVault.connect(alice).withdraw(0, alice.address), msg2);
        
    })

    it('ICHIVault - rebalance', async () => {
        let msg1 = "IV.rebalance: base position invalid",
            msg2 = "IV.rebalance: limit position invalid";

        // alice approves the ICHIVault to transfer her tokens
        await token0.connect(alice).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(alice).approve(ichiVault.address, largeTokenAmount)
        // mint tokens to alice
        await token0.mint(alice.address, largeTokenAmount)
        await token1.mint(alice.address, largeTokenAmount)

        let tickSpacing = await ichiVault.tickSpacing();
        // console.log(tickSpacing.toString());

        await ichiVault.connect(alice).deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('4000'), alice.address);

        let rebalanceSwapAmount = ethers.utils.parseEther('4000')
        await truffleAssert.reverts(
            ichiVault.connect(wallet).rebalance(1800, 1000, 60, 540, rebalanceSwapAmount), msg1);
        await truffleAssert.reverts(
            ichiVault.connect(wallet).rebalance(-1800, 1000, 60, 540, rebalanceSwapAmount), msg1);
        await truffleAssert.reverts(
            ichiVault.connect(wallet).rebalance(-1000, 1800, 60, 540, rebalanceSwapAmount), msg1);
        
        await truffleAssert.reverts(
            ichiVault.connect(wallet).rebalance(-1800, 1200, -60, -540, rebalanceSwapAmount), msg2);
        await truffleAssert.reverts(
            ichiVault.connect(wallet).rebalance(-1800, 1200, -600, -500, rebalanceSwapAmount), msg2);
        await truffleAssert.reverts(
            ichiVault.connect(wallet).rebalance(-1800, 1200, -620, -540, rebalanceSwapAmount), msg2);
    })

})


