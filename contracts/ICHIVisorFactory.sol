// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import {IICHIVisorFactory} from '../interfaces/IICHIVisorFactory.sol';
import {IUniswapV3Factory} from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ICHIVisor} from './ICHIVisor.sol';
import {AddressSet} from "./lib/AddressSet.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract ICHIVisorFactory is IICHIVisorFactory, Ownable {
    using AddressSet for AddressSet.Set;

    address constant NULL_ADDRESS = address(0);

    address public override immutable uniswapV3Factory;

    struct Token {
        AddressSet.Set visorSet;
    }
    mapping(address => Token) tokens;
    AddressSet.Set tokenSet;

    /**
     @notice getICHIVisor allows direct lookup for ICHIVisors using token0/token1/fee/allowToken0/allowToken1 values
     */
    mapping(address => mapping(address => mapping(uint24 => mapping(bool => mapping(bool => address))))) public getICHIVisor; // token0, token1, fee, allowToken1, allowToken2 -> ichiVisor address
    AddressSet.Set visorSet;

    /**
     @notice creates an instance of ICHIVisorFactory
     @param _uniswapV3Factory Uniswap V3 factory
     */
    constructor(address _uniswapV3Factory) {
        uniswapV3Factory = _uniswapV3Factory;
        emit UniswapV3Factory(msg.sender, _uniswapV3Factory);
    }

    /**
     @notice creates an instance of ICHIVisor for specified tokenA/tokenB/fee setting. If needed creates underlying Uniswap V3 pool. AllowToken parameters control whether the ICHIVisor allows one-sided or two-sided liquidity provision
     @param tokenA tokenA of the Uniswap V3 pool
     @param allowTokenA flag that indicates whether tokenA is accepted during deposit
     @param tokenB tokenB of the Uniswap V3 pool
     @param allowTokenB flag that indicates whether tokenB is accepted during deposit
     @param fee fee setting of the Uniswap V3 pool
     @param ichiVisor address of the created ICHIVisor
     */
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

        int24 tickSpacing = IUniswapV3Factory(uniswapV3Factory).feeAmountTickSpacing(fee);
        require(tickSpacing != 0, 'ICHIVisorFactory.createICHIVisor: fee incorrect');
        address pool = IUniswapV3Factory(uniswapV3Factory).getPool(tokenA, tokenB, fee);
        if (pool == NULL_ADDRESS) {
            pool = IUniswapV3Factory(uniswapV3Factory).createPool(token0, token1, fee);
        }

        ichiVisor = address(
            new ICHIVisor{salt: keccak256(abi.encodePacked(token0, allowToken0, token1, allowToken1, fee, tickSpacing))}(pool, allowToken0, allowToken1, owner())
        );

        getICHIVisor[token0][token1][fee][allowToken0][allowToken1] = ichiVisor;
        getICHIVisor[token1][token0][fee][allowToken1][allowToken0] = ichiVisor; // populate mapping in the reverse direction
        // should not be possible for these inserts to fail
        visorSet.insert(ichiVisor, 'ICHIVisorFactory.createICHIVisor: (500) ICHIVisor already exists');
        tokens[token0].visorSet.insert(ichiVisor, 'ICHIVisorFactory.createICHIVisor:: (500) token0 collision');
        tokens[token1].visorSet.insert(ichiVisor, 'ICHIVisorFactory.createICHIVisor:: (500) token1 collision');

        emit ICHIVisorCreated(msg.sender, ichiVisor, token0, allowToken0, token1, allowToken1, fee, visorSet.count());
    }

    /**
     @notice returns the count of tokens ICHIVisors were created for
     */
    function tokenCount() external override view returns(uint) {
        return tokenSet.count();
    }

    /**
     @notice returns token address at the index
     @param index row to inspect
     */
    function tokenAtIndex(uint index) external override view returns(address) {
        return tokenSet.keyAtIndex(index);
    }

    /**
     @notice returns true if given address is for one of the tokens with an ICHIVisor created for
     @param token address to inspect
     */
    function isToken(address token) external override view returns(bool) {
        return tokenSet.exists(token);
    }

    /**
     @notice returns the count of ICHIVisors
     */
    function ichiVisorsCount() external override view returns (uint256) {
        return visorSet.count();
    }

    /**
     @notice returns ICHIVisor address at the index
     @param index row to inspect
     */
    function ichiVisorAtIndex(uint index) external override view returns(address) {
        return visorSet.keyAtIndex(index);
    }

    /**
     @notice returns true if given address is an ICHIVisor
     @param ichiVisor address to inspect
     */
    function isIchiVisor(address ichiVisor) external override view returns(bool) {
        return visorSet.exists(ichiVisor);
    }

    /**
     @notice returns the count of ICHIVisors for a given token
     @param token token address to inspect
     */
    function tokenIchiVisorCount(address token) external override view returns(uint) {
        return tokens[token].visorSet.count();
    }

    /**
     @notice returns ICHIVisor address at the index for a given token
     @param token token address to inspect
     @param index row to inspect
     */
    function tokenIchiVisorAtIndex(address token, uint index) external override view returns(address) {
        return tokens[token].visorSet.keyAtIndex(index);
    }

    /**
     @notice returns true if given address is an ICHIVisor for a given token
     @param token token address to inspect
     @param ichiVisor address to inspect
     */
    function isTokenIchiVisor(address token, address ichiVisor) external override view returns(bool) {
        return tokenSet.exists(token) ? tokens[token].visorSet.exists(ichiVisor) : false;
    }
}