// contracts/libraries/DataTypes.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library DataTypes {
    uint256 constant LTV = 66;
    uint256 constant LIQUIDATION_THRESHOLD = 83;
    uint256 constant LIQUIDATION_BONUS = 10;
    uint256 constant PRECISION = 100;
    
    uint8 constant ORACLE_DECIMALS = 8;
    
    uint256 constant BASE_RATE = 200;
    uint256 constant RATE_SLOPE = 1000;
    uint256 constant OPTIMAL_UTILIZATION = 8000;
    
    struct Position {
        uint256 collateralAmount;
        uint256 borrowedAmount;
        uint256 lastInterestUpdate;
        uint256 accumulatedInterest;
    }
    
    struct LiquidationData {
        uint256 debtToCover;
        uint256 collateralToSeize;
        uint256 liquidatorBonus;
        uint256 healthFactor;
    }
}
