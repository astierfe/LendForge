// contracts/LendingPoolV2.sol - v1.0 - Skeleton
// Contract principal du protocole de lending
// Phase 1.1.4: Structure uniquement, logique en Phase 2
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ILendingPool.sol";
import "./interfaces/IOracleAggregator.sol";
import "./libraries/HealthCalculator.sol";
import "./libraries/DataTypes.sol";

contract LendingPoolV2 is ILendingPool {
    // ============ State Variables ============
    
    // Oracle pour prix ETH/USD
    IOracleAggregator public immutable oracle;
    
    // Positions des utilisateurs
    mapping(address => DataTypes.Position) public positions;
    
    // Totaux globaux
    uint256 public totalCollateral;
    uint256 public totalBorrowed;
    
    // Admin
    address public owner;
    bool public paused;
    
    // ============ Constructor ============
    
    constructor(address _oracle) {
        if (_oracle == address(0)) revert InvalidAddress();
        oracle = IOracleAggregator(_oracle);
        owner = msg.sender;
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    modifier notInEmergency() {
        if (oracle.emergencyMode()) revert OracleEmergencyMode();
        _;
    }
    
    modifier nonZeroAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }
    
    // ============ Main Functions (Placeholders) ============
    
    function depositCollateral() 
        external 
        payable 
        whenNotPaused 
        nonZeroAmount(msg.value) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        // Update position
        position.collateralAmount += msg.value;
        
        // Update global total
        totalCollateral += msg.value;
        
        // Emit event
        emit CollateralDeposited(msg.sender, msg.value, block.timestamp);
    }
    
    function borrow(uint256 amount) 
        external 
        whenNotPaused 
        notInEmergency 
        nonZeroAmount(amount) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        // Check user has collateral
        if (position.collateralAmount == 0) revert InsufficientCollateral();
        
        // Get collateral value in USD
        int256 price = oracle.getLatestPrice();
        require(price > 0, "Invalid price");
        
        uint256 collateralValueUSD = HealthCalculator.convertETHtoUSD(
            position.collateralAmount,
            uint256(price)
        );
        
        // Check if new borrow exceeds LTV
        if (HealthCalculator.exceedsLTV(
            collateralValueUSD,
            position.borrowedAmount,
            amount
        )) {
            revert ExceedsLTV();
        }
        
        // Update position
        position.borrowedAmount += amount;
        position.lastInterestUpdate = block.timestamp;
        
        // Update global total
        totalBorrowed += amount;
        
        // Calculate health factor after borrow
        uint256 healthFactor = HealthCalculator.calculateHealthFactor(
            collateralValueUSD,
            position.borrowedAmount
        );
        
        // Emit event
        emit Borrowed(msg.sender, amount, healthFactor);
        
        // Note: Pas de transfer token dans ce PoC (sera fait en V2 avec ERC20)
        // Dans production: transfer $MYTKN tokens to msg.sender
    }
    
    function repay() 
        external 
        payable 
        whenNotPaused 
        nonZeroAmount(msg.value) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        // Check user has debt
        if (position.borrowedAmount == 0) revert NoDebt();
        
        // Calculate actual repayment amount
        uint256 repayAmount = msg.value > position.borrowedAmount 
            ? position.borrowedAmount 
            : msg.value;
        
        // Update position
        position.borrowedAmount -= repayAmount;
        
        // Update global total
        totalBorrowed -= repayAmount;
        
        // Emit event
        emit Repaid(msg.sender, repayAmount, position.borrowedAmount);
        
        // Refund excess if overpaid
        if (msg.value > repayAmount) {
            uint256 excess = msg.value - repayAmount;
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            require(success, "Refund failed");
        }
    }
    
    function withdrawCollateral(uint256 amount) 
        external 
        whenNotPaused 
        nonZeroAmount(amount) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        // Check sufficient collateral
        if (amount > position.collateralAmount) revert InsufficientCollateral();
        
        // Si user a une dette, vérifier que withdrawal ne casse pas le LTV
        if (position.borrowedAmount > 0) {
            uint256 remainingCollateral = position.collateralAmount - amount;
            
            // Get collateral value USD après withdrawal
            int256 price = oracle.getLatestPrice();
            require(price > 0, "Invalid price");
            
            uint256 remainingValueUSD = HealthCalculator.convertETHtoUSD(
                remainingCollateral,
                uint256(price)
            );
            
            // Check si dépasse LTV
            if (HealthCalculator.exceedsLTV(
                remainingValueUSD,
                position.borrowedAmount,
                0  // Pas de nouveau borrow
            )) {
                revert ExceedsLTV();
            }
        }
        
        // Update position
        position.collateralAmount -= amount;
        
        // Update global total
        totalCollateral -= amount;
        
        // Emit event
        emit CollateralWithdrawn(msg.sender, amount);
        
        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");
    }
    
    function liquidate(address user) 
        external 
        payable 
        whenNotPaused 
        notInEmergency 
    {
        if (user == address(0)) revert InvalidAddress();
        
        DataTypes.Position storage position = positions[user];
        
        // Check user has debt
        if (position.borrowedAmount == 0) revert NoDebt();
        
        // Get current price
        int256 price = oracle.getLatestPrice();
        require(price > 0, "Invalid price");
        
        // Calculate collateral value in USD
        uint256 collateralValueUSD = HealthCalculator.convertETHtoUSD(
            position.collateralAmount,
            uint256(price)
        );
        
        // Check if position is liquidatable (HF < 1.0)
        if (!HealthCalculator.isLiquidatable(
            collateralValueUSD,
            position.borrowedAmount
        )) {
            revert HealthyPosition();
        }
        
        // Liquidator must pay at least the debt
        uint256 debtToCover = position.borrowedAmount;
        require(msg.value >= debtToCover, "Insufficient payment");
        
        // Calculate collateral to seize (includes 10% bonus)
        uint256 collateralToSeize = HealthCalculator.calculateLiquidationAmount(
            debtToCover,
            uint256(price)
        );
        
        // Cap collateral seized to available amount
        if (collateralToSeize > position.collateralAmount) {
            collateralToSeize = position.collateralAmount;
        }
        
        // Update position (clear debt and collateral)
        position.borrowedAmount = 0;
        position.collateralAmount -= collateralToSeize;
        
        // Update globals
        totalBorrowed -= debtToCover;
        totalCollateral -= collateralToSeize;
        
        // Emit event
        emit Liquidated(msg.sender, user, debtToCover, collateralToSeize);
        
        // Transfer collateral to liquidator
        (bool success, ) = payable(msg.sender).call{value: collateralToSeize}("");
        require(success, "Collateral transfer failed");
        
        // Refund excess payment if any
        if (msg.value > debtToCover) {
            uint256 excess = msg.value - debtToCover;
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }
    }
    
    // ============ View Functions ============
    
    function getPosition(address user) 
        external 
        view 
        returns (Position memory) 
    {
        DataTypes.Position storage pos = positions[user];
        return Position({
            collateralAmount: pos.collateralAmount,
            borrowedAmount: pos.borrowedAmount,
            lastInterestUpdate: pos.lastInterestUpdate,
            accumulatedInterest: pos.accumulatedInterest
        });
    }
    
    function getHealthFactor(address user) 
        external 
        returns (uint256) 
    {
        DataTypes.Position storage pos = positions[user];
        
        if (pos.borrowedAmount == 0) {
            return type(uint256).max;
        }
        
        uint256 collateralValueUSD = _getCollateralValueUSD(user);
        uint256 debtValueUSD = pos.borrowedAmount;
        
        return HealthCalculator.calculateHealthFactor(
            collateralValueUSD,
            debtValueUSD
        );
    }
    
    function getCollateralValueUSD(address user) 
        external 
        returns (uint256) 
    {
        return _getCollateralValueUSD(user);
    }
    
    function getCurrentBorrowRate() 
        external 
        pure 
        returns (uint256) 
    {
        // TODO Phase 2: Interest rate model
        return DataTypes.BASE_RATE;
    }
    
    // ============ Internal Helpers ============
    
    function _getCollateralValueUSD(address user) 
        internal 
        returns (uint256) 
    {
        uint256 collateralAmount = positions[user].collateralAmount;
        if (collateralAmount == 0) return 0;
        
        int256 price = oracle.getLatestPrice();
        require(price > 0, "Invalid price");
        
        return HealthCalculator.convertETHtoUSD(
            collateralAmount,
            uint256(price)
        );
    }
    
    // ============ Admin Functions ============
    
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
    
    // ============ Receive ETH ============
    
    receive() external payable {
        revert("Use depositCollateral()");
    }
}