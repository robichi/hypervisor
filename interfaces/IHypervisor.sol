// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;

interface IHypervisor{
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

    event DeployHypervisor(
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
