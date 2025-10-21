// contracts/StakingPool.sol - v1.0
// Staking pool pour LFTKN avec rewards APY
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IRewardDistributor {
    function distributeRewards(address user, uint256 amount) external;
    function getBaseAPY() external view returns (uint256);
}

contract StakingPool is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    IERC20 public immutable stakingToken;
    IRewardDistributor public rewardDistributor;
    
    // User staking data
    struct StakeInfo {
        uint256 amount;
        uint256 lastRewardUpdate;
        uint256 pendingRewards;
    }
    
    mapping(address => StakeInfo) public stakes;
    
    uint256 public totalStaked;
    
    address public owner;
    bool public paused;
    
    // ============ Events ============
    
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardDistributorUpdated(address indexed newDistributor);
    event Paused(bool paused);
    
    // ============ Errors ============
    
    error Unauthorized();
    error InvalidAddress();
    error ZeroAmount();
    error InsufficientStake();
    error ContractPaused();
    error DistributorNotSet();
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    modifier nonZeroAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _stakingToken) {
        if (_stakingToken == address(0)) revert InvalidAddress();
        stakingToken = IERC20(_stakingToken);
        owner = msg.sender;
    }
    
    // ============ Main Functions ============
    
    function stake(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        nonZeroAmount(amount) 
    {
        StakeInfo storage userStake = stakes[msg.sender];
        
        // Claim pending rewards before staking more
        if (userStake.amount > 0) {
            _updateRewards(msg.sender);
        }
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        userStake.amount += amount;
        userStake.lastRewardUpdate = block.timestamp;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    function unstake(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        nonZeroAmount(amount) 
    {
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.amount < amount) revert InsufficientStake();
        
        // Update and claim all pending rewards
        _updateRewards(msg.sender);
        uint256 rewardsToClaim = userStake.pendingRewards;
        
        if (rewardsToClaim > 0) {
            userStake.pendingRewards = 0;
            _distributeRewards(msg.sender, rewardsToClaim);
        }
        
        userStake.amount -= amount;
        totalStaked -= amount;
        
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount, rewardsToClaim);
    }
    
    function claimRewards() external nonReentrant whenNotPaused {
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.amount == 0) revert InsufficientStake();
        
        _updateRewards(msg.sender);
        
        uint256 rewardsToClaim = userStake.pendingRewards;
        if (rewardsToClaim == 0) revert ZeroAmount();
        
        userStake.pendingRewards = 0;
        
        _distributeRewards(msg.sender, rewardsToClaim);
        
        emit RewardsClaimed(msg.sender, rewardsToClaim);
    }
    
    // ============ View Functions ============
    
    function getStakedBalance(address user) external view returns (uint256) {
        return stakes[user].amount;
    }
    
    function calculatePendingRewards(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        
        if (userStake.amount == 0) return 0;
        
        uint256 timeElapsed = block.timestamp - userStake.lastRewardUpdate;
        
        if (timeElapsed == 0) return userStake.pendingRewards;
        
        uint256 baseAPY = _getBaseAPY();
        
        // rewards = stakedAmount * APY * timeElapsed / (365 days * 10000)
        uint256 newRewards = (userStake.amount * baseAPY * timeElapsed) / (365 days * 10000);
        
        return userStake.pendingRewards + newRewards;
    }
    
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 pendingRewards,
        uint256 lastUpdate
    ) {
        StakeInfo memory userStake = stakes[user];
        uint256 totalPending = calculatePendingRewards(user);
        
        return (userStake.amount, totalPending, userStake.lastRewardUpdate);
    }
    
    function getTotalStaked() external view returns (uint256) {
        return totalStaked;
    }
    
    // ============ Internal Functions ============
    
    function _updateRewards(address user) internal {
        StakeInfo storage userStake = stakes[user];
        
        uint256 pending = calculatePendingRewards(user);
        userStake.pendingRewards = pending;
        userStake.lastRewardUpdate = block.timestamp;
    }
    
    function _distributeRewards(address user, uint256 amount) internal {
        if (address(rewardDistributor) == address(0)) revert DistributorNotSet();
        rewardDistributor.distributeRewards(user, amount);
    }
    
    function _getBaseAPY() internal view returns (uint256) {
        if (address(rewardDistributor) == address(0)) return 500; // 5% default
        return rewardDistributor.getBaseAPY();
    }
    
    // ============ Admin Functions ============
    
    function setRewardDistributor(address _distributor) external onlyOwner {
        if (_distributor == address(0)) revert InvalidAddress();
        rewardDistributor = IRewardDistributor(_distributor);
        emit RewardDistributorUpdated(_distributor);
    }
    
    function pause() external onlyOwner {
        paused = true;
        emit Paused(true);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Paused(false);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
}
