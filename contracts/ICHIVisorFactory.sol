// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import './ICHIVisor.sol';
import "../interfaces/IICHIVisorFactory.sol";
import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import './lib/Bytes32Set.sol';
import './lib/AddressSet.sol';

contract ICHIVisorFactory is IICHIVisorFactory, Ownable {

    using AddressSet for AddressSet.Set;
    using Bytes32Set for Bytes32Set.Set;

    address constant NULL_ADDRESS = address(0);

    address public override immutable uniswapV3Factory;
    address public override immutable hypervisorFactory;
    
    struct Token {
        Bytes32Set.Set visorSet;
    }
    mapping(address => Token) tokens;
    AddressSet.Set tokenSet;

    struct IchiVisor {
        address ichivisor;
        address hypervisor;
        address token0;
        bool allowToken0;
        address token1;
        bool allowToken1;
        uint fee;
    }
    Bytes32Set.Set visorSet;
    mapping(bytes32 => IchiVisor) public override ichiVisor;

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

        (bytes32 visorId, /* bool exists */ ) = visorKey(token0, token1, fee);

        // should not be possible for these inserts to fail
        visorSet.insert(visorId, 'ICHIVisorFactory.createIchiVisor:: (500) hypervisor address collision');
        tokens[token0].visorSet.insert(visorId, 'ICHIVisorFactory.createIchiVisor:: (500) token0 collision');
        tokens[token1].visorSet.insert(visorId, 'ICHIVisorFactory.createIchiVisor:: (500) token1 collision');

        // initialize the ichiVisor
        hypervisor = ICHIVisor(newIchiVisor).init(msg.sender);
        
        // update the discoverable state
        IchiVisor memory newVisor = IchiVisor({
            ichivisor: newIchiVisor,
            hypervisor: hypervisor,
            token0: token0,
            allowToken0: allowToken0,
            token1: token1,
            allowToken1: allowToken1,
            fee: fee
        });
        ichiVisor[visorId] = newVisor;
        IHypervisorFactory(hypervisorFactory).subordinateHypervisor(hypervisor, newIchiVisor);

        emit IchiVisorCreated(msg.sender, newIchiVisor, visorId, token0, token1, fee, visorSet.count());
    }

    function visorKey(address tokenA, address tokenB, uint fee) public override view returns(bytes32 key, bool exists) {
        (address token0, address token1) = _orderedPair(tokenA, tokenB);
        key = keccak256(abi.encodePacked(token0, token1, fee));
        exists = visorSet.exists(key);
    }

    function tokenCount() external override view returns(uint) {
        return tokenSet.count();
    }

    function tokenAtIndex(uint index) external override view returns(address) {
        return tokenSet.keyAtIndex(index);
    }

    function isToken(address _token) external override view returns(bool) {
        return tokenSet.exists(_token);
    }

    function ichiVisorsCount() external override view returns (uint256) {
        return visorSet.count();
    }

    function ichiVisorAtIndex(uint index) external override view returns(bytes32) {
        return visorSet.keyAtIndex(index);
    }

    function isIchiVisor(bytes32 checkIchiVisor) external override view returns(bool) {
        return visorSet.exists(checkIchiVisor);
    }

    function tokenIchiVisorCount(address token) external override view returns(uint) {
        return tokens[token].visorSet.count();
    }

    function tokenIchiVisorAtIndex(address token, uint index) external override view returns(bytes32) {
        return tokens[token].visorSet.keyAtIndex(index);
    }

    function _orderedPair(address a, address b) private pure returns(address, address) {
        return a < b ? (a, b) : (b, a);
    }
}
