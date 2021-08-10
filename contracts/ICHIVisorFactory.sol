// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import './ICHIVisor.sol';
import "../interfaces/IICHIVisorFactory.sol";
import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import './lib/AddressSet.sol';

contract ICHIVisorFactory is IICHIVisorFactory, Ownable {

    using AddressSet for AddressSet.Set;

    address constant NULL_ADDRESS = address(0);

    address public override immutable uniswapV3Factory;
    address public override immutable hypervisorFactory;
    
    struct Tradeable {
        AddressSet.Set visorSet;
    }
    mapping(address => Tradeable) tradeable;

    struct IchiVisor {
        address token0;
        bool allowToken0;
        address token1;
        bool allowToken1;
        uint fee;
    }
    AddressSet.Set visorSet;
    mapping(address => IchiVisor) public override ichiVisor;

    constructor(address _uniswapV3Factory, address _hypervisorFactory) {
        uniswapV3Factory = _uniswapV3Factory;
        hypervisorFactory = _hypervisorFactory;
        emit UniswapV3Factory(msg.sender, _uniswapV3Factory);
    }

    function createIchiVisor(
        address tokenA,
        bool allowTokenA,
        address tokenB,
        bool allowTokenB,
        uint24 fee
    ) external override onlyOwner returns (address newIchiVisor, address hypervisor) {
        (address token0, address token1) = _orderedPair(tokenA, tokenB);
        require(token0 != token1, 'ICHIVisorFactory.createIchiVisor: Identical token addresses');
        require(token0 != NULL_ADDRESS, 'ICHIVisorFactory.createIchiVisor:: token undefined');

        // configure policy
        bool allowToken0 = (token0 == tokenA) ? allowTokenA : allowTokenB;
        bool allowToken1 = (token1 == tokenB) ? allowTokenB : allowTokenA;

        // deploy the hypervisor
        newIchiVisor = address(new ICHIVisor{salt: keccak256(abi.encodePacked(
            visorSet.count()
        ))}(
            hypervisorFactory,
            uniswapV3Factory,
            token0, 
            allowToken0, 
            token1, 
            allowToken1, 
            fee
        ));

        // update the discoverable state
        IchiVisor memory newVisor = IchiVisor({
            token0: token0,
            allowToken0: allowToken0,
            token1: token1,
            allowToken1: allowToken1,
            fee: fee
        });

        // should not be possible for these inserts to fail
        visorSet.insert(newIchiVisor, 'ICHIVisorFactory.createIchiVisor:: (500) hypervisor address collision');
        tradeable[token0].visorSet.insert(newIchiVisor, 'ICHIVisorFactory.createIchiVisor:: (500) token0 collision');
        tradeable[token1].visorSet.insert(newIchiVisor, 'ICHIVisorFactory.createIchiVisor:: (500) token1 collision');
        ichiVisor[newIchiVisor] = newVisor;

        // initialize the ichiVisor
        hypervisor = ICHIVisor(newIchiVisor).init();
        IHypervisorFactory(hypervisorFactory).subordinateHypervisor(hypervisor, newIchiVisor);

        emit IchiVisorCreated(msg.sender, newIchiVisor, token0, token1, fee, visorSet.count());
    }

    function ichiVisorsCount() external override view returns (uint256) {
        return visorSet.count();
    }

    function ichiVisorAtIndex(uint index) external override view returns(address) {
        return visorSet.keyAtIndex(index);
    }

    function isIchiVisor(address checkIchiVisor) external override view returns(bool) {
        return visorSet.exists(checkIchiVisor);
    }

    function tokenIchiVisorCount(address token) external override view returns(uint) {
        return tradeable[token].visorSet.count();
    }

    function tokenIchiVisorAtIndex(address token, uint index) external override view returns(address) {
        return tradeable[token].visorSet.keyAtIndex(index);
    }

    function _orderedPair(address a, address b) private pure returns(address, address) {
        return a < b ? (a, b) : (b, a);
    }
}
