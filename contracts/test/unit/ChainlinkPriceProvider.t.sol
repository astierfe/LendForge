// test/unit/ChainlinkPriceProvider.t.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";

contract ChainlinkPriceProviderTest is Test {
    ChainlinkPriceProvider provider;
    MockChainlinkFeed mockFeed;
    
    int256 constant INITIAL_PRICE = 2000e8;
    string constant DESCRIPTION = "Chainlink ETH/USD";
    
    function setUp() public {
        mockFeed = new MockChainlinkFeed(INITIAL_PRICE, 8);
        provider = new ChainlinkPriceProvider(address(mockFeed), DESCRIPTION);
    }
    
    function testConstructorInitialization() public view {
        assertEq(address(provider.feed()), address(mockFeed));
        assertEq(provider.description(), DESCRIPTION);
    }
    
    function testGetPriceReturnsValidPrice() public view {
        int256 price = provider.getPrice();
        assertEq(price, INITIAL_PRICE);
        assertTrue(price > 0);
    }
    
    function testGetPriceRevertsOnStaleData() public {
        vm.warp(block.timestamp + 2 hours);
        
        vm.expectRevert(ChainlinkPriceProvider.StalePrice.selector);
        provider.getPrice();
    }
    
    function testGetPriceRevertsOnNegativePrice() public {
        mockFeed.setPrice(-100);
        
        vm.expectRevert(ChainlinkPriceProvider.InvalidPrice.selector);
        provider.getPrice();
    }
    
    function testGetPriceRevertsOnZeroPrice() public {
        mockFeed.setPrice(0);
        
        vm.expectRevert(ChainlinkPriceProvider.InvalidPrice.selector);
        provider.getPrice();
    }
    
    function testIsHealthyReturnsTrueWhenFeedOK() public view {
        bool healthy = provider.isHealthy();
        assertTrue(healthy);
    }
    
    function testIsHealthyReturnsFalseOnStaleData() public {
        vm.warp(block.timestamp + 2 hours);
        
        bool healthy = provider.isHealthy();
        assertFalse(healthy);
    }
    
    function testIsHealthyReturnsFalseOnInvalidPrice() public {
        mockFeed.setPrice(-100);
        
        bool healthy = provider.isHealthy();
        assertFalse(healthy);
    }
    
    function testIsHealthyReturnsFalseOnZeroPrice() public {
        mockFeed.setPrice(0);
        
        bool healthy = provider.isHealthy();
        assertFalse(healthy);
    }
    
    function testDescriptionReturnsCorrectString() public view {
        assertEq(provider.description(), DESCRIPTION);
    }
    
    function testPriceUpdatesWhenFeedChanges() public {
        int256 newPrice = 2500e8;
        mockFeed.setPrice(newPrice);
        
        int256 price = provider.getPrice();
        assertEq(price, newPrice);
    }
    
    function testConstructorRevertsOnZeroAddress() public {
        vm.expectRevert(ChainlinkPriceProvider.InvalidPrice.selector);
        new ChainlinkPriceProvider(address(0), DESCRIPTION);
    }
    
    function testFuzzGetPrice(int256 price) public {
        vm.assume(price > 0 && price < type(int128).max);
        mockFeed.setPrice(price);
        
        int256 returnedPrice = provider.getPrice();
        assertEq(returnedPrice, price);
    }
}
