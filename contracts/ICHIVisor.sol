// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import {IUniswapV3Factory} from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Hypervisor} from './Hypervisor.sol';
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ICHIVisor is ERC20, Ownable {

    address constant NULL_ADDRESS = address(0);
    address public immutable uniswapV3Factory;
    address public immutable hypervisor;
    address public immutable pool;
    address public immutable token0;
    bool public immutable allowToken0;
    address public immutable token1;
    bool public immutable  allowToken1;
    uint24 public immutable fee;
    
    event HypervisorCreated(
        address uniswapV3Factory, 
        address hypervisor, 
        address pool, 
        address token0, 
        bool allowToken0, 
        address token1, 
        bool allowToken1, 
        uint24 fee);

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

    constructor(
        address _owner,
        address _uniswapV3Factory, 
        address _tokenA,
        bool _allowTokenA,
        address _tokenB,
        bool _allowTokenB,
        uint24 _fee
    )
        ERC20("xICHI Liquidity", "xICHI")
    {
        transferOwnership(_owner);
        fee = _fee;
        (address _token0, address _token1) = _orderedPair(_tokenA, _tokenB);
        require(_tokenA != _tokenB, 'ICHIVisor.constructor: Identical token addresses');
        require(_token0 != NULL_ADDRESS, 'ICHIVisor.constructor: token undefined');

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

        // deploy the hypervisor
        address _hypervisor = address(
            new Hypervisor{
                salt: keccak256(
                    abi.encodePacked(
                        _token0, 
                        _token1, 
                        _fee, 
                        tickSpacing
                    )
                )
            }
            (
                _pool, 
                address(this)
            )
        );
        
        // set immutables
        uniswapV3Factory = _uniswapV3Factory;
        hypervisor = _hypervisor;
        pool = _pool;
        token0 = _token0;
        allowToken0 = _allowToken0;
        token1 = _token1;
        allowToken1 = _allowToken1;

        emit HypervisorCreated(_uniswapV3Factory, _hypervisor, _pool, _token0, _allowToken0, _token1, _allowToken1, _fee);
    }

    function deposit(
        uint256 deposit0,
        uint256 deposit1,
        address to
    ) external returns (uint256 shares) {
        require(allowToken0 || deposit0 == 0, 'ICHIVisor.deposit: token0 prohibited by ICHIVisor policy');
        require(allowToken1 || deposit1 == 0, 'ICHIVisor.deposit: token0 prohibited by ICHIVisor policy');
        ERC20(token0).transferFrom(msg.sender, address(this), deposit0);
        ERC20(token1).transferFrom(msg.sender, address(this), deposit0);
        shares = Hypervisor(hypervisor).deposit(deposit0, deposit1, to);
        emit Deposit(msg.sender, to, shares, deposit0, deposit1);
    }

    function withdraw(
        uint256 shares,
        address to,
        address from
    ) external returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = Hypervisor(hypervisor).withdraw(shares, to, from);
        _burn(from, shares);
        ERC20(token0).transfer(msg.sender, amount0);
        ERC20(token1).transfer(msg.sender, amount1);
        emit Withdraw(from, to, shares, amount0, amount1);
    }
    
    function rebalance(
        int24 _baseLower,
        int24 _baseUpper,
        int24 _limitLower,
        int24 _limitUpper,
        address feeRecipient,
        int256 swapQuantity
    ) external onlyOwner {

        Hypervisor(hypervisor).rebalance(
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
    
    function _orderedPair(address a, address b) private pure returns(address, address) {
        return a < b ? (a, b) : (b, a);
    }
}
