// contracts/interfaces/IOracleAggregator.sol - v2.0
// Interface publique OracleAggregator
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleAggregator {
    // Events
    event PriceUpdated(
        int256 indexed price,
        string source,
        uint256 timestamp
    );
    
    event DeviationDetected(
        int256 chainlinkPrice,
        int256 uniswapPrice,
        uint256 deviationBps
    );
    
    event EmergencyModeSet(bool enabled, string reason);
    
    event SourceSwitched(
        string fromSource,
        string toSource,
        string reason
    );
    
    // Errors
    error EmergencyModeActive();
    error StalePriceFeed();
    error InvalidPrice();
    error Unauthorized();
    error NoValidPriceSource();
    error DeviationTooHigh();
    error CacheStale();
    
    // Main functions
    function updatePrice() external returns (int256);
    function getCachedPrice() external view returns (
        int256 price,
        uint256 updatedAt,
        string memory source
    );
    function getLatestPrice() external returns (int256);
    
    // Admin functions
    function setEmergencyMode(bool _enabled, string calldata reason) external;
    function setMaxDeviation(uint256 _maxDeviation) external;
    
    // View functions
    function emergencyMode() external view returns (bool);
    function decimals() external view returns (uint8);
    function cachedPrice() external view returns (int256);
    function lastPriceUpdate() external view returns (uint256);
    function lastSource() external view returns (string memory);
}