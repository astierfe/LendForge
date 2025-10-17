// test/unit/MockUniswapFallbackProvider.t.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../oracles/mocks/MockUniswapFallbackProvider.sol";

contract MockUniswapFallbackProviderTest is Test {
    MockUniswapFallbackProvider provider;
    address owner = address(this);
    address user = address(0x1);
    
    int256 constant INITIAL_ETH_PRICE = 4000e8;
    
    function setUp() public {
        provider = new MockUniswapFallbackProvider(INITIAL_ETH_PRICE);
    }
    
    function testConstructorSetsInitialPrice() public view {
        assertEq(provider.getPrice(), INITIAL_ETH_PRICE);
        assertEq(provider.owner(), owner);
    }
    
    function testOwnerCanSetPrice() public {
        int256 newPrice = 4100e8;
        provider.setPrice(newPrice);
        
        assertEq(provider.getPrice(), newPrice);
    }
    
    function testNonOwnerCannotSetPrice() public {
        vm.prank(user);
        vm.expectRevert(MockUniswapFallbackProvider.Unauthorized.selector);
        provider.setPrice(4100e8);
    }
    
    function testSetPriceRevertsOnZero() public {
        vm.expectRevert(MockUniswapFallbackProvider.InvalidPrice.selector);
        provider.setPrice(0);
    }
    
    function testSetPriceRevertsOnNegative() public {
        vm.expectRevert(MockUniswapFallbackProvider.InvalidPrice.selector);
        provider.setPrice(-100);
    }
    
    function testIsHealthyReturnsTrueInitially() public view {
        assertTrue(provider.isHealthy());
    }
    
    function testIsHealthyReturnsFalseAfter24Hours() public {
        vm.warp(block.timestamp + 25 hours);
        assertFalse(provider.isHealthy());
    }
    
    function testSetPriceUpdatesTimestamp() public {
        uint256 initialTime = provider.lastUpdatedAt();
        
        vm.warp(block.timestamp + 1 hours);
        provider.setPrice(4100e8);
        
        assertGt(provider.lastUpdatedAt(), initialTime);
    }
    
    function testDescriptionReturnsCorrectString() public view {
        assertEq(
            provider.description(), 
            "Mock Uniswap V3 Fallback (Sepolia pools unreliable)"
        );
    }
    
    function testTransferOwnership() public {
        provider.transferOwnership(user);
        assertEq(provider.owner(), user);
    }
    
    function testTransferOwnershipRevertsOnZeroAddress() public {
        vm.expectRevert(MockUniswapFallbackProvider.InvalidPrice.selector);
        provider.transferOwnership(address(0));
    }
    
    function testNonOwnerCannotTransferOwnership() public {
        vm.prank(user);
        vm.expectRevert(MockUniswapFallbackProvider.Unauthorized.selector);
        provider.transferOwnership(user);
    }
    
    function testFuzzSetPrice(int256 price) public {
        vm.assume(price > 500e8 && price < 100000e8);
        
        provider.setPrice(price);
        assertEq(provider.getPrice(), price);
    }
}
