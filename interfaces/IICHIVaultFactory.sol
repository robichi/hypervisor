// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

interface IICHIVaultFactory {

    function uniswapV3Factory() external view returns(address);

    event UniswapV3Factory(
        address sender, 
        address uniswapV3);

    event ICHIVaultCreated(
        address sender, 
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

    function tokenCount() external view returns(uint);

    function tokenAtIndex(uint index) external returns(address);

    function isToken(address token) external returns(bool);

    function ichiVaultsCount() external view returns (uint256);

    function ichiVaultAtIndex(uint index) external view returns(address);

    function isIchiVault(address ichiVault) external view returns(bool);

    function tokenIchiVaultCount(address token) external view returns(uint);

    function tokenIchiVaultAtIndex(address token, uint index) external view returns(address);

    function isTokenIchiVault(address token, address ichiVault) external view returns(bool);
}
