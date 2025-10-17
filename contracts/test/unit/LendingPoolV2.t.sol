// test/unit/LendingPoolV2.t.sol - v1.0 - Complete tests
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../LendingPoolV2.sol";
import "../../OracleAggregator.sol";
import "../../oracles/PriceRegistry.sol";
import "../../oracles/mocks/MockUSDCPriceProvider.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";
import "../../oracles/ChainlinkPriceProvider.sol";

contract LendingPoolV2Test is Test {
    LendingPoolV2 pool;
    OracleAggregator aggregator;
    PriceRegistry registry;
    ChainlinkPriceProvider ethProvider;
    MockChainlinkFeed mockChainlink;
    
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    address owner = address(this);
    address user1 = address(0x1);
    address user2 = address(0x2);
    
    function setUp() public {
        // Setup simple oracle
        mockChainlink = new MockChainlinkFeed(2000e8, 8);
        ethProvider = new ChainlinkPriceProvider(address(mockChainlink), "ETH/USD");
        
        registry = new PriceRegistry();
        registry.addAsset(WETH, "WETH", address(ethProvider), address(0), 18);
        
        aggregator = new OracleAggregator(address(registry));
        
        pool = new LendingPoolV2(address(aggregator));
        
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }
    
    // ============ Constructor Tests ============
    
    function testConstructorSetsOracle() public view {
        assertEq(address(pool.oracle()), address(aggregator));
        assertEq(pool.owner(), owner);
    }
    
    function testConstructorRevertsZeroAddress() public {
        vm.expectRevert(ILendingPool.InvalidAddress.selector);
        new LendingPoolV2(address(0));
    }
    
    function testInitialStateCorrect() public view {
        assertFalse(pool.paused());
        assertEq(pool.totalCollateral(), 0);
        assertEq(pool.totalBorrowed(), 0);
    }
    
    // ============ Deposit Collateral Tests ============
    
    function testDepositCollateralSuccess() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1 ether);
    }
    
    function testDepositCollateralEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ILendingPool.CollateralDeposited(user1, 1 ether, block.timestamp);
        
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
    }
    
    function testDepositCollateralRevertsZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.depositCollateral{value: 0}();
    }
    
    function testDepositCollateralUpdatesTotalCollateral() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        assertEq(pool.totalCollateral(), 1 ether);
    }
    
    function testDepositCollateralMultipleTimes() public {
        vm.startPrank(user1);
        
        pool.depositCollateral{value: 1 ether}();
        pool.depositCollateral{value: 0.5 ether}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1.5 ether);
        
        vm.stopPrank();
    }
    
    // ============ Borrow Tests ============
    
    function testBorrowSuccess() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 1000e8);
        
        vm.stopPrank();
    }
    
    function testBorrowEmitsEvent() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectEmit(true, false, false, false);
        emit ILendingPool.Borrowed(user1, 1000e8, 0);
        
        pool.borrow(1000e8);
        vm.stopPrank();
    }
    
    function testBorrowRevertsZeroAmount() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.borrow(0);
        
        vm.stopPrank();
    }
    
    function testBorrowRevertsWithoutCollateral() public {
        vm.prank(user1);
        vm.expectRevert(ILendingPool.InsufficientCollateral.selector);
        pool.borrow(100e8);
    }
    
    function testBorrowRevertsExceedsLTV() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        // Max = 2000 * 0.66 = 1320e8
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.borrow(1400e8);
        
        vm.stopPrank();
    }
    
    function testBorrowUpdatesTotalBorrowed() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        
        assertEq(pool.totalBorrowed(), 1000e8);
        
        vm.stopPrank();
    }
    
    function testBorrowUpdatesLastInterestUpdate() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.lastInterestUpdate, block.timestamp);
        
        vm.stopPrank();
    }
    
    // ============ Repay Tests ============
    
    function testRepaySuccess() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        pool.repay{value: 500e8}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 500e8);
        
        vm.stopPrank();
    }
    
    function testRepayEmitsEvent() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        
        vm.expectEmit(true, false, false, true);
        emit ILendingPool.Repaid(user1, 500e8, 500e8);
        
        pool.repay{value: 500e8}();
        vm.stopPrank();
    }
    
    function testRepayRevertsZeroAmount() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        
        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.repay{value: 0}();
        
        vm.stopPrank();
    }
    
    function testRepayRevertsNoDebt() public {
        vm.expectRevert(ILendingPool.NoDebt.selector);
        
        vm.prank(user1);
        pool.repay{value: 100e8}();
    }
    
    function testRepayFullAmount() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        pool.repay{value: 1000e8}();
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.borrowedAmount, 0);
        
        vm.stopPrank();
    }
    
    function testRepayRefundsExcess() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(500e8);
        
        uint256 balanceBefore = user1.balance;
        pool.repay{value: 1000e8}();
        uint256 balanceAfter = user1.balance;
        
        // Should refund 500e8
        assertEq(balanceBefore - balanceAfter, 500e8);
        
        vm.stopPrank();
    }
    
    function testRepayUpdatesTotalBorrowed() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(1000e8);
        pool.repay{value: 500e8}();
        
        assertEq(pool.totalBorrowed(), 500e8);
        
        vm.stopPrank();
    }
    
    // ============ Withdraw Collateral Tests ============
    
    function testWithdrawCollateralSuccess() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        pool.withdrawCollateral(1 ether);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.collateralAmount, 1 ether);
        
        vm.stopPrank();
    }
    
    function testWithdrawCollateralEmitsEvent() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        
        vm.expectEmit(true, false, false, true);
        emit ILendingPool.CollateralWithdrawn(user1, 1 ether);
        
        pool.withdrawCollateral(1 ether);
        vm.stopPrank();
    }
    
    function testWithdrawCollateralRevertsZeroAmount() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.withdrawCollateral(0);
        
        vm.stopPrank();
    }
    
    function testWithdrawCollateralRevertsInsufficientCollateral() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        vm.expectRevert(ILendingPool.InsufficientCollateral.selector);
        pool.withdrawCollateral(2 ether);
        
        vm.stopPrank();
    }
    
    function testWithdrawCollateralRevertsIfBreaksLTV() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        pool.borrow(2000e8);
        
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.withdrawCollateral(1.5 ether);
        
        vm.stopPrank();
    }
    
    function testWithdrawCollateralUpdatesTotalCollateral() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 2 ether}();
        pool.withdrawCollateral(1 ether);
        
        assertEq(pool.totalCollateral(), 1 ether);
        
        vm.stopPrank();
    }
    
    // ============ Pause/Unpause Tests ============
    
    function testPause() public {
        pool.pause();
        assertTrue(pool.paused());
    }
    
    function testUnpause() public {
        pool.pause();
        pool.unpause();
        assertFalse(pool.paused());
    }
    
    function testPauseOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert("Not owner");
        pool.pause();
    }
    
    function testUnpauseOnlyOwner() public {
        pool.pause();
        
        vm.prank(user1);
        vm.expectRevert("Not owner");
        pool.unpause();
    }
    
    function testDepositRevertsWhenPaused() public {
        pool.pause();
        
        vm.prank(user1);
        vm.expectRevert("Paused");
        pool.depositCollateral{value: 1 ether}();
    }
    
    function testBorrowRevertsWhenPaused() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        pool.pause();
        
        vm.prank(user1);
        vm.expectRevert("Paused");
        pool.borrow(100e8);
    }
    
    // ============ Ownership Tests ============
    
    function testTransferOwnership() public {
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
        pool.transferOwnership(user1);
    }
    
    // ============ View Functions Tests ============
    
    function testGetPositionReturnsCorrectData() public {
        vm.startPrank(user1);
        pool.depositCollateral{value: 1 ether}();
        pool.borrow(500e8);
        
        ILendingPool.Position memory pos = pool.getPosition(user1);
        
        assertEq(pos.collateralAmount, 1 ether);
        assertEq(pos.borrowedAmount, 500e8);
        assertEq(pos.lastInterestUpdate, block.timestamp);
        
        vm.stopPrank();
    }
    
    function testGetHealthFactorInfinity() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        uint256 hf = pool.getHealthFactor(user1);
        assertEq(hf, type(uint256).max);
    }
    
    function testGetCollateralValueUSD() public {
        vm.prank(user1);
        pool.depositCollateral{value: 1 ether}();
        
        uint256 value = pool.getCollateralValueUSD(user1);
        assertEq(value, 2000e8); // 1 ETH * $2000
    }
    
    function testGetCurrentBorrowRate() public view {
        uint256 rate = pool.getCurrentBorrowRate();
        assertEq(rate, 200); // BASE_RATE from DataTypes
    }
    
    // ============ Receive Function Test ============
    
    function testReceiveReverts() public {
        vm.prank(user1);
        (bool success, ) = address(pool).call{value: 1 ether}("");
        assertFalse(success);
    }
}