// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

interface IICHIVisorFactory {

    event UniswapV3Factory(
        address sender, 
        address uniswapV3);

    event IchiVisorCreated(
        address sender, 
        address ichiVisor, 
        address token0, 
        address token1, 
        uint24 fee, 
        uint256 count);    

    function createIchiVisor(
        address tokenA,
        bool allowTokenA,
        address tokenB,
        bool allowTokenB,
        uint24 fee) 
        external returns (address newIchiVisor, address hypervisor);

    function uniswapV3Factory() external view returns(address);

    function hypervisorFactory() external view returns(address);

    function ichiVisor(address) external view returns(
        address token0,
        bool allowToken0,
        address token1,
        bool allowToken1,
        uint fee);        

    function ichiVisorsCount() external view returns (uint256);

    function ichiVisorAtIndex(uint index) external view returns(address);

    function isIchiVisor(address checkIchiVisor) external view returns(bool);

    function tokenIchiVisorCount(address token) external view returns(uint);

    function tokenIchiVisorAtIndex(address token, uint index) external view returns(address);

}
