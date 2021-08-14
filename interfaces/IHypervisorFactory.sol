// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

interface IHypervisorFactory {

    function createHypervisor(
            address tokenA,
            bool allowTokenA,
            address tokenB,
            bool allowTokenB,
            uint24 fee
        ) external returns (address hypervisor);

    function init(
        address ichiVisorFactory) external;

    function allHypervisorsLength() external view returns (uint256);

    function subordinateHypervisor(
        address hypervisor, 
        address ichiVisor) external;
}
