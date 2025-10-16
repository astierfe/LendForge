// contracts/oracles/ChainlinkPriceProvider.sol - v1.0
// Provider pour Chainlink price feeds
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPriceProvider.sol";
import "../interfaces/IAggregatorV3.sol";

contract ChainlinkPriceProvider is IPriceProvider {
    AggregatorV3Interface public immutable feed;
    string private _description;
    
    uint256 public constant STALE_THRESHOLD = 1 hours;
    
    error StalePrice();
    error InvalidPrice();
    
    constructor(address _feed, string memory description_) {
        if (_feed == address(0)) revert InvalidPrice();
        feed = AggregatorV3Interface(_feed);
        _description = description_;
    }
    
    function getPrice() external view override returns (int256) {
        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
        ) = feed.latestRoundData();
        
        if (price <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > STALE_THRESHOLD) revert StalePrice();
        
        return price;
    }
    
    function isHealthy() external view override returns (bool) {
        try feed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (price <= 0) return false;
            if (block.timestamp - updatedAt > STALE_THRESHOLD) return false;
            return true;
        } catch {
            return false;
        }
    }
    
    function description() external view override returns (string memory) {
        return _description;
    }
}
