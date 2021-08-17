// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import {IICHIVaultFactory} from '../interfaces/IICHIVaultFactory.sol';
import {IUniswapV3Factory} from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ICHIVault} from './ICHIVault.sol';
import {AddressSet} from "./lib/AddressSet.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract ICHIVaultFactory is IICHIVaultFactory, Ownable {
    using AddressSet for AddressSet.Set;

    address constant NULL_ADDRESS = address(0);

    address public override immutable uniswapV3Factory;

    struct Token {
        AddressSet.Set vaultSet;
    }
    mapping(address => Token) tokens;
    AddressSet.Set tokenSet;

    /**
     @notice getICHIVault allows direct lookup for ICHIVaults using token0/token1/fee/allowToken0/allowToken1 values
     */
    mapping(address => mapping(address => mapping(uint24 => mapping(bool => mapping(bool => address))))) public getICHIVault; // token0, token1, fee, allowToken1, allowToken2 -> ichiVault address
    AddressSet.Set vaultSet;

    /**
     @notice creates an instance of ICHIVaultFactory
     @param _uniswapV3Factory Uniswap V3 factory
     */
    constructor(address _uniswapV3Factory) {
        uniswapV3Factory = _uniswapV3Factory;
        emit UniswapV3Factory(msg.sender, _uniswapV3Factory);
    }

    /**
     @notice creates an instance of ICHIVault for specified tokenA/tokenB/fee setting. If needed creates underlying Uniswap V3 pool. AllowToken parameters control whether the ICHIVault allows one-sided or two-sided liquidity provision
     @param tokenA tokenA of the Uniswap V3 pool
     @param allowTokenA flag that indicates whether tokenA is accepted during deposit
     @param tokenB tokenB of the Uniswap V3 pool
     @param allowTokenB flag that indicates whether tokenB is accepted during deposit
     @param fee fee setting of the Uniswap V3 pool
     @param ichiVault address of the created ICHIVault
     */
    function createICHIVault(
        address tokenA,
        bool allowTokenA,
        address tokenB,
        bool allowTokenB,
        uint24 fee
    ) external override onlyOwner returns (address ichiVault) {
        require(tokenA != tokenB, 'ICHIVaultFactory.createICHIVault: Identical token addresses');
        require(allowTokenA || allowTokenB, 'ICHIVaultFactory.createICHIVault: At least one token must be allowed');

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (bool allowToken0, bool allowToken1) = tokenA < tokenB ? (allowTokenA, allowTokenB) : (allowTokenB, allowTokenA);

        require(token0 != NULL_ADDRESS, 'ICHIVaultFactory.createICHIVault: zero address');

        require(getICHIVault[token0][token1][fee][allowToken0][allowToken1] == NULL_ADDRESS, 'ICHIVaultFactory.createICHIVault: ICHIVault exists');

        int24 tickSpacing = IUniswapV3Factory(uniswapV3Factory).feeAmountTickSpacing(fee);
        require(tickSpacing != 0, 'ICHIVaultFactory.createICHIVault: fee incorrect');
        address pool = IUniswapV3Factory(uniswapV3Factory).getPool(tokenA, tokenB, fee);
        if (pool == NULL_ADDRESS) {
            pool = IUniswapV3Factory(uniswapV3Factory).createPool(token0, token1, fee);
        }

        ichiVault = address(
            new ICHIVault{salt: keccak256(abi.encodePacked(token0, allowToken0, token1, allowToken1, fee, tickSpacing))}(pool, allowToken0, allowToken1, owner())
        );

        getICHIVault[token0][token1][fee][allowToken0][allowToken1] = ichiVault;
        getICHIVault[token1][token0][fee][allowToken1][allowToken0] = ichiVault; // populate mapping in the reverse direction
        // should not be possible for these inserts to fail
        vaultSet.insert(ichiVault, 'ICHIVaultFactory.createICHIVault: (500) ICHIVault already exists');
        tokens[token0].vaultSet.insert(ichiVault, 'ICHIVaultFactory.createICHIVault:: (500) token0 collision');
        tokens[token1].vaultSet.insert(ichiVault, 'ICHIVaultFactory.createICHIVault:: (500) token1 collision');

        emit ICHIVaultCreated(msg.sender, ichiVault, token0, allowToken0, token1, allowToken1, fee, vaultSet.count());
    }

    /**
     @notice returns the count of tokens ICHIVaults were created for
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
     @notice returns true if given address is for one of the tokens with an ICHIVault created for
     @param token address to inspect
     */
    function isToken(address token) external override view returns(bool) {
        return tokenSet.exists(token);
    }

    /**
     @notice returns the count of ICHIVaults
     */
    function ichiVaultsCount() external override view returns (uint256) {
        return vaultSet.count();
    }

    /**
     @notice returns ICHIVault address at the index
     @param index row to inspect
     */
    function ichiVaultAtIndex(uint index) external override view returns(address) {
        return vaultSet.keyAtIndex(index);
    }

    /**
     @notice returns true if given address is an ICHIVault
     @param ichiVault address to inspect
     */
    function isIchiVault(address ichiVault) external override view returns(bool) {
        return vaultSet.exists(ichiVault);
    }

    /**
     @notice returns the count of ICHIVaults for a given token
     @param token token address to inspect
     */
    function tokenIchiVaultCount(address token) external override view returns(uint) {
        return tokens[token].vaultSet.count();
    }

    /**
     @notice returns ICHIVault address at the index for a given token
     @param token token address to inspect
     @param index row to inspect
     */
    function tokenIchiVaultAtIndex(address token, uint index) external override view returns(address) {
        return tokens[token].vaultSet.keyAtIndex(index);
    }

    /**
     @notice returns true if given address is an ICHIVault for a given token
     @param token token address to inspect
     @param ichiVault address to inspect
     */
    function isTokenIchiVault(address token, address ichiVault) external override view returns(bool) {
        return tokenSet.exists(token) ? tokens[token].vaultSet.exists(ichiVault) : false;
    }
}