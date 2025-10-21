// test/unit/MockETHFallback.t.sol - v1.0
// Tests du mock fallback et scenarios de deviation
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../oracles/mocks/MockETHFallbackProvider.sol";
import "../../OracleAggregator.sol";
import "../../oracles/PriceRegistry.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";

contract MockETHFallbackTest is Test {
    MockETHFallbackProvider public fallbackProvider;
    OracleAggregator public aggregator;
    PriceRegistry public registry;
    ChainlinkPriceProvider public primary;
    MockChainlinkFeed public feed;
    
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address public owner;
    
    event DeviationWarning(address indexed asset, int256 primaryPrice, int256 fallbackPrice, uint256 deviationBps);
    event CriticalDeviation(address indexed asset, int256 primaryPrice, int256 fallbackPrice, uint256 deviationBps);
    
    function setUp() public {
        owner = address(this);
        
        feed = new MockChainlinkFeed(2500e8, 8);
        primary = new ChainlinkPriceProvider(address(feed), "Chainlink ETH/USD");
        fallbackProvider = new MockETHFallbackProvider(2500e8);
        
        registry = new PriceRegistry();
        registry.addAsset(ETH_ADDRESS, "ETH", address(primary), address(fallbackProvider), 18);
        
        aggregator = new OracleAggregator(address(registry));
    }
    
    function test_MockFallback_SetPrice() public {
        fallbackProvider.setPrice(3000e8);
        assertEq(fallbackProvider.getPrice(), 3000e8);
    }
    
    function test_MockFallback_IsHealthy() public view {
        assertTrue(fallbackProvider.isHealthy());
    }
    
    function test_Deviation_None() public {
        int256 price = aggregator.getPrice(ETH_ADDRESS);
        assertEq(price, 2500e8);
        
        (bool hasDev, uint256 devBps,,) = aggregator.getDeviationInfo(ETH_ADDRESS);
        assertTrue(hasDev);
        assertEq(devBps, 0);
    }
    
    function test_Deviation_Small_3Percent() public {
        fallbackProvider.setPrice(2575e8);
        
        int256 price = aggregator.getPrice(ETH_ADDRESS);
        assertEq(price, 2500e8);
        
        (bool hasDev, uint256 devBps,,) = aggregator.getDeviationInfo(ETH_ADDRESS);
        assertTrue(hasDev);
        assertEq(devBps, 300);
    }
    
    function test_Deviation_Warning_6Percent() public {
        fallbackProvider.setPrice(2650e8);
        
        vm.expectEmit(true, false, false, false);
        emit DeviationWarning(ETH_ADDRESS, 2500e8, 2650e8, 600);
        
        int256 price = aggregator.getPrice(ETH_ADDRESS);
        assertEq(price, 2500e8);
        
        (bool hasDev, uint256 devBps,,) = aggregator.getDeviationInfo(ETH_ADDRESS);
        assertTrue(hasDev);
        assertEq(devBps, 600);
    }
    
    function test_Deviation_Critical_12Percent() public {
        fallbackProvider.setPrice(2800e8);
        
        vm.expectEmit(true, false, false, false);
        emit CriticalDeviation(ETH_ADDRESS, 2500e8, 2800e8, 1200);
        
        aggregator.getPrice(ETH_ADDRESS);
        
        assertTrue(aggregator.emergencyMode());
        
        (bool hasDev, uint256 devBps,,) = aggregator.getDeviationInfo(ETH_ADDRESS);
        assertTrue(hasDev);
        assertEq(devBps, 1200);
    }
    
    function test_Deviation_PrimaryDown_UseFallback() public {
        feed.setPrice(-1);
        fallbackProvider.setPrice(2600e8);
        
        int256 price = aggregator.getPrice(ETH_ADDRESS);
        assertEq(price, 2600e8);
    }
    
    function test_Scenario_MarketCrash() public {
        feed.setPrice(2000e8);
        fallbackProvider.setPrice(2500e8);
        
        vm.expectEmit(true, false, false, false);
        emit CriticalDeviation(ETH_ADDRESS, 2000e8, 2500e8, 2500);
        
        int256 price = aggregator.getPrice(ETH_ADDRESS);
        assertEq(price, 2000e8);
        
        assertTrue(aggregator.emergencyMode());
    }
    
    function test_Scenario_FallbackStale() public {
        vm.warp(block.timestamp + 25 hours);
        
        int256 price = aggregator.getPrice(ETH_ADDRESS);
        assertEq(price, 2500e8);
        
        assertFalse(fallbackProvider.isHealthy());
    }
}
