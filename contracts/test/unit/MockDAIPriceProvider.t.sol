// test/unit/MockDAIPriceProvider.t.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../oracles/mocks/MockDAIPriceProvider.sol";

contract MockDAIPriceProviderTest is Test {
    MockDAIPriceProvider provider;
    address owner = address(this);
    address user = address(0x1);
    
    function setUp() public {
        provider = new MockDAIPriceProvider();
    }
    
    function testConstructorSetsInitialPrice() public view {
        assertEq(provider.getPrice(), 1e8);
        assertEq(provider.owner(), owner);
    }
    
    function testOwnerCanSetPrice() public {
        int256 newPrice = 1.01e8;
        provider.setPrice(newPrice);
        
        assertEq(provider.getPrice(), newPrice);
    }
    
    function testNonOwnerCannotSetPrice() public {
        vm.prank(user);
        vm.expectRevert(MockDAIPriceProvider.Unauthorized.selector);
        provider.setPrice(1.01e8);
    }
    
    function testSetPriceRevertsOnZero() public {
        vm.expectRevert(MockDAIPriceProvider.InvalidPrice.selector);
        provider.setPrice(0);
    }
    
    function testSetPriceRevertsOnNegative() public {
        vm.expectRevert(MockDAIPriceProvider.InvalidPrice.selector);
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
        provider.setPrice(1.01e8);
        
        assertGt(provider.lastUpdatedAt(), initialTime);
    }
    
    function testDescriptionReturnsCorrectString() public view {
        assertEq(provider.description(), "Mock DAI/USD (Chainlink unavailable)");
    }
    
    function testTransferOwnership() public {
        provider.transferOwnership(user);
        assertEq(provider.owner(), user);
    }
    
    function testTransferOwnershipRevertsOnZeroAddress() public {
        vm.expectRevert(MockDAIPriceProvider.InvalidPrice.selector);
        provider.transferOwnership(address(0));
    }
    
    function testNonOwnerCannotTransferOwnership() public {
        vm.prank(user);
        vm.expectRevert(MockDAIPriceProvider.Unauthorized.selector);
        provider.transferOwnership(user);
    }
    
    function testFuzzSetPrice(int256 price) public {
        vm.assume(price > 0 && price < type(int128).max);
        
        provider.setPrice(price);
        assertEq(provider.getPrice(), price);
    }
}
