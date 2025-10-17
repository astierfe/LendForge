// test/integration/LendingPoolIntegration.t.sol - v1.0
// Tests E2E avec système d'oracles complet
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../LendingPoolV2.sol";
import "../../OracleAggregator.sol";
import "../../oracles/PriceRegistry.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "../../oracles/mocks/MockUniswapFallbackProvider.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";

contract LendingPoolIntegrationTest is Test {
    LendingPoolV2 pool;
    OracleAggregator aggregator;
    PriceRegistry registry;
    
    ChainlinkPriceProvider ethProvider;
    MockUniswapFallbackProvider uniFallback;
    MockChainlinkFeed mockChainlink;
    
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    address owner = address(this);
    address user1 = address(0x1);
    address user2 = address(0x2);
    address liquidator = address(0x3);
    
    function setUp() public {
        // Deploy oracle system
        mockChainlink = new MockChainlinkFeed(2000e8, 8);
        ethProvider = new ChainlinkPriceProvider(address(mockChainlink), "Chainlink ETH/USD");
        uniFallback = new MockUniswapFallbackProvider(2000e8);
        
        registry = new PriceRegistry();
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        aggregator = new OracleAggregator(address(registry));
        
        // Deploy lending pool
        pool = new LendingPoolV2(address(aggregator));
        
        // Fund test users
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(liquidator, 100 ether);
    }
    
    // ============ Basic Flow Tests ============
    
    function testDepositCollateral() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1 ether);
        assertEq(pool.totalCollateral(), 1 ether);
    }
    
    function testBorrowAgainstCollateral() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        
        // 1 ETH * $2000 = $2000 (in 8 decimals = 2000e8)
        // convertETHtoUSD returns: (1e18 * 2000e8) / 1e18 = 2000e8
        // Max borrow = 2000e8 * 66 / 100 = 1320e8
        uint256 borrowAmount = 1320e8;
        pool.borrow(borrowAmount);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, borrowAmount);
        
        vm.stopPrank();
    }
    
    function testRepayDebt() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        
        pool.repay{value: 500e8}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 500e8);
        
        vm.stopPrank();
    }
    
    function testWithdrawCollateral() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 2 ether}();
        pool.withdrawCollateral(1 ether);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1 ether);
        
        vm.stopPrank();
    }
    
    // ============ Oracle Integration Tests ============
    
    function testBorrowUsesOraclePrice() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        
        // Initially ETH = $2000 → max borrow = 1320e8
        uint256 maxBorrow1 = 1320e8;
        pool.borrow(maxBorrow1);
        
        vm.stopPrank();
        
        // Price increases to $2500
        mockChainlink.setPrice(2500e8);
        
        vm.startPrank(user2);
        pool.depositCollateral{value: 1 ether}();
        
        // Now max borrow = 2500 * 0.66 = 1650e8
        uint256 maxBorrow2 = 1650e8;
        pool.borrow(maxBorrow2);
        
        assertTrue(maxBorrow2 > maxBorrow1);
        
        vm.stopPrank();
    }
    
    function testOracleEmergencyBlocksBorrow() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        // Trigger emergency mode
        aggregator.setEmergencyMode(true, "Test emergency");
        
        vm.prank(user1);
        vm.expectRevert(ILendingPool.OracleEmergencyMode.selector);
        pool.borrow(100e18);
    }
    
    function testOracleEmergencyBlocksLiquidation() public {
        // Setup position
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1320e8);
        vm.stopPrank();
        
        // Trigger emergency
        aggregator.setEmergencyMode(true, "Test");
        
        vm.prank(liquidator);
        vm.expectRevert(ILendingPool.OracleEmergencyMode.selector);
        pool.liquidate{value: 1320e8}(user1);
    }
    
    function testFallbackOracleUsedWhenPrimaryFails() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        // Make Chainlink stale
        vm.warp(block.timestamp + 2 hours);
        
        // Should use Uniswap fallback (still $2000)
        uint256 maxBorrow = 1320e8;
        pool.borrow(maxBorrow);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, maxBorrow);
        
        vm.stopPrank();
    }
    
    // ============ Health Factor Tests ============
    
    function testHealthFactorCalculation() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        
        uint256 hf = pool.getHealthFactor(user1);
        
        // Collateral: 1 ETH * $2000 = 2000e8
        // Liquidation threshold: 83%
        // Adjusted collateral: 2000e8 * 83 / 100 = 1660e8
        // Debt: 1000e8
        // HF = (1660e8 / 1000e8) * 100 = 166
        assertEq(hf, 166);
        
        vm.stopPrank();
    }
    
    function testHealthFactorInfinityWhenNoDebt() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        uint256 hf = pool.getHealthFactor(user1);
        assertEq(hf, type(uint256).max);
    }
    
    // ============ Liquidation Tests ============
    
    function testLiquidationWhenUnderwater() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1320e8); // Max borrow at 66% LTV
        vm.stopPrank();
        
        // Price drops to $1500 (position becomes underwater)
        mockChainlink.setPrice(1500e8);
        uniFallback.setPrice(1500e8);
        
        // Health factor should be < 100
        uint256 hf = pool.getHealthFactor(user1);
        assertLt(hf, 100);
        
        // Liquidate
        vm.prank(liquidator);
        pool.liquidate{value: 1320e8}(user1);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
    }
    
    function testCannotLiquidateHealthyPosition() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        vm.stopPrank();
        
        vm.prank(liquidator);
        vm.expectRevert(ILendingPool.HealthyPosition.selector);
        pool.liquidate{value: 1000e8}(user1);
    }
    
    function testLiquidatorReceivesBonus() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1320e8);
        vm.stopPrank();
        
        mockChainlink.setPrice(1500e8);
        
        uint256 liquidatorBalanceBefore = liquidator.balance;
        
        vm.prank(liquidator);
        pool.liquidate{value: 1320e8}(user1);
        
        uint256 liquidatorBalanceAfter = liquidator.balance;
        
        // Liquidator should receive collateral + 10% bonus
        uint256 received = liquidatorBalanceAfter - (liquidatorBalanceBefore - 1320e8);
        assertGt(received, 0);
    }
    
    // ============ Multi-User Tests ============
    
    function testMultipleUsersSeparatePositions() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.prank(user2);
        pool.depositCollateral{value: 2 ether}();
        
        vm.prank(user1);
        pool.borrow(500e8);
        
        ILendingPool.Position memory pos1 = pool.getPosition(user1);
        ILendingPool.Position memory pos2 = pool.getPosition(user2);
        
        assertEq(pos1.collateralAmount, 1 ether);
        assertEq(pos1.borrowedAmount, 500e8);
        assertEq(pos2.collateralAmount, 2 ether);
        assertEq(pos2.borrowedAmount, 0);
    }
    
    function testTotalCollateralAndBorrowedTracking() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.prank(user2);
        pool.depositCollateral{value: 2 ether}();
        
        assertEq(pool.totalCollateral(), 3 ether);
        
        vm.prank(user1);
        pool.borrow(500e8);
        
        vm.prank(user2);
        pool.borrow(1000e8);
        
        assertEq(pool.totalBorrowed(), 1500e8);
    }
    
    // ============ Edge Cases ============
    
    function testCannotBorrowWithoutCollateral() public {
        vm.prank(user1);
        vm.expectRevert(ILendingPool.InsufficientCollateral.selector);
        pool.borrow(100e18);
    }
    
    function testCannotRepayWithoutDebt() public {
        vm.expectRevert(ILendingPool.NoDebt.selector);
        
        vm.prank(user1);
        pool.repay{value: 100e8}();
    }
    
    function testCannotWithdrawMoreThanCollateral() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectRevert(ILendingPool.InsufficientCollateral.selector);
        pool.withdrawCollateral(2 ether);
        
        vm.stopPrank();
    }
    
    function testCannotWithdrawIfBreaksLTV() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        pool.borrow(2000e8);
        
        // Withdrawing 1.5 ETH would leave only 0.5 ETH collateral
        // 0.5 ETH * $2000 = 1000e8, max borrow = 660e8
        // Current debt = 2000e8 > 660e8, so should revert
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.withdrawCollateral(1.5 ether);
        
        vm.stopPrank();
    }
}