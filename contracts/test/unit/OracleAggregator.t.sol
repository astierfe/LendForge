// test/unit/OracleAggregator.t.sol - v2.2 - Étape 4 (corrigé)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../OracleAggregator.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";
import "../../oracles/mocks/MockUniswapV3Pool.sol";

contract OracleAggregatorTest is Test {
    OracleAggregator oracle;
    MockChainlinkFeed chainlink;
    MockUniswapV3Pool uniswap;
    
    address owner = address(this);
    address user = address(0x123);    
    
    function setUp() public {
        chainlink = new MockChainlinkFeed(2000e8, 8);
        uniswap = new MockUniswapV3Pool();
        oracle = new OracleAggregator(address(chainlink), address(uniswap));
    }
    
    // ============ ÉTAPE 1: Constructor + Chainlink ============
    
    function testConstructorSetsChainlinkFeed() public view {
        assertEq(address(oracle.chainlinkFeed()), address(chainlink));
    }
    
    function testConstructorSetsOwner() public view {
        assertEq(oracle.owner(), owner);
    }
    
    function testConstructorRevertsZeroAddress() public {
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        new OracleAggregator(address(0), address(uniswap));
    }
    
    function testGetLatestPriceReturnsChainlinkPrice() public {
        int256 price = oracle.getLatestPrice();
        assertEq(price, 2000e8);
    }
    
    function testGetLatestPriceWithDifferentPrice() public {
        chainlink.setPrice(2500e8);
        int256 price = oracle.getLatestPrice();
        assertEq(price, 2500e8);
    }
    
    function testGetLatestPriceRevertsOnNegativePrice() public {
        chainlink.setPrice(-1);
        
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        oracle.getLatestPrice();
    }
    
    function testGetLatestPriceRevertsOnZeroPrice() public {
        chainlink.setPrice(0);
        
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        oracle.getLatestPrice();
    }
    
    function testGetLatestPriceRevertsOnStaleFeed() public {
        chainlink.setPrice(2000e8);
        vm.warp(block.timestamp + 2 hours);
        
        // Chainlink stale + Uniswap sans prix = InvalidPrice
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        oracle.getLatestPrice();
    }
    
    function testDecimals() public view {
        assertEq(oracle.decimals(), 8);
    }
    
    function testFuzzChainlinkPrice(int256 price) public {
        price = bound(price, 1e8, 100000e8);
        
        chainlink.setPrice(price);
        int256 result = oracle.getLatestPrice();
        
        assertEq(result, price);
    }

    // ============ ÉTAPE 2: Cache Mechanism ============
    
    function testUpdatePriceUpdatesCachedPrice() public {
        int256 price = oracle.updatePrice();
        
        assertEq(oracle.cachedPrice(), 2000e8);
        assertEq(price, 2000e8);
    }
    
    function testUpdatePriceUpdatesTimestamp() public {
        oracle.updatePrice();
        
        assertEq(oracle.lastPriceUpdate(), block.timestamp);
    }
    
    function testUpdatePriceUpdatesSource() public {
        oracle.updatePrice();
        
        assertEq(oracle.lastSource(), "chainlink");
    }
    
    function testGetCachedPriceReturnsValidCache() public {
        oracle.updatePrice();
        
        (int256 price, uint256 updatedAt, string memory source) = 
            oracle.getCachedPrice();
        
        assertEq(price, 2000e8);
        assertEq(updatedAt, block.timestamp);
        assertEq(source, "chainlink");
    }
    
    function testGetCachedPriceRevertsWhenStale() public {
        oracle.updatePrice();
        
        vm.warp(block.timestamp + 6 minutes);
        
        vm.expectRevert(OracleAggregator.CacheStale.selector);
        oracle.getCachedPrice();
    }
    
    function testGetCachedPriceWorksWithinDuration() public {
        oracle.updatePrice();
        
        vm.warp(block.timestamp + 4 minutes);
        
        (int256 price, , ) = oracle.getCachedPrice();
        assertEq(price, 2000e8);
    }
    
    function testMultiplePriceUpdates() public {
        oracle.updatePrice();
        assertEq(oracle.cachedPrice(), 2000e8);
        
        chainlink.setPrice(2500e8);
        vm.warp(block.timestamp + 1 minutes);
        
        oracle.updatePrice();
        assertEq(oracle.cachedPrice(), 2500e8);
        
        chainlink.setPrice(1800e8);
        vm.warp(block.timestamp + 1 minutes);
        
        int256 finalPrice = oracle.updatePrice();
        assertEq(finalPrice, 1800e8);
        assertEq(oracle.cachedPrice(), 1800e8);
    }
    
    function testGetLatestPriceUpdatesCache() public {
        int256 price = oracle.getLatestPrice();
        
        assertEq(oracle.cachedPrice(), 2000e8);
        assertEq(price, 2000e8);
    }
    
    function testCacheExactlyAtDuration() public {
        oracle.updatePrice();
        
        vm.warp(block.timestamp + 5 minutes);
        
        (int256 price,,) = oracle.getCachedPrice();
        assertEq(price, 2000e8);
    }
    
    function testFuzzCacheUpdate(int256 price) public {
        price = bound(price, 1e8, 100000e8);
        
        chainlink.setPrice(price);
        oracle.updatePrice();
        
        assertEq(oracle.cachedPrice(), price);
        
        (int256 cachedPrice, , ) = oracle.getCachedPrice();
        assertEq(cachedPrice, price);
    }
    
    // ============ ÉTAPE 3: Emergency Mode ============
    
    function testEmergencyModeInitiallyFalse() public view {
        assertFalse(oracle.emergencyMode());
    }
    
    function testSetEmergencyModeTrue() public {
        oracle.setEmergencyMode(true, "Market manipulation detected");
        
        assertTrue(oracle.emergencyMode());
    }
    
    function testSetEmergencyModeFalse() public {
        oracle.setEmergencyMode(true, "Emergency");
        oracle.setEmergencyMode(false, "Recovery");
        
        assertFalse(oracle.emergencyMode());
    }
    
    function testSetEmergencyModeEmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.EmergencyModeSet(true, "Test emergency");
        
        oracle.setEmergencyMode(true, "Test emergency");
    }
    
    function testSetEmergencyModeOnlyOwner() public {
        vm.prank(user);
        
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        oracle.setEmergencyMode(true, "");
    }
    
    function testUpdatePriceRevertsInEmergency() public {
        oracle.setEmergencyMode(true, "Emergency");
        
        vm.expectRevert(OracleAggregator.EmergencyModeActive.selector);
        oracle.updatePrice();
    }
    
    function testGetLatestPriceRevertsInEmergency() public {
        oracle.setEmergencyMode(true, "Emergency");
        
        vm.expectRevert(OracleAggregator.EmergencyModeActive.selector);
        oracle.getLatestPrice();
    }
    
    function testGetCachedPriceWorksInEmergency() public {
        oracle.updatePrice();
        
        oracle.setEmergencyMode(true, "Emergency");
        
        (int256 price, , string memory source) = oracle.getCachedPrice();
        
        assertEq(price, 2000e8);
        assertEq(source, "chainlink");
    }
    
    function testEmergencyModeToggle() public {
        oracle.setEmergencyMode(true, "Emergency");
        assertTrue(oracle.emergencyMode());
        
        oracle.setEmergencyMode(false, "Recovery");
        assertFalse(oracle.emergencyMode());
        
        int256 price = oracle.updatePrice();
        assertEq(price, 2000e8);
    }
    
    function testEmergencyModePreservesCachedPrice() public {
        oracle.updatePrice();
        assertEq(oracle.cachedPrice(), 2000e8);
        
        oracle.setEmergencyMode(true, "Emergency");
        
        assertEq(oracle.cachedPrice(), 2000e8);
        assertEq(oracle.lastSource(), "chainlink");
    }
    
    function testRecoveryFromEmergency() public {
        oracle.updatePrice();
        
        oracle.setEmergencyMode(true, "Emergency");
        
        chainlink.setPrice(2500e8);
        
        oracle.setEmergencyMode(false, "Recovery");
        
        int256 newPrice = oracle.updatePrice();
        assertEq(newPrice, 2500e8);
        assertEq(oracle.cachedPrice(), 2500e8);
    }    

    // ============ ÉTAPE 4: Uniswap V3 TWAP Fallback ============

    function testConstructorSetsUniswapPool() public view {
        assertEq(address(oracle.uniswapPool()), address(uniswap));
    }

    function testUpdatePriceUsesChainlinkWhenHealthy() public {
        int256 price = oracle.updatePrice();
        
        assertEq(price, 2000e8);
        assertEq(oracle.lastSource(), "chainlink");
    }

    function testUpdatePriceFallsBackToUniswapWhenChainlinkStale() public {
        oracle.updatePrice();
        
        vm.warp(block.timestamp + 2 hours);
        
        uniswap.setMockPrice(1950e8);
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, 1950e8);
        assertEq(oracle.lastSource(), "uniswap");
    }

    function testUpdatePriceFallsBackToUniswapWhenChainlinkNegative() public {
        chainlink.setPrice(-1);
        uniswap.setMockPrice(2100e8);
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, 2100e8);
        assertEq(oracle.lastSource(), "uniswap");
    }

    function testUpdatePriceEmitsSourceSwitchedEvent() public {
        chainlink.setPrice(0);
        uniswap.setMockPrice(2050e8);
        
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.SourceSwitched("chainlink", "uniswap", "Chainlink failed, using TWAP");
        
        oracle.updatePrice();
    }

    function testUpdatePriceRevertsWhenBothSourcesFail() public {
        chainlink.setPrice(-1);
        // uniswap mock price = 0 par défaut (pas de prix)
        
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        oracle.updatePrice();
    }

    function testUniswapFallbackWithDifferentPrices() public {
        vm.warp(block.timestamp + 2 hours);
        uniswap.setMockPrice(1800e8);
        
        int256 price1 = oracle.updatePrice();
        assertEq(price1, 1800e8);
        
        chainlink.setPrice(2200e8);
        vm.warp(block.timestamp + 1 minutes);
        
        int256 price2 = oracle.updatePrice();
        assertEq(price2, 2200e8);
        assertEq(oracle.lastSource(), "chainlink");
    }

    function testFuzzUniswapFallback(int256 uniPrice) public {
        uniPrice = bound(uniPrice, 1e8, 100000e8);
        
        chainlink.setPrice(-1);
        
        uniswap.setMockPrice(uniPrice);
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, uniPrice);
        assertEq(oracle.lastSource(), "uniswap");
    }
}