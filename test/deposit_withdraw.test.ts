import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants } from 'ethers'
import chai from 'chai'
import { expect } from 'chai'
import { fixture, ichiVaultTestFixture } from "./shared/fixtures"
import { solidity } from "ethereum-waffle"
const truffleAssert = require('truffle-assertions');

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"

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

const createFixtureLoader = waffle.createFixtureLoader
const smallTokenAmount = ethers.utils.parseEther('1000')
const largeTokenAmount = ethers.utils.parseEther('1000000')
const veryLargeTokenAmount = ethers.utils.parseEther('10000000000')
const giantTokenAmount = ethers.utils.parseEther('1000000000000')

describe('ICHIVault General Functionality', () => {
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
        // console.log("ICHIVault Factory " + ichiVaultFactory.address);
        // console.log("ICHIVault factory owner " + await ichiVaultFactory.owner());
        // console.log("wallet used to create new ICHIVaults " + wallet.address);
        await ichiVaultFactory.connect(wallet).setFeeRecipient(other.address)
        await ichiVaultFactory.connect(wallet).createICHIVault(token0.address, true, token1.address, true, FeeAmount.MEDIUM)
        
        let ichiVaultAddress = await ichiVaultFactory.getICHIVault(wallet.address, token0.address, token1.address, FeeAmount.MEDIUM, true, true);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault
        await ichiVault.connect(wallet).setAffiliate(bob.address)
        // console.log("ICHIVault address " + ichiVault.address);

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

    function msg(text: string) {
        return "VM Exception while processing transaction: reverted with reason string '" + text + "'";
    }

    it('multiple deposits and total withdrawal', async () => {
        let msg1 = "allowance insufficient",
            msg2 = "underflow balance sender",
            msg3 = "insufficient balance",
            msg4 = "VM Exception while processing transaction: revert with reason \"LS\"";

        await truffleAssert.reverts(
            ichiVault.connect(alice).deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('4000'), alice.address), msg(msg1));

            // alice approves the ICHIVault to transfer her tokens
        await token0.connect(alice).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(alice).approve(ichiVault.address, largeTokenAmount)

        await truffleAssert.reverts(
            ichiVault.connect(alice).deposit(ethers.utils.parseEther('4000'), ethers.utils.parseEther('4000'), alice.address), msg(msg2));

            // mint tokens to alice
        await token0.mint(alice.address, largeTokenAmount)
        await token1.mint(alice.address, largeTokenAmount)

        // alice should start with 0 ICHIVault tokens
        let alice_liq_balance = await ichiVault.balanceOf(alice.address)
        expect(alice_liq_balance).to.equal(0)

        // expect that alice's deposits which exceed the deposit maximums to be reverted
        await expect(ichiVault.connect(alice).deposit(ethers.utils.parseEther('100000'), 0, alice.address)).to.be.reverted
        await expect(ichiVault.connect(alice).deposit(0, ethers.utils.parseEther('200000'), alice.address)).to.be.reverted
        await expect(ichiVault.connect(alice).deposit(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'), alice.address)).to.be.reverted

        // expect alice's deposit smaller than deposit maximums to be accepted
        await ichiVault.connect(alice).deposit(smallTokenAmount, smallTokenAmount, alice.address)

        // should fail with insufficient funds message
        await truffleAssert.reverts(
            ichiVault.connect(alice).withdraw(ethers.utils.parseEther('40000'), alice.address), msg(msg3));

        let token0vault = await token0.balanceOf(ichiVault.address)
        let token1vault = await token1.balanceOf(ichiVault.address)
        // check that all the tokens alice depostied ended up in the vault
        expect(token0vault).to.equal(smallTokenAmount)
        expect(token1vault).to.equal(smallTokenAmount)

        alice_liq_balance = await ichiVault.balanceOf(alice.address)
        //console.log(alice_liq_balance.toString())

        // check that alice has been awarded liquidity tokens in ICHIVault equal the
        // quantity of tokens deposited since their price is the same
        expect(alice_liq_balance).to.equal(ethers.utils.parseEther('2000'))

        // liquidity positions will only be created once rebalance is called
        await ichiVault.rebalance(-1800, 1800, -600, 0, 0)
 
        //alice_liq_balance = await ichiVault.balanceOf(alice.address)
        //console.log(alice_liq_balance.toString())
        await truffleAssert.reverts(
            ichiVault.connect(alice).withdraw(ethers.utils.parseEther('40000'), alice.address), msg4); 
 
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        // all of the vault assets should have been deployed in v3 lp positions
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)

        let basePosition = await ichiVault.getBasePosition()
        let limitPosition = await ichiVault.getLimitPosition()
        expect(basePosition[0]).to.be.gt(0)
        expect(limitPosition[0]).to.be.equal(0)

        await ichiVault.connect(alice).deposit(smallTokenAmount, ethers.utils.parseEther('4000'), alice.address)
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(smallTokenAmount)
        expect(token1vault).to.equal(ethers.utils.parseEther('4000'))
        alice_liq_balance = await ichiVault.balanceOf(alice.address)

        expect(alice_liq_balance).to.lt(ethers.utils.parseEther('7000').add(15))
        expect(alice_liq_balance).to.gt(ethers.utils.parseEther('7000').sub(15))

        await ichiVault.connect(alice).deposit(ethers.utils.parseEther('2000'), smallTokenAmount, alice.address)

        // do a test swap
        await token0.connect(carol).approve(router.address, veryLargeTokenAmount)
        await token1.connect(carol).approve(router.address, veryLargeTokenAmount)
        await router.connect(carol).exactInputSingle({
            tokenIn: token0.address,
            tokenOut: token1.address,
            fee: FeeAmount.MEDIUM,
            recipient: carol.address,
            deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
            amountIn: largeTokenAmount,
            amountOutMinimum: ethers.utils.parseEther('0'),
            sqrtPriceLimitX96: 0,
        })

        let limitUpper = -60
        let limitLower = -540
        let tokenAmounts = await ichiVault.getTotalAmounts()
        let token0BeforeRebalanceSwap = tokenAmounts[0]
        let token1BeforeRebalanceSwap = tokenAmounts[1]
        let fees0main = await token0.balanceOf(other.address)
        let fees1main = await token1.balanceOf(other.address)
        let fees0aff = await token0.balanceOf(bob.address)
        let fees1aff = await token1.balanceOf(bob.address)
        expect(fees0main).to.equal(0)
        expect(fees1main).to.equal(0)
        expect(fees0aff).to.equal(0)
        expect(fees1aff).to.equal(0)
        let rebalanceSwapAmount = ethers.utils.parseEther('4000')
        await ichiVault.rebalance(-1800, 1920, limitLower, limitUpper, rebalanceSwapAmount)
        tokenAmounts = await ichiVault.getTotalAmounts()
        let token0AfterRebalanceSwap = tokenAmounts[0]
        expect(token0BeforeRebalanceSwap.sub(token0AfterRebalanceSwap).sub(rebalanceSwapAmount).abs()).to.be.lt(ethers.utils.parseEther('1'))
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)
        fees0main = await token0.balanceOf(other.address)
        fees1main = await token1.balanceOf(other.address)
        fees0aff = await token0.balanceOf(bob.address)
        fees1aff = await token1.balanceOf(bob.address)
        if (fees0main > fees0aff)
            expect(fees0main.sub(fees0aff)).to.lt(10)
        if (fees0main <= fees0aff)
            expect(fees0aff.sub(fees0main)).to.lt(10)
        expect(fees0aff).to.gt(0)
        expect(fees1aff).to.equal(0)
        expect(fees1main).to.equal(0)
        
        // have the positions been updated? Are the token amounts unchanged?
        basePosition = await ichiVault.getBasePosition()
        limitPosition = await ichiVault.getLimitPosition()
        expect(basePosition[0]).to.be.gt(0)
        expect(limitPosition[0]).to.be.gt(0)

        await ichiVault.rebalance(-1800, 1920, limitLower, limitUpper, rebalanceSwapAmount.mul(-1))
        tokenAmounts = await ichiVault.getTotalAmounts()
        let token0AfterSecondRebalance = tokenAmounts[0]
        let token1AfterSecondRebalance = tokenAmounts[1]
        expect(token0AfterSecondRebalance.sub(token0BeforeRebalanceSwap).abs()).to.be.lt(ethers.utils.parseEther('15'))
        expect(token1AfterSecondRebalance.sub(token1BeforeRebalanceSwap).abs()).to.be.lt(ethers.utils.parseEther('15'))

        // test withdrawal of liquidity
        alice_liq_balance = await ichiVault.balanceOf(alice.address)
        await ichiVault.connect(alice).withdraw(alice_liq_balance, alice.address)
        tokenAmounts = await ichiVault.getTotalAmounts()
        // verify that all liquidity has been removed from the pool
        expect(tokenAmounts[0]).to.equal(0)
        expect(tokenAmounts[1]).to.equal(0)
    })

    it('calculates fees properly & rebalances to limit-only after large swap (100/0)', async () => {
        // remove affiliate, so all fees would go to the main recipient (100/0 split)
        await ichiVault.connect(wallet).setAffiliate(NULL_ADDRESS)

        await token0.mint(alice.address, largeTokenAmount)
        await token1.mint(alice.address, largeTokenAmount)

        await token0.connect(alice).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(alice).approve(ichiVault.address, largeTokenAmount)

        // alice should start with 0 ICHIVault tokens
        let alice_liq_balance = await ichiVault.balanceOf(alice.address)
        expect(alice_liq_balance).to.equal(0)

        await ichiVault.connect(alice).deposit(smallTokenAmount, smallTokenAmount, alice.address)

        let token0vault = await token0.balanceOf(ichiVault.address)
        let token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(smallTokenAmount)
        expect(token1vault).to.equal(smallTokenAmount)
        alice_liq_balance = await ichiVault.balanceOf(alice.address)

        // check that alice has been awarded liquidity tokens equal the
        // quantity of tokens deposited since their price is the same
        expect(alice_liq_balance).to.equal(ethers.utils.parseEther('2000'))

        // liquidity positions will only be created once rebalance is called
        await ichiVault.rebalance(-120, 120, -60, 0, 0)
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)

        let basePosition = await ichiVault.getBasePosition()
        let limitPosition = await ichiVault.getLimitPosition()
        expect(basePosition[0]).to.be.gt(0)
        expect(limitPosition[0]).to.be.equal(0)

        let tokenAmounts = await ichiVault.getTotalAmounts()
        expect(tokenAmounts[0] === tokenAmounts[1])

        // do a test swap
        await token0.connect(carol).approve(router.address, veryLargeTokenAmount)
        await token1.connect(carol).approve(router.address, veryLargeTokenAmount)
        await router.connect(carol).exactInputSingle({
            tokenIn: token0.address,
            tokenOut: token1.address,
            fee: FeeAmount.MEDIUM,
            recipient: carol.address,
            deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
            amountIn: ethers.utils.parseEther('100000000'),
            amountOutMinimum: ethers.utils.parseEther('0'),
            sqrtPriceLimitX96: 0,
        })

        let limitUpper = 0
        let limitLower = -180
        tokenAmounts = await ichiVault.getTotalAmounts()
        expect(tokenAmounts[0] > tokenAmounts[1])
        let currentTick = await ichiVault.currentTick()
        // this is beyond the bounds of the original base position
        expect(currentTick).to.equal(-199)

        let fees0 = await token0.balanceOf(other.address)
        let fees1 = await token1.balanceOf(other.address)
        expect(fees0).to.equal(0)
        expect(fees1).to.equal(0)
        await ichiVault.rebalance(-1800, 1800, limitLower, limitUpper, 0)
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)
        fees0 = await token0.balanceOf(other.address)
        fees1 = await token1.balanceOf(other.address)
        expect(fees0).to.gt(ethers.utils.parseEther('0.3'))
        expect(fees0).to.lt(ethers.utils.parseEther('0.305'))
        // have the positions been updated? Are the token amounts unchanged?
        basePosition = await ichiVault.getBasePosition()
        limitPosition = await ichiVault.getLimitPosition()
        // the base position should have 0 liquidity because we are left with
        // only a single asset after carol's big swap
        expect(basePosition[0]).to.equal(0)
        expect(limitPosition[0]).to.be.gt(0)

        // restore affiliate but set the split to 100/0, so it'll have the same effect
        await ichiVault.connect(wallet).setAffiliate(bob.address)
        await ichiVaultFactory.connect(wallet).setBaseFeeSplit(100)
        // also set baseFee to 20%
        await ichiVaultFactory.connect(wallet).setBaseFee(20)

        // swap everything back and check fees in the other token have
        // been earned
        await router.connect(carol).exactInputSingle({
            tokenIn: token1.address,
            tokenOut: token0.address,
            fee: FeeAmount.MEDIUM,
            recipient: carol.address,
            deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
            amountIn: ethers.utils.parseEther('200000000'),
            amountOutMinimum: ethers.utils.parseEther('0'),
            sqrtPriceLimitX96: 0,
        })
        currentTick = await ichiVault.currentTick()
        // this is beyond the bounds of the original base position
        expect(currentTick).to.equal(200)
        limitUpper = 180
        limitLower = 0
        await ichiVault.rebalance(-1800, 1800, limitLower, limitUpper, 0)
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)
        fees1 = await token1.balanceOf(other.address)
        // we are expecting fees of approximately 3 bips (10% of 30bips, which is total fees)
        expect(fees1).to.gt(ethers.utils.parseEther('1.190'))
        expect(fees1).to.lt(ethers.utils.parseEther('1.210'))

        // have the positions been updated? Are the token amounts unchanged?
        basePosition = await ichiVault.getBasePosition()
        limitPosition = await ichiVault.getLimitPosition()
        // the base position should have 0 liquidity because we are left with
        // only a single asset after carol's big swap
        expect(basePosition[0]).to.equal(0)
        expect(limitPosition[0]).to.be.gt(0)

        // restore affiliate and split
        await ichiVault.connect(wallet).setAffiliate(bob.address)
        await ichiVaultFactory.connect(wallet).setBaseFeeSplit(50)
        await ichiVaultFactory.connect(wallet).setBaseFee(10)
    })

    it('calculates fees properly & rebalances to limit-only after large swap (40/60, 0/100)', async () => {
        // restore affiliate but set the split to 0/100
        await ichiVault.connect(wallet).setAffiliate(bob.address)
        await ichiVaultFactory.connect(wallet).setBaseFeeSplit(0)

        await token0.mint(alice.address, largeTokenAmount)
        await token1.mint(alice.address, largeTokenAmount)

        await token0.connect(alice).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(alice).approve(ichiVault.address, largeTokenAmount)

        // alice should start with 0 ICHIVault tokens
        let alice_liq_balance = await ichiVault.balanceOf(alice.address)
        expect(alice_liq_balance).to.equal(0)

        await ichiVault.connect(alice).deposit(smallTokenAmount, smallTokenAmount, alice.address)

        let token0vault = await token0.balanceOf(ichiVault.address)
        let token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(smallTokenAmount)
        expect(token1vault).to.equal(smallTokenAmount)
        alice_liq_balance = await ichiVault.balanceOf(alice.address)

        // check that alice has been awarded liquidity tokens equal the
        // quantity of tokens deposited since their price is the same
        expect(alice_liq_balance).to.equal(ethers.utils.parseEther('2000'))

        // liquidity positions will only be created once rebalance is called
        await ichiVault.rebalance(-120, 120, -60, 0, 0)
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)

        let basePosition = await ichiVault.getBasePosition()
        let limitPosition = await ichiVault.getLimitPosition()
        expect(basePosition[0]).to.be.gt(0)
        expect(limitPosition[0]).to.be.equal(0)

        let tokenAmounts = await ichiVault.getTotalAmounts()
        expect(tokenAmounts[0] === tokenAmounts[1])

        // do a test swap
        await token0.connect(carol).approve(router.address, veryLargeTokenAmount)
        await token1.connect(carol).approve(router.address, veryLargeTokenAmount)
        await router.connect(carol).exactInputSingle({
            tokenIn: token0.address,
            tokenOut: token1.address,
            fee: FeeAmount.MEDIUM,
            recipient: carol.address,
            deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
            amountIn: ethers.utils.parseEther('100000000'),
            amountOutMinimum: ethers.utils.parseEther('0'),
            sqrtPriceLimitX96: 0,
        })

        let limitUpper = 0
        let limitLower = -180
        tokenAmounts = await ichiVault.getTotalAmounts()
        expect(tokenAmounts[0] > tokenAmounts[1])
        let currentTick = await ichiVault.currentTick()
        // this is beyond the bounds of the original base position
        expect(currentTick).to.equal(-199)

        let fees0main = await token0.balanceOf(other.address)
        let fees1main = await token1.balanceOf(other.address)
        let fees0aff = await token0.balanceOf(bob.address)
        let fees1aff = await token1.balanceOf(bob.address)
        expect(fees0aff).to.equal(0)
        expect(fees1aff).to.equal(0)

        await ichiVault.rebalance(-1800, 1800, limitLower, limitUpper, 0)
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)
        fees0main = await token0.balanceOf(other.address)
        fees1main = await token1.balanceOf(other.address)
        fees0aff = await token0.balanceOf(bob.address)
        fees1aff = await token1.balanceOf(bob.address)
        expect(fees0main).to.equal(0)
        expect(fees1main).to.equal(0)
        expect(fees0aff).to.gt(ethers.utils.parseEther('0.295'))
        expect(fees0aff).to.lt(ethers.utils.parseEther('0.305'))
        // have the positions been updated? Are the token amounts unchanged?
        basePosition = await ichiVault.getBasePosition()
        limitPosition = await ichiVault.getLimitPosition()
        // the base position should have 0 liquidity because we are left with
        // only a single asset after carol's big swap
        expect(basePosition[0]).to.equal(0)
        expect(limitPosition[0]).to.be.gt(0)

        // swap everything back and check fees in the other token have
        // been earned
        await router.connect(carol).exactInputSingle({
            tokenIn: token1.address,
            tokenOut: token0.address,
            fee: FeeAmount.MEDIUM,
            recipient: carol.address,
            deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
            amountIn: ethers.utils.parseEther('200000000'),
            amountOutMinimum: ethers.utils.parseEther('0'),
            sqrtPriceLimitX96: 0,
        })
        currentTick = await ichiVault.currentTick()

        // set split as 40/60
        await ichiVaultFactory.connect(wallet).setBaseFeeSplit(40)

        // this is beyond the bounds of the original base position
        expect(currentTick).to.equal(200)
        limitUpper = 180
        limitLower = 0
        await ichiVault.rebalance(-1800, 1800, limitLower, limitUpper, 0)
        token0vault = await token0.balanceOf(ichiVault.address)
        token1vault = await token1.balanceOf(ichiVault.address)
        expect(token0vault).to.equal(0)
        expect(token1vault).to.equal(0)
        fees1main = await token1.balanceOf(other.address)
        fees1aff = await token1.balanceOf(bob.address)
        // we are expecting fees of approximately 3 bips (10% of 30bips, which is total fees)
        // and adjust for 40/60
        expect(fees1main).to.gt(ethers.utils.parseEther('0.235'))
        expect(fees1main).to.lt(ethers.utils.parseEther('0.245'))
        expect(fees1aff).to.gt(ethers.utils.parseEther('0.355'))
        expect(fees1aff).to.lt(ethers.utils.parseEther('0.365'))

        // have the positions been updated? Are the token amounts unchanged?
        basePosition = await ichiVault.getBasePosition()
        limitPosition = await ichiVault.getLimitPosition()
        // the base position should have 0 liquidity because we are left with
        // only a single asset after carol's big swap
        expect(basePosition[0]).to.equal(0)
        expect(limitPosition[0]).to.be.gt(0)

        // restore affiliate and 50/50 split
        await ichiVault.connect(wallet).setAffiliate(bob.address)
        await ichiVaultFactory.connect(wallet).setBaseFeeSplit(50)
    })

    it('deposit/withdrawal with many users', async () => {
        let tokenAmount = ethers.utils.parseEther('10000')

        // token mint for liquidity add
        await token0.mint(user0.address, tokenAmount)
        await token1.mint(user0.address, tokenAmount)

        await token0.mint(user1.address, tokenAmount)
        await token1.mint(user1.address, tokenAmount)

        await token0.mint(user2.address, tokenAmount)
        await token1.mint(user2.address, tokenAmount)

        await token0.mint(user3.address, tokenAmount)
        await token1.mint(user3.address, tokenAmount)

        await token0.mint(user4.address, tokenAmount)
        await token1.mint(user4.address, tokenAmount)

        await token0.mint(other.address, ethers.utils.parseEther('100000'))
        await token1.mint(other.address, ethers.utils.parseEther('100000'))

        // deposit to vault contract

        await token0.connect(user0).approve(ichiVault.address, tokenAmount)
        await token1.connect(user0).approve(ichiVault.address, tokenAmount)

        await token0.connect(user1).approve(ichiVault.address, tokenAmount)
        await token1.connect(user1).approve(ichiVault.address, tokenAmount)

        await token0.connect(user2).approve(ichiVault.address, tokenAmount)
        await token1.connect(user2).approve(ichiVault.address, tokenAmount)

        await token0.connect(user3).approve(ichiVault.address, tokenAmount)
        await token1.connect(user3).approve(ichiVault.address, tokenAmount)

        await token0.connect(user4).approve(ichiVault.address, tokenAmount)
        await token1.connect(user4).approve(ichiVault.address, tokenAmount)

        await ichiVault.connect(user0).deposit(tokenAmount, tokenAmount, user0.address)
        await ichiVault.connect(user1).deposit(tokenAmount, tokenAmount, user1.address)
        await ichiVault.connect(user2).deposit(tokenAmount, tokenAmount, user2.address)
        await ichiVault.connect(user3).deposit(tokenAmount, tokenAmount, user3.address)
        await ichiVault.connect(user4).deposit(tokenAmount, tokenAmount, user4.address)

        let user0token0Amount = await token0.balanceOf(user0.address)
        let user0token1Amount = await token1.balanceOf(user0.address)

        let user1token0Amount = await token0.balanceOf(user1.address)
        let user1token1Amount = await token1.balanceOf(user1.address)

        let user2token0Amount = await token0.balanceOf(user2.address)
        let user2token1Amount = await token1.balanceOf(user2.address)

        let user3token0Amount = await token0.balanceOf(user3.address)
        let user3token1Amount = await token1.balanceOf(user3.address)

        let user4token0Amount = await token0.balanceOf(user4.address)
        let user4token1Amount = await token1.balanceOf(user4.address)

        expect(user0token0Amount.toString()).to.be.equal("0")
        expect(user1token0Amount.toString()).to.be.equal("0")
        expect(user2token0Amount.toString()).to.be.equal("0")
        expect(user3token0Amount.toString()).to.be.equal("0")
        expect(user4token0Amount.toString()).to.be.equal("0")
        expect(user0token1Amount.toString()).to.be.equal("0")
        expect(user1token1Amount.toString()).to.be.equal("0")
        expect(user2token1Amount.toString()).to.be.equal("0")
        expect(user3token1Amount.toString()).to.be.equal("0")
        expect(user4token1Amount.toString()).to.be.equal("0")

        // rebalance
        await ichiVault.rebalance(-120, 120, 0, 60, 0)

        // withdraw
        const user0_liq_balance = await ichiVault.balanceOf(user0.address)
        const user1_liq_balance = await ichiVault.balanceOf(user1.address)
        const user2_liq_balance = await ichiVault.balanceOf(user2.address)
        const user3_liq_balance = await ichiVault.balanceOf(user3.address)
        const user4_liq_balance = await ichiVault.balanceOf(user4.address)

        await ichiVault.connect(user0).withdraw(user0_liq_balance, user0.address)
        await ichiVault.connect(user1).withdraw(user1_liq_balance, user1.address)
        await ichiVault.connect(user2).withdraw(user2_liq_balance, user2.address)
        await ichiVault.connect(user3).withdraw(user3_liq_balance, user3.address)
        await ichiVault.connect(user4).withdraw(user4_liq_balance, user4.address)

        user0token0Amount = await token0.balanceOf(user0.address)
        user0token1Amount = await token1.balanceOf(user0.address)

        user1token0Amount = await token0.balanceOf(user1.address)
        user1token1Amount = await token1.balanceOf(user1.address)

        user2token0Amount = await token0.balanceOf(user2.address)
        user2token1Amount = await token1.balanceOf(user2.address)

        user3token0Amount = await token0.balanceOf(user3.address)
        user3token1Amount = await token1.balanceOf(user3.address)

        user4token0Amount = await token0.balanceOf(user4.address)
        user4token1Amount = await token1.balanceOf(user4.address)

        expect(user0token0Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
        expect(user1token0Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
        expect(user2token0Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
        expect(user3token0Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
        expect(user0token1Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
        expect(user1token1Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
        expect(user2token1Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
        expect(user3token1Amount.sub(tokenAmount).abs().toNumber()).to.be.lte(1)
    })

    it('can withdraw deposited funds without rebalance', async () => {
        await token0.mint(alice.address, largeTokenAmount)
        await token1.mint(alice.address, largeTokenAmount)

        await token0.connect(alice).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(alice).approve(ichiVault.address, largeTokenAmount)

        // alice should start with 0 vault tokens
        let alice_liq_balance = await ichiVault.balanceOf(alice.address)
        expect(alice_liq_balance).to.equal(0)

        await ichiVault.connect(alice).deposit(smallTokenAmount, smallTokenAmount, alice.address)
        alice_liq_balance = await ichiVault.balanceOf(alice.address)
        expect(alice_liq_balance).to.equal(ethers.utils.parseEther('2000'))
        await ichiVault.connect(alice).withdraw(alice_liq_balance, alice.address)
        let tokenAmounts = await ichiVault.getTotalAmounts()
        // verify that all liquidity has been removed from the pool
        expect(tokenAmounts[0]).to.equal(0)
        expect(tokenAmounts[1]).to.equal(0)

        await ichiVault.connect(alice).deposit(smallTokenAmount, smallTokenAmount, alice.address)

        await ichiVault.rebalance(-120, 120, 0, 60, 0)

        let tokenAmount = smallTokenAmount

        await token0.mint(user0.address, tokenAmount)
        await token1.mint(user0.address, tokenAmount)
        await token0.connect(user0).approve(ichiVault.address, tokenAmount)
        await token1.connect(user0).approve(ichiVault.address, tokenAmount)
        await ichiVault.connect(user0).deposit(tokenAmount, tokenAmount, user0.address)
        let token0Balance = await token0.balanceOf(user0.address)
        let token1Balance = await token1.balanceOf(user0.address)
        expect(token0Balance).to.equal(0)
        expect(token1Balance).to.equal(0)

        const user0_liq_balance = await ichiVault.balanceOf(user0.address)
        tokenAmounts = await ichiVault.getTotalAmounts()
        // verify that all liquidity has been removed from the pool
        expect(tokenAmounts[0]).to.be.gte(ethers.utils.parseEther('2000').sub(15))
        expect(tokenAmounts[1]).to.be.gte(ethers.utils.parseEther('2000').sub(15))
        expect(tokenAmounts[0]).to.be.lt(ethers.utils.parseEther('2000').add(15))
        expect(tokenAmounts[1]).to.be.lt(ethers.utils.parseEther('2000').add(15))

        await ichiVault.connect(user0).withdraw(user0_liq_balance, user0.address)
        token0Balance = await token0.balanceOf(user0.address)
        token1Balance = await token1.balanceOf(user0.address)
        expect(token0Balance).to.equal(smallTokenAmount)
        expect(token1Balance).to.equal(smallTokenAmount)
    })
})

describe('ETHUSDT ICHIVault Test', () => {
    const [wallet, other, user0, user1, user2, user3, user4, user5] = waffle.provider.getWallets()

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

        let ichiVaultAddress = await ichiVaultFactory.getICHIVault(wallet.address, token0.address, token1.address, FeeAmount.MEDIUM, true, true);
        ichiVault = (await ethers.getContractAt('ICHIVault', ichiVaultAddress)) as ICHIVault
 
        await ichiVault.connect(wallet).setDepositMax(ethers.utils.parseEther('100000'), ethers.utils.parseEther('100000'))

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
        uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', poolAddress)) as IUniswapV3Pool
        // initializing the pool to mimick the tick that an ETH (18 decimals)
        // - USDT (6 decimals) pool would have if ETH were priced at $2500
        await uniswapPool.initialize(encodePriceSqrt(2500000000, ethers.utils.parseEther('1')))
 
        // adding extra liquidity into pool to make sure there's always
        // someone to swap with
        await token0.mint(user0.address, giantTokenAmount)
        await token1.mint(user0.address, giantTokenAmount)

        await token0.connect(user0).approve(nft.address, veryLargeTokenAmount)
        await token1.connect(user0).approve(nft.address, veryLargeTokenAmount)

        await nft.connect(user0).mint({
            token0: token0.address,
            token1: token1.address,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            fee: FeeAmount.MEDIUM,
            recipient: user0.address,
            amount0Desired: veryLargeTokenAmount,
            amount1Desired: veryLargeTokenAmount,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 2000000000,
        })
        
    })

    it('handles deposit / withdrawal from pools of different balances', async () => {
        let slot0 = await uniswapPool.slot0()
        expect(slot0.tick).to.equal(-198080)

        // create a balanced base deposit
        await token0.mint(user1.address, largeTokenAmount)
        await token1.mint(user1.address, largeTokenAmount)

        await token0.connect(user1).approve(ichiVault.address, largeTokenAmount)
        await token1.connect(user1).approve(ichiVault.address, largeTokenAmount)

        await ichiVault.connect(user1).deposit(ethers.utils.parseEther('1'), 2500000000, user1.address)

        let user1LiquidityBalance = await ichiVault.balanceOf(user1.address)
        let expectedValue = 5000000000
        expect(user1LiquidityBalance).to.be.gt(Math.round(expectedValue*0.999))
        expect(user1LiquidityBalance).to.be.lt(Math.round(expectedValue*1.001))

        // deposit & withdraw liquidity with ETH & USDT balanced
        await token0.mint(user2.address, ethers.utils.parseEther('0.5'))
        await token1.mint(user2.address, 1250000000)
        await token0.connect(user2).approve(ichiVault.address, ethers.utils.parseEther('0.5'))
        await token1.connect(user2).approve(ichiVault.address, 1250000000)

        await ichiVault.connect(user2).deposit(ethers.utils.parseEther('0.5'), 1250000000, user2.address)
        let user2LiquidityBalance = await ichiVault.balanceOf(user2.address)
        expectedValue = 2500000000
        expect(user2LiquidityBalance).to.be.gt(Math.round(expectedValue*0.999))
        expect(user2LiquidityBalance).to.be.lt(Math.round(expectedValue*1.001))

        await ichiVault.connect(user2).withdraw(user2LiquidityBalance, user2.address)

        let user2ethBalance = await token0.balanceOf(user2.address)
        let user2usdtBalance = await token1.balanceOf(user2.address)
        expect(user2ethBalance).to.be.lt(ethers.utils.parseEther('0.501'))
        expect(user2ethBalance).to.be.gt(ethers.utils.parseEther('0.499'))
        expect(user2usdtBalance).to.be.lt(1250100000)
        expect(user2usdtBalance).to.be.gt(1249900000)

        // deposit & withdraw liquidity with ETH only
        await token0.mint(user3.address, ethers.utils.parseEther('0.5'))
        await token0.connect(user3).approve(ichiVault.address, ethers.utils.parseEther('0.5'))

        await ichiVault.connect(user3).deposit(ethers.utils.parseEther('0.5'), 0, user3.address)
        let user3LiquidityBalance = await ichiVault.balanceOf(user3.address)
        expect(user3LiquidityBalance).to.be.gt(1249500000)
        expect(user3LiquidityBalance).to.be.lt(1250010000)

        await ichiVault.connect(user3).withdraw(user3LiquidityBalance, user3.address)

        let user3ethBalance = await token0.balanceOf(user3.address)
        let user3usdtBalance = await token1.balanceOf(user3.address)
        expect(user3ethBalance).to.be.lt(ethers.utils.parseEther('0.301'))
        expect(user3ethBalance).to.be.gt(ethers.utils.parseEther('0.299'))
        expect(user3usdtBalance).to.be.lt(500100000)
        expect(user3usdtBalance).to.be.gt(499900000)

        // deposit & withdraw liquidity with USDT overweight
        let singleSidedUSDTAmount = 1000000000
        await token1.mint(user4.address, singleSidedUSDTAmount)
        await token1.connect(user4).approve(ichiVault.address, singleSidedUSDTAmount)

        await ichiVault.connect(user4).deposit(0, singleSidedUSDTAmount, user4.address)
        let user4LiquidityBalance = await ichiVault.balanceOf(user4.address)
        expect(user4LiquidityBalance).to.be.gt(Math.round(singleSidedUSDTAmount*0.999))
        expect(user4LiquidityBalance).to.be.lt(Math.round(singleSidedUSDTAmount*1.001))

        await ichiVault.connect(user4).withdraw(user4LiquidityBalance, user4.address)

        let user4ethBalance = await token0.balanceOf(user4.address)
        let user4usdtBalance = await token1.balanceOf(user4.address)
        expect(user4ethBalance).to.be.lt(ethers.utils.parseEther('0.201'))
        expect(user4ethBalance).to.be.gt(ethers.utils.parseEther('0.199'))
        expect(user4usdtBalance).to.be.lt(500100000)
        expect(user4usdtBalance).to.be.gt(499900000)

        // add a deposit of just ETH
        await ichiVault.connect(user1).deposit(ethers.utils.parseEther('1'), 0, user1.address)

        user1LiquidityBalance = await ichiVault.balanceOf(user1.address)
        expect(user1LiquidityBalance).to.be.gt(7499500000)
        expect(user1LiquidityBalance).to.be.lt(7500100000)

        // deposit & withdraw liquidity with ETH & USDT balanced
        // deposit & withdraw liquidity with ETH overweight
        // deposit & withdraw liquidity with USDT overweight

        // add a deposit of just USDT, flipping the balance of the pool to be
        // overweight USDT
        await ichiVault.connect(user1).deposit(0, 6500000000, user1.address)

        user1LiquidityBalance = await ichiVault.balanceOf(user1.address)
        expect(user1LiquidityBalance).to.be.gt(13999500000)
        expect(user1LiquidityBalance).to.be.lt(14000010000)

        // deposit & withdraw liquidity with ETH & USDT balanced
        // deposit & withdraw liquidity with ETH overweight
        // deposit & withdraw liquidity with USDT overweight
    })
})
