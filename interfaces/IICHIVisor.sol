// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;

interface IICHIVisor{

    function pool() external view returns(address);
    function token0() external view returns(address);
    function allowToken0() external view returns(bool);
    function token1() external view returns(address);
    function allowToken1() external view returns(bool);
    function fee() external view returns(uint24);

    function tickSpacing() external view returns(int24);
    function baseLower() external view returns(int24);
    function baseUpper() external view returns(int24);
    function limitLower() external view returns(int24);
    function limitUpper() external view returns(int24);

    function deposit0Max() external view returns(uint256);
    function deposit1Max() external view returns(uint256);
    function maxTotalSupply() external view returns(uint256);

    function deposit(
        uint256,
        uint256,
        address
    ) external returns (uint256);

    function withdraw(
        uint256,
        address,
        address
    ) external returns (uint256, uint256);

    function rebalance(
        int24 _baseLower,
        int24 _baseUpper,
        int24 _limitLower,
        int24 _limitUpper,
        address feeRecipient,
        int256 swapQuantity
    ) external;

    function setDepositMax(
        uint256 _deposit0Max, 
        uint256 _deposit1Max) external;

    function getTotalAmounts() external view returns (uint256, uint256);

    event DeployICHIVisor(
        address sender, 
        address _pool, 
        address _owner);

    event Deposit(
        address indexed sender,
        address indexed to,
        uint256 shares,
        uint256 amount0,
        uint256 amount1
    );

    event Withdraw(
        address indexed sender,
        address indexed to,
        uint256 shares,
        uint256 amount0,
        uint256 amount1
    );

    event Rebalance(
        int24 tick,
        uint256 totalAmount0,
        uint256 totalAmount1,
        uint256 totalSupply
    );
}
