// contracts/LendingPool.sol - v3.0
// Lending pool multi-collateral from scratch
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ILendingPool.sol";
import "./OracleAggregator.sol";
import "./CollateralManager.sol";
import "./libraries/HealthCalculator.sol";
import "./libraries/DataTypes.sol";

contract LendingPool is ILendingPool {
    // ============ State Variables ============
    
    OracleAggregator public immutable oracle;
    CollateralManager public collateralManager;
    
    // User borrowed amounts only (collateral in CollateralManager)
    mapping(address => DataTypes.Position) public positions;
    
    uint256 public totalBorrowed;
    
    address public owner;
    bool public paused;
    
    // ============ Constructor ============
    
    constructor(address _oracle, address _collateralManager) {
        if (_oracle == address(0)) revert InvalidAddress();
        if (_collateralManager == address(0)) revert InvalidAddress();
        oracle = OracleAggregator(_oracle);
        collateralManager = CollateralManager(payable(_collateralManager));
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
    {
        revert("Use CollateralManager.depositETH()");
    }
    
    function borrow(uint256 amount) 
        external 
        whenNotPaused 
        notInEmergency 
        nonZeroAmount(amount) 
    {
        DataTypes.Position storage position = positions[msg.sender];
        
        // Get total collateral value from CollateralManager
        uint256 collateralValueUSD = collateralManager.getCollateralValueUSD(msg.sender);
        
        if (collateralValueUSD == 0) revert InsufficientCollateral();
        
        // Check if new borrow exceeds max borrow capacity
        uint256 maxBorrow = collateralManager.getMaxBorrowValue(msg.sender);

        // Convert ETH debt to USD for comparison with maxBorrow (which is in USD)
        int256 ethPrice = oracle.getPrice(address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
        require(ethPrice > 0, "Invalid ETH price");

        uint256 currentDebtUSD = HealthCalculator.convertETHtoUSD(
            position.borrowedAmount,
            uint256(ethPrice)
        );
        uint256 newBorrowUSD = HealthCalculator.convertETHtoUSD(
            amount,
            uint256(ethPrice)
        );
        uint256 newTotalDebtUSD = currentDebtUSD + newBorrowUSD;

        if (newTotalDebtUSD > maxBorrow) {
            revert ExceedsLTV();
        }

        position.borrowedAmount += amount;
        position.lastInterestUpdate = block.timestamp;
        totalBorrowed += amount;

        // Calculate health factor with debt in USD
        uint256 newDebtUSD = HealthCalculator.convertETHtoUSD(
            position.borrowedAmount,
            uint256(ethPrice)
        );
        uint256 healthFactor = HealthCalculator.calculateHealthFactor(
            collateralValueUSD,
            newDebtUSD
        );
        
        emit Borrowed(msg.sender, amount, healthFactor);
        
        // Transfer borrowed amount to user
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");
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
        
        // Refund excess
        if (msg.value > repayAmount) {
            uint256 excess = msg.value - repayAmount;
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            require(success, "Refund failed");
        }
    }
    
    function withdrawCollateral(uint256 /* amount */) 
        external 
        pure
    {
        revert("Use CollateralManager.withdrawETH() or withdrawERC20()");
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
        
        // Get total collateral value
        uint256 collateralValueUSD = collateralManager.getCollateralValueUSD(user);

        // Convert debt to USD for health factor calculation
        int256 ethPrice = oracle.getPrice(address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
        require(ethPrice > 0, "Invalid ETH price");

        uint256 debtUSD = HealthCalculator.convertETHtoUSD(
            position.borrowedAmount,
            uint256(ethPrice)
        );

        // Check if liquidatable
        if (!HealthCalculator.isLiquidatable(
            collateralValueUSD,
            debtUSD
        )) {
            revert HealthyPosition();
        }
        
        uint256 debtToCover = position.borrowedAmount;
        require(msg.value >= debtToCover, "Insufficient payment");
        
        // Calculate total collateral to seize (with bonus)
        uint256 collateralToSeizeUSD = _calculateLiquidationCollateralUSD(
            debtToCover
        );
        
        // Clear user's debt
        position.borrowedAmount = 0;
        totalBorrowed -= debtToCover;
        
        emit Liquidated(msg.sender, user, debtToCover, collateralToSeizeUSD);
        
        // Refund excess payment
        if (msg.value > debtToCover) {
            uint256 excess = msg.value - debtToCover;
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }
        
        // Note: Liquidator must call CollateralManager to claim seized collateral
        // This event signals which collateral can be seized
    }
    
    // ============ View Functions ============
    
    function getPosition(address user) 
        external 
        view 
        returns (Position memory) 
    {
        DataTypes.Position storage pos = positions[user];
        return Position({
            collateralAmount: 0, // Stored in CollateralManager
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

        uint256 collateralValueUSD = collateralManager.getCollateralValueUSD(user);

        // Convert debt to USD for health factor calculation
        int256 ethPrice = oracle.getPrice(address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
        require(ethPrice > 0, "Invalid ETH price");

        uint256 debtUSD = HealthCalculator.convertETHtoUSD(
            pos.borrowedAmount,
            uint256(ethPrice)
        );

        return HealthCalculator.calculateHealthFactor(
            collateralValueUSD,
            debtUSD
        );
    }
    
    function getCollateralValueUSD(address user) 
        external 
        returns (uint256) 
    {
        return collateralManager.getCollateralValueUSD(user);
    }
    
    function getCurrentBorrowRate() 
        external 
        pure 
        returns (uint256) 
    {
        return DataTypes.BASE_RATE;
    }
    
    function getBorrowedAmount(address user) external view returns (uint256) {
        return positions[user].borrowedAmount;
    }
    
    function getMaxBorrowAmount(address user) external returns (uint256) {
        uint256 maxBorrow = collateralManager.getMaxBorrowValue(user);
        uint256 currentDebt = positions[user].borrowedAmount;
        
        if (maxBorrow <= currentDebt) return 0;
        
        return maxBorrow - currentDebt;
    }
    
    function getUserCollaterals(address user) external view returns (
        address[] memory assets,
        uint256[] memory amounts
    ) {
        (assets, amounts, ) = collateralManager.getUserCollaterals(user);
    }
    
    // ============ Internal Helpers ============
    
    function _calculateLiquidationCollateralUSD(
        uint256 debtRepaid
    ) internal pure returns (uint256) {
        // Apply liquidation bonus (10%)
        uint256 bonus = (debtRepaid * DataTypes.LIQUIDATION_BONUS) / 100;
        return debtRepaid + bonus;
    }
    
    // ============ Admin Functions ============
    
    function setCollateralManager(address _manager) external onlyOwner {
        if (_manager == address(0)) revert InvalidAddress();
        collateralManager = CollateralManager(payable(_manager));
    }
    
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
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Emergency withdraw failed");
    }
    
    // ============ Receive ETH ============
    
    receive() external payable {
        // Accept ETH for repayments and liquidations
    }
}