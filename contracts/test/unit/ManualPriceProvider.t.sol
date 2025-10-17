// test/unit/ManualPriceProvider.t.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../oracles/ManualPriceProvider.sol";

contract ManualPriceProviderTest is Test {
    ManualPriceProvider provider;
    address owner = address(this);
    address user = address(0x1);
    
    int256 constant INITIAL_PRICE = 10e8; // $10
    string constant DESCRIPTION = "Manual LFTKN/USD";
    
    function setUp() public {
        provider = new ManualPriceProvider(INITIAL_PRICE, DESCRIPTION);
    }
    
    function testConstructorSetsInitialPrice() public view {
        assertEq(provider.getPrice(), INITIAL_PRICE);
        assertEq(provider.owner(), owner);
        assertEq(provider.description(), DESCRIPTION);
    }
    
    function testConstructorRevertsOnZeroPrice() public {
        vm.expectRevert(ManualPriceProvider.InvalidPrice.selector);
        new ManualPriceProvider(0, DESCRIPTION);
    }
    
    function testConstructorRevertsOnNegativePrice() public {
        vm.expectRevert(ManualPriceProvider.InvalidPrice.selector);
        new ManualPriceProvider(-100, DESCRIPTION);
    }
    
    function testOwnerCanSetPrice() public {
        int256 newPrice = 12e8;
        provider.setPrice(newPrice);
        
        assertEq(provider.getPrice(), newPrice);
    }
    
    function testNonOwnerCannotSetPrice() public {
        vm.prank(user);
        vm.expectRevert(ManualPriceProvider.Unauthorized.selector);
        provider.setPrice(12e8);
    }
    
    function testSetPriceRevertsOnZero() public {
        vm.expectRevert(ManualPriceProvider.InvalidPrice.selector);
        provider.setPrice(0);
    }
    
    function testSetPriceRevertsOnNegative() public {
        vm.expectRevert(ManualPriceProvider.InvalidPrice.selector);
        provider.setPrice(-100);
    }
    
    function testIsHealthyReturnsTrueInitially() public view {
        assertTrue(provider.isHealthy());
    }
    
    function testIsHealthyReturnsFalseAfter24Hours() public {
        vm.warp(block.timestamp + 25 hours);
        assertFalse(provider.isHealthy());
    }
    
    function testIsHealthyReturnsTrueAfterPriceUpdate() public {
        vm.warp(block.timestamp + 25 hours);
        assertFalse(provider.isHealthy());
        
        provider.setPrice(11e8);
        assertTrue(provider.isHealthy());
    }
    
    function testSetPriceUpdatesTimestamp() public {
        uint256 initialTime = provider.lastUpdatedAt();
        
        vm.warp(block.timestamp + 1 hours);
        provider.setPrice(11e8);
        
        assertGt(provider.lastUpdatedAt(), initialTime);
        assertEq(provider.lastUpdatedAt(), block.timestamp);
    }
    
    function testDescriptionReturnsCorrectString() public view {
        assertEq(provider.description(), DESCRIPTION);
    }
    
    function testTransferOwnership() public {
        provider.transferOwnership(user);
        assertEq(provider.owner(), user);
        
        vm.prank(user);
        provider.setPrice(15e8);
        assertEq(provider.getPrice(), 15e8);
    }
    
    function testTransferOwnershipRevertsOnZeroAddress() public {
        vm.expectRevert(ManualPriceProvider.InvalidPrice.selector);
        provider.transferOwnership(address(0));
    }
    
    function testNonOwnerCannotTransferOwnership() public {
        vm.prank(user);
        vm.expectRevert(ManualPriceProvider.Unauthorized.selector);
        provider.transferOwnership(user);
    }
    
    function testOldOwnerCannotSetPriceAfterTransfer() public {
        provider.transferOwnership(user);
        
        vm.expectRevert(ManualPriceProvider.Unauthorized.selector);
        provider.setPrice(15e8);
    }
    
    function testMultiplePriceUpdates() public {
        provider.setPrice(11e8);
        assertEq(provider.getPrice(), 11e8);
        
        provider.setPrice(12e8);
        assertEq(provider.getPrice(), 12e8);
        
        provider.setPrice(13e8);
        assertEq(provider.getPrice(), 13e8);
    }
    
    function testFuzzSetPrice(int256 price) public {
        vm.assume(price > 1e8 && price < 1000e8);
        
        provider.setPrice(price);
        assertEq(provider.getPrice(), price);
        assertTrue(provider.isHealthy());
    }
    
    function testFuzzDescription(string memory desc) public {
        ManualPriceProvider customProvider = new ManualPriceProvider(10e8, desc);
        assertEq(customProvider.description(), desc);
    }
}
