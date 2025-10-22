// contracts/oracles/OracleAggregatorV3.sol - v3.0
// Oracle aggregator unifié avec PriceRegistry et cache multi-assets
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./oracles/PriceRegistry.sol";
import "./interfaces/IPriceProvider.sol";

contract OracleAggregator {
    PriceRegistry public immutable registry;
    
    struct CachedPrice {
        int256 price;
        uint256 updatedAt;
        string source;
    }
    
    struct DeviationData {
        bool hasDeviation;
        uint256 deviationBps;
        int256 primaryPrice;
        int256 fallbackPrice;
        uint256 timestamp;
    }
    
    // Cache per asset
    mapping(address => CachedPrice) public priceCache;
    
    // Deviation tracking per asset
    mapping(address => DeviationData) public deviations;
    
    // Config
    uint256 public constant CACHE_DURATION = 5 minutes;
    uint256 public constant MAX_DEVIATION = 500; // 5%
    uint256 public constant CRITICAL_DEVIATION = 1000; // 10%
    uint256 public constant BASIS_POINTS = 10000;
    
    // State
    bool public emergencyMode;
    bool public deviationChecksEnabled = true;
    address public owner;
    
    // Events
    event PriceUpdated(
        address indexed asset,
        int256 price,
        string source,
        uint256 timestamp
    );
    event PricesCached(
        address indexed asset,
        int256 primaryPrice,
        int256 fallbackPrice
    );
    event DeviationWarning(
        address indexed asset,
        int256 primaryPrice,
        int256 fallbackPrice,
        uint256 deviationBps
    );
    event CriticalDeviation(
        address indexed asset,
        int256 primaryPrice,
        int256 fallbackPrice,
        uint256 deviationBps
    );
    event FallbackUsed(
        address indexed asset,
        int256 fallbackPrice,
        uint256 deviationBps,
        string reason
    );
    event EmergencyModeSet(bool enabled, string reason);
    event CacheCleared(address indexed asset);
    
    // Errors
    error EmergencyModeActive();
    error Unauthorized();
    error CacheStale();
    error InvalidAddress();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier notInEmergency() {
        if (emergencyMode) revert EmergencyModeActive();
        _;
    }
    
    constructor(address _registry) {
        if (_registry == address(0)) revert InvalidAddress();
        registry = PriceRegistry(_registry);
        owner = msg.sender;
    }
    
    // Get price with cache update (blocked in emergency)
    function getPrice(address asset) external notInEmergency returns (int256) {
        return _updateAndGetPrice(asset);
    }
    
    // Get cached price (view, no update)
    function getCachedPrice(address asset) external view returns (
        int256 price,
        uint256 updatedAt,
        string memory source
    ) {
        CachedPrice memory cached = priceCache[asset];
        
        // Check if cache exists
        if (cached.updatedAt == 0) {
            revert CacheStale();
        }
        
        // Check if cache is stale
        if (block.timestamp - cached.updatedAt > CACHE_DURATION) {
            revert CacheStale();
        }
        
        return (cached.price, cached.updatedAt, cached.source);
    }
    
    // Update price and cache with SMART fallback
    function _updateAndGetPrice(address asset) internal returns (int256) {
        address primaryProvider = registry.getPrimaryProvider(asset);
        address secondaryProvider = registry.getFallbackProvider(asset);
        
        int256 primaryPrice;
        bool primarySuccess = false;
        
        // Try primary
        try IPriceProvider(primaryProvider).getPrice() returns (int256 price) {
            if (price > 0) {
                primaryPrice = price;
                primarySuccess = true;
            }
        } catch {}
        
        int256 secondaryPrice;
        bool secondarySuccess = false;
        
        // Try fallback if exists
        if (secondaryProvider != address(0)) {
            try IPriceProvider(secondaryProvider).getPrice() returns (int256 price) {
                if (price > 0) {
                    secondaryPrice = price;
                    secondarySuccess = true;
                }
            } catch {}
        }
        
        // Determine final price with SMART logic
        int256 finalPrice;
        string memory source;
        
        // Case 1: Both available - check deviation and choose
        if (primarySuccess && secondarySuccess && deviationChecksEnabled) {
            uint256 deviation = _calculateDeviation(primaryPrice, secondaryPrice);
            
            // Store deviation data
            deviations[asset] = DeviationData({
                hasDeviation: true,
                deviationBps: deviation,
                primaryPrice: primaryPrice,
                fallbackPrice: secondaryPrice,
                timestamp: block.timestamp
            });
            
            emit PricesCached(asset, primaryPrice, secondaryPrice);
            
            // CRITICAL FIX: Choose price based on deviation
            if (deviation >= CRITICAL_DEVIATION) {
                // 10%+ deviation → Use fallback + Emergency mode
                finalPrice = secondaryPrice;
                source = string(abi.encodePacked(
                    IPriceProvider(secondaryProvider).description(),
                    " (EMERGENCY)"
                ));
                
                emergencyMode = true;
                emit EmergencyModeSet(true, "Critical price deviation detected");
                emit CriticalDeviation(asset, primaryPrice, secondaryPrice, deviation);
                emit FallbackUsed(asset, secondaryPrice, deviation, "Critical deviation");
                
            } else if (deviation > MAX_DEVIATION) {
                // 5-10% deviation → Use fallback + Warning
                finalPrice = secondaryPrice;
                source = string(abi.encodePacked(
                    IPriceProvider(secondaryProvider).description(),
                    " (DEVIATION)"
                ));
                
                emit DeviationWarning(asset, primaryPrice, secondaryPrice, deviation);
                emit FallbackUsed(asset, secondaryPrice, deviation, "Deviation threshold exceeded");
                
            } else {
                // < 5% deviation → Use primary (normal)
                finalPrice = primaryPrice;
                source = IPriceProvider(primaryProvider).description();
            }
            
        } 
        // Case 2: Only primary available
        else if (primarySuccess) {
            finalPrice = primaryPrice;
            source = IPriceProvider(primaryProvider).description();
            deviations[asset].hasDeviation = false;
        } 
        // Case 3: Only fallback available (primary failed)
        else if (secondarySuccess) {
            finalPrice = secondaryPrice;
            source = string(abi.encodePacked(
                IPriceProvider(secondaryProvider).description(),
                " (PRIMARY FAILED)"
            ));
            emit FallbackUsed(asset, secondaryPrice, 0, "Primary provider failed");
        } 
        // Case 4: Both failed
        else {
            revert PriceRegistry.AllProvidersFailed();
        }
        
        // Update cache
        priceCache[asset] = CachedPrice({
            price: finalPrice,
            updatedAt: block.timestamp,
            source: source
        });
        
        emit PriceUpdated(asset, finalPrice, source, block.timestamp);
        
        return finalPrice;
    }
    
    // Calculate deviation in basis points
    function _calculateDeviation(int256 price1, int256 price2) 
        internal 
        pure 
        returns (uint256) 
    {
        if (price1 == 0 || price2 == 0) return BASIS_POINTS;
        
        int256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        uint256 deviation = (uint256(diff) * BASIS_POINTS) / uint256(price1);
        
        return deviation;
    }
    
    // Get deviation info for asset
    function getDeviationInfo(address asset) external view returns (
        bool hasDeviation,
        uint256 deviationBps,
        int256 primaryPrice,
        int256 fallbackPrice
    ) {
        DeviationData memory dev = deviations[asset];
        return (dev.hasDeviation, dev.deviationBps, dev.primaryPrice, dev.fallbackPrice);
    }
    
    // Clear cache for asset
    function clearCache(address asset) external onlyOwner {
        delete priceCache[asset];
        emit CacheCleared(asset);
    }
    
    // Clear deviation data for asset
    function clearDeviation(address asset) external onlyOwner {
        delete deviations[asset];
    }
    
    // Admin: Set emergency mode
    function setEmergencyMode(bool _enabled, string calldata reason) 
        external 
        onlyOwner 
    {
        emergencyMode = _enabled;
        emit EmergencyModeSet(_enabled, reason);
    }
    
    // Admin: Toggle deviation checks
    function setDeviationChecks(bool _enabled) external onlyOwner {
        deviationChecksEnabled = _enabled;
    }
    
    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
}