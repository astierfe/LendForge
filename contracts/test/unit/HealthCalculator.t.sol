// test/unit/HealthCalculator.t.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../libraries/HealthCalculator.sol";
import "../../libraries/DataTypes.sol";

contract HealthCalculatorTest is Test {
    function testHealthFactorHealthyPosition() public pure {
        uint256 hf = HealthCalculator.calculateHealthFactor(2000e8, 1200e8);
        assertEq(hf, 138);
    }
    
    function testHealthFactorAtLiquidationThreshold() public pure {
        uint256 hf = HealthCalculator.calculateHealthFactor(1446e8, 1200e8);
        assertEq(hf, 100);
    }
    
    function testHealthFactorUnhealthy() public pure {
        uint256 hf = HealthCalculator.calculateHealthFactor(1400e8, 1200e8);
        assertLt(hf, 100);
        assertEq(hf, 96);
    }
    
    function testHealthFactorNoDebt() public pure {
        uint256 hf = HealthCalculator.calculateHealthFactor(2000e8, 0);
        assertEq(hf, type(uint256).max);
    }
    
    function testHealthFactorRevertsZeroCollateral() public {
        vm.expectRevert(HealthCalculator.InvalidCollateralValue.selector);
        this.helperCalculateHF(0, 1000e8);
    }
    
    function helperCalculateHF(uint256 c, uint256 d) external pure returns (uint256) {
        return HealthCalculator.calculateHealthFactor(c, d);
    }
    
    function testIsLiquidatableHealthy() public pure {
        bool result = HealthCalculator.isLiquidatable(2000e8, 1200e8);
        assertFalse(result);
    }
    
    function testIsLiquidatableUnhealthy() public pure {
        bool result = HealthCalculator.isLiquidatable(1400e8, 1200e8);
        assertTrue(result);
    }
    
    function testIsLiquidatableNoDebt() public pure {
        bool result = HealthCalculator.isLiquidatable(2000e8, 0);
        assertFalse(result);
    }
    
    function testLiquidationAmountCalculation() public pure {
        uint256 seized = HealthCalculator.calculateLiquidationAmount(1200e8, 2000e8);
        uint256 expected = 0.66 ether;
        assertEq(seized, expected);
    }
    
    function testLiquidationAmountWithBonus() public pure {
        uint256 seized = HealthCalculator.calculateLiquidationAmount(1000e8, 2500e8);
        assertEq(seized, 0.44 ether);
    }
    
    function testLiquidationRevertsZeroPrice() public {
        vm.expectRevert(HealthCalculator.DivisionByZero.selector);
        this.helperLiquidation(1000e8, 0);
    }
    
    function helperLiquidation(uint256 d, uint256 p) external pure returns (uint256) {
        return HealthCalculator.calculateLiquidationAmount(d, p);
    }
    
    function testConvertETHtoUSD() public pure {
        uint256 valueUSD = HealthCalculator.convertETHtoUSD(1 ether, 2000e8);
        assertEq(valueUSD, 2000e8);
    }
    
    function testConvertPartialETH() public pure {
        uint256 valueUSD = HealthCalculator.convertETHtoUSD(0.5 ether, 2000e8);
        assertEq(valueUSD, 1000e8);
    }
    
    function testConvertWithDifferentPrice() public pure {
        uint256 valueUSD = HealthCalculator.convertETHtoUSD(2 ether, 1500e8);
        assertEq(valueUSD, 3000e8);
    }
    
    function testMaxBorrowCalculation() public pure {
        uint256 maxBorrow = HealthCalculator.calculateMaxBorrow(2000e8);
        assertEq(maxBorrow, 1320e8);
    }
    
    function testMaxBorrowZeroCollateral() public pure {
        uint256 maxBorrow = HealthCalculator.calculateMaxBorrow(0);
        assertEq(maxBorrow, 0);
    }
    
    function testExceedsLTVTrue() public pure {
        bool exceeds = HealthCalculator.exceedsLTV(2000e8, 800e8, 600e8);
        assertTrue(exceeds);
    }
    
    function testExceedsLTVFalse() public pure {
        bool exceeds = HealthCalculator.exceedsLTV(2000e8, 800e8, 500e8);
        assertFalse(exceeds);
    }
    
    function testExceedsLTVExactLimit() public pure {
        bool exceeds = HealthCalculator.exceedsLTV(2000e8, 1000e8, 320e8);
        assertFalse(exceeds);
    }
    
    function testMinCollateralCalculation() public pure {
        uint256 minCollat = HealthCalculator.calculateMinCollateral(1200e8);
        assertGe(minCollat, 1445e8);
        assertLe(minCollat, 1446e8);
    }
    
    function testMinCollateralZeroDebt() public pure {
        uint256 minCollat = HealthCalculator.calculateMinCollateral(0);
        assertEq(minCollat, 0);
    }
    
    function testFuzzHealthFactor(uint256 collateral, uint256 debt) public pure {
        collateral = bound(collateral, 100e8, 100000e8);
        debt = bound(debt, 1e8, 100000e8);
        
        if (debt > collateral * 10) return;
        
        uint256 hf = HealthCalculator.calculateHealthFactor(collateral, debt);
        
        assertGt(hf, 0);
        
        if (collateral > debt * 12 / 10) {
            assertGt(hf, 83);
        }
    }
    
    function testFuzzLiquidationAmount(uint256 debt, uint256 price) public pure {
        debt = bound(debt, 1e8, 1000000e8);
        price = bound(price, 100e8, 10000e8);
        
        uint256 seized = HealthCalculator.calculateLiquidationAmount(debt, price);
        
        uint256 baseAmount = (debt * 1e18) / price;
        assertGt(seized, baseAmount);
    }
}
