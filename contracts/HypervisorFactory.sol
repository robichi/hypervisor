// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import {IUniswapV3Factory} from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Hypervisor} from './Hypervisor.sol';
import {AddressSet} from './lib/AddressSet.sol';

contract ICHIVisorFactory is Ownable {

    using AddressSet for AddressSet.Set;

    address constant NULL_ADDRESS = address(0);
    IUniswapV3Factory public uniswapV3Factory;
    
    struct Tradeable {
        AddressSet.Set visorSet;
    }
    AddressSet.Set tradeableSet;
    mapping(address => Tradeable) tradeable;
    
    struct Visor {
        address pool;
        address token0;
        address token1;
        uint fee;
    }
    AddressSet.Set visorSet;
    mapping(address => address) public visorPool;
    mapping(address => Visor) public visor;

    event HypervisorCreated(address hypervisor, address pool, address token0, address token1, uint24 fee, uint256 count);

    constructor(address _uniswapV3Factory) {
        uniswapV3Factory = IUniswapV3Factory(_uniswapV3Factory);
    }

    function createHypervisor(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external onlyOwner returns (address hypervisor) {
        (address token0, address token1) = _orderedPair(tokenA, tokenB);
        require(token0 != token1, 'ICHIVisorFactory.createHypervisor: Identical token addresses');
        require(token0 != NULL_ADDRESS, 'ICHIVisorFactory.createHypervisor: token undefined');

        int24 tickSpacing = uniswapV3Factory.feeAmountTickSpacing(fee);
        require(tickSpacing != 0, 'ICHIVisorFactory.createHypervisor: Incorrect Fee');

        address pool = uniswapV3Factory.getPool(token0, token1, fee);

        // create uniswap pool if needed
        if (pool == NULL_ADDRESS) {
            pool = uniswapV3Factory.createPool(token0, token1, fee);
        }

        // deploy the hypervisor
        hypervisor = address(new Hypervisor{salt: keccak256(abi.encodePacked(token0, token1, fee, tickSpacing))}(pool, address(this)));
        require(visorPool[hypervisor] == NULL_ADDRESS, 'ICHIVisorFactory.createHypervisor: Hypervisor exists');

        // update the discoverable state
        Visor memory newVisor = Visor({
            pool: pool,
            token0: token0,
            token1: token1,
            fee: fee
        });
        visorSet.insert(hypervisor, 'ICHIVisorFactory.createHypervisor: (500) hypervisor id collision');
        tradeable[token0].visorSet.insert(hypervisor, 'ICHIVisorFactory.createHypervisor: (500) token0 collision');
        tradeable[token1].visorSet.insert(hypervisor, 'ICHIVisorFactory.createHypervisor: (500) token1 collision');
        visorPool[hypervisor] = pool;
        visor[hypervisor] = newVisor;

        emit HypervisorCreated(hypervisor, pool, token0, token1, fee, visorSet.count());
    }

    function allVisorsLength() external view returns (uint256) {
        return visorSet.count();
    }

    function visorAtIndex(uint index) external view returns(address) {
        return visorSet.keyAtIndex(index);
    }

    function tokenVisorCount(address token) external view returns(uint) {
        return tradeable[token].visorSet.count();
    }

    function tokenVisorAtIndex(address token, uint index) external view returns(address) {
        return tradeable[token].visorSet.keyAtIndex(index);
    }

    function _orderedPair(address a, address b) private pure returns(address, address) {
        return a < b ? (a, b) : (b, a);
    }
}
