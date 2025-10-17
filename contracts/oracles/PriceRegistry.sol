// contracts/oracles/PriceRegistry.sol - v1.0
// Registry central pour mapper assets vers IPriceProvider
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPriceProvider.sol";

contract PriceRegistry {
    struct AssetConfig {
        address primaryProvider;
        address fallbackProvider;
        bool enabled;
        uint8 decimals;
        string symbol;
    }
    
    // asset address => AssetConfig
    mapping(address => AssetConfig) public assets;
    
    // List of supported assets
    address[] public supportedAssets;
    
    // Admin
    address public owner;
    
    // Events
    event AssetAdded(
        address indexed asset,
        string symbol,
        address primaryProvider,
        address fallbackProvider
    );
    
    event AssetUpdated(
        address indexed asset,
        address primaryProvider,
        address fallbackProvider
    );
    
    event AssetEnabled(address indexed asset, bool enabled);
    
    event PrimaryProviderUpdated(address indexed asset, address newProvider);
    event FallbackProviderUpdated(address indexed asset, address newProvider);
    
    // Errors
    error Unauthorized();
    error AssetNotFound();
    error AssetAlreadyExists();
    error InvalidAddress();
    error AssetDisabled();
    error AllProvidersFailed();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    // Add new asset with primary and optional fallback provider
    function addAsset(
        address asset,
        string calldata symbol,
        address primaryProvider,
        address fallbackProvider,
        uint8 decimals_
    ) external onlyOwner {
        if (asset == address(0)) revert InvalidAddress();
        if (primaryProvider == address(0)) revert InvalidAddress();
        if (assets[asset].enabled) revert AssetAlreadyExists();
        
        assets[asset] = AssetConfig({
            primaryProvider: primaryProvider,
            fallbackProvider: fallbackProvider,
            enabled: true,
            decimals: decimals_,
            symbol: symbol
        });
        
        supportedAssets.push(asset);
        
        emit AssetAdded(asset, symbol, primaryProvider, fallbackProvider);
    }
    
    // Update both providers at once
    function updateAsset(
        address asset,
        address primaryProvider,
        address fallbackProvider
    ) external onlyOwner {
        if (!assets[asset].enabled) revert AssetNotFound();
        if (primaryProvider == address(0)) revert InvalidAddress();
        
        assets[asset].primaryProvider = primaryProvider;
        assets[asset].fallbackProvider = fallbackProvider;
        
        emit AssetUpdated(asset, primaryProvider, fallbackProvider);
    }
    
    // Update only primary provider
    function updatePrimaryProvider(
        address asset,
        address newProvider
    ) external onlyOwner {
        if (!assets[asset].enabled) revert AssetNotFound();
        if (newProvider == address(0)) revert InvalidAddress();
        
        assets[asset].primaryProvider = newProvider;
        emit PrimaryProviderUpdated(asset, newProvider);
    }
    
    // Update only fallback provider (can be address(0) to remove)
    function updateFallbackProvider(
        address asset,
        address newProvider
    ) external onlyOwner {
        if (!assets[asset].enabled) revert AssetNotFound();
        
        assets[asset].fallbackProvider = newProvider;
        emit FallbackProviderUpdated(asset, newProvider);
    }
    
    // Enable/disable asset
    function setAssetEnabled(address asset, bool enabled) external onlyOwner {
        if (assets[asset].primaryProvider == address(0)) revert AssetNotFound();
        
        assets[asset].enabled = enabled;
        emit AssetEnabled(asset, enabled);
    }
    
    // Get price for asset (tries primary, then fallback)
    function getPrice(address asset) external view returns (int256) {
        AssetConfig memory config = assets[asset];
        
        if (config.primaryProvider == address(0)) revert AssetNotFound();
        if (!config.enabled) revert AssetDisabled();

        // Try primary provider
        try IPriceProvider(config.primaryProvider).getPrice() returns (int256 price) {
            if (price > 0) return price;
        } catch {}
        
        // Try fallback provider if exists
        if (config.fallbackProvider != address(0)) {
            try IPriceProvider(config.fallbackProvider).getPrice() returns (int256 price) {
                if (price > 0) return price;
            } catch {}
        }
        
        revert AllProvidersFailed();
    }
    
    // Get primary provider for asset
    function getPrimaryProvider(address asset) external view returns (address) {
        if (!assets[asset].enabled) revert AssetDisabled();
        return assets[asset].primaryProvider;
    }
    
    // Get fallback provider for asset
    function getFallbackProvider(address asset) external view returns (address) {
        if (!assets[asset].enabled) revert AssetDisabled();
        return assets[asset].fallbackProvider;
    }
    
    // Check if asset supported
    function isSupported(address asset) external view returns (bool) {
        return assets[asset].enabled;
    }
    
    // Get all supported assets
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }
    
    // Get asset config
    function getAssetConfig(address asset) external view returns (
        address primaryProvider,
        address fallbackProvider,
        bool enabled,
        uint8 decimals_,
        string memory symbol
    ) {
        AssetConfig memory config = assets[asset];
        return (
            config.primaryProvider,
            config.fallbackProvider,
            config.enabled,
            config.decimals,
            config.symbol
        );
    }
    
    // Get decimals for asset
    function decimals(address asset) external view returns (uint8) {
        if (!assets[asset].enabled) revert AssetDisabled();
        return assets[asset].decimals;
    }
    
    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
}