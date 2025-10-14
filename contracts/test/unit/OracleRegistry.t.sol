// test/integration/OracleRegistry.t.sol - v1.1 - Integration tests
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../oracles/PriceFeedRegistry.sol";
import "../../OracleAggregator.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";
import "../../oracles/mocks/MockUniswapV3Pool.sol";

contract OracleRegistryTest is Test {
    PriceFeedRegistry registry;
    
    OracleAggregator oracleETH;
    OracleAggregator oracleUSDC;
    OracleAggregator oracleDAI;
    
    MockChainlinkFeed chainlinkETH;
    MockChainlinkFeed chainlinkUSDC;
    MockChainlinkFeed chainlinkDAI;
    
    MockUniswapV3Pool uniswapETH;
    MockUniswapV3Pool uniswapUSDC;
    MockUniswapV3Pool uniswapDAI;
    
    address constant ETH = address(0x1);
    address constant USDC = address(0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8);
    address constant DAI = address(0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357);
    
    address owner = address(this);
    address user1 = address(0x100);
    address user2 = address(0x200);
    
    function setUp() public {
        // Deploy mocks with realistic prices
        chainlinkETH = new MockChainlinkFeed(2000e8, 8);
        chainlinkUSDC = new MockChainlinkFeed(1e8, 8);
        chainlinkDAI = new MockChainlinkFeed(1e8, 8);
        
        uniswapETH = new MockUniswapV3Pool();
        uniswapUSDC = new MockUniswapV3Pool();
        uniswapDAI = new MockUniswapV3Pool();
        
        uniswapETH.setMockPrice(2000e8);
        uniswapUSDC.setMockPrice(1e8);
        uniswapDAI.setMockPrice(1e8);
        
        // Deploy oracles
        oracleETH = new OracleAggregator(address(chainlinkETH), address(uniswapETH));
        oracleUSDC = new OracleAggregator(address(chainlinkUSDC), address(uniswapUSDC));
        oracleDAI = new OracleAggregator(address(chainlinkDAI), address(uniswapDAI));
        
        // Link Uniswap mocks to Chainlink for auto-sync
        uniswapETH.linkToChainlink(address(chainlinkETH));
        uniswapUSDC.linkToChainlink(address(chainlinkUSDC));
        uniswapDAI.linkToChainlink(address(chainlinkDAI));
        
        // Disable deviation checks for integration tests
        oracleETH.setDeviationChecks(false);
        oracleUSDC.setDeviationChecks(false);
        oracleDAI.setDeviationChecks(false);
        
        // Deploy and configure registry
        registry = new PriceFeedRegistry();
        
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 18);
        registry.addFeed(USDC, "USDC", address(chainlinkUSDC), address(uniswapUSDC), address(oracleUSDC), 6);
        registry.addFeed(DAI, "DAI", address(chainlinkDAI), address(uniswapDAI), address(oracleDAI), 18);
    }
    
    // ============ Multi-Asset Price Retrieval ============
    
    function testGetAllPricesSimultaneously() public {
        int256 priceETH = registry.getPrice(ETH);
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2000e8);
        assertEq(priceUSDC, 1e8);
        assertEq(priceDAI, 1e8);
    }
    
    function testGetCachedPricesAllAssets() public {
        registry.getPrice(ETH);
        registry.getPrice(USDC);
        registry.getPrice(DAI);
        
        (int256 cachedETH, , string memory sourceETH) = registry.getCachedPrice(ETH);
        (int256 cachedUSDC, , string memory sourceUSDC) = registry.getCachedPrice(USDC);
        (int256 cachedDAI, , string memory sourceDAI) = registry.getCachedPrice(DAI);
        
        assertEq(cachedETH, 2000e8);
        assertEq(cachedUSDC, 1e8);
        assertEq(cachedDAI, 1e8);
        
        assertEq(sourceETH, "chainlink");
        assertEq(sourceUSDC, "chainlink");
        assertEq(sourceDAI, "chainlink");
    }
    
    function testAllAssetsSupported() public view {
        assertTrue(registry.isSupported(ETH));
        assertTrue(registry.isSupported(USDC));
        assertTrue(registry.isSupported(DAI));
    }
    
    function testGetSupportedAssetsList() public view {
        address[] memory assets = registry.getSupportedAssets();
        
        assertEq(assets.length, 3);
        assertEq(assets[0], ETH);
        assertEq(assets[1], USDC);
        assertEq(assets[2], DAI);
    }
    
    // ============ Oracle Fallback Scenarios ============
    
    function testETHFallbackToUniswap() public {
        // Chainlink ETH fails
        chainlinkETH.setPrice(-1);
        
        // Uniswap available
        uniswapETH.setMockPrice(1950e8);
        
        int256 price = registry.getPrice(ETH);
        
        assertEq(price, 1950e8);
        
        (, , string memory source) = registry.getCachedPrice(ETH);
        assertEq(source, "uniswap");
    }
    
    function testUSDCFallbackToUniswap() public {
            vm.warp(block.timestamp + 2 hours);
            
            uniswapUSDC.setMockPrice(99500000); // $0.995
            
            int256 price = registry.getPrice(USDC);
            
            assertEq(price, 99500000);
            
            (, , string memory source) = registry.getCachedPrice(USDC);
            assertEq(source, "uniswap");
        }
        
    function testDAIFallbackToUniswap() public {
        chainlinkDAI.setPrice(0);
        uniswapDAI.setMockPrice(100500000); // $1.005
        int256 price = registry.getPrice(DAI);
        assertEq(price, 100500000);
        }
        
    function testMixedSources() public {
        // Scénario réaliste : ETH/DAI normaux, USDC avec Chainlink qui échoue
        
        // Faire échouer Chainlink USDC en mettant un prix négatif
        chainlinkUSDC.setPrice(-1);
        
        // Unlink USDC uniswap et donner un prix manuel
        uniswapUSDC.linkToChainlink(address(0));
        uniswapUSDC.setMockPrice(1e8);
        
        // Récupérer les prix
        int256 priceETH = registry.getPrice(ETH);
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2000e8);
        assertEq(priceUSDC, 1e8);
        assertEq(priceDAI, 1e8);
        
        // Vérifier les sources
        (, , string memory sourceETH) = registry.getCachedPrice(ETH);
        (, , string memory sourceUSDC) = registry.getCachedPrice(USDC);
        (, , string memory sourceDAI) = registry.getCachedPrice(DAI);
        
        assertEq(sourceETH, "chainlink");
        assertEq(sourceUSDC, "uniswap");
        assertEq(sourceDAI, "chainlink");
    }
    
    // ============ Price Updates Across Assets ============
    
    function testBulkPriceUpdate() public {
        chainlinkETH.setPrice(2100e8);
        chainlinkUSDC.setPrice(100500000);
        chainlinkDAI.setPrice(99800000);
        
        int256 priceETH = registry.getPrice(ETH);
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2100e8);
        assertEq(priceUSDC, 100500000);
        assertEq(priceDAI, 99800000);
    }
    
    function testVolatilityETHOnly() public {
        chainlinkETH.setPrice(2000e8);
        int256 price1 = registry.getPrice(ETH);
        
        chainlinkETH.setPrice(2500e8);
        int256 price2 = registry.getPrice(ETH);
        
        chainlinkETH.setPrice(1800e8);
        int256 price3 = registry.getPrice(ETH);
        
        assertEq(price1, 2000e8);
        assertEq(price2, 2500e8);
        assertEq(price3, 1800e8);
        
        int256 priceUSDC = registry.getPrice(USDC);
        assertEq(priceUSDC, 1e8);
    }
    
    function testStablecoinsPegMaintained() public {
        chainlinkUSDC.setPrice(100200000); // $1.002
        chainlinkDAI.setPrice(99900000);   // $0.999
        
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertGt(priceUSDC, 99e6);
        assertLt(priceUSDC, 101e6);
        
        assertGt(priceDAI, 99e6);
        assertLt(priceDAI, 101e6);
    }
    
    // ============ Deviation Detection Multi-Asset ============
    
    function testDeviationETHTriggersEmergency() public {
        // Re-enable deviation checks for this test
        oracleETH.setDeviationChecks(true);
        
        // Unlink to create manual deviation
        uniswapETH.linkToChainlink(address(0));
        
        chainlinkETH.setPrice(2000e8);
        uniswapETH.setMockPrice(2250e8); // 12.5% deviation
        
        registry.getPrice(ETH);
        
        assertTrue(oracleETH.emergencyMode());
        
        assertFalse(oracleUSDC.emergencyMode());
        assertFalse(oracleDAI.emergencyMode());
    }
    
    function testDeviationIsolatedPerAsset() public {
        // Re-enable deviation checks
        oracleETH.setDeviationChecks(true);
        oracleUSDC.setDeviationChecks(true);
        oracleDAI.setDeviationChecks(true);
        
        // Unlink to create manual deviations
        uniswapETH.linkToChainlink(address(0));
        uniswapUSDC.linkToChainlink(address(0));
        uniswapDAI.linkToChainlink(address(0));
        
        uniswapETH.setMockPrice(2100e8);  // 5% deviation - warning
        uniswapUSDC.setMockPrice(1e8);     // 0% deviation
        uniswapDAI.setMockPrice(101000000); // 1% deviation
        
        registry.getPrice(ETH);
        registry.getPrice(USDC);
        registry.getPrice(DAI);
        
        assertFalse(oracleETH.emergencyMode());
        assertFalse(oracleUSDC.emergencyMode());
        assertFalse(oracleDAI.emergencyMode());
    }
    
    function testDeviationRecoveryPerAsset() public {
        // Re-enable deviation checks
        oracleETH.setDeviationChecks(true);
        
        // Unlink to create manual deviation
        uniswapETH.linkToChainlink(address(0));
        
        uniswapETH.setMockPrice(2250e8);
        registry.getPrice(ETH);
        assertTrue(oracleETH.emergencyMode());
        
        oracleETH.setEmergencyMode(false, "Manual recovery");
        
        chainlinkETH.setPrice(2050e8);
        uniswapETH.setMockPrice(2070e8);
        
        int256 price = registry.getPrice(ETH);
        assertEq(price, 2050e8);
        assertFalse(oracleETH.emergencyMode());
    }
    
    // ============ Admin Operations Multi-Asset ============
    
    function testDisableETHKeepsOthers() public {
        registry.setFeedEnabled(ETH, false);
        
        assertFalse(registry.isSupported(ETH));
        assertTrue(registry.isSupported(USDC));
        assertTrue(registry.isSupported(DAI));
        
        vm.expectRevert(PriceFeedRegistry.FeedDisabled.selector);
        registry.getPrice(ETH);
        
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceUSDC, 1e8);
        assertEq(priceDAI, 1e8);
    }
    
    function testUpdateETHOracleKeepsOthers() public {
        MockChainlinkFeed newChainlink = new MockChainlinkFeed(2100e8, 8);
        MockUniswapV3Pool newUniswap = new MockUniswapV3Pool();
        newUniswap.setMockPrice(2100e8);
        
        registry.updateFeed(ETH, address(newChainlink), address(newUniswap));
        
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceUSDC, 1e8);
        assertEq(priceDAI, 1e8);
    }
    
    function testDisableAllAssets() public {
        registry.setFeedEnabled(ETH, false);
        registry.setFeedEnabled(USDC, false);
        registry.setFeedEnabled(DAI, false);
        
        assertFalse(registry.isSupported(ETH));
        assertFalse(registry.isSupported(USDC));
        assertFalse(registry.isSupported(DAI));
        
        address[] memory assets = registry.getSupportedAssets();
        assertEq(assets.length, 3);
    }
    
    function testReEnableAllAssets() public {
        registry.setFeedEnabled(ETH, false);
        registry.setFeedEnabled(USDC, false);
        registry.setFeedEnabled(DAI, false);
        
        registry.setFeedEnabled(ETH, true);
        registry.setFeedEnabled(USDC, true);
        registry.setFeedEnabled(DAI, true);
        
        int256 priceETH = registry.getPrice(ETH);
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2000e8);
        assertEq(priceUSDC, 1e8);
        assertEq(priceDAI, 1e8);
    }
    
    // ============ Decimals Handling ============
    
    function testDecimalsPerAsset() public view {
        assertEq(registry.decimals(ETH), 18);
        assertEq(registry.decimals(USDC), 6);
        assertEq(registry.decimals(DAI), 18);
    }
    
    function testDecimalsConsistency() public view {
        (,,,,uint8 decimalsETH,) = registry.getFeedConfig(ETH);
        (,,,,uint8 decimalsUSDC,) = registry.getFeedConfig(USDC);
        (,,,,uint8 decimalsDAI,) = registry.getFeedConfig(DAI);
        
        assertEq(decimalsETH, 18);
        assertEq(decimalsUSDC, 6);
        assertEq(decimalsDAI, 18);
    }
    
    // ============ Stress Testing ============
    
    function testRapidPriceUpdates() public {
        for (uint i = 0; i < 10; i++) {
            chainlinkETH.setPrice(int256(2000e8 + i * 10e8));
            vm.warp(block.timestamp + 1 minutes);
            
            int256 price = registry.getPrice(ETH);
            assertEq(price, int256(2000e8 + i * 10e8));
        }
    }
    
    function testAllAssetsRapidUpdates() public {
        for (uint i = 0; i < 5; i++) {
            chainlinkETH.setPrice(int256(2000e8 + i * 100e8));
            chainlinkUSDC.setPrice(int256(1e8 + i * 1000000));
            chainlinkDAI.setPrice(int256(1e8 - i * 1000000));
            
            vm.warp(block.timestamp + 1 minutes);
            
            registry.getPrice(ETH);
            registry.getPrice(USDC);
            registry.getPrice(DAI);
        }
        
        assertTrue(true);
    }
    
    function testCacheExpiryMultipleAssets() public {
        registry.getPrice(ETH);
        registry.getPrice(USDC);
        registry.getPrice(DAI);
        
        vm.warp(block.timestamp + 6 minutes);
        
        vm.expectRevert(OracleAggregator.CacheStale.selector);
        registry.getCachedPrice(ETH);
        
        vm.expectRevert(OracleAggregator.CacheStale.selector);
        registry.getCachedPrice(USDC);
        
        vm.expectRevert(OracleAggregator.CacheStale.selector);
        registry.getCachedPrice(DAI);
    }
    
    // ============ Real-World Scenarios ============
    
    function testMarketCrashETH() public {
        chainlinkETH.setPrice(2000e8);
        int256 price1 = registry.getPrice(ETH);
        
        chainlinkETH.setPrice(1500e8); // -25%
        int256 price2 = registry.getPrice(ETH);
        
        chainlinkETH.setPrice(1200e8); // -40%
        int256 price3 = registry.getPrice(ETH);
        
        assertEq(price1, 2000e8);
        assertEq(price2, 1500e8);
        assertEq(price3, 1200e8);
        
        int256 priceUSDC = registry.getPrice(USDC);
        assertEq(priceUSDC, 1e8);
    }
    
    function testUSDCDepeg() public {
        chainlinkUSDC.setPrice(90000000); // $0.90
        
        int256 price = registry.getPrice(USDC);
        assertEq(price, 90000000);
        
        int256 priceETH = registry.getPrice(ETH);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2000e8);
        assertEq(priceDAI, 1e8);
    }
    
    function testAllStablecoinsDepeg() public {
        chainlinkUSDC.setPrice(95000000); // $0.95
        chainlinkDAI.setPrice(90000000);  // $0.90
        
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceUSDC, 95000000);
        assertEq(priceDAI, 90000000);
        
        int256 priceETH = registry.getPrice(ETH);
        assertEq(priceETH, 2000e8);
    }
    
    function testRecoveryAfterMarketCrash() public {
        chainlinkETH.setPrice(1200e8);
        registry.getPrice(ETH);
        
        chainlinkETH.setPrice(1500e8);
        int256 price1 = registry.getPrice(ETH);
        
        chainlinkETH.setPrice(1800e8);
        int256 price2 = registry.getPrice(ETH);
        
        chainlinkETH.setPrice(2000e8);
        int256 price3 = registry.getPrice(ETH);
        
        assertEq(price1, 1500e8);
        assertEq(price2, 1800e8);
        assertEq(price3, 2000e8);
    }
}
