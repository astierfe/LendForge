// contracts/oracles/MockDAIPriceProvider.sol - v1.0
// Mock provider pour DAI/USD (feed Sepolia unreliable)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../interfaces/IPriceProvider.sol";

contract MockDAIPriceProvider is IPriceProvider {
    int256 public price;
    uint256 public lastUpdatedAt;
    address public owner;
    
    uint256 public constant STALE_THRESHOLD = 24 hours;
    
    error Unauthorized();
    error InvalidPrice();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    constructor() {
        owner = msg.sender;
        price = 1e8; // $1.00
        lastUpdatedAt = block.timestamp;
    }
    
    function setPrice(int256 _price) external onlyOwner {
        if (_price <= 0) revert InvalidPrice();
        price = _price;
        lastUpdatedAt = block.timestamp;
    }
    
    function getPrice() external view override returns (int256) {
        if (price <= 0) revert InvalidPrice();
        return price;
    }
    
    function isHealthy() external view override returns (bool) {
        if (price <= 0) return false;
        if (block.timestamp - lastUpdatedAt > STALE_THRESHOLD) return false;
        return true;
    }
    
    function description() external pure override returns (string memory) {
        return "Mock DAI/USD (Chainlink unavailable)";
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidPrice();
        owner = newOwner;
    }
}
