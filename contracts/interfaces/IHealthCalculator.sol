// contracts/interfaces/IHealthCalculator.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHealthCalculator {
    function calculateHealthFactor(
        uint256 collateralValueUSD,
        uint256 debtValueUSD
    ) external pure returns (uint256);
    
    function isLiquidatable(
        uint256 collateralValueUSD,
        uint256 debtValueUSD
    ) external pure returns (bool);
    
    function calculateLiquidationAmount(
        uint256 debtRepaid,
        uint256 collateralPrice
    ) external pure returns (uint256 collateralToSeize);
}
