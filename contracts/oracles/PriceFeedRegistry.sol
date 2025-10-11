// contracts/oracles/PriceFeedRegistry.sol - v1.0
// Centralised registry pour gérer multiple price feeds
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IOracleAggregator.sol";

contract PriceFeedRegistry {
    struct FeedConfig {
        address chainlinkFeed;
        address uniswapPool;
        address oracleAggregator;
        bool enabled;
        uint8 decimals;
        string symbol;
    }
    
    // asset address => FeedConfig
    mapping(address => FeedConfig) public feeds;
    
    // List of supported assets
    address[] public supportedAssets;
    
    // Admin
    address public owner;
    
    // Events
    event FeedAdded(
        address indexed asset,
        string symbol,
        address chainlinkFeed,
        address uniswapPool,
        address oracleAggregator
    );
    
    event FeedUpdated(
        address indexed asset,
        address chainlinkFeed,
        address uniswapPool
    );
    
    event FeedEnabled(address indexed asset, bool enabled);
    
    // Errors
    error Unauthorized();
    error FeedNotFound();
    error FeedAlreadyExists();
    error InvalidAddress();
    error FeedDisabled();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    // Add new price feed
    function addFeed(
        address asset,
        string calldata symbol,
        address chainlinkFeed,
        address uniswapPool,
        address oracleAggregator,
        uint8 decimals_
    ) external onlyOwner {
        if (asset == address(0)) revert InvalidAddress();
        if (feeds[asset].enabled) revert FeedAlreadyExists();
        
        feeds[asset] = FeedConfig({
            chainlinkFeed: chainlinkFeed,
            uniswapPool: uniswapPool,
            oracleAggregator: oracleAggregator,
            enabled: true,
            decimals: decimals_,
            symbol: symbol
        });
        
        supportedAssets.push(asset);
        
        emit FeedAdded(asset, symbol, chainlinkFeed, uniswapPool, oracleAggregator);
    }
    
    // Update existing feed addresses
    function updateFeed(
        address asset,
        address chainlinkFeed,
        address uniswapPool
    ) external onlyOwner {
        if (!feeds[asset].enabled) revert FeedNotFound();
        
        feeds[asset].chainlinkFeed = chainlinkFeed;
        feeds[asset].uniswapPool = uniswapPool;
        
        emit FeedUpdated(asset, chainlinkFeed, uniswapPool);
    }
    
    // Enable/disable feed
    function setFeedEnabled(address asset, bool enabled) external onlyOwner {
        if (feeds[asset].oracleAggregator == address(0)) revert FeedNotFound();
        
        feeds[asset].enabled = enabled;
        emit FeedEnabled(asset, enabled);
    }
    
    // Get price for asset
    function getPrice(address asset) external returns (int256) {
        FeedConfig memory config = feeds[asset];
        
        if (!config.enabled) revert FeedDisabled();
        if (config.oracleAggregator == address(0)) revert FeedNotFound();
        
        return IOracleAggregator(config.oracleAggregator).updatePrice();
    }
    
    // Get cached price (view, no gas)
    function getCachedPrice(address asset) external view returns (
        int256 price,
        uint256 updatedAt,
        string memory source
    ) {
        FeedConfig memory config = feeds[asset];
        
        if (!config.enabled) revert FeedDisabled();
        if (config.oracleAggregator == address(0)) revert FeedNotFound();
        
        return IOracleAggregator(config.oracleAggregator).getCachedPrice();
    }
    
    // Get oracle aggregator for asset
    function getOracleAggregator(address asset) external view returns (address) {
        if (!feeds[asset].enabled) revert FeedDisabled();
        return feeds[asset].oracleAggregator;
    }
    
    // Check if asset supported
    function isSupported(address asset) external view returns (bool) {
        return feeds[asset].enabled;
    }
    
    // Get all supported assets
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }
    
    // Get feed config
    function getFeedConfig(address asset) external view returns (
        address chainlinkFeed,
        address uniswapPool,
        address oracleAggregator,
        bool enabled,
        uint8 decimals_,
        string memory symbol
    ) {
        FeedConfig memory config = feeds[asset];
        return (
            config.chainlinkFeed,
            config.uniswapPool,
            config.oracleAggregator,
            config.enabled,
            config.decimals,
            config.symbol
        );
    }
    
    // Get decimals for asset
    function decimals(address asset) external view returns (uint8) {
        if (!feeds[asset].enabled) revert FeedDisabled();
        return feeds[asset].decimals;
    }
    
    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
}