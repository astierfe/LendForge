// test/unit/OracleAggregator.t.sol - v3.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../OracleAggregator.sol";
import "../../oracles/PriceRegistry.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "../../oracles/mocks/MockUSDCPriceProvider.sol";
import "../../oracles/mocks/MockDAIPriceProvider.sol";
import "../../oracles/mocks/MockUniswapFallbackProvider.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";

contract OracleAggregatorTest is Test {
    OracleAggregator aggregator;
    PriceRegistry registry;
    
    ChainlinkPriceProvider ethProvider;
    MockUSDCPriceProvider usdcProvider;
    MockDAIPriceProvider daiProvider;
    MockUniswapFallbackProvider uniFallback;
    
    MockChainlinkFeed mockChainlink;
    
    address owner = address(this);
    address user = address(0x1);
    
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
    address constant DAI = 0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357;
    
    function setUp() public {
        // Deploy registry
        registry = new PriceRegistry();
        
        // Deploy providers
        mockChainlink = new MockChainlinkFeed(2000e8, 8);
        ethProvider = new ChainlinkPriceProvider(address(mockChainlink), "Chainlink ETH/USD");
        usdcProvider = new MockUSDCPriceProvider();
        daiProvider = new MockDAIPriceProvider();
        uniFallback = new MockUniswapFallbackProvider(2000e8);
        
        // Setup registry
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        registry.addAsset(DAI, "DAI", address(daiProvider), address(0), 18);
        
        // Deploy aggregator
        aggregator = new OracleAggregator(address(registry));
    }
    
    // ============ Constructor Tests ============
    
    function testConstructorSetsRegistry() public view {
        assertEq(address(aggregator.registry()), address(registry));
        assertEq(aggregator.owner(), owner);
    }
    
    function testConstructorRevertsZeroAddress() public {
        vm.expectRevert(OracleAggregator.InvalidAddress.selector);
        new OracleAggregator(address(0));
    }
    
    function testInitialStateCorrect() public view {
        assertFalse(aggregator.emergencyMode());
        assertTrue(aggregator.deviationChecksEnabled());
    }
    
    // ============ Get Price Tests ============
    
    function testGetPriceETH() public {
        int256 price = aggregator.getPrice(WETH);
        assertEq(price, 2000e8);
    }
    
    function testGetPriceUSDC() public {
        int256 price = aggregator.getPrice(USDC);
        assertEq(price, 1e8);
    }
    
    function testGetPriceDAI() public {
        int256 price = aggregator.getPrice(DAI);
        assertEq(price, 1e8);
    }
    
    function testGetPriceMultipleAssets() public {
        assertEq(aggregator.getPrice(WETH), 2000e8);
        assertEq(aggregator.getPrice(USDC), 1e8);
        assertEq(aggregator.getPrice(DAI), 1e8);
    }
    
    function testGetPriceEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit OracleAggregator.PriceUpdated(WETH, 2000e8, "Chainlink ETH/USD", block.timestamp);
        
        aggregator.getPrice(WETH);
    }
    
    function testGetPriceUpdatesCache() public {
        aggregator.getPrice(WETH);
        
        (int256 cached, uint256 updatedAt, string memory source) = aggregator.priceCache(WETH);
        
        assertEq(cached, 2000e8);
        assertEq(updatedAt, block.timestamp);
        assertEq(source, "Chainlink ETH/USD");
    }
    
    function testGetPriceRevertsInEmergency() public {
        aggregator.setEmergencyMode(true, "Test emergency");
        
        vm.expectRevert(OracleAggregator.EmergencyModeActive.selector);
        aggregator.getPrice(WETH);
    }
    
    // ============ Cached Price Tests ============
    
    function testGetCachedPrice() public {
        aggregator.getPrice(WETH);
        
        (int256 price, uint256 updatedAt, string memory source) = aggregator.getCachedPrice(WETH);
        
        assertEq(price, 2000e8);
        assertEq(updatedAt, block.timestamp);
        assertEq(source, "Chainlink ETH/USD");
    }
    
    function testGetCachedPriceRevertsStale() public {
        aggregator.getPrice(WETH);
        
        vm.warp(block.timestamp + 6 minutes);
        
        vm.expectRevert(OracleAggregator.CacheStale.selector);
        aggregator.getCachedPrice(WETH);
    }
    
    function testGetCachedPriceMultipleAssets() public {
        aggregator.getPrice(WETH);
        aggregator.getPrice(USDC);
        
        (int256 ethPrice,,) = aggregator.getCachedPrice(WETH);
        (int256 usdcPrice,,) = aggregator.getCachedPrice(USDC);
        
        assertEq(ethPrice, 2000e8);
        assertEq(usdcPrice, 1e8);
    }
    
    // ============ Fallback Tests ============
    
    function testGetPriceUsesFallbackWhenPrimaryFails() public {
        // Make Chainlink stale
        vm.warp(block.timestamp + 2 hours);
        
        int256 price = aggregator.getPrice(WETH);
        
        // Should use fallback (Uniswap mock)
        assertEq(price, 2000e8);
    }
    
    function testGetPriceEmitsBothPricesWhenBothAvailable() public {
        vm.expectEmit(true, false, false, true);
        emit OracleAggregator.PricesCached(WETH, 2000e8, 2000e8);
        
        aggregator.getPrice(WETH);
    }
    
    function testGetPriceUsesOnlyPrimaryWhenNoFallback() public {
        int256 price = aggregator.getPrice(USDC);
        assertEq(price, 1e8);
    }
    
    // ============ Deviation Tests ============
    
    function testDeviationDetectedWhenPricesDiffer() public {
        // Set fallback to different price
        uniFallback.setPrice(2100e8); // 5% deviation
        
        aggregator.getPrice(WETH);
        
        (bool hasDev, uint256 devBps,,) = aggregator.getDeviationInfo(WETH);
        
        assertTrue(hasDev);
        assertApproxEqAbs(devBps, 500, 10); // ~5% = 500 bps
    }
    
    function testDeviationWarningEmitted() public {
        uniFallback.setPrice(2110e8); // ~5.5% deviation
        
        vm.expectEmit(true, false, false, false);
        emit OracleAggregator.DeviationWarning(WETH, 2000e8, 2110e8, 0);
        
        aggregator.getPrice(WETH);
    }
    
    function testCriticalDeviationTriggersEmergency() public {
        uniFallback.setPrice(2250e8); // >10% deviation
        
        assertFalse(aggregator.emergencyMode());
        
        aggregator.getPrice(WETH);
        
        assertTrue(aggregator.emergencyMode());
    }
    
    function testCriticalDeviationEmitsEvent() public {
        uniFallback.setPrice(2250e8);
        
        vm.expectEmit(true, false, false, false);
        emit OracleAggregator.CriticalDeviation(WETH, 2000e8, 2250e8, 0);
        
        aggregator.getPrice(WETH);
    }
    
    function testDeviationChecksCanBeDisabled() public {
        aggregator.setDeviationChecks(false);
        uniFallback.setPrice(3000e8); // 50% deviation
        
        // Should NOT trigger emergency
        aggregator.getPrice(WETH);
        
        assertFalse(aggregator.emergencyMode());
    }
    
    function testDeviationClearedWhenOnlyOneSource() public {
        // First create deviation
        uniFallback.setPrice(2100e8);
        aggregator.getPrice(WETH);
        
        (bool hasDev1,,,) = aggregator.getDeviationInfo(WETH);
        assertTrue(hasDev1);
        
        // Now get USDC price (no fallback)
        aggregator.getPrice(USDC);
        
        (bool hasDev2,,,) = aggregator.getDeviationInfo(USDC);
        assertFalse(hasDev2);
    }
    
    // ============ Cache Management Tests ============
    
    function testClearCache() public {
        aggregator.getPrice(WETH);
        
        aggregator.clearCache(WETH);
        
        vm.expectRevert(OracleAggregator.CacheStale.selector);
        aggregator.getCachedPrice(WETH);
    }
    
    function testClearCacheEmitsEvent() public {
        aggregator.getPrice(WETH);
        
        vm.expectEmit(true, false, false, false);
        emit OracleAggregator.CacheCleared(WETH);
        
        aggregator.clearCache(WETH);
    }
    
    function testClearCacheOnlyOwner() public {
        aggregator.getPrice(WETH);
        
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        aggregator.clearCache(WETH);
    }
    
    function testClearDeviation() public {
        uniFallback.setPrice(2100e8);
        aggregator.getPrice(WETH);
        
        (bool hasDev1,,,) = aggregator.getDeviationInfo(WETH);
        assertTrue(hasDev1);
        
        aggregator.clearDeviation(WETH);
        
        (bool hasDev2,,,) = aggregator.getDeviationInfo(WETH);
        assertFalse(hasDev2);
    }
    
    function testClearDeviationOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        aggregator.clearDeviation(WETH);
    }
    
    // ============ Emergency Mode Tests ============
    
    function testSetEmergencyMode() public {
        aggregator.setEmergencyMode(true, "Manual trigger");
        assertTrue(aggregator.emergencyMode());
        
        aggregator.setEmergencyMode(false, "Resolved");
        assertFalse(aggregator.emergencyMode());
    }
    
    function testSetEmergencyModeEmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.EmergencyModeSet(true, "Test");
        
        aggregator.setEmergencyMode(true, "Test");
    }
    
    function testSetEmergencyModeOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        aggregator.setEmergencyMode(true, "Unauthorized");
    }
    
    function testSetDeviationChecks() public {
        aggregator.setDeviationChecks(false);
        assertFalse(aggregator.deviationChecksEnabled());
        
        aggregator.setDeviationChecks(true);
        assertTrue(aggregator.deviationChecksEnabled());
    }
    
    function testSetDeviationChecksOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        aggregator.setDeviationChecks(false);
    }
    
    // ============ Ownership Tests ============
    
    function testTransferOwnership() public {
        aggregator.transferOwnership(user);
        assertEq(aggregator.owner(), user);
    }
    
    function testTransferOwnershipRevertsZeroAddress() public {
        vm.expectRevert(OracleAggregator.InvalidAddress.selector);
        aggregator.transferOwnership(address(0));
    }
    
    function testTransferOwnershipOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        aggregator.transferOwnership(user);
    }
    
    // ============ Integration Tests ============
    
    function testFullPriceUpdateCycle() public {
        // Get initial price
        int256 price1 = aggregator.getPrice(WETH);
        assertEq(price1, 2000e8);
        
        // Update underlying price
        mockChainlink.setPrice(2100e8);
        
        // Get updated price
        int256 price2 = aggregator.getPrice(WETH);
        assertEq(price2, 2100e8);
        
        // Verify cache updated
        (int256 cached,,) = aggregator.getCachedPrice(WETH);
        assertEq(cached, 2100e8);
    }
    
    function testMultiAssetPriceTracking() public {
        aggregator.getPrice(WETH);
        aggregator.getPrice(USDC);
        aggregator.getPrice(DAI);
        
        (int256 ethPrice,,) = aggregator.getCachedPrice(WETH);
        (int256 usdcPrice,,) = aggregator.getCachedPrice(USDC);
        (int256 daiPrice,,) = aggregator.getCachedPrice(DAI);
        
        assertEq(ethPrice, 2000e8);
        assertEq(usdcPrice, 1e8);
        assertEq(daiPrice, 1e8);
    }
}