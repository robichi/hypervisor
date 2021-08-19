// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import {IICHIVaultFactory} from '../interfaces/IICHIVaultFactory.sol';
import {IUniswapV3Factory} from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ICHIVault} from './ICHIVault.sol';
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract ICHIVaultFactory is IICHIVaultFactory, Ownable {
    address constant NULL_ADDRESS = address(0);

    uint256 constant DEFAULT_BASE_FEE = 10;
    uint256 constant DEFAULT_BASE_FEE_SPLIT = 50;
    uint256 constant PERCENT = 100;
    address public override immutable uniswapV3Factory;
    address public override feeRecipient;
    uint256 public override baseFee;
    uint256 public override baseFeeSplit;

    /**
     @notice getICHIVault allows direct lookup for ICHIVaults using token0/token1/fee/allowToken0/allowToken1 values
     */
    mapping(address => mapping(address => mapping(address => mapping(uint24 => mapping(bool => mapping(bool => address)))))) public getICHIVault; // deployer, token0, token1, fee, allowToken1, allowToken2 -> ichiVault address
    address[] public vaultSet;

    /**
     @notice creates an instance of ICHIVaultFactory
     @param _uniswapV3Factory Uniswap V3 factory
     */
    constructor(address _uniswapV3Factory) {
        require(_uniswapV3Factory != NULL_ADDRESS, 'IVF.constructor: zero address');
        uniswapV3Factory = _uniswapV3Factory;
        feeRecipient = msg.sender;
        baseFee = DEFAULT_BASE_FEE; 
        baseFeeSplit = DEFAULT_BASE_FEE_SPLIT; 
        emit DeployICHIVaultFactory(msg.sender, _uniswapV3Factory);
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
    ) external override returns (address ichiVault) {
        require(tokenA != tokenB, 'IVF.createICHIVault: Identical token addresses');
        require(allowTokenA || allowTokenB, 'IVF.createICHIVault: At least one token must be allowed');

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (bool allowToken0, bool allowToken1) = tokenA < tokenB ? (allowTokenA, allowTokenB) : (allowTokenB, allowTokenA);

        require(token0 != NULL_ADDRESS, 'IVF.createICHIVault: zero address');

        require(getICHIVault[msg.sender][token0][token1][fee][allowToken0][allowToken1] == NULL_ADDRESS, 'IVF.createICHIVault: ICHIVault exists');

        int24 tickSpacing = IUniswapV3Factory(uniswapV3Factory).feeAmountTickSpacing(fee);
        require(tickSpacing != 0, 'IVF.createICHIVault: fee incorrect');
        address pool = IUniswapV3Factory(uniswapV3Factory).getPool(tokenA, tokenB, fee);
        if (pool == NULL_ADDRESS) {
            pool = IUniswapV3Factory(uniswapV3Factory).createPool(token0, token1, fee);
        }

        ichiVault = address(
            new ICHIVault{salt: keccak256(abi.encodePacked(msg.sender, token0, allowToken0, token1, allowToken1, fee, tickSpacing))}(pool, allowToken0, allowToken1, msg.sender)
        );

        getICHIVault[msg.sender][token0][token1][fee][allowToken0][allowToken1] = ichiVault;
        getICHIVault[msg.sender][token1][token0][fee][allowToken1][allowToken0] = ichiVault; // populate mapping in the reverse direction
        vaultSet.push(ichiVault);

        emit ICHIVaultCreated(msg.sender, ichiVault, token0, allowToken0, token1, allowToken1, fee, vaultSet.length);
    }

    /**
     @notice Sets the fee recipient account address, where portion of the collected swap fees will be distributed
     @dev onlyOwner
     @param _feeRecipient The fee recipient account address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != NULL_ADDRESS, 'IVF.setFeeRecipient: zero address');
        feeRecipient = _feeRecipient;
    }

    /**
     @notice Sets the fee percentage to be taked from the accumulated pool's swap fees. This percentage is then distributed between the feeRecipient and affiliate accounts
     @dev onlyOwner
     @param _baseFee The fee percentage to be taked from the accumulated pool's swap fee
     */
    function setBaseFee(uint256 _baseFee) external onlyOwner {
        require(_baseFee <= PERCENT, 'IVF.setBaseFee: baseFee must be <= 100%');
        baseFee = _baseFee;
    }

    /**
     @notice Sets the fee split ratio between feeRecipient and affilicate accounts. The ratio is set as (baseFeeSplit)/(100 - baseFeeSplit), that is if we want 20/80 ratio (with feeRecipient getting 20%), baseFeeSplit should be set to 20
     @dev onlyOwner
     @param _baseFeeSplit The fee split ratio between feeRecipient and affilicate accounts
     */
    function setBaseFeeSplit(uint256 _baseFeeSplit) external onlyOwner {
        require(_baseFeeSplit <= PERCENT, 'IVF.setBaseFeeSplit: baseFeeSplit must be <= 100');
        baseFeeSplit = _baseFeeSplit;
    }

}