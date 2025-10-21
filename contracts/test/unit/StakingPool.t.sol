// test/StakingPool.t.sol - v1.0
// Tests complets StakingPool + RewardDistributor
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../StakingPool.sol";
import "../../RewardDistributor.sol";
import "../../token/LFTKN.sol";

contract StakingPoolTest is Test {
    StakingPool public stakingPool;
    RewardDistributor public distributor;
    LFTKN public token;
    
    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public carol = address(0x3);
    
    uint256 constant INITIAL_BALANCE = 100_000 * 1e18;
    uint256 constant REWARD_POOL = 5_000_000 * 1e18;
    
    function setUp() public {
        token = new LFTKN();
        stakingPool = new StakingPool(address(token));
        distributor = new RewardDistributor(address(token));
        
        stakingPool.setRewardDistributor(address(distributor));
        distributor.setStakingPool(address(stakingPool));
        
        // Fund distributor
        token.approve(address(distributor), REWARD_POOL);
        distributor.fundPool(REWARD_POOL);
        
        // Give tokens to users
        token.transfer(alice, INITIAL_BALANCE);
        token.transfer(bob, INITIAL_BALANCE);
        token.transfer(carol, INITIAL_BALANCE);
    }
    
    // ============ Phase A: StakingPool Core Tests ============
    
    function test_Stake_Basic() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
        
        assertEq(stakingPool.getStakedBalance(alice), stakeAmount);
        assertEq(stakingPool.getTotalStaked(), stakeAmount);
    }
    
    function test_Stake_ZeroAmount_Reverts() public {
        vm.startPrank(alice);
        vm.expectRevert(StakingPool.ZeroAmount.selector);
        stakingPool.stake(0);
        vm.stopPrank();
    }
    
    function test_Stake_WithoutApproval_Reverts() public {
        vm.startPrank(alice);
        vm.expectRevert();
        stakingPool.stake(1000 * 1e18);
        vm.stopPrank();
    }
    
    function test_Stake_Multiple_Accumulates() public {
        uint256 firstStake = 500 * 1e18;
        uint256 secondStake = 300 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), firstStake + secondStake);
        stakingPool.stake(firstStake);
        stakingPool.stake(secondStake);
        vm.stopPrank();
        
        assertEq(stakingPool.getStakedBalance(alice), firstStake + secondStake);
    }
    
    function test_Stake_EmitsEvent() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        
        vm.expectEmit(true, true, true, true);
        emit StakingPool.Staked(alice, stakeAmount, block.timestamp);
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
    }
    
    function test_Unstake_Basic() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        
        stakingPool.unstake(stakeAmount);
        vm.stopPrank();
        
        assertEq(stakingPool.getStakedBalance(alice), 0);
        assertEq(token.balanceOf(alice), INITIAL_BALANCE);
    }
    
    function test_Unstake_MoreThanBalance_Reverts() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        
        vm.expectRevert(StakingPool.InsufficientStake.selector);
        stakingPool.unstake(stakeAmount + 1);
        vm.stopPrank();
    }
    
    function test_Unstake_Partial() public {
        uint256 stakeAmount = 1000 * 1e18;
        uint256 unstakeAmount = 400 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        stakingPool.unstake(unstakeAmount);
        vm.stopPrank();
        
        assertEq(stakingPool.getStakedBalance(alice), stakeAmount - unstakeAmount);
    }
    
    function test_Unstake_AutoClaimsRewards() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        
        vm.warp(block.timestamp + 365 days);
        
        uint256 balanceBefore = token.balanceOf(alice);
        stakingPool.unstake(stakeAmount);
        uint256 balanceAfter = token.balanceOf(alice);
        
        vm.stopPrank();
        
        // Should receive stake + rewards (5% APY)
        uint256 expectedRewards = (stakeAmount * 500) / 10000;
        assertApproxEqAbs(balanceAfter - balanceBefore, stakeAmount + expectedRewards, 1e15);
    }
    
    function test_CalculatePendingRewards_ZeroAtStart() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
        
        assertEq(stakingPool.calculatePendingRewards(alice), 0);
    }
    
    function test_CalculatePendingRewards_LinearGrowth() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 30 days);
        
        uint256 expectedRewards = (stakeAmount * 500 * 30 days) / (365 days * 10000);
        assertApproxEqAbs(stakingPool.calculatePendingRewards(alice), expectedRewards, 1e15);
    }
    
    function test_CalculatePendingRewards_OneYear() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 365 days);
        
        // 5% APY => 50 tokens on 1000
        uint256 expectedRewards = (stakeAmount * 500) / 10000;
        assertApproxEqAbs(stakingPool.calculatePendingRewards(alice), expectedRewards, 1e15);
    }
    
    function test_MultipleUsers_RewardsIsolated() public {
        uint256 aliceStake = 1000 * 1e18;
        uint256 bobStake = 2000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), aliceStake);
        stakingPool.stake(aliceStake);
        vm.stopPrank();
        
        vm.startPrank(bob);
        token.approve(address(stakingPool), bobStake);
        stakingPool.stake(bobStake);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 365 days);
        
        uint256 aliceRewards = stakingPool.calculatePendingRewards(alice);
        uint256 bobRewards = stakingPool.calculatePendingRewards(bob);
        
        // Bob should have ~2x rewards of Alice
        assertApproxEqAbs(bobRewards, aliceRewards * 2, 1e16);
    }
    
    function test_ClaimRewards_Basic() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        
        vm.warp(block.timestamp + 365 days);
        
        uint256 balanceBefore = token.balanceOf(alice);
        stakingPool.claimRewards();
        uint256 balanceAfter = token.balanceOf(alice);
        
        vm.stopPrank();
        
        uint256 expectedRewards = (stakeAmount * 500) / 10000;
        assertApproxEqAbs(balanceAfter - balanceBefore, expectedRewards, 1e15);
        
        // Stake should remain
        assertEq(stakingPool.getStakedBalance(alice), stakeAmount);
    }
    
    function test_ClaimRewards_NoStake_Reverts() public {
        vm.startPrank(alice);
        vm.expectRevert(StakingPool.InsufficientStake.selector);
        stakingPool.claimRewards();
        vm.stopPrank();
    }
    
    function test_ClaimRewards_ZeroRewards_Reverts() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        
        vm.expectRevert(StakingPool.ZeroAmount.selector);
        stakingPool.claimRewards();
        vm.stopPrank();
    }
    
    function test_ClaimRewards_Multiple() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        
        vm.warp(block.timestamp + 30 days);
        stakingPool.claimRewards();
        
        vm.warp(block.timestamp + 30 days);
        stakingPool.claimRewards();
        
        vm.stopPrank();
    }
    
    function test_Stake_After_Claim() public {
        uint256 firstStake = 1000 * 1e18;
        uint256 secondStake = 500 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), firstStake + secondStake);
        stakingPool.stake(firstStake);
        
        vm.warp(block.timestamp + 30 days);
        stakingPool.claimRewards();
        
        stakingPool.stake(secondStake);
        vm.stopPrank();
        
        assertEq(stakingPool.getStakedBalance(alice), firstStake + secondStake);
    }
    
    function test_GetStakeInfo() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        uint256 stakeTime = block.timestamp;
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
        
        (uint256 amount, uint256 pending, uint256 lastUpdate) = stakingPool.getStakeInfo(alice);
        
        assertEq(amount, stakeAmount);
        assertEq(pending, 0);
        assertEq(lastUpdate, stakeTime);
    }
    
    function test_Pause_BlocksStaking() public {
        stakingPool.pause();
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), 1000 * 1e18);
        vm.expectRevert(StakingPool.ContractPaused.selector);
        stakingPool.stake(1000 * 1e18);
        vm.stopPrank();
    }
    
    function test_Unpause_AllowsStaking() public {
        stakingPool.pause();
        stakingPool.unpause();
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), 1000 * 1e18);
        stakingPool.stake(1000 * 1e18);
        vm.stopPrank();
    }
    
    // ============ Phase B: RewardDistributor Tests ============
    
    function test_FundPool_Basic() public {
        uint256 fundAmount = 100_000 * 1e18;
        
        token.approve(address(distributor), fundAmount);
        distributor.fundPool(fundAmount);
        
        assertEq(distributor.getPoolBalance(), REWARD_POOL + fundAmount);
    }
    
    function test_FundPool_ZeroAmount_Reverts() public {
        vm.expectRevert(RewardDistributor.ZeroAmount.selector);
        distributor.fundPool(0);
    }
    
    function test_FundPool_EmitsEvent() public {
        uint256 fundAmount = 100_000 * 1e18;
        
        token.approve(address(distributor), fundAmount);
        
        vm.expectEmit(true, true, true, true);
        emit RewardDistributor.PoolFunded(owner, fundAmount, REWARD_POOL + fundAmount);
        distributor.fundPool(fundAmount);
    }
    
    function test_DistributeRewards_OnlyStakingPool() public {
        vm.startPrank(alice);
        vm.expectRevert(RewardDistributor.Unauthorized.selector);
        distributor.distributeRewards(alice, 100 * 1e18);
        vm.stopPrank();
    }
    
    function test_DistributeRewards_InsufficientBalance_Reverts() public {
        uint256 excessAmount = REWARD_POOL + 1;
        
        vm.startPrank(address(stakingPool));
        vm.expectRevert(RewardDistributor.InsufficientPoolBalance.selector);
        distributor.distributeRewards(alice, excessAmount);
        vm.stopPrank();
    }
    
    function test_SetBaseAPY_Basic() public {
        uint256 newAPY = 1000; // 10%
        distributor.setBaseAPY(newAPY);
        assertEq(distributor.getBaseAPY(), newAPY);
    }
    
    function test_SetBaseAPY_TooHigh_Reverts() public {
        vm.expectRevert(RewardDistributor.InvalidAPY.selector);
        distributor.setBaseAPY(3000); // 30% > MAX_APY
    }
    
    function test_SetBaseAPY_TooLow_Reverts() public {
        vm.expectRevert(RewardDistributor.InvalidAPY.selector);
        distributor.setBaseAPY(50); // 0.5% < MIN_APY
    }
    
    function test_SetBaseAPY_EmitsEvent() public {
        uint256 oldAPY = distributor.getBaseAPY();
        uint256 newAPY = 1000;
        
        vm.expectEmit(true, true, true, true);
        emit RewardDistributor.BaseAPYUpdated(oldAPY, newAPY);
        distributor.setBaseAPY(newAPY);
    }
    
    function test_Distributor_Pause() public {
        distributor.pause();
        
        vm.startPrank(address(stakingPool));
        vm.expectRevert(RewardDistributor.ContractPaused.selector);
        distributor.distributeRewards(alice, 100 * 1e18);
        vm.stopPrank();
    }
    
    function test_EmergencyWithdraw_OnlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(RewardDistributor.Unauthorized.selector);
        distributor.emergencyWithdraw(alice, 1000 * 1e18);
        vm.stopPrank();
    }
    
    function test_EmergencyWithdraw_Basic() public {
        uint256 withdrawAmount = 1000 * 1e18;
        uint256 balanceBefore = token.balanceOf(owner);
        
        distributor.emergencyWithdraw(owner, withdrawAmount);
        
        assertEq(token.balanceOf(owner), balanceBefore + withdrawAmount);
        assertEq(distributor.getPoolBalance(), REWARD_POOL - withdrawAmount);
    }
    
    // ============ Phase C: Integration Tests ============
    
    function test_Integration_FullFlow() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        
        vm.warp(block.timestamp + 365 days);
        
        uint256 balanceBefore = token.balanceOf(alice);
        stakingPool.unstake(stakeAmount);
        uint256 balanceAfter = token.balanceOf(alice);
        
        vm.stopPrank();
        
        uint256 expectedRewards = (stakeAmount * 500) / 10000;
        assertApproxEqAbs(balanceAfter, balanceBefore + stakeAmount + expectedRewards, 1e15);
    }
    
    function test_Integration_MultipleUsersConcurrent() public {
        uint256 aliceStake = 1000 * 1e18;
        uint256 bobStake = 2000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), aliceStake);
        stakingPool.stake(aliceStake);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 30 days);
        
        vm.startPrank(bob);
        token.approve(address(stakingPool), bobStake);
        stakingPool.stake(bobStake);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 365 days);
        
        vm.prank(alice);
        stakingPool.claimRewards();
        
        vm.prank(bob);
        stakingPool.claimRewards();
        
        // Both should have received rewards
        assertTrue(token.balanceOf(alice) > INITIAL_BALANCE - aliceStake);
        assertTrue(token.balanceOf(bob) > INITIAL_BALANCE - bobStake);
    }
    
    function test_Integration_APYChangeMidStaking() public {
        uint256 stakeAmount = 1000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 182 days);
        
        distributor.setBaseAPY(1000); // Change to 10%
        
        vm.warp(block.timestamp + 183 days);
        
        vm.prank(alice);
        stakingPool.claimRewards();
        
        // Should have mixed APY rewards
        assertTrue(token.balanceOf(alice) > INITIAL_BALANCE - stakeAmount);
    }
    
    function test_Integration_PoolRefill() public {
        uint256 stakeAmount = 100_000 * 1e18;
        
        vm.startPrank(alice);
        token.approve(address(stakingPool), stakeAmount);
        stakingPool.stake(stakeAmount);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 365 days);
        
        uint256 poolBalanceBefore = distributor.getPoolBalance();
        
        vm.prank(alice);
        stakingPool.claimRewards();
        
        uint256 poolBalanceAfter = distributor.getPoolBalance();
        
        assertTrue(poolBalanceAfter < poolBalanceBefore);
        
        // Refill pool
        uint256 refillAmount = 1_000_000 * 1e18;
        token.approve(address(distributor), refillAmount);
        distributor.fundPool(refillAmount);
        
        assertEq(distributor.getPoolBalance(), poolBalanceAfter + refillAmount);
    }
}
