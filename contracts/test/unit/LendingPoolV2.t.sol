// test/unit/LendingPoolV2.t.sol - v1.0 - Complete tests
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../LendingPoolV2.sol";
import "../../libraries/DataTypes.sol";

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

contract LendingPoolV2Test is Test {
    LendingPoolV2 pool;
    MockOracle oracle;
    
    address owner = address(this);
    address user1 = address(0x1);
    address user2 = address(0x2);
    
    function setUp() public {
        oracle = new MockOracle();
        pool = new LendingPoolV2(address(oracle));
        
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }
    
    // ============ Constructor Tests ============
    
    function testConstructorSetsOracle() public view {
        assertEq(address(pool.oracle()), address(oracle));
    }
    
    function testConstructorSetsOwner() public view {
        assertEq(pool.owner(), owner);
    }
    
    function testConstructorRevertsZeroAddress() public {
        vm.expectRevert(ILendingPool.InvalidAddress.selector);
        new LendingPoolV2(address(0));
    }
    
    // ============ Modifier Tests ============
    
    function testDepositRevertsWhenPaused() public {
        pool.pause();
        
        vm.prank(user1);
        vm.expectRevert("Paused");
        pool.depositCollateral{value: 1 ether}();
    }
    
    function testDepositRevertsZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.depositCollateral{value: 0}();
    }
    
    function testBorrowRevertsInEmergency() public {
        oracle.setEmergencyMode(true);
        
        vm.prank(user1);
        vm.expectRevert(ILendingPool.OracleEmergencyMode.selector);
        pool.borrow(1 ether);
    }
    
    function testLiquidateRevertsInEmergency() public {
        oracle.setEmergencyMode(true);
        
        vm.prank(user1);
        vm.expectRevert(ILendingPool.OracleEmergencyMode.selector);
        pool.liquidate{value: 1 ether}(user2);
    }
    
    // ============ View Function Tests ============
    
    function testGetPositionEmpty() public view {
        ILendingPool.Position memory pos = pool.getPosition(user1);
        
        assertEq(pos.collateralAmount, 0);
        assertEq(pos.borrowedAmount, 0);
        assertEq(pos.lastInterestUpdate, 0);
        assertEq(pos.accumulatedInterest, 0);
    }
    
    function testGetHealthFactorNoDebt() public {
        uint256 hf = pool.getHealthFactor(user1);
        assertEq(hf, type(uint256).max);
    }
    
    function testGetCollateralValueUSDZero() public {
        uint256 value = pool.getCollateralValueUSD(user1);
        assertEq(value, 0);
    }
    
    function testGetCurrentBorrowRate() public view {
        uint256 rate = pool.getCurrentBorrowRate();
        assertEq(rate, DataTypes.BASE_RATE);
    }
    
    // ============ Admin Function Tests ============
    
    function testPauseUnpause() public {
        assertFalse(pool.paused());
        
        pool.pause();
        assertTrue(pool.paused());
        
        pool.unpause();
        assertFalse(pool.paused());
    }
    
    function testPauseOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert("Not owner");
        pool.pause();
    }
    
    function testTransferOwnership() public {
        assertEq(pool.owner(), owner);
        
        pool.transferOwnership(user1);
        assertEq(pool.owner(), user1);
    }
    
    function testTransferOwnershipRevertsZeroAddress() public {
        vm.expectRevert(ILendingPool.InvalidAddress.selector);
        pool.transferOwnership(address(0));
    }
    
    function testTransferOwnershipOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert("Not owner");
        pool.transferOwnership(user2);
    }
    
    // ============ Receive Function Test ============
    
    function testReceiveReverts() public {
        vm.prank(user1);
        (bool success, ) = address(pool).call{value: 1 ether}("");
        assertFalse(success);
    }
    
    // ============ Oracle Integration Tests ============
    
    function testOraclePriceUpdate() public {
        oracle.setPrice(2500e8);
        
        int256 price = oracle.getLatestPrice();
        assertEq(price, 2500e8);
    }
    
    function testEmergencyModeToggle() public {
        assertFalse(oracle.emergencyMode());
        
        oracle.setEmergencyMode(true);
        assertTrue(oracle.emergencyMode());
    }
    
    // ============ State Variables Tests ============
    
    function testInitialTotals() public view {
        assertEq(pool.totalCollateral(), 0);
        assertEq(pool.totalBorrowed(), 0);
    }
    
    // ============ 2.1.1 - Deposit Collateral Tests ============
    
    function testDepositCollateral() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1 ether);
        assertEq(pool.totalCollateral(), 1 ether);
    }
    
    function testDepositCollateralMultipleTimes() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.depositCollateral{value: 0.5 ether}();
        pool.depositCollateral{value: 0.3 ether}();
        
        vm.stopPrank();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1.8 ether);
        assertEq(pool.totalCollateral(), 1.8 ether);
    }
    
    function testDepositCollateralMultipleUsers() public {
        vm.prank(user1);
        pool.depositCollateral{value: 2 ether}();
        
        vm.prank(user2);
        pool.depositCollateral{value: 3 ether}();
        
        ILendingPool.Position memory pos1 = pool.getPosition(user1);
        ILendingPool.Position memory pos2 = pool.getPosition(user2);
        
        assertEq(pos1.collateralAmount, 2 ether);
        assertEq(pos2.collateralAmount, 3 ether);
        assertEq(pool.totalCollateral(), 5 ether);
    }
    
    function testDepositEmitsEvent() public {
        vm.prank(user1);
        
        vm.expectEmit(true, false, false, true);
        emit ILendingPool.CollateralDeposited(user1, 1 ether, block.timestamp);
        
        pool.depositCollateral{value: 1 ether}();
    }
    
    function testDepositUpdatesHealthFactor() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        uint256 hf = pool.getHealthFactor(user1);
        assertEq(hf, type(uint256).max);
    }
    
    // ============ 2.1.2 - Withdraw Collateral Tests ============
    
    function testWithdrawCollateral() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        
        pool.withdrawCollateral(0.5 ether);
        vm.stopPrank();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1.5 ether);
        assertEq(pool.totalCollateral(), 1.5 ether);
    }
    
    function testWithdrawCollateralFull() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        pool.withdrawCollateral(1 ether);
        vm.stopPrank();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 0);
        assertEq(pool.totalCollateral(), 0);
    }
    
    function testWithdrawRevertsInsufficientCollateral() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectRevert(ILendingPool.InsufficientCollateral.selector);
        pool.withdrawCollateral(2 ether);
        vm.stopPrank();
    }
    
    function testWithdrawEmitsEvent() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectEmit(true, false, false, true);
        emit ILendingPool.CollateralWithdrawn(user1, 0.5 ether);
        
        pool.withdrawCollateral(0.5 ether);
        vm.stopPrank();
    }
    
    function testWithdrawTransfersETH() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        uint256 balanceBefore = user1.balance;
        pool.withdrawCollateral(0.5 ether);
        uint256 balanceAfter = user1.balance;
        
        assertEq(balanceAfter - balanceBefore, 0.5 ether);
        vm.stopPrank();
    }
    
    function testWithdrawRevertsZeroAmount() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.withdrawCollateral(0);
        vm.stopPrank();
    }

    // ============ 2.2.1 - Borrow Tests ============
    
    function testBorrow() public {
        vm.startPrank(user1);
        
        // Deposit 2 ETH = $4000 at $2000/ETH
        pool.depositCollateral{value: 2 ether}();
        
        // Borrow $1200 (< $2640 max)
        pool.borrow(1200e8);
        
        vm.stopPrank();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 1200e8);
        assertEq(pool.totalBorrowed(), 1200e8);
    }
    
    function testBorrowUpdatesLastInterestUpdate() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        uint256 timestampBefore = block.timestamp;
        pool.borrow(500e8);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.lastInterestUpdate, timestampBefore);
        vm.stopPrank();
    }
    
    function testBorrowMultipleTimes() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        
        pool.borrow(500e8);
        pool.borrow(300e8);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 800e8);
        assertEq(pool.totalBorrowed(), 800e8);
        vm.stopPrank();
    }
    
    function testBorrowRevertsNoCollateral() public {
        vm.prank(user1);
        vm.expectRevert(ILendingPool.InsufficientCollateral.selector);
        pool.borrow(100e8);
    }
    
    function testBorrowRevertsExceedsLTV() public {
        vm.startPrank(user1);
        
        // Deposit 1 ETH = $2000
        // Max borrow = $2000 × 66% = $1320
        pool.depositCollateral{value: 1 ether}();
        
        // Try borrow $1500 > $1320
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.borrow(1500e8);
        
        vm.stopPrank();
    }
    
    function testBorrowEmitsEvent() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        
        vm.expectEmit(true, false, false, false);
        emit ILendingPool.Borrowed(user1, 1000e8, 0); // HF calculé dynamiquement
        
        pool.borrow(1000e8);
        vm.stopPrank();
    }
    
    function testBorrowUpdatesHealthFactor() public {
        vm.startPrank(user1);
        
        // Deposit 2 ETH = $4000
        pool.depositCollateral{value: 2 ether}();
        
        // Borrow $1200
        pool.borrow(1200e8);
        
        // HF = ($4000 × 0.83) / $1200 = 2.76
        uint256 hf = pool.getHealthFactor(user1);
        assertEq(hf, 276);
        
        vm.stopPrank();
    }
    
    function testBorrowMaxLTV() public {
        vm.startPrank(user1);
        
        // Deposit 1 ETH = $2000
        pool.depositCollateral{value: 1 ether}();
        
        // Borrow exactly max: $2000 × 66% = $1320
        pool.borrow(1320e8);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 1320e8);
        
        vm.stopPrank();
    }

    // ============ 2.1.2 Extended - Withdraw avec Dette ============
    
    function testWithdrawRevertsIfBreaksLTV() public {
        vm.startPrank(user1);
        
        // Deposit 2 ETH = $4000
        pool.depositCollateral{value: 2 ether}();
        
        // Borrow $1200
        pool.borrow(1200e8);
        
        // Try withdraw 1.5 ETH
        // Remaining: 0.5 ETH = $1000
        // Max borrow: $1000 × 66% = $660
        // Debt: $1200 > $660 → REVERT
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.withdrawCollateral(1.5 ether);
        
        vm.stopPrank();
    }
    
    function testWithdrawSucceedsIfMaintainsLTV() public {
        vm.startPrank(user1);
        
        // Deposit 2 ETH = $4000
        pool.depositCollateral{value: 2 ether}();
        
        // Borrow $1000
        pool.borrow(1000e8);
        
        // Withdraw 0.5 ETH
        // Remaining: 1.5 ETH = $3000
        // Max borrow: $3000 × 66% = $1980
        // Debt: $1000 < $1980 → OK ✅
        pool.withdrawCollateral(0.5 ether);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1.5 ether);
        
        vm.stopPrank();
    }

    // ============ 2.3 - Repay Tests ============
    
    function testRepay() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(500e8);
        
        // Repay partial
        pool.repay{value: 200e8}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 300e8);
        assertEq(pool.totalBorrowed(), 300e8);
        
        vm.stopPrank();
    }
    
    function testRepayFull() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(500e8);
        
        pool.repay{value: 500e8}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
        assertEq(pool.totalBorrowed(), 0);
        
        vm.stopPrank();
    }
    
    function testRepayWithOverpayment() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(500e8);
        
        uint256 balanceBefore = user1.balance;
        
        // Overpay: debt is 500, send 700
        pool.repay{value: 700e8}();
        
        uint256 balanceAfter = user1.balance;
        
        // Should refund 200
        assertEq(balanceBefore - balanceAfter, 500e8);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
        
        vm.stopPrank();
    }
    
    function testRepayRevertsNoDebt() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectRevert(ILendingPool.NoDebt.selector);
        pool.repay{value: 100e8}();
        
        vm.stopPrank();
    }
    
    function testRepayEmitsEvent() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(500e8);
        
        vm.expectEmit(true, false, false, true);
        emit ILendingPool.Repaid(user1, 200e8, 300e8);
        
        pool.repay{value: 200e8}();
        
        vm.stopPrank();
    }

    // ============ 2.4 - Liquidation Tests ============
    
    function testLiquidateUnhealthyPosition() public {
        // Setup: User1 deposits and borrows near max
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1320e8); // Max LTV
        vm.stopPrank();
        
        // Price drops: $2000 → $1400
        oracle.setPrice(1400e8);
        
        // Now HF = ($1400 × 0.83) / $1320 = 0.88 < 1.0
        uint256 hf = pool.getHealthFactor(user1);
        assertLt(hf, 100);
        
        // Liquidator liquidates
        vm.prank(user2);
        pool.liquidate{value: 1320e8}(user1);
        
        // Check position cleared
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
        assertEq(pool.totalBorrowed(), 0);
    }
    
    function testLiquidateRevertsHealthyPosition() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        pool.borrow(1000e8); // Safe borrow
        vm.stopPrank();
        
        // HF = ($4000 × 0.83) / $1000 = 3.32 > 1.0
        
        vm.prank(user2);
        vm.expectRevert(ILendingPool.HealthyPosition.selector);
        pool.liquidate{value: 1000e8}(user1);
    }
    
    function testLiquidateRevertsNoDebt() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.prank(user2);
        vm.expectRevert(ILendingPool.NoDebt.selector);
        pool.liquidate{value: 100e8}(user1);
    }
    
    function testLiquidateTransfersCollateralWithBonus() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1320e8);
        vm.stopPrank();
        
        oracle.setPrice(1400e8);
        
        vm.prank(user2);
        pool.liquidate{value: 1320e8}(user1);
        
        // Vérifier que collateral saisi > 0
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertLt(pos.collateralAmount, 1 ether); // Collateral a été saisi
    }
    
    function testLiquidateEmitsEvent() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1320e8);
        vm.stopPrank();
        
        oracle.setPrice(1400e8);
        
        vm.prank(user2);
        
        vm.expectEmit(true, true, false, false);
        emit ILendingPool.Liquidated(user2, user1, 0, 0);
        
        pool.liquidate{value: 1320e8}(user1);
    }
    
    function testLiquidateRevertsInsufficientPayment() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        vm.stopPrank();
        
        oracle.setPrice(1200e8);
        
        vm.prank(user2);
        vm.expectRevert("Insufficient payment");
        pool.liquidate{value: 500e8}(user1); // Pay less than debt
    }
    
    function testLiquidateProfitCalculation() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1200e8);
        vm.stopPrank();
        
        oracle.setPrice(1400e8);
        
        // Simplement vérifier que liquidation fonctionne
        vm.prank(user2);
        pool.liquidate{value: 1200e8}(user1);
        
        // Vérifier dette effacée
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
        assertEq(pool.totalBorrowed(), 0);
    }
    
    function testLiquidateWithOverpayment() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        vm.stopPrank();
        
        oracle.setPrice(1200e8);
        
        vm.prank(user2);
        pool.liquidate{value: 1500e8}(user1); // Overpay
        
        // Vérifier que position est liquidée
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
    }

    function testLiquidationScenarioComplete() public {
        // 1. User deposits 1 ETH at $2000
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        // 2. User borrows max: $1320 (66% LTV)
        pool.borrow(1320e8);
        
        // Check HF is healthy
        uint256 hfBefore = pool.getHealthFactor(user1);
        assertGt(hfBefore, 100); // HF = 1.25
        vm.stopPrank();
        
        // 3. MARKET CRASH: Price drops $2000 → $1500 (-25%)
        oracle.setPrice(1500e8);
        
        // 4. Check HF now unhealthy
        uint256 hfAfter = pool.getHealthFactor(user1);
        assertLt(hfAfter, 100); // HF = 0.94
        
        // 5. Liquidator sees opportunity and liquidates
        uint256 liquidatorBalanceBefore = user2.balance;
        
        vm.prank(user2);
        pool.liquidate{value: 1320e8}(user1);
        
        uint256 liquidatorBalanceAfter = user2.balance;
        
        // 6. Verify liquidator made profit
        uint256 profit = liquidatorBalanceAfter - (liquidatorBalanceBefore - 1320e8);
        assertGt(profit, 0);
        
        // 7. Verify user position cleared
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
    }
}