// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

interface IICHIVaultFactory {

    function uniswapV3Factory() external view returns(address);
    function feeRecipient() external view returns(address);
    function baseFee() external view returns(uint256);
    function baseFeeSplit() external view returns(uint256);

    event DeployICHIVaultFactory(
        address sender, 
        address uniswapV3Factory);

    event ICHIVaultCreated(
        address indexed sender, 
        address ichiVault, 
        address tokenA,
        bool allowTokenA,
        address tokenB,
        bool allowTokenB,
        uint24 fee,
        uint256 count);    

    function createICHIVault(
            address tokenA,
            bool allowTokenA,
            address tokenB,
            bool allowTokenB,
            uint24 fee
        ) external returns (address ichiVault);

}
