// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

interface IICHIVisorFactory {

    function uniswapV3Factory() external view returns(address);

    event UniswapV3Factory(
        address sender, 
        address uniswapV3);

    event ICHIVisorCreated(
        address sender, 
        address ichiVisor, 
        address tokenA,
        bool allowTokenA,
        address tokenB,
        bool allowTokenB,
        uint24 fee,
        uint256 count);    

    function createICHIVisor(
            address tokenA,
            bool allowTokenA,
            address tokenB,
            bool allowTokenB,
            uint24 fee
        ) external returns (address ichiVisor);

    function tokenCount() external view returns(uint);

    function tokenAtIndex(uint index) external returns(address);

    function isToken(address token) external returns(bool);

    function ichiVisorsCount() external view returns (uint256);

    function ichiVisorAtIndex(uint index) external view returns(address);

    function isIchiVisor(address ichiVisor) external view returns(bool);

    function tokenIchiVisorCount(address token) external view returns(uint);

    function tokenIchiVisorAtIndex(address token, uint index) external view returns(address);

    function isTokenIchiVisor(address token, address ichiVisor) external view returns(bool);
}
