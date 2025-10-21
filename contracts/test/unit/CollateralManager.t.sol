// test/CollateralManager.t.sol - v1.0
// Tests unitaires pour CollateralManager
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../CollateralManager.sol";
import "../../OracleAggregator.sol";
import "../../oracles/PriceRegistry.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "../../oracles/mocks/MockUSDCPriceProvider.sol";
import "../../oracles/mocks/MockDAIPriceProvider.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 1_000_000 * 10**decimals_);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CollateralManagerTest is Test {
    CollateralManager public manager;
    OracleAggregator public oracle;
    PriceRegistry public registry;
    
    MockERC20 public usdc;
    MockERC20 public dai;
    
    MockChainlinkFeed public ethFeed;
    ChainlinkPriceProvider public ethProvider;
    MockUSDCPriceProvider public usdcProvider;
    MockDAIPriceProvider public daiProvider;
    
    address public owner;
    address public user1;
    address public user2;
    
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    event CollateralDeposited(address indexed user, address indexed asset, uint256 amount, uint256 timestamp);
    event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount, uint256 timestamp);
    event AssetAdded(address indexed asset, string symbol, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationPenalty);
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        
        // Deploy tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);
        
        usdc.mint(user1, 100_000 * 1e6);
        usdc.mint(user2, 100_000 * 1e6);
        dai.mint(user1, 100_000 * 1e18);
        dai.mint(user2, 100_000 * 1e18);
        
        // Deploy oracle system
        ethFeed = new MockChainlinkFeed(2000e8, 8);
        ethProvider = new ChainlinkPriceProvider(address(ethFeed), "ETH/USD");
        usdcProvider = new MockUSDCPriceProvider();
        daiProvider = new MockDAIPriceProvider();
        
        registry = new PriceRegistry();
        registry.addAsset(ETH_ADDRESS, "ETH", address(ethProvider), address(0), 18);
        registry.addAsset(address(usdc), "USDC", address(usdcProvider), address(0), 6);
        registry.addAsset(address(dai), "DAI", address(daiProvider), address(0), 18);
        
        oracle = new OracleAggregator(address(registry));
        
        // Deploy CollateralManager
        manager = new CollateralManager(address(oracle));
        
        // Add supported assets
        manager.addAsset(ETH_ADDRESS, "ETH", 66, 83, 10, 18);
        manager.addAsset(address(usdc), "USDC", 90, 95, 5, 6);
        manager.addAsset(address(dai), "DAI", 90, 95, 5, 18);
    }
    
    // ============ Constructor Tests ============
    
    function test_Constructor() public view {
        assertEq(address(manager.oracle()), address(oracle));
        assertEq(manager.owner(), owner);
    }
    
    function test_Constructor_RevertInvalidOracle() public {
        vm.expectRevert(CollateralManager.InvalidAddress.selector);
        new CollateralManager(address(0));
    }
    
    // ============ Asset Configuration Tests ============
    
    function test_AddAsset_Success() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        
        vm.expectEmit(true, false, false, true);
        emit AssetAdded(address(newToken), "NEW", 80, 85, 8);
        
        manager.addAsset(address(newToken), "NEW", 80, 85, 8, 18);
        
        CollateralManager.CollateralConfig memory config = manager.getAssetConfig(address(newToken));
        assertEq(config.ltv, 80);
        assertEq(config.liquidationThreshold, 85);
        assertEq(config.liquidationPenalty, 8);
        assertEq(config.decimals, 18);
        assertTrue(config.enabled);
        assertEq(config.symbol, "NEW");
    }
    
    function test_AddAsset_RevertInvalidAddress() public {
        vm.expectRevert(CollateralManager.InvalidAddress.selector);
        manager.addAsset(address(0), "ZERO", 80, 85, 8, 18);
    }
    
    function test_AddAsset_RevertAlreadyExists() public {
        vm.expectRevert(CollateralManager.AssetAlreadyExists.selector);
        manager.addAsset(ETH_ADDRESS, "ETH", 66, 83, 10, 18);
    }
    
    function test_AddAsset_RevertInvalidLTV() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        
        vm.expectRevert(CollateralManager.InvalidConfig.selector);
        manager.addAsset(address(newToken), "NEW", 90, 85, 8, 18);
    }
    
    function test_AddAsset_RevertInvalidThreshold() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        
        vm.expectRevert(CollateralManager.InvalidConfig.selector);
        manager.addAsset(address(newToken), "NEW", 80, 105, 8, 18);
    }
    
    function test_AddAsset_RevertInvalidPenalty() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        
        vm.expectRevert(CollateralManager.InvalidConfig.selector);
        manager.addAsset(address(newToken), "NEW", 80, 85, 60, 18);
    }
    
    function test_AddAsset_RevertNotOwner() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        
        vm.prank(user1);
        vm.expectRevert(CollateralManager.Unauthorized.selector);
        manager.addAsset(address(newToken), "NEW", 80, 85, 8, 18);
    }
    
    function test_UpdateAssetConfig_Success() public {
        manager.updateAssetConfig(ETH_ADDRESS, 70, 85, 12);
        
        CollateralManager.CollateralConfig memory config = manager.getAssetConfig(ETH_ADDRESS);
        assertEq(config.ltv, 70);
        assertEq(config.liquidationThreshold, 85);
        assertEq(config.liquidationPenalty, 12);
    }
    
    function test_UpdateAssetConfig_RevertNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(CollateralManager.Unauthorized.selector);
        manager.updateAssetConfig(ETH_ADDRESS, 70, 85, 12);
    }
    
    function test_SetAssetEnabled() public {
        manager.setAssetEnabled(ETH_ADDRESS, false);
        assertFalse(manager.isAssetSupported(ETH_ADDRESS));
        
        manager.setAssetEnabled(ETH_ADDRESS, true);
        assertTrue(manager.isAssetSupported(ETH_ADDRESS));
    }
    
    // ============ ETH Deposit Tests ============
    
    function test_DepositETH_Success() public {
        vm.startPrank(user1);
        
        vm.expectEmit(true, true, false, false);
        emit CollateralDeposited(user1, ETH_ADDRESS, 10 ether, block.timestamp);
        
        manager.depositETH{value: 10 ether}();
        
        assertEq(manager.getUserCollateralBalance(user1, ETH_ADDRESS), 10 ether);
        
        address[] memory assets = manager.getUserAssets(user1);
        assertEq(assets.length, 1);
        assertEq(assets[0], ETH_ADDRESS);
        
        vm.stopPrank();
    }
    
    function test_DepositETH_Multiple() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 5 ether}();
        manager.depositETH{value: 3 ether}();
        
        assertEq(manager.getUserCollateralBalance(user1, ETH_ADDRESS), 8 ether);
        
        address[] memory assets = manager.getUserAssets(user1);
        assertEq(assets.length, 1);
        
        vm.stopPrank();
    }
    
    function test_DepositETH_RevertZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(CollateralManager.InvalidAmount.selector);
        manager.depositETH{value: 0}();
    }
    
    function test_DepositETH_RevertAssetDisabled() public {
        manager.setAssetEnabled(ETH_ADDRESS, false);
        
        vm.prank(user1);
        vm.expectRevert(CollateralManager.AssetNotSupported.selector);
        manager.depositETH{value: 1 ether}();
    }
    
    // ============ ERC20 Deposit Tests ============
    
    function test_DepositERC20_USDC_Success() public {
        vm.startPrank(user1);
        
        usdc.approve(address(manager), 1000e6);
        manager.depositERC20(address(usdc), 1000e6);
        
        assertEq(manager.getUserCollateralBalance(user1, address(usdc)), 1000e6);
        assertEq(usdc.balanceOf(address(manager)), 1000e6);
        
        vm.stopPrank();
    }
    
    function test_DepositERC20_DAI_Success() public {
        vm.startPrank(user1);
        
        dai.approve(address(manager), 5000e18);
        manager.depositERC20(address(dai), 5000e18);
        
        assertEq(manager.getUserCollateralBalance(user1, address(dai)), 5000e18);
        
        vm.stopPrank();
    }
    
    function test_DepositERC20_MultipleAssets() public {
        vm.startPrank(user1);
        
        usdc.approve(address(manager), 1000e6);
        manager.depositERC20(address(usdc), 1000e6);
        
        dai.approve(address(manager), 2000e18);
        manager.depositERC20(address(dai), 2000e18);
        
        address[] memory assets = manager.getUserAssets(user1);
        assertEq(assets.length, 2);
        
        vm.stopPrank();
    }
    
    function test_DepositERC20_RevertZeroAmount() public {
        vm.startPrank(user1);
        usdc.approve(address(manager), 1000e6);
        
        vm.expectRevert(CollateralManager.InvalidAmount.selector);
        manager.depositERC20(address(usdc), 0);
        
        vm.stopPrank();
    }
    
    function test_DepositERC20_RevertETHAddress() public {
        vm.prank(user1);
        vm.expectRevert(CollateralManager.InvalidAddress.selector);
        manager.depositERC20(ETH_ADDRESS, 1000);
    }
    
    // ============ ETH Withdraw Tests ============
    
    function test_WithdrawETH_Success() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 10 ether}();
        
        uint256 balanceBefore = user1.balance;
        manager.withdrawETH(5 ether);
        
        assertEq(manager.getUserCollateralBalance(user1, ETH_ADDRESS), 5 ether);
        assertEq(user1.balance, balanceBefore + 5 ether);
        
        vm.stopPrank();
    }
    
    function test_WithdrawETH_Full() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 10 ether}();
        manager.withdrawETH(10 ether);
        
        assertEq(manager.getUserCollateralBalance(user1, ETH_ADDRESS), 0);
        
        address[] memory assets = manager.getUserAssets(user1);
        assertEq(assets.length, 0);
        
        vm.stopPrank();
    }
    
    function test_WithdrawETH_RevertInsufficientCollateral() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 5 ether}();
        
        vm.expectRevert(CollateralManager.InsufficientCollateral.selector);
        manager.withdrawETH(10 ether);
        
        vm.stopPrank();
    }
    
    // ============ ERC20 Withdraw Tests ============
    
    function test_WithdrawERC20_Success() public {
        vm.startPrank(user1);
        
        usdc.approve(address(manager), 1000e6);
        manager.depositERC20(address(usdc), 1000e6);
        
        manager.withdrawERC20(address(usdc), 500e6);
        
        assertEq(manager.getUserCollateralBalance(user1, address(usdc)), 500e6);
        
        vm.stopPrank();
    }
    
    function test_WithdrawERC20_Full() public {
        vm.startPrank(user1);
        
        dai.approve(address(manager), 1000e18);
        manager.depositERC20(address(dai), 1000e18);
        
        manager.withdrawERC20(address(dai), 1000e18);
        
        assertEq(manager.getUserCollateralBalance(user1, address(dai)), 0);
        
        address[] memory assets = manager.getUserAssets(user1);
        assertEq(assets.length, 0);
        
        vm.stopPrank();
    }
    
    function test_WithdrawERC20_RevertInsufficientCollateral() public {
        vm.startPrank(user1);
        
        usdc.approve(address(manager), 500e6);
        manager.depositERC20(address(usdc), 500e6);
        
        vm.expectRevert(CollateralManager.InsufficientCollateral.selector);
        manager.withdrawERC20(address(usdc), 1000e6);
        
        vm.stopPrank();
    }
    
    // ============ Collateral Value Tests ============
    
    function test_GetCollateralValueUSD_SingleAsset() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 10 ether}();
        
        vm.stopPrank();
        
        uint256 valueUSD = manager.getCollateralValueUSD(user1);
        assertEq(valueUSD, 20_000e8);
    }
    
    function test_GetCollateralValueUSD_MultipleAssets() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 10 ether}();
        
        usdc.approve(address(manager), 5000e6);
        manager.depositERC20(address(usdc), 5000e6);
        
        dai.approve(address(manager), 3000e18);
        manager.depositERC20(address(dai), 3000e18);
        
        vm.stopPrank();
        
        uint256 valueUSD = manager.getCollateralValueUSD(user1);
        assertEq(valueUSD, 28_000e8);
    }
    
    function test_GetCollateralValueUSD_ZeroBalance() public {
        uint256 valueUSD = manager.getCollateralValueUSD(user1);
        assertEq(valueUSD, 0);
    }
    
    function test_GetCollateralValueUSD_PriceChange() public {
        vm.startPrank(user1);
        manager.depositETH{value: 10 ether}();
        vm.stopPrank();
        
        ethFeed.setPrice(3000e8);
        
        uint256 valueUSD = manager.getCollateralValueUSD(user1);
        assertEq(valueUSD, 30_000e8);
    }
    
    // ============ Max Borrow Tests ============
    
    function test_GetMaxBorrowValue_SingleAsset() public {
        vm.startPrank(user1);
        manager.depositETH{value: 10 ether}();
        vm.stopPrank();
        
        uint256 maxBorrow = manager.getMaxBorrowValue(user1);
        assertEq(maxBorrow, 13_200e8);
    }
    
    function test_GetMaxBorrowValue_MultipleAssets() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 10 ether}();
        
        usdc.approve(address(manager), 10_000e6);
        manager.depositERC20(address(usdc), 10_000e6);
        
        vm.stopPrank();
        
        uint256 maxBorrow = manager.getMaxBorrowValue(user1);
        assertEq(maxBorrow, 22_200e8);
    }
    
    // ============ User Collaterals Tests ============
    
    function test_GetUserCollaterals() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 5 ether}();
        
        usdc.approve(address(manager), 1000e6);
        manager.depositERC20(address(usdc), 1000e6);
        
        vm.stopPrank();
        
        (address[] memory assets, uint256[] memory amounts, ) = manager.getUserCollaterals(user1);
        
        assertEq(assets.length, 2);
        assertEq(amounts[0], 5 ether);
        assertEq(amounts[1], 1000e6);
    }
    
    // ============ Admin Tests ============
    
    function test_TransferOwnership() public {
        manager.transferOwnership(user1);
        assertEq(manager.owner(), user1);
    }
    
    function test_TransferOwnership_RevertInvalidAddress() public {
        vm.expectRevert(CollateralManager.InvalidAddress.selector);
        manager.transferOwnership(address(0));
    }
    
    // ============ Integration Tests ============
    
    function test_Integration_FullFlow() public {
        vm.startPrank(user1);
        
        manager.depositETH{value: 10 ether}();
        usdc.approve(address(manager), 5000e6);
        manager.depositERC20(address(usdc), 5000e6);
        
        uint256 totalValue = manager.getCollateralValueUSD(user1);
        assertEq(totalValue, 25_000e8);
        
        uint256 maxBorrow = manager.getMaxBorrowValue(user1);
        assertGt(maxBorrow, 0);
        
        manager.withdrawETH(5 ether);
        
        uint256 newValue = manager.getCollateralValueUSD(user1);
        assertLt(newValue, totalValue);
        
        vm.stopPrank();
    }
    
    function test_Integration_MultipleUsers() public {
        vm.prank(user1);
        manager.depositETH{value: 10 ether}();
        
        vm.prank(user2);
        manager.depositETH{value: 20 ether}();
        
        uint256 value1 = manager.getCollateralValueUSD(user1);
        uint256 value2 = manager.getCollateralValueUSD(user2);
        
        assertEq(value2, value1 * 2);
    }
}
