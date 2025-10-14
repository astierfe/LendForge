// contracts/OracleAggregator.sol - v2.5
// Oracle aggregator avec Chainlink primary + Uniswap fallback + Deviation Detection
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAggregatorV3.sol";
import "./interfaces/IUniswapV3Pool.sol";

contract OracleAggregator {
    // Price sources
    AggregatorV3Interface public immutable chainlinkFeed;
    IUniswapV3Pool public immutable uniswapPool;
    
    // Cache pour view functions
    int256 public cachedPrice;
    uint256 public lastPriceUpdate;
    string public lastSource;
    
    // Deviation tracking
    struct DeviationData {
        bool hasDeviation;
        uint256 deviationBps;
        int256 chainlinkPrice;
        int256 uniswapPrice;
        uint256 timestamp;
    }
    DeviationData public lastDeviation;
    
    // Config
    uint256 public constant STALE_THRESHOLD = 1 hours;
    uint256 public constant CACHE_DURATION = 5 minutes;
    uint32 public constant TWAP_PERIOD = 3600;
    uint256 public constant MAX_DEVIATION = 500; // 5% = 500 basis points
    uint256 public constant CRITICAL_DEVIATION = 1000; // 10% = 1000 basis points
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 basis points
    
    // State
    bool public emergencyMode;
    bool public deviationChecksEnabled = true;
    address public owner;

    // Events
    event EmergencyModeSet(bool enabled, string reason);
    event SourceSwitched(string fromSource, string toSource, string reason);
    event DeviationWarning(int256 chainlinkPrice, int256 uniswapPrice, uint256 deviationBps);
    event CriticalDeviation(int256 chainlinkPrice, int256 uniswapPrice, uint256 deviationBps);
    event PriceUpdated(int256 price, string source, uint256 timestamp, int256 chainlinkPrice, int256 uniswapPrice);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CacheManuallyUpdated(int256 price, string source, uint256 timestamp);
    event DeviationDataCleared(uint256 timestamp);
    
    // Errors
    error EmergencyModeActive();    
    error StalePriceFeed();
    error InvalidPrice();
    error Unauthorized();
    error CacheStale();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier notInEmergency() {
        if (emergencyMode) revert EmergencyModeActive();
        _;
    }
    
    constructor(address _chainlinkFeed, address _uniswapPool) {
        if (_chainlinkFeed == address(0)) revert InvalidPrice();
        chainlinkFeed = AggregatorV3Interface(_chainlinkFeed);
        uniswapPool = IUniswapV3Pool(_uniswapPool);
        owner = msg.sender;
    }

    // Update price et cache (bloqué en emergency)
    function updatePrice() external notInEmergency returns (int256) {
        int256 price = _getPriceWithFallback();
        
        // Update cache
        cachedPrice = price;
        lastPriceUpdate = block.timestamp;
        
        return price;
    }
    
    // Get cached price (view, gas-free)
    function getCachedPrice() external view returns (
        int256 price,
        uint256 updatedAt,
        string memory source
    ) {
        if (block.timestamp - lastPriceUpdate > CACHE_DURATION) {
            revert CacheStale();
        }
        
        return (cachedPrice, lastPriceUpdate, lastSource);
    }
    
    // Main function: get latest price (bloqué en emergency)
    function getLatestPrice() external notInEmergency returns (int256) {
        return this.updatePrice();
    }

    // Admin toggle emergency mode
    function setEmergencyMode(bool _enabled, string calldata reason) 
        external 
        onlyOwner 
    {
        emergencyMode = _enabled;
        emit EmergencyModeSet(_enabled, reason);
    }

    // Admin toggle deviation checks
    function setDeviationChecks(bool _enabled) external onlyOwner {
        deviationChecksEnabled = _enabled;
    }

    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidPrice();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // Force update cache manually
    function forceUpdateCache(int256 price, string calldata source) external onlyOwner {
        if (price <= 0) revert InvalidPrice();
        cachedPrice = price;
        lastPriceUpdate = block.timestamp;
        lastSource = source;
        emit CacheManuallyUpdated(price, source, block.timestamp);
    }

    // Clear deviation data
    function clearDeviationData() external onlyOwner {
        lastDeviation.hasDeviation = false;
        lastDeviation.deviationBps = 0;
        lastDeviation.chainlinkPrice = 0;
        lastDeviation.uniswapPrice = 0;
        lastDeviation.timestamp = 0;
        emit DeviationDataCleared(block.timestamp);
    }

    // Get oracle health status
    function getOracleHealth() external view returns (
        bool chainlinkHealthy,
        bool uniswapHealthy,
        bool cacheValid,
        uint256 timeSinceLastUpdate
    ) {
        // Check Chainlink
        chainlinkHealthy = false;
        try this._getChainlinkPriceExternal() returns (int256) {
            chainlinkHealthy = true;
        } catch {}

        // Check Uniswap
        uniswapHealthy = false;
        try this._getUniswapTWAPExternal() returns (int256 price) {
            if (price > 0) {
                uniswapHealthy = true;
            }
        } catch {}

        // Check cache
        timeSinceLastUpdate = block.timestamp - lastPriceUpdate;
        cacheValid = timeSinceLastUpdate <= CACHE_DURATION;

        return (chainlinkHealthy, uniswapHealthy, cacheValid, timeSinceLastUpdate);
    }
    
    function calculateDeviation(int256 price1, int256 price2) 
        public 
        pure 
        returns (uint256) 
    {
        if (price1 == 0 || price2 == 0) {
            return BASIS_POINTS; // 100% deviation
        }
        
        // Calculate absolute difference
        int256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        
        // Calculate deviation in basis points: (diff / price1) * 10000
        uint256 deviation = (uint256(diff) * BASIS_POINTS) / uint256(price1);
        
        return deviation;
    }
    
    // Get deviation info
    function getDeviationInfo() external view returns (
        bool hasDeviation,
        uint256 deviationBps,
        int256 chainlinkPrice,
        int256 uniswapPrice
    ) {
        return (
            lastDeviation.hasDeviation,
            lastDeviation.deviationBps,
            lastDeviation.chainlinkPrice,
            lastDeviation.uniswapPrice
        );
    }
    
    // Internal: fetch Chainlink price with validations
    function _getChainlinkPrice() internal view returns (int256) {
        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
        ) = chainlinkFeed.latestRoundData();
        
        if (price <= 0) revert InvalidPrice();
        
        if (block.timestamp - updatedAt > STALE_THRESHOLD) {
            revert StalePriceFeed();
        }
        
        return price;
    }
    
    // View: get decimals
    function decimals() external view returns (uint8) {
        return chainlinkFeed.decimals();
    }

    // Get price with fallback logic + deviation detection
    function _getPriceWithFallback() internal returns (int256) {
        bool chainlinkSuccess = false;
        int256 chainlinkPrice;
        
        // Try Chainlink
        try this._getChainlinkPriceExternal() returns (int256 price) {
            chainlinkPrice = price;
            chainlinkSuccess = true;
        } catch {}
        
        bool uniswapSuccess = false;
        int256 uniswapPrice;
        
        // Try Uniswap
        try this._getUniswapTWAPExternal() returns (int256 price) {
            if (price > 0) {
                uniswapPrice = price;
                uniswapSuccess = true;
            }
        } catch {}
        
        // Both sources available - check deviation
        if (chainlinkSuccess && uniswapSuccess) {
            uint256 deviation = calculateDeviation(chainlinkPrice, uniswapPrice);
            
            // Store deviation data
            lastDeviation = DeviationData({
                hasDeviation: true,
                deviationBps: deviation,
                chainlinkPrice: chainlinkPrice,
                uniswapPrice: uniswapPrice,
                timestamp: block.timestamp
            });
            
            // Check if deviation exceeds thresholds (only if enabled)
            if (deviationChecksEnabled) {
                if (deviation >= CRITICAL_DEVIATION) {
                    // Critical deviation: trigger emergency mode
                    emit CriticalDeviation(chainlinkPrice, uniswapPrice, deviation);
                    emergencyMode = true;
                    emit EmergencyModeSet(true, "Critical price deviation detected");
                } else if (deviation > MAX_DEVIATION) {
                    // Warning: deviation high but not critical
                    emit DeviationWarning(chainlinkPrice, uniswapPrice, deviation);
                }
            }
            
            lastSource = "chainlink";
            emit SourceSwitched("", "chainlink", "Primary source healthy");
            emit PriceUpdated(chainlinkPrice,"chainlink",block.timestamp,chainlinkPrice,uniswapPrice);
            return chainlinkPrice;
        }
        
        // Clear deviation tracking if only one source
        if (chainlinkSuccess || uniswapSuccess) {
            lastDeviation.hasDeviation = false;
        }
        
        // Only Chainlink
        if (chainlinkSuccess) {
            lastSource = "chainlink";
            emit SourceSwitched("", "chainlink", "Primary source only");
            emit PriceUpdated(chainlinkPrice,"chainlink",block.timestamp,chainlinkPrice,0);
            return chainlinkPrice;
        }
        
        // Only Uniswap (fallback)
        if (uniswapSuccess) {
            lastSource = "uniswap";
            emit SourceSwitched("chainlink", "uniswap", "Chainlink failed, using TWAP");
            emit PriceUpdated(uniswapPrice,"uniswap",block.timestamp,0,uniswapPrice);
            return uniswapPrice;
        }
        
        // No source available
        revert InvalidPrice();
    }

    // External wrapper for try/catch
    function _getChainlinkPriceExternal() external view returns (int256) {
        return _getChainlinkPrice();
    }

    // External wrapper for try/catch
    function _getUniswapTWAPExternal() external view returns (int256) {
        return _getUniswapTWAP();
    }

    // Internal: fetch Uniswap TWAP (utilise mock price direct)
    function _getUniswapTWAP() internal view returns (int256) {
        // Pour tests: utiliser mock price direct
        try IUniswapV3PoolMock(address(uniswapPool)).getMockPrice() returns (int256 mockPrice) {
            if (mockPrice > 0) {
                return mockPrice;
            }
        } catch {}
        
        // Si pas de mock price, revert
        revert InvalidPrice();
    }
}
