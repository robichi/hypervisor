// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import '../interfaces/IHypervisorFactory.sol';
import '../interfaces/IHypervisor.sol';
import '../interfaces/IICHIVisor.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract ICHIVisor is IICHIVisor, ERC20, Ownable {

    using SafeERC20 for IERC20;

    address constant NULL_ADDRESS = address(0);
    uint256 private constant INFINITE = ~uint256(0);
    address public override immutable uniswapV3Factory;
    address public override immutable hypervisorFactory;
    address public override immutable pool;
    address public override immutable token0;
    bool public override immutable allowToken0;
    address public override immutable token1;
    bool public override immutable allowToken1;
    uint24 public override immutable fee;
    address public override hypervisor;
    
    modifier initialized {
        require(hypervisor != NULL_ADDRESS, 'ICHIVisor.initialied: not initialized');
        _;
    }

    constructor(
        address _hypervisorFactory,
        address _uniswapV3Factory, 
        address _tokenA,
        bool _allowTokenA,
        address _tokenB,
        bool _allowTokenB,
        uint24 _fee
    )
        ERC20("xICHI Liquidity", "xICHI")
    {
        fee = _fee;
        (address _token0, address _token1) = _orderedPair(_tokenA, _tokenB);
        require(_tokenA != _tokenB, 'ICHIVisor.constructor: Identical token addresses');
        require(_token0 != NULL_ADDRESS, 'ICHIVisor.constructor: token undefined');
        require(_allowTokenA || _allowTokenB, 'ICHIVisor.constructor: At least one token must be allowed');

        // configure the policy
        bool _allowToken0 = (_token0 == _tokenA) ? _allowTokenA : _allowTokenB;
        bool _allowToken1 = (_token1 == _tokenB) ? _allowTokenB : _allowTokenA;

        // inspect the uniswap pool
        int24 tickSpacing = IUniswapV3Factory(_uniswapV3Factory).feeAmountTickSpacing(_fee);
        require(tickSpacing != 0, 'ICHIVisor.constructor: Incorrect Fee');

        address _pool = IUniswapV3Factory(_uniswapV3Factory).getPool(_token0, _token1, _fee);

        // create uniswap pool if needed
        if (_pool == NULL_ADDRESS) {
            _pool = IUniswapV3Factory(_uniswapV3Factory).createPool(_token0, _token1, _fee);
        }

        // set immutables
        uniswapV3Factory = _uniswapV3Factory;
        hypervisorFactory = _hypervisorFactory;
        pool = _pool;
        token0 = _token0;
        allowToken0 = _allowToken0;
        token1 = _token1;
        allowToken1 = _allowToken1;

        emit HypervisorCreated(_uniswapV3Factory, _hypervisorFactory, _pool, _token0, _allowToken0, _token1, _allowToken1, _fee);
    }

    function init(address deployer) external override onlyOwner returns(address _hypervisor) {
        require(hypervisor == NULL_ADDRESS, 'ICHIVisor.init: already initialized');
        _hypervisor = IHypervisorFactory(hypervisorFactory).createHypervisor(token0, token1, fee);
        hypervisor = _hypervisor;
        transferOwnership(deployer);
        IERC20(token0).safeApprove(hypervisor, INFINITE);
        IERC20(token1).safeApprove(hypervisor, INFINITE);
        emit Initialized(_hypervisor);
    }

    function deposit(
        uint256 deposit0,
        uint256 deposit1,
        address to
    ) external override initialized returns (uint256 shares) {
        require(allowToken0 || deposit0 == 0, 'ICHIVisor.deposit: token0 prohibited by ICHIVisor policy');
        require(allowToken1 || deposit1 == 0, 'ICHIVisor.deposit: token1 prohibited by ICHIVisor policy');
        IERC20(token0).safeTransferFrom(msg.sender, address(this), deposit0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), deposit1);
        shares = IHypervisor(hypervisor).deposit(deposit0, deposit1, address(this));
        _mint(to, shares);
        emit Deposit(msg.sender, to, shares, deposit0, deposit1);
    }

    function withdraw(
        uint256 shares,
        address to,
        address from
    ) external override initialized returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = IHypervisor(hypervisor).withdraw(shares, address(this), address(this));
        _burn(from, shares);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
        emit Withdraw(from, to, shares, amount0, amount1);
    }
    
    function rebalance(
        int24 _baseLower,
        int24 _baseUpper,
        int24 _limitLower,
        int24 _limitUpper,
        address feeRecipient,
        int256 swapQuantity
    ) external override initialized onlyOwner {

        IHypervisor(hypervisor).rebalance(
            _baseLower,
            _baseUpper,
            _limitLower,
            _limitUpper,
            feeRecipient,
            swapQuantity
        );

        emit Rebalance(
            _baseLower,
            _baseUpper,
            _limitLower,
            _limitUpper,
            feeRecipient,
            swapQuantity
        );
    }

    // @param _deposit0Max The maximum amount of token0 allowed in a deposit
    // @param _deposit1Max The maximum amount of token1 allowed in a deposit
    function setDepositMax(uint256 _deposit0Max, uint256 _deposit1Max) external override initialized onlyOwner {
        IHypervisor(hypervisor).setDepositMax(_deposit0Max, _deposit1Max);
        emit SetDepositMax(_deposit0Max, _deposit1Max);
    }
    
    function _orderedPair(address a, address b) private pure returns(address, address) {
        return a < b ? (a, b) : (b, a);
    }
}
