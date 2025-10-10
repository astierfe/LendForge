// script/DeployAll.s.sol - v1.0
// Deploy Oracle + LendingPool sur Sepolia
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Script.sol";
import "../contracts/LendingPoolV2.sol";

// Mock Chainlink feed pour Sepolia (pas de vrai feed ETH/USD)
contract MockChainlinkFeed {
    int256 public price = 2000e8; // $2000
    uint256 public updatedAt = block.timestamp;
    
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt_,
            uint80 answeredInRound
        )
    {
        return (1, price, block.timestamp, updatedAt, 1);
    }
    
    function decimals() external pure returns (uint8) {
        return 8;
    }
    
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }
}

// Mock Uniswap pool pour fallback
contract MockUniswapPool {
    function observe(uint32[] calldata)
        external
        pure
        returns (int56[] memory tickCumulatives, uint160[] memory)
    {
        tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600 * 100; // Mock tick
        
        uint160[] memory liquidity = new uint160[](2);
        return (tickCumulatives, liquidity);
    }
}

// Simplified Oracle for PoC (no TWAP complexity)
contract SimpleOracle {
    MockChainlinkFeed public immutable chainlinkFeed;
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
        chainlinkFeed = MockChainlinkFeed(_chainlinkFeed);
        owner = msg.sender;
    }
    
    function getLatestPrice() external view returns (int256) {
        if (emergencyMode) revert EmergencyModeActive();
        
        (, int256 price, , uint256 updatedAt, ) = chainlinkFeed.latestRoundData();
        
        if (price <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > 1 hours) revert InvalidPrice();
        
        return price;
    }
    
    function decimals() external pure returns (uint8) {
        return 8;
    }
    
    function setEmergencyMode(bool _enabled) external onlyOwner {
        emergencyMode = _enabled;
        emit EmergencyModeSet(_enabled);
    }
}

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy Mock Chainlink Feed
        console.log("Deploying MockChainlinkFeed...");
        MockChainlinkFeed chainlinkFeed = new MockChainlinkFeed();
        console.log("MockChainlinkFeed deployed at:", address(chainlinkFeed));
        
        // 2. Deploy Mock Uniswap Pool (optionnel, pas utilisé ici)
        console.log("Deploying MockUniswapPool...");
        MockUniswapPool uniswapPool = new MockUniswapPool();
        console.log("MockUniswapPool deployed at:", address(uniswapPool));
        
        // 3. Deploy SimpleOracle
        console.log("Deploying SimpleOracle...");
        SimpleOracle oracle = new SimpleOracle(address(chainlinkFeed));
        console.log("SimpleOracle deployed at:", address(oracle));
        
        // 4. Deploy LendingPoolV2
        console.log("Deploying LendingPoolV2...");
        LendingPoolV2 lendingPool = new LendingPoolV2(address(oracle));
        console.log("LendingPoolV2 deployed at:", address(lendingPool));
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("MockChainlinkFeed:", address(chainlinkFeed));
        console.log("MockUniswapPool:", address(uniswapPool));
        console.log("SimpleOracle:", address(oracle));
        console.log("LendingPoolV2:", address(lendingPool));
        console.log("\nSave these addresses to .env:");
        console.log("CHAINLINK_FEED_ADDRESS=", address(chainlinkFeed));
        console.log("ORACLE_ADDRESS=", address(oracle));
        console.log("LENDING_POOL_ADDRESS=", address(lendingPool));
    }
}