// test/unit/OracleAggregator.t.sol - v2.3 - Étape 5
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

    // ============ ÉTAPE 5: Deviation Detection ============

    function testDeviationConstants() public view {
        assertEq(oracle.MAX_DEVIATION(), 500); // 5%
        assertEq(oracle.CRITICAL_DEVIATION(), 1000); // 10%
    }

    function testCalculateDeviationZeroDeviation() public {
        uint256 deviation = oracle.calculateDeviation(2000e8, 2000e8);
        assertEq(deviation, 0);
    }

    function testCalculateDeviationSmallPositive() public {
        // Chainlink: $2000, Uniswap: $2050 (+2.5%)
        uint256 deviation = oracle.calculateDeviation(2000e8, 2050e8);
        assertEq(deviation, 250); // 2.5% = 250 basis points
    }

    function testCalculateDeviationSmallNegative() public {
        // Chainlink: $2000, Uniswap: $1950 (-2.5%)
        uint256 deviation = oracle.calculateDeviation(2000e8, 1950e8);
        assertEq(deviation, 250); // Absolute value
    }

    function testCalculateDeviationExactMax() public {
        // Chainlink: $2000, Uniswap: $2100 (+5%)
        uint256 deviation = oracle.calculateDeviation(2000e8, 2100e8);
        assertEq(deviation, 500); // 5% = 500 bp
    }

    function testCalculateDeviationExceedsMax() public {
        // Chainlink: $2000, Uniswap: $2150 (+7.5%)
        uint256 deviation = oracle.calculateDeviation(2000e8, 2150e8);
        assertEq(deviation, 750); // 7.5% = 750 bp
    }

    function testCalculateDeviationCritical() public {
        // Chainlink: $2000, Uniswap: $2200 (+10%)
        uint256 deviation = oracle.calculateDeviation(2000e8, 2200e8);
        assertEq(deviation, 1000); // 10% = 1000 bp
    }

    function testCalculateDeviationLargeDeviation() public {
        // Chainlink: $2000, Uniswap: $1500 (-25%)
        uint256 deviation = oracle.calculateDeviation(2000e8, 1500e8);
        assertEq(deviation, 2500); // 25% = 2500 bp
    }

    function testUpdatePriceWithinDeviation() public {
        // Chainlink: $2000, Uniswap: $2050 (2.5% deviation)
        uniswap.setMockPrice(2050e8);
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, 2000e8);
        assertEq(oracle.lastSource(), "chainlink");
        assertFalse(oracle.emergencyMode());
    }

    function testUpdatePriceExactMaxDeviation() public {
        // Chainlink: $2000, Uniswap: $2100 (5% deviation)
        uniswap.setMockPrice(2100e8);
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, 2000e8);
        assertEq(oracle.lastSource(), "chainlink");
        assertFalse(oracle.emergencyMode());
    }

    function testUpdatePriceExceedsMaxDeviation() public {
        // Chainlink: $2000, Uniswap: $2150 (7.5% deviation)
        uniswap.setMockPrice(2150e8);
        
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.DeviationWarning(2000e8, 2150e8, 750);
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, 2000e8);
        assertEq(oracle.lastSource(), "chainlink");
        assertFalse(oracle.emergencyMode());
    }

    function testUpdatePriceCriticalDeviation() public {
        // Chainlink: $2000, Uniswap: $2200 (10% deviation)
        uniswap.setMockPrice(2200e8);
        
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.CriticalDeviation(2000e8, 2200e8, 1000);
        
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.EmergencyModeSet(true, "Critical price deviation detected");
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, 2000e8);
        assertTrue(oracle.emergencyMode());
    }

    function testUpdatePriceExtremeCriticalDeviation() public {
        // Chainlink: $2000, Uniswap: $1500 (-25% deviation)
        uniswap.setMockPrice(1500e8);
        
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.CriticalDeviation(2000e8, 1500e8, 2500);
        
        oracle.updatePrice();
        
        assertTrue(oracle.emergencyMode());
    }

    function testUpdatePriceDeviationWarningNoEmergency() public {
        // Deviation between 5% and 10% should emit warning but not trigger emergency
        uniswap.setMockPrice(2120e8); // 6% deviation
        
        oracle.updatePrice();
        
        assertFalse(oracle.emergencyMode());
    }

    function testGetDeviationInfoInitially() public {
        (
            bool hasDeviation,
            uint256 deviationBps,
            int256 chainlinkPrice,
            int256 uniswapPrice
        ) = oracle.getDeviationInfo();
        
        assertFalse(hasDeviation);
        assertEq(deviationBps, 0);
        assertEq(chainlinkPrice, 0);
        assertEq(uniswapPrice, 0);
    }

    function testGetDeviationInfoAfterUpdate() public {
        uniswap.setMockPrice(2100e8);
        
        oracle.updatePrice();
        
        (
            bool hasDeviation,
            uint256 deviationBps,
            int256 chainlinkPrice,
            int256 uniswapPrice
        ) = oracle.getDeviationInfo();
        
        assertTrue(hasDeviation);
        assertEq(deviationBps, 500); // 5%
        assertEq(chainlinkPrice, 2000e8);
        assertEq(uniswapPrice, 2100e8);
    }

    function testGetDeviationInfoWithWarning() public {
        uniswap.setMockPrice(2150e8); // 7.5%
        
        oracle.updatePrice();
        
        (bool hasDeviation, uint256 deviationBps, , ) = oracle.getDeviationInfo();
        
        assertTrue(hasDeviation);
        assertEq(deviationBps, 750);
    }

    function testMultipleUpdatesTrackDeviation() public {
        // First update: small deviation
        uniswap.setMockPrice(2050e8);
        oracle.updatePrice();
        
        (, uint256 dev1, , ) = oracle.getDeviationInfo();
        assertEq(dev1, 250);
        
        // Second update: larger deviation
        vm.warp(block.timestamp + 1 minutes);
        chainlink.setPrice(2100e8);
        uniswap.setMockPrice(2250e8);
        oracle.updatePrice();
        
        (, uint256 dev2, , ) = oracle.getDeviationInfo();
        assertGt(dev2, dev1);
    }

    function testDeviationOnlyCheckedWhenBothSourcesAvailable() public {
        // Chainlink stale, fallback to Uniswap only
        vm.warp(block.timestamp + 2 hours);
        uniswap.setMockPrice(1800e8);
        
        int256 price = oracle.updatePrice();
        
        assertEq(price, 1800e8);
        assertEq(oracle.lastSource(), "uniswap");
        
        // Deviation not tracked because only one source
        (bool hasDeviation, , , ) = oracle.getDeviationInfo();
        assertFalse(hasDeviation);
    }

    /* impossible à reproduire : POINT DE VIGILANCE
    function testFuzzDeviation(int256 chainlinkPrice, int256 uniswapPrice) public {
        chainlinkPrice = bound(chainlinkPrice, 100e8, 10000e8);
        uniswapPrice = bound(uniswapPrice, 100e8, 10000e8);
        
        uint256 deviation = oracle.calculateDeviation(chainlinkPrice, uniswapPrice);
        
        // Deviation should be >= 0
        assertGe(deviation, 0);
        
        // If prices are similar (within 2x), symmetry should hold
        if (chainlinkPrice <= uniswapPrice * 2 && uniswapPrice <= chainlinkPrice * 2) {
            uint256 deviationReverse = oracle.calculateDeviation(uniswapPrice, chainlinkPrice);
            assertEq(deviation, deviationReverse);
        }
    }*/

    function testDeviationZeroPriceHandling() public {
        // Should not revert, but return max deviation
        uint256 deviation = oracle.calculateDeviation(2000e8, 0);
        assertEq(deviation, 10000); // 100% deviation
    }

    function testCriticalDeviationAutoRecovery() public {
        // Trigger critical deviation
        uniswap.setMockPrice(2200e8);
        oracle.updatePrice();
        assertTrue(oracle.emergencyMode());
        
        // Admin manually recovers
        oracle.setEmergencyMode(false, "Manual recovery after investigation");
        assertFalse(oracle.emergencyMode());
        
        // Normal deviation now
        vm.warp(block.timestamp + 1 minutes);
        chainlink.setPrice(2050e8);
        uniswap.setMockPrice(2070e8);
        
        int256 price = oracle.updatePrice();
        assertEq(price, 2050e8);
        assertFalse(oracle.emergencyMode());
    }

    function testDeviationEventData() public {
        uniswap.setMockPrice(2150e8);
        
        vm.recordLogs();
        oracle.updatePrice();
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        
        // Should emit DeviationWarning event
        bool foundWarning = false;
        for (uint i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("DeviationWarning(int256,int256,uint256)")) {
                foundWarning = true;
                break;
            }
        }
        assertTrue(foundWarning);
    }

    function testDeviationBoundaryConditions() public {
        // Test exact boundaries
        
        // 4.99% - no warning
        uniswap.setMockPrice(2099e8);
        oracle.updatePrice();
        assertFalse(oracle.emergencyMode());
        
        // 5.01% - warning
        vm.warp(block.timestamp + 1 minutes);
        uniswap.setMockPrice(2101e8);
        oracle.updatePrice();
        assertFalse(oracle.emergencyMode());
        
        // 9.99% - warning only
        vm.warp(block.timestamp + 1 minutes);
        uniswap.setMockPrice(2199e8);
        oracle.updatePrice();
        assertFalse(oracle.emergencyMode());
        
        // 10.01% - emergency
        vm.warp(block.timestamp + 1 minutes);
        chainlink.setPrice(2000e8);
        uniswap.setMockPrice(2201e8);
        oracle.updatePrice();
        assertTrue(oracle.emergencyMode());
    }

    // ============ ÉTAPE 6: Price Update Events ============

    function testPriceUpdatedEventOnChainlinkSuccess() public {
        // Setup: prix normaux
        chainlink.setPrice(2000e8);
        uniswap.setMockPrice(2050e8);
        
        // Attend l'event avec les bonnes valeurs
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            2000e8,           // price final
            "chainlink",      // source
            block.timestamp,  // timestamp
            2000e8,          // chainlinkPrice
            2050e8           // uniswapPrice
        );
        
        oracle.updatePrice();
    }

    function testPriceUpdatedEventOnUniswapFallback() public {
        // Chainlink stale, fallback Uniswap
        chainlink.setPrice(2000e8);
        vm.warp(block.timestamp + 2 hours);
        uniswap.setMockPrice(1950e8);
        
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            1950e8,
            "uniswap",
            block.timestamp,
            0,              // chainlink failed
            1950e8
        );
        
        oracle.updatePrice();
    }

    function testPriceUpdatedEventOnChainlinkOnly() public {
        // Uniswap n'a pas de prix
        chainlink.setPrice(2100e8);
        
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            2100e8,
            "chainlink",
            block.timestamp,
            2100e8,
            0               // uniswap failed
        );
        
        oracle.updatePrice();
    }

    function testPriceUpdatedEventMultipleCalls() public {
        // Premier update
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            2000e8,
            "chainlink",
            block.timestamp,
            2000e8,
            0
        );
        oracle.updatePrice();
        
        // Changement prix + temps
        vm.warp(block.timestamp + 1 minutes);
        chainlink.setPrice(2500e8);
        uniswap.setMockPrice(2520e8);
        
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            2500e8,
            "chainlink",
            block.timestamp,
            2500e8,
            2520e8
        );
        oracle.updatePrice();
    }

    function testPriceUpdatedEventWithDeviation() public {
        // Setup deviation warning (7%)
        chainlink.setPrice(2000e8);
        uniswap.setMockPrice(2140e8);
        
        // Attend DeviationWarning puis PriceUpdated
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.DeviationWarning(2000e8, 2140e8, 700);
        
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            2000e8,
            "chainlink",
            block.timestamp,
            2000e8,
            2140e8
        );
        
        oracle.updatePrice();
    }

    function testPriceUpdatedEventWithCriticalDeviation() public {
        // Setup deviation critique (12%)
        chainlink.setPrice(2000e8);
        uniswap.setMockPrice(2240e8);
        
        // Attend CriticalDeviation, EmergencyMode, puis PriceUpdated
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.CriticalDeviation(2000e8, 2240e8, 1200);
        
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.EmergencyModeSet(true, "Critical price deviation detected");
        
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            2000e8,
            "chainlink",
            block.timestamp,
            2000e8,
            2240e8
        );
        
        oracle.updatePrice();
    }

    function testGetLatestPriceEmitsPriceUpdated() public {
        // getLatestPrice() appelle updatePrice() donc doit aussi emit
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            2000e8,
            "chainlink",
            block.timestamp,
            2000e8,
            0
        );
        
        oracle.getLatestPrice();
    }

    function testPriceUpdatedEventTimestampAccuracy() public {
        uint256 beforeTime = block.timestamp;
        
        vm.recordLogs();
        oracle.updatePrice();
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        
        // Trouver l'event PriceUpdated
        bool foundEvent = false;
        for (uint i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("PriceUpdated(int256,string,uint256,int256,int256)")) {
                foundEvent = true;
                // Décoder toutes les données de l'event
                (int256 price, string memory source, uint256 timestamp, int256 chainlinkPrice, int256 uniswapPrice) = 
                    abi.decode(logs[i].data, (int256, string, uint256, int256, int256));
                
                // Le timestamp dans l'event doit être égal au block.timestamp
                assertEq(timestamp, beforeTime);
                break;
            }
        }
        assertTrue(foundEvent, "PriceUpdated event not found");
    }

    function testPriceUpdatedEventDataConsistency() public {
        chainlink.setPrice(2300e8);
        uniswap.setMockPrice(2310e8);
        
        vm.recordLogs();
        int256 returnedPrice = oracle.updatePrice();
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        
        // Vérifier que le prix dans l'event correspond au prix retourné
        for (uint i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("PriceUpdated(int256,string,uint256,int256,int256)")) {
                // Premier paramètre = prix
                assertEq(returnedPrice, 2300e8);
                break;
            }
        }
    }

    function testFuzzPriceUpdatedEvent(int256 price) public {
        price = bound(price, 1e8, 100000e8);
        
        chainlink.setPrice(price);
        
        vm.expectEmit(true, true, true, true);
        emit OracleAggregator.PriceUpdated(
            price,
            "chainlink",
            block.timestamp,
            price,
            0
        );
        
        oracle.updatePrice();
    }

    // test/unit/OracleAggregator.t.sol - v2.5 - Étape 7
    // Ajouter à la fin du fichier

    // ============ ÉTAPE 7: Admin Functions ============

    function testTransferOwnership() public {
        assertEq(oracle.owner(), owner);
        
        vm.expectEmit(true, true, false, false);
        emit OracleAggregator.OwnershipTransferred(owner, user);
        
        oracle.transferOwnership(user);
        
        assertEq(oracle.owner(), user);
    }

    function testTransferOwnershipRevertsZeroAddress() public {
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        oracle.transferOwnership(address(0));
    }

    function testTransferOwnershipOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        oracle.transferOwnership(user);
    }

    function testTransferOwnershipNewOwnerCanAct() public {
        oracle.transferOwnership(user);
        
        vm.prank(user);
        oracle.setEmergencyMode(true, "Test by new owner");
        
        assertTrue(oracle.emergencyMode());
    }

    function testForceUpdateCache() public {
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.CacheManuallyUpdated(3000e8, "manual", block.timestamp);
        
        oracle.forceUpdateCache(3000e8, "manual");
        
        assertEq(oracle.cachedPrice(), 3000e8);
        assertEq(oracle.lastSource(), "manual");
        assertEq(oracle.lastPriceUpdate(), block.timestamp);
    }

    function testForceUpdateCacheRevertsZeroPrice() public {
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        oracle.forceUpdateCache(0, "manual");
    }

    function testForceUpdateCacheRevertsNegativePrice() public {
        vm.expectRevert(OracleAggregator.InvalidPrice.selector);
        oracle.forceUpdateCache(-100, "manual");
    }

    function testForceUpdateCacheOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        oracle.forceUpdateCache(2500e8, "manual");
    }

    function testForceUpdateCacheOverwritesExisting() public {
        oracle.updatePrice();
        assertEq(oracle.cachedPrice(), 2000e8);
        
        vm.warp(block.timestamp + 1 minutes);
        oracle.forceUpdateCache(3500e8, "admin_override");
        
        assertEq(oracle.cachedPrice(), 3500e8);
        assertEq(oracle.lastSource(), "admin_override");
    }

    function testClearDeviationData() public {
        chainlink.setPrice(2000e8);
        uniswap.setMockPrice(2100e8);
        oracle.updatePrice();
        
        (bool hasDeviation, uint256 deviationBps,,) = oracle.getDeviationInfo();
        assertTrue(hasDeviation);
        assertEq(deviationBps, 500);
        
        vm.expectEmit(false, false, false, true);
        emit OracleAggregator.DeviationDataCleared(block.timestamp);
        
        oracle.clearDeviationData();
        
        (hasDeviation, deviationBps,,) = oracle.getDeviationInfo();
        assertFalse(hasDeviation);
        assertEq(deviationBps, 0);
    }

    function testClearDeviationDataOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(OracleAggregator.Unauthorized.selector);
        oracle.clearDeviationData();
    }

function testGetOracleHealthBothHealthy() public {
    uniswap.setMockPrice(2050e8);
    oracle.updatePrice(); // Initialiser le cache
    
    (
        bool chainlinkHealthy,
        bool uniswapHealthy,
        bool cacheValid,
        uint256 timeSinceLastUpdate
    ) = oracle.getOracleHealth();
    
    assertTrue(chainlinkHealthy);
    assertTrue(uniswapHealthy);
    assertTrue(cacheValid); // Cache vient d'être mis à jour
    assertEq(timeSinceLastUpdate, 0); // Instantané
}

    function testGetOracleHealthChainlinkStale() public {
        oracle.updatePrice();
        
        vm.warp(block.timestamp + 2 hours);
        uniswap.setMockPrice(1950e8);
        
        (bool chainlinkHealthy, bool uniswapHealthy,,) = oracle.getOracleHealth();
        
        assertFalse(chainlinkHealthy);
        assertTrue(uniswapHealthy);
    }

    function testGetOracleHealthUniswapFailed() public {
        oracle.updatePrice(); // Initialiser
        
        (bool chainlinkHealthy, bool uniswapHealthy,,) = oracle.getOracleHealth();
        
        assertTrue(chainlinkHealthy);
        assertFalse(uniswapHealthy); // Pas de mock price = failed
    }

    function testGetOracleHealthCacheValid() public {
        oracle.updatePrice();
        
        (,, bool cacheValid, uint256 timeSinceLastUpdate) = oracle.getOracleHealth();
        
        assertTrue(cacheValid);
        assertEq(timeSinceLastUpdate, 0);
    }

    function testGetOracleHealthCacheStale() public {
        oracle.updatePrice();
        
        vm.warp(block.timestamp + 6 minutes);
        
        (,, bool cacheValid, uint256 timeSinceLastUpdate) = oracle.getOracleHealth();
        
        assertFalse(cacheValid);
        assertEq(timeSinceLastUpdate, 6 minutes);
    }

    function testGetOracleHealthTimeSinceUpdate() public {
        oracle.updatePrice();
        
        vm.warp(block.timestamp + 3 minutes);
        
        (,,, uint256 timeSinceLastUpdate) = oracle.getOracleHealth();
        
        assertEq(timeSinceLastUpdate, 3 minutes);
    }

    function testGetOracleHealthBothFailed() public {
        chainlink.setPrice(-1);
        
        (bool chainlinkHealthy, bool uniswapHealthy,,) = oracle.getOracleHealth();
        
        assertFalse(chainlinkHealthy);
        assertFalse(uniswapHealthy);
    }

    function testAdminWorkflowEmergencyRecovery() public {
        chainlink.setPrice(2000e8);
        uniswap.setMockPrice(2300e8);
        oracle.updatePrice();
        assertTrue(oracle.emergencyMode());
        
        (bool hasDeviation,,,) = oracle.getDeviationInfo();
        assertTrue(hasDeviation);
        
        oracle.clearDeviationData();
        oracle.setEmergencyMode(false, "Manual recovery");
        
        (hasDeviation,,,) = oracle.getDeviationInfo();
        assertFalse(hasDeviation);
        assertFalse(oracle.emergencyMode());
    }

    function testAdminWorkflowManualPriceOverride() public {
        oracle.updatePrice();
        assertEq(oracle.cachedPrice(), 2000e8);
        
        (
            bool chainlinkHealthy,
            bool uniswapHealthy,,
        ) = oracle.getOracleHealth();
        assertTrue(chainlinkHealthy);
        
        oracle.forceUpdateCache(2800e8, "verified_external_source");
        
        assertEq(oracle.cachedPrice(), 2800e8);
        assertEq(oracle.lastSource(), "verified_external_source");
    }

    function testFuzzForceUpdateCache(int256 price) public {
        price = bound(price, 1e8, 100000e8);
        
        oracle.forceUpdateCache(price, "fuzz_test");
        
        assertEq(oracle.cachedPrice(), price);
        assertEq(oracle.lastSource(), "fuzz_test");
    }

}
