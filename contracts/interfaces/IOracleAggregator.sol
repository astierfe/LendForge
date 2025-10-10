// contracts/interfaces/IOracleAggregator.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleAggregator {
    function getLatestPrice() external returns (int256);
    function emergencyMode() external view returns (bool);
    function decimals() external view returns (uint8);
}
