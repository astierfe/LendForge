// test/LendingPool.t.sol - v1.0
// Tests E2E pour LendingPool multi-collateral
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

contract LendingPoolTest is Test {
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
    
    // ============ Deposit Tests ============
    
    function testDepositETHCollateral() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        
        uint256 balance = collateralManager.getUserCollateralBalance(user1, ETH_ADDRESS);
        assertEq(balance, 1 ether);
        
        vm.stopPrank();
    }
    
    function testDepositUSDCCollateral() public {
        vm.startPrank(user1);
        
        usdc.approve(address(collateralManager), 1000e6);
        collateralManager.depositERC20(address(usdc), 1000e6);
        
        uint256 balance = collateralManager.getUserCollateralBalance(user1, address(usdc));
        assertEq(balance, 1000e6);
        
        vm.stopPrank();
    }
    
    function testDepositMultipleAssets() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        
        usdc.approve(address(collateralManager), 1000e6);
        collateralManager.depositERC20(address(usdc), 1000e6);
        
        dai.approve(address(collateralManager), 500e18);
        collateralManager.depositERC20(address(dai), 500e18);
        
        address[] memory assets = collateralManager.getUserAssets(user1);
        assertEq(assets.length, 3);
        
        vm.stopPrank();
    }
    
    // ============ Borrow Tests ============
    
    function testBorrowWithETHCollateral() public {
        vm.startPrank(user1);
        
        // Deposit 1 ETH ($2000)
        collateralManager.depositETH{value: 1 ether}();
        
        // Max borrow = $2000 * 66% = $1320 (in 8 decimals = 132000000000)
        pool.borrow(1000e8); // Borrow $1000
        
        uint256 borrowed = pool.getBorrowedAmount(user1);
        assertEq(borrowed, 1000e8);
        
        vm.stopPrank();
    }
    
    function testBorrowWithMultiCollateral() public {
        vm.startPrank(user1);
        
        // Deposit 1 ETH ($2000) + 1000 USDC ($1000)
        collateralManager.depositETH{value: 1 ether}();
        usdc.approve(address(collateralManager), 1000e6);
        collateralManager.depositERC20(address(usdc), 1000e6);
        
        // ETH: $2000 * 66% = $1320
        // USDC: $1000 * 90% = $900
        // Total max = $2220
        
        pool.borrow(2000e8); // Borrow $2000
        
        uint256 borrowed = pool.getBorrowedAmount(user1);
        assertEq(borrowed, 2000e8);
        
        vm.stopPrank();
    }
    
    function testCannotBorrowWithoutCollateral() public {
        vm.startPrank(user1);
        
        vm.expectRevert(ILendingPool.InsufficientCollateral.selector);
        pool.borrow(1000e8);
        
        vm.stopPrank();
    }
    
    function testCannotExceedMaxBorrow() public {
        vm.startPrank(user1);

        collateralManager.depositETH{value: 1 ether}();

        // Collateral: 1 ETH @ $2000 = $2000
        // Max borrow: $2000 × 66% = $1320
        // To exceed: borrow > 0.66 ETH (0.75 ETH @ $2000 = $1500 > $1320)
        vm.expectRevert(ILendingPool.ExceedsLTV.selector);
        pool.borrow(0.75 ether);

        vm.stopPrank();
    }
    
    function testGetMaxBorrowAmount() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        
        uint256 maxBorrow = pool.getMaxBorrowAmount(user1);
        
        // $2000 * 66% = $1320 in 8 decimals
        assertEq(maxBorrow, 132000000000);
        
        vm.stopPrank();
    }
    
    function testBorrowReceivesETH() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        
        uint256 balanceBefore = user1.balance;
        
        pool.borrow(1000e8);
        
        uint256 balanceAfter = user1.balance;
        
        // User should receive 1000e8 wei (very small amount for test)
        assertEq(balanceAfter - balanceBefore, 1000e8);
        
        vm.stopPrank();
    }
    
    // ============ Repay Tests ============
    
    function testRepayDebt() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        
        pool.repay{value: 500e8}();
        
        uint256 borrowed = pool.getBorrowedAmount(user1);
        assertEq(borrowed, 500e8);
        
        vm.stopPrank();
    }
    
    function testRepayFullDebt() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        
        pool.repay{value: 1000e8}();
        
        uint256 borrowed = pool.getBorrowedAmount(user1);
        assertEq(borrowed, 0);
        
        vm.stopPrank();
    }
    
    function testRepayRefundsExcess() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        
        uint256 balanceBefore = user1.balance;
        
        pool.repay{value: 2000e8}();
        
        uint256 balanceAfter = user1.balance;
        
        // Should refund 1000e8
        assertEq(balanceBefore - balanceAfter, 1000e8);
        
        vm.stopPrank();
    }
    
    function testCannotRepayWithoutDebt() public {
        vm.prank(user1);
        
        vm.expectRevert(ILendingPool.NoDebt.selector);
        pool.repay{value: 100e8}();
    }
    
    // ============ Health Factor Tests ============
    
    function testHealthFactorHealthy() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        
        uint256 hf = pool.getHealthFactor(user1);
        
        // Collateral: $2000, LT: 83%, Debt: $1000
        // HF = ($2000 * 83%) / $1000 = 166
        assertGt(hf, 100);
        
        vm.stopPrank();
    }
    
    function testHealthFactorUnhealthy() public {
        vm.startPrank(user1);

        // Use USDC collateral (stable) so price change affects only debt
        deal(address(usdc), user1, 2000e6);
        usdc.approve(address(collateralManager), 2000e6);
        collateralManager.depositERC20(address(usdc), 2000e6);

        // Borrow ETH: 0.90 ETH @ $2000 = $1900 (close to max $1900 = $2000 * 95%)
        pool.borrow(0.90 ether);

        vm.stopPrank();

        // Increase ETH price to $2200
        ethFeed.setPrice(2200e8);
        ethFallback.setPrice(2200e8);

        uint256 hf = pool.getHealthFactor(user1);

        // Collateral: $2000 USDC (stable), LT: 95%
        // Debt: 0.90 ETH @ $2200 = $2090
        // HF = ($2000 * 95%) / $2090 = 1900 / 2090 = 90 < 100 ✓
        assertLt(hf, 100);
    }
    
    function testHealthFactorInfiniteNoDebt() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        
        uint256 hf = pool.getHealthFactor(user1);
        
        assertEq(hf, type(uint256).max);
        
        vm.stopPrank();
    }
    
    // ============ Liquidation Tests ============
    
    function testLiquidateUnhealthyPosition() public {
        vm.startPrank(user1);

        // Use USDC collateral
        deal(address(usdc), user1, 2000e6);
        usdc.approve(address(collateralManager), 2000e6);
        collateralManager.depositERC20(address(usdc), 2000e6);

        // Borrow 0.90 ETH @ $2000 = $1900
        pool.borrow(0.90 ether);

        vm.stopPrank();

        // Increase ETH price to make position unhealthy
        ethFeed.setPrice(2200e8);
        ethFallback.setPrice(2200e8);

        uint256 hf = pool.getHealthFactor(user1);
        assertLt(hf, 100);

        // Liquidate with correct ETH amount (0.90 ETH debt)
        vm.prank(liquidator);
        pool.liquidate{value: 0.90 ether}(user1);

        uint256 borrowedAfter = pool.getBorrowedAmount(user1);
        assertEq(borrowedAfter, 0);
    }
    
    function testCannotLiquidateHealthyPosition() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        
        vm.stopPrank();
        
        vm.prank(liquidator);
        vm.expectRevert(ILendingPool.HealthyPosition.selector);
        pool.liquidate{value: 1000e8}(user1);
    }
    
    function testLiquidationRequiresSufficientPayment() public {
        vm.startPrank(user1);

        // Use USDC collateral
        deal(address(usdc), user1, 2000e6);
        usdc.approve(address(collateralManager), 2000e6);
        collateralManager.depositERC20(address(usdc), 2000e6);

        // Borrow 0.90 ETH
        pool.borrow(0.90 ether);

        vm.stopPrank();

        // Make unhealthy
        ethFeed.setPrice(2200e8);
        ethFallback.setPrice(2200e8);

        // Try to liquidate with insufficient payment (only 0.5 ETH instead of 0.95)
        vm.prank(liquidator);
        vm.expectRevert("Insufficient payment");
        pool.liquidate{value: 0.5 ether}(user1);
    }
    
    // ============ Withdraw Tests ============
    
    function testWithdrawETH() public {
        vm.startPrank(user1);
        
        collateralManager.depositETH{value: 2 ether}();
        
        uint256 balanceBefore = user1.balance;
        
        collateralManager.withdrawETH(1 ether);
        
        uint256 balanceAfter = user1.balance;
        
        assertEq(balanceAfter - balanceBefore, 1 ether);
        
        vm.stopPrank();
    }
    
    function testWithdrawUSDC() public {
        vm.startPrank(user1);
        
        usdc.approve(address(collateralManager), 2000e6);
        collateralManager.depositERC20(address(usdc), 2000e6);
        
        uint256 balanceBefore = usdc.balanceOf(user1);
        
        collateralManager.withdrawERC20(address(usdc), 1000e6);
        
        uint256 balanceAfter = usdc.balanceOf(user1);
        
        assertEq(balanceAfter - balanceBefore, 1000e6);
        
        vm.stopPrank();
    }
    
    // ============ Admin Tests ============
    
    function testSetCollateralManager() public {
        CollateralManager newManager = new CollateralManager(address(oracle));
        
        pool.setCollateralManager(address(newManager));
        
        assertEq(address(pool.collateralManager()), address(newManager));
    }
    
    function testPauseUnpause() public {
        pool.pause();
        
        vm.prank(user1);
        vm.expectRevert("Paused");
        pool.borrow(100e8);
        
        pool.unpause();
        
        vm.startPrank(user1);
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(100e8);
        vm.stopPrank();
    }
    
    function testOnlyOwnerCanSetCollateralManager() public {
        CollateralManager newManager = new CollateralManager(address(oracle));
        
        vm.prank(user1);
        vm.expectRevert("Not owner");
        pool.setCollateralManager(address(newManager));
    }
    
    // ============ Integration Tests ============
    
    function testFullUserFlow() public {
        vm.startPrank(user1);
        
        // 1. Deposit multiple collaterals
        collateralManager.depositETH{value: 2 ether}();
        usdc.approve(address(collateralManager), 2000e6);
        collateralManager.depositERC20(address(usdc), 2000e6);
        
        // 2. Check max borrow
        uint256 maxBorrow = pool.getMaxBorrowAmount(user1);
        assertGt(maxBorrow, 0);
        
        // 3. Borrow
        pool.borrow(3000e8);
        
        // 4. Check health factor
        uint256 hf = pool.getHealthFactor(user1);
        assertGt(hf, 100);
        
        // 5. Repay partial
        pool.repay{value: 1000e8}();
        
        // 6. Check improved health factor
        uint256 hfAfter = pool.getHealthFactor(user1);
        assertGt(hfAfter, hf);
        
        // 7. Withdraw some collateral
        collateralManager.withdrawETH(0.5 ether);
        
        // 8. Check still healthy
        uint256 hfFinal = pool.getHealthFactor(user1);
        assertGt(hfFinal, 100);
        
        vm.stopPrank();
    }
    
    function testMultipleUsersSeparatePositions() public {
        // User1 deposits and borrows
        vm.startPrank(user1);
        collateralManager.depositETH{value: 1 ether}();
        pool.borrow(1000e8);
        vm.stopPrank();
        
        // User2 deposits and borrows
        vm.startPrank(user2);
        usdc.approve(address(collateralManager), 2000e6);
        collateralManager.depositERC20(address(usdc), 2000e6);
        pool.borrow(1500e8);
        vm.stopPrank();
        
        // Check separate positions
        assertEq(pool.getBorrowedAmount(user1), 1000e8);
        assertEq(pool.getBorrowedAmount(user2), 1500e8);
        
        assertGt(pool.getHealthFactor(user1), 100);
        assertGt(pool.getHealthFactor(user2), 100);
    }
}