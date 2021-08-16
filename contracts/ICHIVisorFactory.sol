// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import {IICHIVisorFactory} from '../interfaces/IICHIVisorFactory.sol';
import {IUniswapV3Factory} from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ICHIVisor} from './ICHIVisor.sol';
import "./lib/AddressSet.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract ICHIVisorFactory is IICHIVisorFactory, Ownable {
    using AddressSet for AddressSet.Set;

    address constant NULL_ADDRESS = address(0);

    IUniswapV3Factory public immutable uniswapV3Factory;

    struct Token {
        AddressSet.Set visorSet;
    }
    mapping(address => Token) tokens;
    AddressSet.Set tokenSet;

    mapping(address => mapping(address => mapping(uint24 => mapping(bool => mapping(bool => address))))) public getICHIVisor; // token0, token1, fee, allowToken1, allowToken2 -> ichiVisor address
    AddressSet.Set visorSet;

    constructor(address _uniswapV3Factory) {
        uniswapV3Factory = IUniswapV3Factory(_uniswapV3Factory);
        emit UniswapV3Factory(msg.sender, _uniswapV3Factory);
    }

    function createICHIVisor(
        address tokenA,
        bool allowTokenA,
        address tokenB,
        bool allowTokenB,
        uint24 fee
    ) external override onlyOwner returns (address ichiVisor) {
        require(tokenA != tokenB, 'ICHIVisorFactory.createICHIVisor: Identical token addresses');
        require(allowTokenA || allowTokenB, 'ICHIVisorFactory.createICHIVisor: At least one token must be allowed');

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (bool allowToken0, bool allowToken1) = tokenA < tokenB ? (allowTokenA, allowTokenB) : (allowTokenB, allowTokenA);

        require(token0 != NULL_ADDRESS, 'ICHIVisorFactory.createICHIVisor: zero address');

        require(getICHIVisor[token0][token1][fee][allowToken0][allowToken1] == NULL_ADDRESS, 'ICHIVisorFactory.createICHIVisor: ICHIVisor exists');

        int24 tickSpacing = uniswapV3Factory.feeAmountTickSpacing(fee);
        require(tickSpacing != 0, 'ICHIVisorFactory.createICHIVisor: fee incorrect');
        address pool = uniswapV3Factory.getPool(tokenA, tokenB, fee);
        if (pool == NULL_ADDRESS) {
            pool = uniswapV3Factory.createPool(token0, token1, fee);
        }
        address poolToken0 = IUniswapV3Pool(pool).token0();

        (token0, token1) = tokenA == poolToken0 ? (tokenA, tokenB) : (tokenB, tokenA);
        (allowToken0, allowToken1) = tokenA == poolToken0 ? (allowTokenA, allowTokenB) : (allowTokenB, allowTokenA);

        ichiVisor = address(
            new ICHIVisor{salt: keccak256(abi.encodePacked(token0, allowToken0, token1, allowToken1, fee, tickSpacing))}(pool, allowToken0, allowToken1, owner())
        );

        getICHIVisor[token0][token1][fee][allowToken0][allowToken1] = ichiVisor;
        getICHIVisor[token1][token0][fee][allowToken1][allowToken0] = ichiVisor; // populate mapping in the reverse direction
        visorSet.insert(ichiVisor, 'ICHIVisorFactory.createICHIVisor: ICHIVisor already exists');
        // should not be possible for these inserts to fail
        tokens[token0].visorSet.insert(ichiVisor, 'ICHIVisorFactory.createICHIVisor:: (500) token0 collision');
        tokens[token1].visorSet.insert(ichiVisor, 'ICHIVisorFactory.createICHIVisor:: (500) token1 collision');

        emit ICHIVisorCreated(msg.sender, ichiVisor, token0, allowToken0, token1, allowToken1, fee, visorSet.count());
    }

    function tokenCount() external override view returns(uint) {
        return tokenSet.count();
    }

    function tokenAtIndex(uint index) external override view returns(address) {
        return tokenSet.keyAtIndex(index);
    }

    function isToken(address _token) external override view returns(bool) {
        return tokenSet.exists(_token);
    }

    function ichiVisorsCount() external override view returns (uint256) {
        return visorSet.count();
    }

    function ichiVisorAtIndex(uint index) external override view returns(address) {
        return visorSet.keyAtIndex(index);
    }

    function isIchiVisor(address ichiVisor) external override view returns(bool) {
        return visorSet.exists(ichiVisor);
    }

    function tokenIchiVisorCount(address token) external override view returns(uint) {
        return tokens[token].visorSet.count();
    }

    function tokenIchiVisorAtIndex(address token, uint index) external override view returns(address) {
        return tokens[token].visorSet.keyAtIndex(index);
    }

}