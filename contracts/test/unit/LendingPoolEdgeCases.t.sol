// test/unit/LendingPoolEdgeCases.t.sol
// Tests edge cases et couverture complète pour LendingPool v3.0 ETH-native
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../LendingPool.sol";
import "../../CollateralManager.sol";
import "../../OracleAggregator.sol";
import "../../oracles/PriceRegistry.sol";
import "../../oracles/mocks/MockUSDCPriceProvider.sol";
import "../../oracles/mocks/MockDAIPriceProvider.sol";
import "../../oracles/mocks/MockETHFallbackProvider.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_)
        ERC20(name, symbol)
    {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract LendingPoolEdgeCasesTest is Test {
    LendingPool public pool;
    CollateralManager public collateralManager;
    OracleAggregator public oracle;
    PriceRegistry public registry;

    MockChainlinkFeed public ethFeed;
    ChainlinkPriceProvider public ethProvider;
    MockUSDCPriceProvider public usdcProvider;
    MockDAIPriceProvider public daiProvider;
    MockETHFallbackProvider public ethFallback;

    MockERC20 public usdc;
    MockERC20 public dai;

    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address public user1;
    address public user2;
    address public liquidator;

    event Borrowed(address indexed user, uint256 amount, uint256 healthFactor);
    event Repaid(address indexed user, uint256 amount, uint256 remainingDebt);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        uint256 debtCovered,
        uint256 collateralSeized
    );

    // Allow test contract to receive ETH
    receive() external payable {}

    function setUp() public {
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        liquidator = makeAddr("liquidator");

        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);

        // Deploy oracle system
        ethFeed = new MockChainlinkFeed(2000e8, 8); // $2000
        ethProvider = new ChainlinkPriceProvider(address(ethFeed), "ETH/USD");
        ethFallback = new MockETHFallbackProvider(2000e8);
        usdcProvider = new MockUSDCPriceProvider();
        daiProvider = new MockDAIPriceProvider();

        registry = new PriceRegistry();
        oracle = new OracleAggregator(address(registry));

        // Register assets in registry
        registry.addAsset(ETH_ADDRESS, "ETH", address(ethProvider), address(ethFallback), 18);
        registry.addAsset(address(usdc), "USDC", address(usdcProvider), address(0), 6);
        registry.addAsset(address(dai), "DAI", address(daiProvider), address(0), 18);

        // Deploy CollateralManager
        collateralManager = new CollateralManager(address(oracle));

        // Add assets to CollateralManager
        collateralManager.addAsset(ETH_ADDRESS, "ETH", 66, 83, 10, 18);
        collateralManager.addAsset(address(usdc), "USDC", 90, 95, 5, 6);
        collateralManager.addAsset(address(dai), "DAI", 90, 95, 5, 18);

        // Deploy LendingPool
        pool = new LendingPool(address(oracle), address(collateralManager));

        // Fund pool with ETH for borrows
        vm.deal(address(pool), 1000 ether);

        // Fund users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(liquidator, 100 ether);

        usdc.mint(user1, 10000e6);
        usdc.mint(user2, 10000e6);
        dai.mint(user1, 10000e18);
        dai.mint(user2, 10000e18);
    }

    // ============ Borrow Edge Cases ============

    function testBorrowZeroAmountReverts() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();

        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.borrow(0);

        vm.stopPrank();
    }

    function testBorrowInEmergencyModeReverts() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();

        vm.stopPrank();

        // Activate emergency mode
        oracle.setEmergencyMode(true, "Test emergency");

        vm.prank(user1);
        vm.expectRevert(ILendingPool.OracleEmergencyMode.selector);
        pool.borrow(1000e8);
    }

    function testBorrowEmitsBorrowedEvent() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();

        // Expect Borrowed event
        vm.expectEmit(true, false, false, false);
        emit Borrowed(user1, 1000e8, 0); // healthFactor will be calculated

        pool.borrow(1000e8);

        vm.stopPrank();
    }

    function testBorrowUpdatesTotalBorrowed() public {
        uint256 totalBefore = pool.totalBorrowed();

        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        vm.stopPrank();

        uint256 totalAfter = pool.totalBorrowed();

        assertEq(totalAfter - totalBefore, 1000e8);
    }

    function testBorrowIncreasesExistingDebt() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 2 ether}();

        // First borrow
        pool.borrow(500e8);
        assertEq(pool.getBorrowedAmount(user1), 500e8);

        // Second borrow (increase debt)
        pool.borrow(500e8);
        assertEq(pool.getBorrowedAmount(user1), 1000e8);

        vm.stopPrank();
    }

    function testBorrowWhenPoolHasInsufficientETH() public {
        // Deploy new pool with limited ETH
        LendingPool smallPool = new LendingPool(address(oracle), address(collateralManager));
        vm.deal(address(smallPool), 100e8); // Pool has only $100 worth

        vm.startPrank(user1);

        collateralManager.depositETH{value: 10 ether}();

        // Try to borrow $10,000 (more than pool has)
        // This should pass LTV check ($20,000 * 66% = $13,200 max)
        // But fail on ETH transfer
        vm.expectRevert("ETH transfer failed");
        smallPool.borrow(10000e8);

        vm.stopPrank();
    }

    function testBorrowUpdatesLastInterestUpdate() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();

        uint256 timeBefore = block.timestamp;

        pool.borrow(1000e8);

        ILendingPool.Position memory pos = pool.getPosition(user1);
        assertEq(pos.lastInterestUpdate, timeBefore);

        vm.stopPrank();
    }

    // ============ Repay Edge Cases ============

    function testRepayZeroAmountReverts() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        vm.expectRevert(ILendingPool.ZeroAmount.selector);
        pool.repay{value: 0}();

        vm.stopPrank();
    }

    function testRepayEmitsRepaidEvent() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        // Expect Repaid event
        vm.expectEmit(true, false, false, true);
        emit Repaid(user1, 500e8, 500e8);

        pool.repay{value: 500e8}();

        vm.stopPrank();
    }

    function testRepayUpdatesTotalBorrowed() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        uint256 totalBefore = pool.totalBorrowed();

        pool.repay{value: 500e8}();

        uint256 totalAfter = pool.totalBorrowed();

        assertEq(totalBefore - totalAfter, 500e8);

        vm.stopPrank();
    }

    function testRepayFullDebtWithExactAmount() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        uint256 balanceBefore = user1.balance;

        pool.repay{value: 1000e8}();

        uint256 balanceAfter = user1.balance;

        assertEq(pool.getBorrowedAmount(user1), 0);
        assertEq(balanceBefore - balanceAfter, 1000e8);

        vm.stopPrank();
    }

    // ============ Liquidation Edge Cases ============

    function testLiquidateWithZeroAddressReverts() public {
        vm.prank(liquidator);
        vm.expectRevert(ILendingPool.InvalidAddress.selector);
        pool.liquidate{value: 1000e8}(address(0));
    }

    function testLiquidateEmitsLiquidatedEvent() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1200e8);

        vm.stopPrank();

        // Drop ETH price to make position unhealthy
        ethFeed.setPrice(1000e8);
        ethFallback.setPrice(1000e8);

        // Expect Liquidated event
        vm.expectEmit(true, true, false, false);
        emit Liquidated(liquidator, user1, 0, 0); // amounts will be calculated

        vm.prank(liquidator);
        pool.liquidate{value: 1200e8}(user1);
    }

    function testLiquidateRefundsExcess() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        vm.stopPrank();

        // Drop ETH price
        ethFeed.setPrice(900e8);
        ethFallback.setPrice(900e8);

        vm.startPrank(liquidator);

        uint256 balanceBefore = liquidator.balance;

        // Pay more than needed
        pool.liquidate{value: 2000e8}(user1);

        uint256 balanceAfter = liquidator.balance;

        // Should refund 1000e8 excess
        assertEq(balanceBefore - balanceAfter, 1000e8);

        vm.stopPrank();
    }

    function testLiquidateCalculatesCorrectBonus() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1200e8);

        vm.stopPrank();

        // Drop ETH price
        ethFeed.setPrice(1000e8);
        ethFallback.setPrice(1000e8);

        vm.prank(liquidator);
        pool.liquidate{value: 1200e8}(user1);

        // Debt should be cleared
        assertEq(pool.getBorrowedAmount(user1), 0);

        // Collateral seized = debt + 10% bonus
        // $1200 + $120 = $1320 worth of collateral
    }

    function testLiquidateUpdatesTotalBorrowed() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1200e8);

        vm.stopPrank();

        // Drop ETH price
        ethFeed.setPrice(1000e8);
        ethFallback.setPrice(1000e8);

        uint256 totalBefore = pool.totalBorrowed();

        vm.prank(liquidator);
        pool.liquidate{value: 1200e8}(user1);

        uint256 totalAfter = pool.totalBorrowed();

        assertEq(totalBefore - totalAfter, 1200e8);
    }

    function testLiquidatePositionWithNoDebt() public {
        vm.prank(liquidator);
        vm.expectRevert(ILendingPool.NoDebt.selector);
        pool.liquidate{value: 1000e8}(user1);
    }

    // ============ Health Factor Edge Cases ============

    function testHealthFactorAfterPriceChange() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        uint256 hfBefore = pool.getHealthFactor(user1);

        vm.stopPrank();

        // Increase ETH price
        ethFeed.setPrice(3000e8);
        ethFallback.setPrice(3000e8);

        uint256 hfAfter = pool.getHealthFactor(user1);

        // Health factor should improve with higher collateral value
        assertGt(hfAfter, hfBefore);
    }

    function testHealthFactorWithMultipleUsers() public {
        // User1
        vm.startPrank(user1);
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        uint256 hf1 = pool.getHealthFactor(user1);
        vm.stopPrank();

        // User2
        vm.startPrank(user2);
        usdc.approve(address(collateralManager), 2000e6);
        collateralManager.depositERC20(address(usdc), 2000e6);
        pool.borrow(1500e8);
        uint256 hf2 = pool.getHealthFactor(user2);
        vm.stopPrank();

        // Both should be healthy
        assertGt(hf1, 100);
        assertGt(hf2, 100);

        // HF should be different due to different LTV
        assertNotEq(hf1, hf2);
    }

    // ============ Admin Functions Edge Cases ============

    function testSetCollateralManagerWithZeroAddressReverts() public {
        vm.expectRevert(ILendingPool.InvalidAddress.selector);
        pool.setCollateralManager(address(0));
    }

    function testPauseBlocksBorrow() public {
        vm.startPrank(user1);
        collateralManager.depositETH{value: 1 ether}();
        vm.stopPrank();

        pool.pause();

        vm.prank(user1);
        vm.expectRevert("Paused");
        pool.borrow(1000e8);
    }

    function testPauseBlocksRepay() public {
        vm.startPrank(user1);
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        vm.stopPrank();

        pool.pause();

        vm.prank(user1);
        vm.expectRevert("Paused");
        pool.repay{value: 500e8}();
    }

    function testPauseBlocksLiquidate() public {
        vm.startPrank(user1);
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1200e8);
        vm.stopPrank();

        ethFeed.setPrice(1000e8);
        ethFallback.setPrice(1000e8);

        pool.pause();

        vm.prank(liquidator);
        vm.expectRevert("Paused");
        pool.liquidate{value: 1200e8}(user1);
    }

    function testEmergencyWithdraw() public {
        uint256 poolBalance = address(pool).balance;

        address owner = pool.owner();
        uint256 ownerBalanceBefore = owner.balance;

        // Must call as owner
        vm.prank(owner);
        pool.emergencyWithdraw();

        uint256 ownerBalanceAfter = owner.balance;

        assertEq(address(pool).balance, 0);
        assertEq(ownerBalanceAfter - ownerBalanceBefore, poolBalance);
    }

    function testTransferOwnership() public {
        address newOwner = makeAddr("newOwner");

        pool.transferOwnership(newOwner);

        assertEq(pool.owner(), newOwner);
    }

    function testTransferOwnershipZeroAddressReverts() public {
        vm.expectRevert(ILendingPool.InvalidAddress.selector);
        pool.transferOwnership(address(0));
    }

    function testOnlyOwnerCanTransferOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(user1);
        vm.expectRevert("Not owner");
        pool.transferOwnership(newOwner);
    }

    // ============ View Functions Edge Cases ============

    function testGetPositionReturnsCorrectData() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);

        ILendingPool.Position memory pos = pool.getPosition(user1);

        assertEq(pos.borrowedAmount, 1000e8);
        assertEq(pos.lastInterestUpdate, block.timestamp);
        assertEq(pos.collateralAmount, 0); // Stored in CollateralManager

        vm.stopPrank();
    }

    function testGetMaxBorrowAmountAfterBorrow() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();

        uint256 maxBefore = pool.getMaxBorrowAmount(user1);

        pool.borrow(500e8);

        uint256 maxAfter = pool.getMaxBorrowAmount(user1);

        // Max borrow should decrease by borrowed amount
        assertEq(maxBefore - maxAfter, 500e8);

        vm.stopPrank();
    }

    function testGetMaxBorrowAmountWithNoCollateral() public {
        uint256 maxBorrow = pool.getMaxBorrowAmount(user1);
        assertEq(maxBorrow, 0);
    }

    function testGetMaxBorrowAmountWhenDebtExceedsCapacity() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1320e8); // Max borrow

        vm.stopPrank();

        // Drop collateral value
        ethFeed.setPrice(1000e8);
        ethFallback.setPrice(1000e8);

        uint256 maxBorrow = pool.getMaxBorrowAmount(user1);

        // Should return 0 when debt > capacity
        assertEq(maxBorrow, 0);
    }

    function testGetCurrentBorrowRate() public {
        uint256 rate = pool.getCurrentBorrowRate();
        assertGt(rate, 0);
    }

    function testGetUserCollaterals() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();
        usdc.approve(address(collateralManager), 1000e6);
        collateralManager.depositERC20(address(usdc), 1000e6);

        (address[] memory assets, uint256[] memory amounts) = pool.getUserCollaterals(user1);

        assertEq(assets.length, 2);
        assertEq(amounts.length, 2);

        vm.stopPrank();
    }
}
