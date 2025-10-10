// contracts/src/SimpleOracle.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

contract SimpleOracle {
    IAggregatorV3 public immutable chainlinkFeed;
    bool public emergencyMode;
    address public owner;
    
    event EmergencyModeSet(bool enabled);
    
    error EmergencyModeActive();
    error InvalidPrice();
    error Unauthorized();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    constructor(address _chainlinkFeed) {
        chainlinkFeed = IAggregatorV3(_chainlinkFeed);
        owner = msg.sender;
    }
    
    function getLatestPrice() external view returns (int256) {
        if (emergencyMode) revert EmergencyModeActive();
        
        (, int256 price, , uint256 updatedAt, ) = chainlinkFeed.latestRoundData();
        
        if (price <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > 1 hours) revert InvalidPrice();
        
        return price;
    }
    
    function decimals() external view returns (uint8) {
        return chainlinkFeed.decimals();
    }
    
    function setEmergencyMode(bool _enabled) external onlyOwner {
        emergencyMode = _enabled;
        emit EmergencyModeSet(_enabled);
    }
}