// test/integration/LendingFlow.t.sol - v1.0 - DEBUG VERSION
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../contracts/LendingPoolV2.sol";

contract MockOracle {
    int256 public price = 2000e8;
    bool public emergencyMode = false;
    
    function getLatestPrice() external view returns (int256) {
        return price;
    }
    
    function decimals() external pure returns (uint8) {
        return 8;
    }
    
    function setPrice(int256 _price) external {
        price = _price;
    }
    
    function setEmergencyMode(bool _enabled) external {
        emergencyMode = _enabled;
    }
}

contract LendingFlowTest is Test {
    LendingPoolV2 pool;
    MockOracle oracle;
    
    address user1 = address(0x100);
    address user2 = address(0x200);
    address user3 = address(0x300);
    address liquidator = address(0x999);
    
    function setUp() public {
        oracle = new MockOracle();
        pool = new LendingPoolV2(address(oracle));
        
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
        vm.deal(liquidator, 100 ether);
    }
    
    // ============ Scenario 1: Happy Path Full Cycle ============
    
    function testHappyPathFullCycle() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 2 ether}();
        assertEq(pool.getPosition(user1).collateralAmount, 2 ether);
        
        pool.borrow(1200e8);
        assertEq(pool.getPosition(user1).borrowedAmount, 1200e8);
        
        pool.repay{value: 600e8}();
        assertEq(pool.getPosition(user1).borrowedAmount, 600e8);
        
        pool.withdrawCollateral(0.5 ether);
        assertEq(pool.getPosition(user1).collateralAmount, 1.5 ether);
        
        pool.repay{value: 600e8}();
        assertEq(pool.getPosition(user1).borrowedAmount, 0);
        
        pool.withdrawCollateral(1.5 ether);
        assertEq(pool.getPosition(user1).collateralAmount, 0);
        
        vm.stopPrank();
        
        assertEq(pool.totalCollateral(), 0);
        assertEq(pool.totalBorrowed(), 0);
    }
    
    // ============ Scenario 2: Liquidation Flow - SIMPLIFIED ============
    
    function testLiquidationScenarioComplete() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1320e8);
        vm.stopPrank();
        
        oracle.setPrice(1500e8);
        
        uint256 hfAfter = pool.getHealthFactor(user1);
        assertLt(hfAfter, 100);
        
        vm.prank(liquidator);
        pool.liquidate{value: 1320e8}(user1);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
    }
    
    // ============ Scenario 3: Multi-User - SIMPLIFIED ============
    
    function testMultiUserScenario() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 3 ether}();
        pool.borrow(1000e8);
        vm.stopPrank();
        
        vm.startPrank(user2);
        pool.depositCollateral{value: 2 ether}();
        pool.borrow(2640e8);
        vm.stopPrank();
        
        vm.prank(user3);
        pool.depositCollateral{value: 1 ether}();
        
        assertEq(pool.totalCollateral(), 6 ether);
        assertEq(pool.totalBorrowed(), 3640e8);
        
        oracle.setPrice(1500e8);
        
        uint256 hf2 = pool.getHealthFactor(user2);
        assertLt(hf2, 100);
        
        vm.prank(liquidator);
        pool.liquidate{value: 2640e8}(user2);
        
        assertEq(pool.getPosition(user2).borrowedAmount, 0);
        
        vm.prank(user1);
        pool.repay{value: 500e8}();
        assertEq(pool.getPosition(user1).borrowedAmount, 500e8);
    }
}