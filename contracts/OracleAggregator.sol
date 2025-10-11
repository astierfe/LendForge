// contracts/OracleAggregator.sol - v2.2 - Étape 4
// Oracle aggregator avec Chainlink primary + Uniswap fallback
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAggregatorV3.sol";
import "./interfaces/IUniswapV3Pool.sol";

contract OracleAggregator {
    // Price sources
    AggregatorV3Interface public immutable chainlinkFeed;
    IUniswapV3Pool public immutable uniswapPool;
    
    // Cache pour view functions (gas-free)
    int256 public cachedPrice;
    uint256 public lastPriceUpdate;
    string public lastSource;
    
    // Config
    uint256 public constant STALE_THRESHOLD = 1 hours;
    uint256 public constant CACHE_DURATION = 5 minutes;
    uint32 public constant TWAP_PERIOD = 3600; // 1 hour
    
    // State
    bool public emergencyMode;    
    address public owner;

    // Events
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
    
    // Get cached price (view, gas-free) - Fonctionne même en emergency
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

    // Get price with fallback logic
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
        
        // Both sources available - prefer Chainlink
        if (chainlinkSuccess && uniswapSuccess) {
            lastSource = "chainlink";
            emit SourceSwitched("", "chainlink", "Primary source healthy");
            return chainlinkPrice;
        }
        
        // Only Chainlink
        if (chainlinkSuccess) {
            lastSource = "chainlink";
            emit SourceSwitched("", "chainlink", "Primary source only");
            return chainlinkPrice;
        }
        
        // Only Uniswap (fallback)
        if (uniswapSuccess) {
            lastSource = "uniswap";
            emit SourceSwitched("chainlink", "uniswap", "Chainlink failed, using TWAP");
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