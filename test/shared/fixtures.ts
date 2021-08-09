import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

import {
    TestERC20,
    UniswapV3Factory,
    SwapRouter,
    NonfungiblePositionManager,
    HypervisorFactory,
    ICHIVisorFactory,
    MockUniswapV3PoolDeployer
} from "../../typechain";

import { Fixture } from 'ethereum-waffle'

interface UniswapV3Fixture {
    factory: UniswapV3Factory
    router: SwapRouter
    nft: NonfungiblePositionManager
}

async function uniswapV3Fixture(): Promise<UniswapV3Fixture> {
    const factoryFactory = await ethers.getContractFactory('UniswapV3Factory')
    const factory = (await factoryFactory.deploy()) as UniswapV3Factory

    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const WETH = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20 // TODO: change to real WETH

    const routerFactory = await ethers.getContractFactory('SwapRouter')
    const router = (await routerFactory.deploy(factory.address, WETH.address)) as SwapRouter

    const nftFactory = await ethers.getContractFactory('NonfungiblePositionManager')
    const nft = (await nftFactory.deploy(factory.address, WETH.address, ethers.constants.AddressZero)) as NonfungiblePositionManager // TODO: third parameter is wrong
    return { factory, router, nft }
}


interface TokensFixture {
    token0: TestERC20
    token1: TestERC20
    token2: TestERC20
}

async function tokensFixture(): Promise<TokensFixture> {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokenA = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20
    const tokenB = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20
    const tokenC = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20

    const [token0, token1, token2] = [tokenA, tokenB, tokenC].sort((tokenA, tokenB) =>
        tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1
    )

    return { token0, token1, token2 }
}

interface ICHIVisorFactoryFixture {
    ichiVisorFactory: ICHIVisorFactory
}

async function ichiVisorFactoryFixture(factory: UniswapV3Factory): Promise<ICHIVisorFactoryFixture> {
    const hypervisorFactoryFactory = await ethers.getContractFactory('HypervisorFactory')
    const hypervisorFactory = (await hypervisorFactoryFactory.deploy(factory.address)) as HypervisorFactory

    const ichiVisorFactoryFactory = await ethers.getContractFactory('ICHIVisorFactory')
    const ichiVisorFactory = (await ichiVisorFactoryFactory.deploy(factory.address, hypervisorFactory.address)) as ICHIVisorFactory

    console.log("initial HV Factory owner " + await hypervisorFactory.owner());
    await hypervisorFactory.init(ichiVisorFactory.address);
    console.log("HV Factory owner after init" + await hypervisorFactory.owner());
    
    return { ichiVisorFactory }
}

interface OurFactoryFixture {
    ourFactory: MockUniswapV3PoolDeployer
}

async function ourFactoryFixture(): Promise<OurFactoryFixture> {
    const ourFactoryFactory = await ethers.getContractFactory('MockUniswapV3PoolDeployer')
    const ourFactory = (await ourFactoryFactory.deploy()) as MockUniswapV3PoolDeployer
    return { ourFactory }
}

type allContractsFixture = UniswapV3Fixture & TokensFixture & OurFactoryFixture

export const fixture: Fixture<allContractsFixture> = async function (): Promise<allContractsFixture> {
    const { factory, router, nft } = await uniswapV3Fixture()
    const { token0, token1, token2 } = await tokensFixture()
    const { ourFactory } = await ourFactoryFixture()

    return {
        token0,
        token1,
        token2,
        factory,
        router,
        nft,
        ourFactory,
    }
}

type ICHIVisorTestFixture = UniswapV3Fixture & TokensFixture & ICHIVisorFactoryFixture

export const ichiVisorTestFixture: Fixture<ICHIVisorTestFixture> = async function (): Promise<ICHIVisorTestFixture> {
    const { factory, router, nft } = await uniswapV3Fixture()
    const { token0, token1, token2 } = await tokensFixture()
    const { ichiVisorFactory } = await ichiVisorFactoryFixture(factory)

    return {
        token0,
        token1,
        token2,
        factory,
        router,
        nft,
        ichiVisorFactory,
    }
}
