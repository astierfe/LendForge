// contracts/interfaces/ILendingPool.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILendingPool {
    struct Position {
        uint256 collateralAmount;
        uint256 borrowedAmount;
        uint256 lastInterestUpdate;
        uint256 accumulatedInterest;
    }
    
    event CollateralDeposited(address indexed user, uint256 amount, uint256 timestamp);
    event Borrowed(address indexed user, uint256 amount, uint256 healthFactor);
    event Repaid(address indexed user, uint256 amount, uint256 remainingDebt);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);
    event InterestAccrued(address indexed user, uint256 interestAmount);
    
    error ZeroAmount();
    error InsufficientCollateral();
    error ExceedsLTV();
    error NoDebt();
    error HealthyPosition();
    error OracleEmergencyMode();
    error InvalidAddress();
    
    function depositCollateral() external payable;
    function borrow(uint256 amount) external;
    function repay() external payable;
    function withdrawCollateral(uint256 amount) external;
    function liquidate(address user) external payable;
    
    function getPosition(address user) external view returns (Position memory);
    function getHealthFactor(address user) external returns (uint256);
    function getCollateralValueUSD(address user) external returns (uint256);
    function getCurrentBorrowRate() external view returns (uint256);
}
