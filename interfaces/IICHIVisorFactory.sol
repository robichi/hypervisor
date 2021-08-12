// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

interface IICHIVisorFactory {

    event UniswapV3Factory(
        address sender, 
        address uniswapV3);

    event IchiVisorCreated(
        address sender, 
        address ichiVisor, 
        bytes32 visorId,
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

    function ichiVisor(bytes32) external view returns(
        address hypervisor,
        address token0,
        bool allowToken0,
        address token1,
        bool allowToken1,
        uint fee);        


    function visorKey(address token0, address token1, uint fee) external pure returns(bytes32, bool);

    function tokenCount() external view returns(uint);

    function tokenAtIndex(uint index) external returns(address);

    function isToken(address _token) external returns(bool);

    function ichiVisorsCount() external view returns (uint256);

    function ichiVisorAtIndex(uint index) external view returns(bytes32);

    function isIchiVisor(bytes32 checkIchiVisor) external view returns(bool);

    function tokenIchiVisorCount(address token) external view returns(uint);

    function tokenIchiVisorAtIndex(address token, uint index) external view returns(bytes32);

}
