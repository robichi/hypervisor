// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import {IHypervisorFactory} from '../interfaces/IHypervisorFactory.sol';
import {IICHIVisorFactory} from '../interfaces/IICHIVisorFactory.sol';
import {IUniswapV3Factory} from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Hypervisor} from './Hypervisor.sol';

contract HypervisorFactory is IHypervisorFactory, Ownable {
    IUniswapV3Factory public immutable uniswapV3Factory;

    bool public initialized;
    mapping(address => mapping(address => mapping(uint24 => mapping(bool => mapping(bool => address))))) public getHypervisor; // token0, token1, fee -> hypervisor address
    address[] public allHypervisors;

    event HypervisorCreated(address token0, address token1, uint24 fee, address hypervisor, uint256);
    event HypervisorFactoryInitialized(address ichiVisorFactor);

    modifier onlyTrusted (address token0, address token1, uint fee) {
        (/* bytes32 key */, bool exists) = IICHIVisorFactory(owner()).visorKey(token0, token1, fee);
        require(exists, "HypervisorFactory.onlyTrusted: caller wasn't created by the ichiVisorFactory");
        _;
    }

    constructor(address _uniswapV3Factory) {
        uniswapV3Factory = IUniswapV3Factory(_uniswapV3Factory);
    }

    function init(address ichiVisorFactory) external override onlyOwner {
        transferOwnership(ichiVisorFactory);
        initialized = true;
        emit HypervisorFactoryInitialized(ichiVisorFactory);
    }

    function allHypervisorsLength() external override view returns (uint256) {
        return allHypervisors.length;
    }

    function createHypervisor(
        address tokenA,
        bool allowTokenA,
        address tokenB,
        bool allowTokenB,
        uint24 fee
    ) external override onlyTrusted(tokenA, tokenB, fee) returns (address hypervisor) {
        require(initialized, 'HypervisorFactory.createHypervisor: not initialized');
        require(tokenA != tokenB, 'HypervisorFactory.createHypervisor: Identical token addresses');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (bool allowToken0, bool allowToken1) = tokenA < tokenB ? (allowTokenA, allowTokenB) : (allowTokenB, allowTokenA);
        require(token0 != address(0), 'HypervisorFactory.createHypervisor: zero address');
        require(getHypervisor[token0][token1][fee][allowToken0][allowToken1] == address(0), 'HypervisorFactory.createHypervisor: hypervisor exists');
        int24 tickSpacing = uniswapV3Factory.feeAmountTickSpacing(fee);
        require(tickSpacing != 0, 'HypervisorFactory.createHypervisor: fee incorrect');
        address pool = uniswapV3Factory.getPool(token0, token1, fee);
        if (pool == address(0)) {
            pool = uniswapV3Factory.createPool(token0, token1, fee);
        }
        hypervisor = address(
            new Hypervisor{salt: keccak256(abi.encodePacked(token0, allowToken0, token1, allowToken1, fee, tickSpacing))}(pool, address(this))
        );

        getHypervisor[token0][token1][fee][allowToken0][allowToken1] = hypervisor;
        getHypervisor[token1][token0][fee][allowToken1][allowToken0] = hypervisor; // populate mapping in the reverse direction
        allHypervisors.push(hypervisor);
        emit HypervisorCreated(token0, token1, fee, hypervisor, allHypervisors.length);
    }

    function subordinateHypervisor(address hypervisor, address ichiVisor) external override onlyOwner {
        Hypervisor(hypervisor).transferOwnership(ichiVisor);
    }
}