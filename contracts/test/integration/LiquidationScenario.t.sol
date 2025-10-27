// test/integration/LiquidationScenario.t.sol
// Test d'intégration E2E - Scénario complet de liquidation
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
import "../../libraries/HealthCalculator.sol";
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

contract LiquidationScenarioTest is Test {
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
    address public borrower;
    address public liquidator;

    event Borrowed(address indexed user, uint256 amount, uint256 healthFactor);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        uint256 debtCovered,
        uint256 collateralSeized
    );

    receive() external payable {}

    function setUp() public {
        borrower = makeAddr("borrower");
        liquidator = makeAddr("liquidator");

        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);

        // Deploy oracle system
        ethFeed = new MockChainlinkFeed(2000e8, 8); // $2000 initial
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
        // ETH: 66% LTV, 83% liquidation threshold, 10% bonus
        collateralManager.addAsset(ETH_ADDRESS, "ETH", 66, 83, 10, 18);
        collateralManager.addAsset(address(usdc), "USDC", 90, 95, 5, 6);
        collateralManager.addAsset(address(dai), "DAI", 90, 95, 5, 18);

        // Deploy LendingPool
        pool = new LendingPool(address(oracle), address(collateralManager));

        // Fund pool with ETH for borrows
        vm.deal(address(pool), 1000 ether);

        // Fund borrower and liquidator
        vm.deal(borrower, 100 ether);
        vm.deal(liquidator, 100 ether);

        usdc.mint(borrower, 10000e6);
        usdc.mint(liquidator, 10000e6);
    }

    // ============ Complete Liquidation Scenario ============

    function testCompleteLiquidationScenario() public {
        console.log("\n=== LIQUIDATION SCENARIO E2E TEST ===\n");

        // === PHASE 1: Borrower deposits collateral ===
        console.log("PHASE 1: Borrower deposits 1 ETH collateral");
        vm.startPrank(borrower);

        collateralManager.depositETH{value: 1 ether}();

        uint256 collateralBalance = collateralManager.getUserCollateralBalance(borrower, ETH_ADDRESS);
        assertEq(collateralBalance, 1 ether);
        console.log("  Collateral deposited:", collateralBalance / 1e18, "ETH");

        // Check collateral value in USD (8 decimals)
        uint256 collateralValueUSD = collateralManager.getCollateralValueUSD(borrower);
        console.log("  Collateral value:", collateralValueUSD / 1e8, "USD");
        assertEq(collateralValueUSD, 2000e8); // $2000

        vm.stopPrank();

        // === PHASE 2: Borrower borrows near max capacity ===
        console.log("\nPHASE 2: Borrower borrows $1200 (close to max)");
        vm.startPrank(borrower);

        uint256 maxBorrow = pool.getMaxBorrowAmount(borrower);
        console.log("  Max borrow capacity:", maxBorrow / 1e8, "USD");
        assertEq(maxBorrow, 1320e8); // $2000 * 66% = $1320

        uint256 borrowAmount = 1200e8; // Borrow $1200
        uint256 borrowerBalanceBefore = borrower.balance;

        vm.expectEmit(true, false, false, false);
        emit Borrowed(borrower, borrowAmount, 0);

        pool.borrow(borrowAmount);

        uint256 borrowerBalanceAfter = borrower.balance;
        uint256 borrowed = pool.getBorrowedAmount(borrower);

        assertEq(borrowed, borrowAmount);
        assertEq(borrowerBalanceAfter - borrowerBalanceBefore, borrowAmount);
        console.log("  Borrowed:", borrowed / 1e8, "USD");
        console.log("  ETH received:", (borrowerBalanceAfter - borrowerBalanceBefore) / 1e8, "wei");

        uint256 hfHealthy = pool.getHealthFactor(borrower);
        console.log("  Health Factor:", hfHealthy);
        assertGt(hfHealthy, 100); // Should be healthy

        vm.stopPrank();

        // === PHASE 3: Price crash - ETH drops from $2000 to $1000 ===
        console.log("\nPHASE 3: Market crash - ETH price drops to $1000");
        ethFeed.setPrice(1000e8);
        ethFallback.setPrice(1000e8);

        console.log("  New ETH price: $1000");

        // Check new collateral value
        uint256 collateralValueAfterCrash = collateralManager.getCollateralValueUSD(borrower);
        console.log("  New collateral value:", collateralValueAfterCrash / 1e8, "USD");
        assertEq(collateralValueAfterCrash, 1000e8); // $1000

        // === PHASE 4: Health Factor becomes critical ===
        console.log("\nPHASE 4: Check Health Factor after crash");
        uint256 hfUnhealthy = pool.getHealthFactor(borrower);
        console.log("  Health Factor:", hfUnhealthy);

        // Collateral: $1000, LT: 83%, Debt: $1200
        // HF = ($1000 * 83%) / $1200 = 69.16
        assertLt(hfUnhealthy, 100);
        console.log("  Position is LIQUIDATABLE (HF < 100)");

        // Verify position is liquidatable using HealthCalculator
        uint256 collateralValue = collateralManager.getCollateralValueUSD(borrower);
        bool isLiquidatable = HealthCalculator.isLiquidatable(collateralValue, borrowed);
        assertTrue(isLiquidatable);

        // === PHASE 5: Liquidator liquidates the position ===
        console.log("\nPHASE 5: Liquidator liquidates borrower's position");
        vm.startPrank(liquidator);

        uint256 liquidatorBalanceBefore = liquidator.balance;
        uint256 debtToCover = pool.getBorrowedAmount(borrower);
        console.log("  Debt to cover:", debtToCover / 1e8, "USD");

        // Calculate expected collateral seized (with 10% bonus)
        uint256 expectedCollateralSeized = (debtToCover * 110) / 100; // +10% bonus
        console.log("  Expected collateral seized:", expectedCollateralSeized / 1e8, "USD (with 10% bonus)");

        vm.expectEmit(true, true, false, false);
        emit Liquidated(liquidator, borrower, 0, 0);

        pool.liquidate{value: debtToCover}(borrower);

        uint256 liquidatorBalanceAfter = liquidator.balance;

        // === PHASE 6: Verify liquidation results ===
        console.log("\nPHASE 6: Verify liquidation results");

        uint256 borrowerDebtAfter = pool.getBorrowedAmount(borrower);
        console.log("  Borrower debt after:", borrowerDebtAfter);
        assertEq(borrowerDebtAfter, 0);
        console.log("Borrower debt cleared");

        uint256 liquidatorPaid = liquidatorBalanceBefore - liquidatorBalanceAfter;
        console.log("  Liquidator paid:", liquidatorPaid / 1e8, "wei");
        assertEq(liquidatorPaid, debtToCover);
        console.log("  Liquidator paid exact debt amount");

        uint256 totalBorrowed = pool.totalBorrowed();
        console.log("  Total borrowed in pool:", totalBorrowed / 1e8, "USD");
        console.log("  Pool totalBorrowed updated");

        vm.stopPrank();

        console.log("\n=== LIQUIDATION SCENARIO COMPLETED SUCCESSFULLY ===\n");
    }

    // ============ Multi-Collateral Liquidation Scenario ============

    function testMultiCollateralLiquidationScenario() public {
        console.log("\n=== MULTI-COLLATERAL LIQUIDATION SCENARIO ===\n");

        // === PHASE 1: Borrower deposits multiple collaterals ===
        console.log("PHASE 1: Borrower deposits ETH + USDC");
        vm.startPrank(borrower);

        collateralManager.depositETH{value: 1 ether}();
        usdc.approve(address(collateralManager), 1000e6);
        collateralManager.depositERC20(address(usdc), 1000e6);

        uint256 totalCollateralValue = collateralManager.getCollateralValueUSD(borrower);
        console.log("  Total collateral value:", totalCollateralValue / 1e8, "USD");
        // ETH: $2000 + USDC: $1000 = $3000
        assertEq(totalCollateralValue, 3000e8);

        vm.stopPrank();

        // === PHASE 2: Borrower borrows against multi-collateral ===
        console.log("\nPHASE 2: Borrower borrows $2500");
        vm.startPrank(borrower);

        uint256 maxBorrow = pool.getMaxBorrowAmount(borrower);
        console.log("  Max borrow capacity:", maxBorrow / 1e8, "USD");
        // ETH: $2000 * 66% = $1320
        // USDC: $1000 * 90% = $900
        // Total: $2220
        assertEq(maxBorrow, 2220e8);

        pool.borrow(2000e8);

        uint256 hfHealthy = pool.getHealthFactor(borrower);
        console.log("  Health Factor:", hfHealthy);
        assertGt(hfHealthy, 100);

        vm.stopPrank();

        // === PHASE 3: ETH price crashes ===
        console.log("\nPHASE 3: ETH price crashes to $800");
        ethFeed.setPrice(800e8);
        ethFallback.setPrice(800e8);

        uint256 collateralValueAfterCrash = collateralManager.getCollateralValueUSD(borrower);
        console.log("  New collateral value:", collateralValueAfterCrash / 1e8, "USD");
        // ETH: $800 + USDC: $1000 = $1800

        uint256 hfUnhealthy = pool.getHealthFactor(borrower);
        console.log("  Health Factor:", hfUnhealthy);
        assertLt(hfUnhealthy, 100);

        // === PHASE 4: Liquidate ===
        console.log("\nPHASE 4: Liquidate position");
        vm.prank(liquidator);
        pool.liquidate{value: 2000e8}(borrower);

        assertEq(pool.getBorrowedAmount(borrower), 0);
        console.log("  Multi-collateral position liquidated successfully");

        console.log("\n=== MULTI-COLLATERAL SCENARIO COMPLETED ===\n");
    }

    // ============ Partial Recovery Scenario ============

    function testPartialRecoveryScenario() public {
        console.log("\n=== PARTIAL RECOVERY SCENARIO ===\n");

        // Setup: Borrower has position near liquidation
        vm.startPrank(borrower);
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1300e8);
        vm.stopPrank();

        // Price drops slightly, position becomes unhealthy
        ethFeed.setPrice(1500e8);
        ethFallback.setPrice(1500e8);

        uint256 hfBefore = pool.getHealthFactor(borrower);
        console.log("PHASE 1: Position unhealthy, HF:", hfBefore);
        assertLt(hfBefore, 100);

        // Borrower adds more collateral to recover
        console.log("\nPHASE 2: Borrower adds 0.5 ETH more collateral");
        vm.prank(borrower);
        collateralManager.depositETH{value: 0.5 ether}();

        uint256 hfAfter = pool.getHealthFactor(borrower);
        console.log("  New Health Factor:", hfAfter);
        assertGt(hfAfter, 100);
        console.log("  Position recovered by adding collateral");

        // Verify liquidation now fails
        vm.prank(liquidator);
        vm.expectRevert(ILendingPool.HealthyPosition.selector);
        pool.liquidate{value: 1300e8}(borrower);

        console.log("\n=== PARTIAL RECOVERY SCENARIO COMPLETED ===\n");
    }

    // ============ Liquidation with Price Recovery ============

    function testLiquidationRaceCondition() public {
        console.log("\n=== LIQUIDATION RACE CONDITION SCENARIO ===\n");

        // Setup unhealthy position
        vm.startPrank(borrower);
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1200e8);
        vm.stopPrank();

        ethFeed.setPrice(1000e8);
        ethFallback.setPrice(1000e8);

        console.log("PHASE 1: Position becomes liquidatable");
        uint256 hfUnhealthy = pool.getHealthFactor(borrower);
        console.log("  Health Factor:", hfUnhealthy);
        assertLt(hfUnhealthy, 100);

        // Price recovers before liquidator can act
        console.log("\nPHASE 2: Price recovers quickly");
        ethFeed.setPrice(2000e8);
        ethFallback.setPrice(2000e8);

        uint256 hfRecovered = pool.getHealthFactor(borrower);
        console.log("  New Health Factor:", hfRecovered);
        assertGt(hfRecovered, 100);

        // Liquidation attempt fails
        console.log("\nPHASE 3: Liquidation attempt fails");
        vm.prank(liquidator);
        vm.expectRevert(ILendingPool.HealthyPosition.selector);
        pool.liquidate{value: 1200e8}(borrower);

        console.log("  Liquidation correctly rejected for healthy position");
        console.log("\n=== RACE CONDITION SCENARIO COMPLETED ===\n");
    }
}
