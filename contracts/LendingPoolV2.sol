// contracts/LendingPoolV2.sol - v2.0
// Lending pool avec nouveau système d'oracles
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ILendingPool.sol";
import "./OracleAggregator.sol";
import "./libraries/HealthCalculator.sol";
import "./libraries/DataTypes.sol";

contract LendingPoolV2 is ILendingPool {
    // ============ State Variables ============
    
    // Oracle aggregator pour tous les prix
    OracleAggregator public immutable oracle;
    
    // Positions des utilisateurs
    mapping(address => DataTypes.Position) public positions;
    
    // Totaux globaux
    uint256 public totalCollateral;
    uint256 public totalBorrowed;
    
    // Collateral asset (ETH address)
    address public constant COLLATERAL_ASSET = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14; // WETH
    
    // Admin
    address public owner;
    bool public paused;
    
    // ============ Constructor ============
    
    constructor(address _oracle) {
        if (_oracle == address(0)) revert InvalidAddress();
        oracle = OracleAggregator(_oracle);
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
    
    // ============ Main Functions ============
    
    function depositCollateral() 
        external 
        payable 
        whenNotPaused 
        nonZeroAmount(msg.value) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        position.collateralAmount += msg.value;
        totalCollateral += msg.value;
        
        emit CollateralDeposited(msg.sender, msg.value, block.timestamp);
    }
    
    function borrow(uint256 amount) 
        external 
        whenNotPaused 
        notInEmergency 
        nonZeroAmount(amount) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        if (position.collateralAmount == 0) revert InsufficientCollateral();
        
        // Get collateral value in USD via oracle
        int256 price = oracle.getPrice(COLLATERAL_ASSET);
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
        
        position.borrowedAmount += amount;
        position.lastInterestUpdate = block.timestamp;
        totalBorrowed += amount;
        
        uint256 healthFactor = HealthCalculator.calculateHealthFactor(
            collateralValueUSD,
            position.borrowedAmount
        );
        
        emit Borrowed(msg.sender, amount, healthFactor);
    }
    
    function repay() 
        external 
        payable 
        whenNotPaused 
        nonZeroAmount(msg.value) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        if (position.borrowedAmount == 0) revert NoDebt();
        
        uint256 repayAmount = msg.value > position.borrowedAmount 
            ? position.borrowedAmount 
            : msg.value;
        
        position.borrowedAmount -= repayAmount;
        totalBorrowed -= repayAmount;
        
        emit Repaid(msg.sender, repayAmount, position.borrowedAmount);
        
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
        
        if (amount > position.collateralAmount) revert InsufficientCollateral();
        
        // If user has debt, check LTV after withdrawal
        if (position.borrowedAmount > 0) {
            uint256 remainingCollateral = position.collateralAmount - amount;
            
            int256 price = oracle.getPrice(COLLATERAL_ASSET);
            require(price > 0, "Invalid price");
            
            uint256 remainingValueUSD = HealthCalculator.convertETHtoUSD(
                remainingCollateral,
                uint256(price)
            );
            
            if (HealthCalculator.exceedsLTV(
                remainingValueUSD,
                position.borrowedAmount,
                0
            )) {
                revert ExceedsLTV();
            }
        }
        
        position.collateralAmount -= amount;
        totalCollateral -= amount;
        
        emit CollateralWithdrawn(msg.sender, amount);
        
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
        
        if (position.borrowedAmount == 0) revert NoDebt();
        
        int256 price = oracle.getPrice(COLLATERAL_ASSET);
        require(price > 0, "Invalid price");
        
        uint256 collateralValueUSD = HealthCalculator.convertETHtoUSD(
            position.collateralAmount,
            uint256(price)
        );
        
        if (!HealthCalculator.isLiquidatable(
            collateralValueUSD,
            position.borrowedAmount
        )) {
            revert HealthyPosition();
        }
        
        uint256 debtToCover = position.borrowedAmount;
        require(msg.value >= debtToCover, "Insufficient payment");
        
        uint256 collateralToSeize = HealthCalculator.calculateLiquidationAmount(
            debtToCover,
            uint256(price)
        );
        
        if (collateralToSeize > position.collateralAmount) {
            collateralToSeize = position.collateralAmount;
        }
        
        position.borrowedAmount = 0;
        position.collateralAmount -= collateralToSeize;
        
        totalBorrowed -= debtToCover;
        totalCollateral -= collateralToSeize;
        
        emit Liquidated(msg.sender, user, debtToCover, collateralToSeize);
        
        (bool success, ) = payable(msg.sender).call{value: collateralToSeize}("");
        require(success, "Collateral transfer failed");
        
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
        
        return HealthCalculator.calculateHealthFactor(
            collateralValueUSD,
            pos.borrowedAmount
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
        return DataTypes.BASE_RATE;
    }
    
    // ============ Internal Helpers ============
    
    function _getCollateralValueUSD(address user) 
        internal 
        returns (uint256) 
    {
        uint256 collateralAmount = positions[user].collateralAmount;
        if (collateralAmount == 0) return 0;
        
        int256 price = oracle.getPrice(COLLATERAL_ASSET);
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