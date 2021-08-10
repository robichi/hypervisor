// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

interface IICHIVisor {

    function uniswapV3Factory() external view returns(address);
    function hypervisorFactory() external view returns(address);
    function hypervisor() external view returns(address); 
    function pool() external view returns(address);
    function token0() external view returns(address);
    function allowToken0() external view returns(bool);
    function token1() external view returns(address);
    function allowToken1() external view returns(bool);
    function fee() external view returns(uint24);

    function init() external returns(address _hypervisor);
    
    function deposit(
        uint256 deposit0,
        uint256 deposit1,
        address to
    ) external returns (uint256 shares);

    function withdraw(
        uint256 shares,
        address to,
        address from
    ) external returns (uint256 amount0, uint256 amount1);

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
        uint256 _deposit1Max) 
        external;   

    event HypervisorCreated(
        address uniswapV3Factory, 
        address hypervisorFactory, 
        address pool, 
        address token0, 
        bool allowToken0, 
        address token1, 
        bool allowToken1, 
        uint24 fee);

    event Initialized(address _hypervisor);

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
        int24 _baseLower,
        int24 _baseUpper,
        int24 _limitLower,
        int24 _limitUpper,
        address feeRecipient,
        int256 swapQuantity
    );

    event SetDepositMax(
        uint _deposit0Max, 
        uint _deposit1Max);        
}
