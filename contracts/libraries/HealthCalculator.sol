// contracts/libraries/HealthCalculator.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DataTypes.sol";

library HealthCalculator {
    uint256 private constant PRECISION = 10000;
    
    error InvalidCollateralValue();
    error InvalidDebtValue();
    error DivisionByZero();
    
    function calculateHealthFactor(
        uint256 collateralValueUSD,
        uint256 debtValueUSD
    ) internal pure returns (uint256) {
        if (debtValueUSD == 0) {
            return type(uint256).max;
        }
        
        if (collateralValueUSD == 0) revert InvalidCollateralValue();
        
        uint256 adjustedCollateral = (collateralValueUSD * DataTypes.LIQUIDATION_THRESHOLD) / 100;
        uint256 healthFactor = (adjustedCollateral * 100) / debtValueUSD;
        
        return healthFactor;
    }
    
    function isLiquidatable(
        uint256 collateralValueUSD,
        uint256 debtValueUSD
    ) internal pure returns (bool) {
        if (debtValueUSD == 0) return false;
        
        uint256 hf = calculateHealthFactor(collateralValueUSD, debtValueUSD);
        return hf < 100;
    }
    
    function calculateLiquidationAmount(
        uint256 debtRepaid,
        uint256 collateralPriceUSD
    ) internal pure returns (uint256 collateralToSeize) {
        if (collateralPriceUSD == 0) revert DivisionByZero();
        
        uint256 baseCollateral = (debtRepaid * 1e18) / collateralPriceUSD;
        
        uint256 bonus = (baseCollateral * DataTypes.LIQUIDATION_BONUS) / 100;
        collateralToSeize = baseCollateral + bonus;
        
        return collateralToSeize;
    }
    
    function convertETHtoUSD(
        uint256 ethAmount,
        uint256 ethPriceUSD
    ) internal pure returns (uint256) {
        return (ethAmount * ethPriceUSD) / 1e18;
    }
    
    function calculateMaxBorrow(
        uint256 collateralValueUSD
    ) internal pure returns (uint256) {
        return (collateralValueUSD * DataTypes.LTV) / 100;
    }
    
    function exceedsLTV(
        uint256 collateralValueUSD,
        uint256 currentDebt,
        uint256 newBorrowAmount
    ) internal pure returns (bool) {
        uint256 totalDebt = currentDebt + newBorrowAmount;
        uint256 maxBorrow = calculateMaxBorrow(collateralValueUSD);
        return totalDebt > maxBorrow;
    }
    
    function calculateMinCollateral(
        uint256 debtValueUSD
    ) internal pure returns (uint256) {
        return (debtValueUSD * 100) / DataTypes.LIQUIDATION_THRESHOLD;
    }
}
