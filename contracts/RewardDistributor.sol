// contracts/RewardDistributor.sol - v1.0
// Gestion du pool de rewards et distribution aux stakers
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RewardDistributor {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    IERC20 public immutable rewardToken;
    address public stakingPool;
    address public owner;
    
    uint256 public baseAPY = 500; // 5% = 500 basis points
    uint256 public constant MAX_APY = 2500; // 25% max
    uint256 public constant MIN_APY = 100; // 1% min
    
    uint256 public totalDistributed;
    
    bool public paused;
    
    // ============ Events ============
    
    event PoolFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event RewardsDistributed(address indexed user, uint256 amount);
    event BaseAPYUpdated(uint256 oldAPY, uint256 newAPY);
    event StakingPoolUpdated(address indexed newPool);
    event Paused(bool paused);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    
    // ============ Errors ============
    
    error Unauthorized();
    error InvalidAddress();
    error ZeroAmount();
    error InsufficientPoolBalance();
    error InvalidAPY();
    error ContractPaused();
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier onlyStakingPool() {
        if (msg.sender != stakingPool) revert Unauthorized();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _rewardToken) {
        if (_rewardToken == address(0)) revert InvalidAddress();
        rewardToken = IERC20(_rewardToken);
        owner = msg.sender;
    }
    
    // ============ Main Functions ============
    
    function distributeRewards(address user, uint256 amount) 
        external 
        onlyStakingPool 
        whenNotPaused 
    {
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        
        uint256 poolBalance = rewardToken.balanceOf(address(this));
        if (poolBalance < amount) revert InsufficientPoolBalance();
        
        totalDistributed += amount;
        
        rewardToken.safeTransfer(user, amount);
        
        emit RewardsDistributed(user, amount);
    }
    
    // ============ Admin Functions ============
    
    function fundPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 newBalance = rewardToken.balanceOf(address(this));
        
        emit PoolFunded(msg.sender, amount, newBalance);
    }
    
    function setBaseAPY(uint256 newAPY) external onlyOwner {
        if (newAPY < MIN_APY || newAPY > MAX_APY) revert InvalidAPY();
        
        uint256 oldAPY = baseAPY;
        baseAPY = newAPY;
        
        emit BaseAPYUpdated(oldAPY, newAPY);
    }
    
    function setStakingPool(address _stakingPool) external onlyOwner {
        if (_stakingPool == address(0)) revert InvalidAddress();
        stakingPool = _stakingPool;
        emit StakingPoolUpdated(_stakingPool);
    }
    
    function pause() external onlyOwner {
        paused = true;
        emit Paused(true);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Paused(false);
    }
    
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        
        uint256 poolBalance = rewardToken.balanceOf(address(this));
        if (poolBalance < amount) revert InsufficientPoolBalance();
        
        rewardToken.safeTransfer(to, amount);
        
        emit EmergencyWithdraw(to, amount);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
    
    // ============ View Functions ============
    
    function getPoolBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }
    
    function getBaseAPY() external view returns (uint256) {
        return baseAPY;
    }
    
    function getTotalDistributed() external view returns (uint256) {
        return totalDistributed;
    }
    
    function canDistribute(uint256 amount) external view returns (bool) {
        if (paused) return false;
        uint256 poolBalance = rewardToken.balanceOf(address(this));
        return poolBalance >= amount;
    }
}
