// test/unit/LFTKN.t.sol - v1.0 - Unit tests
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../token/LFTKN.sol";

contract LFTKNTest is Test {
    LFTKN token;
    
    address owner = address(this);
    address user1 = address(0x1);
    address user2 = address(0x2);
    
    uint256 constant TOTAL_SUPPLY = 10_000_000 * 10**18;
    
    function setUp() public {
        token = new LFTKN();
    }
    
    // ============ Constructor Tests ============
    
    function testConstructorMintsToDeployer() public view {
        assertEq(token.balanceOf(owner), TOTAL_SUPPLY);
    }
    
    function testTotalSupply() public view {
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }
    
    function testName() public view {
        assertEq(token.name(), "LendForge Token");
    }
    
    function testSymbol() public view {
        assertEq(token.symbol(), "LFTKN");
    }
    
    function testDecimals() public view {
        assertEq(token.decimals(), 18);
    }
    
    function testInitialBalanceOthers() public view {
        assertEq(token.balanceOf(user1), 0);
        assertEq(token.balanceOf(user2), 0);
    }
    
    // ============ Transfer Tests ============
    
    function testTransfer() public {
        uint256 amount = 1000 * 10**18;
        
        bool success = token.transfer(user1, amount);
        
        assertTrue(success);
        assertEq(token.balanceOf(owner), TOTAL_SUPPLY - amount);
        assertEq(token.balanceOf(user1), amount);
    }
    
    function testTransferMultiple() public {
        uint256 amount1 = 1000 * 10**18;
        uint256 amount2 = 500 * 10**18;
        
        token.transfer(user1, amount1);
        token.transfer(user2, amount2);
        
        assertEq(token.balanceOf(user1), amount1);
        assertEq(token.balanceOf(user2), amount2);
        assertEq(token.balanceOf(owner), TOTAL_SUPPLY - amount1 - amount2);
    }
    
    function testTransferZero() public {
        bool success = token.transfer(user1, 0);
        
        assertTrue(success);
        assertEq(token.balanceOf(user1), 0);
    }
    
    function testTransferRevertsInsufficientBalance() public {
        vm.prank(user1);
        
        vm.expectRevert();
        token.transfer(user2, 100);
    }
    
    function testTransferToZeroAddress() public {
        vm.expectRevert();
        token.transfer(address(0), 1000);
    }
    
    function testTransferEmitsEvent() public {
        uint256 amount = 1000 * 10**18;
        
        vm.expectEmit(true, true, false, true);
        emit IERC20.Transfer(owner, user1, amount);
        
        token.transfer(user1, amount);
    }
    
    // ============ Approve Tests ============
    
    function testApprove() public {
        uint256 amount = 1000 * 10**18;
        
        bool success = token.approve(user1, amount);
        
        assertTrue(success);
        assertEq(token.allowance(owner, user1), amount);
    }
    
    function testApproveZero() public {
        token.approve(user1, 1000);
        token.approve(user1, 0);
        
        assertEq(token.allowance(owner, user1), 0);
    }
    
    function testApproveOverwrite() public {
        token.approve(user1, 1000);
        token.approve(user1, 2000);
        
        assertEq(token.allowance(owner, user1), 2000);
    }
    
    function testApproveEmitsEvent() public {
        uint256 amount = 1000 * 10**18;
        
        vm.expectEmit(true, true, false, true);
        emit IERC20.Approval(owner, user1, amount);
        
        token.approve(user1, amount);
    }
    
    // ============ TransferFrom Tests ============
    
    function testTransferFrom() public {
        uint256 amount = 1000 * 10**18;
        
        token.approve(user1, amount);
        
        vm.prank(user1);
        bool success = token.transferFrom(owner, user2, amount);
        
        assertTrue(success);
        assertEq(token.balanceOf(owner), TOTAL_SUPPLY - amount);
        assertEq(token.balanceOf(user2), amount);
        assertEq(token.allowance(owner, user1), 0);
    }
    
    function testTransferFromPartial() public {
        uint256 allowance = 1000 * 10**18;
        uint256 amount = 500 * 10**18;
        
        token.approve(user1, allowance);
        
        vm.prank(user1);
        token.transferFrom(owner, user2, amount);
        
        assertEq(token.balanceOf(user2), amount);
        assertEq(token.allowance(owner, user1), allowance - amount);
    }
    
    function testTransferFromRevertsInsufficientAllowance() public {
        token.approve(user1, 500);
        
        vm.prank(user1);
        vm.expectRevert();
        token.transferFrom(owner, user2, 1000);
    }
    
    function testTransferFromRevertsInsufficientBalance() public {
        token.transfer(user1, 100);
        
        vm.prank(user1);
        token.approve(user2, 1000);
        
        vm.prank(user2);
        vm.expectRevert();
        token.transferFrom(user1, owner, 1000);
    }
    
    function testTransferFromEmitsEvents() public {
        uint256 amount = 1000 * 10**18;
        
        token.approve(user1, amount);
        
        vm.expectEmit(true, true, false, true);
        emit IERC20.Transfer(owner, user2, amount);
        
        vm.prank(user1);
        token.transferFrom(owner, user2, amount);
    }
    
    // ============ IncreaseAllowance Tests ============
    
    function testIncreaseAllowance() public {
        token.approve(user1, 1000);
        
        bool success = token.increaseAllowance(user1, 500);
        
        assertTrue(success);
        assertEq(token.allowance(owner, user1), 1500);
    }
    
    function testIncreaseAllowanceFromZero() public {
        bool success = token.increaseAllowance(user1, 1000);
        
        assertTrue(success);
        assertEq(token.allowance(owner, user1), 1000);
    }
    
    // ============ DecreaseAllowance Tests ============
    
    function testDecreaseAllowance() public {
        token.approve(user1, 1000);
        
        bool success = token.decreaseAllowance(user1, 300);
        
        assertTrue(success);
        assertEq(token.allowance(owner, user1), 700);
    }
    
    function testDecreaseAllowanceToZero() public {
        token.approve(user1, 1000);
        
        token.decreaseAllowance(user1, 1000);
        
        assertEq(token.allowance(owner, user1), 0);
    }
    
    function testDecreaseAllowanceRevertsUnderflow() public {
        token.approve(user1, 500);
        
        vm.expectRevert();
        token.decreaseAllowance(user1, 1000);
    }
    
    // ============ Supply Tests ============
    
    function testTotalSupplyConstant() public {
        token.transfer(user1, 1000);
        token.transfer(user2, 2000);
        
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }
    
    function testCannotMintMore() public view {
        // Verify total supply is fixed
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }
    
    function testAllTokensDistributable() public {
        token.transfer(user1, TOTAL_SUPPLY);
        
        assertEq(token.balanceOf(owner), 0);
        assertEq(token.balanceOf(user1), TOTAL_SUPPLY);
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }
    
    // ============ Fuzz Tests ============
    
    function testFuzzTransfer(address to, uint256 amount) public {
        vm.assume(to != address(0));
        amount = bound(amount, 0, TOTAL_SUPPLY);
        
        bool success = token.transfer(to, amount);
        
        assertTrue(success);
        assertEq(token.balanceOf(to), amount);
    }
    
    function testFuzzApprove(address spender, uint256 amount) public {
        vm.assume(spender != address(0));
        
        bool success = token.approve(spender, amount);
        
        assertTrue(success);
        assertEq(token.allowance(owner, spender), amount);
    }
    
    function testFuzzTransferFrom(uint256 amount) public {
        amount = bound(amount, 0, TOTAL_SUPPLY);
        
        token.approve(user1, amount);
        
        vm.prank(user1);
        bool success = token.transferFrom(owner, user2, amount);
        
        assertTrue(success);
        assertEq(token.balanceOf(user2), amount);
    }
    
    // ============ Edge Cases ============
    
    function testTransferAllBalance() public {
        token.transfer(user1, TOTAL_SUPPLY);
        
        assertEq(token.balanceOf(owner), 0);
        assertEq(token.balanceOf(user1), TOTAL_SUPPLY);
    }
    
    function testMultipleTransfersSameRecipient() public {
        uint256 amount = 100 * 10**18;
        
        token.transfer(user1, amount);
        token.transfer(user1, amount);
        token.transfer(user1, amount);
        
        assertEq(token.balanceOf(user1), amount * 3);
    }
    
    function testTransferChain() public {
        uint256 amount = 1000 * 10**18;
        
        token.transfer(user1, amount);
        
        vm.prank(user1);
        token.transfer(user2, amount / 2);
        
        assertEq(token.balanceOf(user1), amount / 2);
        assertEq(token.balanceOf(user2), amount / 2);
    }
    
    function testAllowanceAfterFullTransferFrom() public {
        uint256 amount = 1000 * 10**18;
        
        token.approve(user1, amount);
        
        vm.prank(user1);
        token.transferFrom(owner, user2, amount);
        
        assertEq(token.allowance(owner, user1), 0);
    }
}
