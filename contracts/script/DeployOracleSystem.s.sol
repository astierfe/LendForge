// script/DeployOracleSystem.s.sol - v1.0 - Complete oracle system deployment
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Script.sol";
import "../oracles/PriceFeedRegistry.sol";
import "../OracleAggregator.sol";
import "../oracles/mocks/MockChainlinkFeed.sol";
import "../oracles/mocks/MockUniswapV3Pool.sol";

contract DeployOracleSystem is Script {
    // Asset addresses (mock for ETH, real for USDC/DAI on Sepolia)
    address constant ETH = address(0x1);
    address constant USDC = address(0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8);
    address constant DAI = address(0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357);
    
    // Deployed contracts
    PriceFeedRegistry public registry;
    
    OracleAggregator public oracleETH;
    OracleAggregator public oracleUSDC;
    OracleAggregator public oracleDAI;
    
    MockChainlinkFeed public chainlinkETH;
    MockChainlinkFeed public chainlinkUSDC;
    MockChainlinkFeed public chainlinkDAI;
    
    MockUniswapV3Pool public uniswapETH;
    MockUniswapV3Pool public uniswapUSDC;
    MockUniswapV3Pool public uniswapDAI;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("====================================");
        console.log("Deploying Oracle System on Sepolia");
        console.log("====================================");
        console.log("");
        
        // Step 1: Deploy Mock Chainlink Feeds
        console.log("1. Deploying Mock Chainlink Feeds...");
        chainlinkETH = new MockChainlinkFeed(2000e8, 8);
        console.log("   ETH Feed:", address(chainlinkETH));
        
        chainlinkUSDC = new MockChainlinkFeed(1e8, 8);
        console.log("   USDC Feed:", address(chainlinkUSDC));
        
        chainlinkDAI = new MockChainlinkFeed(1e8, 8);
        console.log("   DAI Feed:", address(chainlinkDAI));
        console.log("");
        
        // Step 2: Deploy Mock Uniswap V3 Pools
        console.log("2. Deploying Mock Uniswap V3 Pools...");
        uniswapETH = new MockUniswapV3Pool();
        uniswapETH.setMockPrice(2000e8);
        console.log("   ETH Pool:", address(uniswapETH));
        
        uniswapUSDC = new MockUniswapV3Pool();
        uniswapUSDC.setMockPrice(1e8);
        console.log("   USDC Pool:", address(uniswapUSDC));
        
        uniswapDAI = new MockUniswapV3Pool();
        uniswapDAI.setMockPrice(1e8);
        console.log("   DAI Pool:", address(uniswapDAI));
        console.log("");
        
        // Step 3: Deploy Oracle Aggregators
        console.log("3. Deploying Oracle Aggregators...");
        oracleETH = new OracleAggregator(address(chainlinkETH), address(uniswapETH));
        console.log("   ETH Oracle:", address(oracleETH));
        
        oracleUSDC = new OracleAggregator(address(chainlinkUSDC), address(uniswapUSDC));
        console.log("   USDC Oracle:", address(oracleUSDC));
        
        oracleDAI = new OracleAggregator(address(chainlinkDAI), address(uniswapDAI));
        console.log("   DAI Oracle:", address(oracleDAI));
        console.log("");
        
        // Step 4: Deploy PriceFeedRegistry
        console.log("4. Deploying PriceFeedRegistry...");
        registry = new PriceFeedRegistry();
        console.log("   Registry:", address(registry));
        console.log("");
        
        // Step 5: Register all assets
        console.log("5. Registering assets in Registry...");
        
        registry.addFeed(
            ETH,
            "ETH",
            address(chainlinkETH),
            address(uniswapETH),
            address(oracleETH),
            18
        );
        console.log("   ETH registered (18 decimals)");
        
        registry.addFeed(
            USDC,
            "USDC",
            address(chainlinkUSDC),
            address(uniswapUSDC),
            address(oracleUSDC),
            6
        );
        console.log("   USDC registered (6 decimals)");
        
        registry.addFeed(
            DAI,
            "DAI",
            address(chainlinkDAI),
            address(uniswapDAI),
            address(oracleDAI),
            18
        );
        console.log("   DAI registered (18 decimals)");
        console.log("");
        
        // Step 6: Verify deployment
        console.log("6. Verifying deployment...");
        
        int256 priceETH = registry.getPrice(ETH);
        console.log("   ETH Price: $", uint256(priceETH) / 1e8);
        
        int256 priceUSDC = registry.getPrice(USDC);
        console.log("   USDC Price: $", uint256(priceUSDC) / 1e8);
        
        int256 priceDAI = registry.getPrice(DAI);
        console.log("   DAI Price: $", uint256(priceDAI) / 1e8);
        
        address[] memory assets = registry.getSupportedAssets();
        console.log("   Total Assets:", assets.length);
        console.log("");
        
        vm.stopBroadcast();
        
        // Print deployment summary
        console.log("====================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("====================================");
        console.log("");
        console.log("Core Contracts:");
        console.log("  PriceFeedRegistry:", address(registry));
        console.log("");
        
        console.log("Oracle Aggregators:");
        console.log("  ETH Oracle:", address(oracleETH));
        console.log("  USDC Oracle:", address(oracleUSDC));
        console.log("  DAI Oracle:", address(oracleDAI));
        console.log("");
        
        console.log("Chainlink Feeds (Mock):");
        console.log("  ETH Feed:", address(chainlinkETH));
        console.log("  USDC Feed:", address(chainlinkUSDC));
        console.log("  DAI Feed:", address(chainlinkDAI));
        console.log("");
        
        console.log("Uniswap Pools (Mock):");
        console.log("  ETH Pool:", address(uniswapETH));
        console.log("  USDC Pool:", address(uniswapUSDC));
        console.log("  DAI Pool:", address(uniswapDAI));
        console.log("");
        
        console.log("Asset Addresses:");
        console.log("  ETH (Mock):", ETH);
        console.log("  USDC:", USDC);
        console.log("  DAI:", DAI);
        console.log("");
        
        console.log("Environment Variables to Update:");
        console.log("====================================");
        console.log("");
        console.log("# Oracle System");
        console.log("PRICE_FEED_REGISTRY=", address(registry));
        console.log("");
        console.log("# ETH Oracle");
        console.log("ORACLE_ETH=", address(oracleETH));
        console.log("CHAINLINK_ETH_FEED=", address(chainlinkETH));
        console.log("UNISWAP_ETH_POOL=", address(uniswapETH));
        console.log("");
        console.log("# USDC Oracle");
        console.log("ORACLE_USDC=", address(oracleUSDC));
        console.log("CHAINLINK_USDC_FEED=", address(chainlinkUSDC));
        console.log("UNISWAP_USDC_POOL=", address(uniswapUSDC));
        console.log("");
        console.log("# DAI Oracle");
        console.log("ORACLE_DAI=", address(oracleDAI));
        console.log("CHAINLINK_DAI_FEED=", address(chainlinkDAI));
        console.log("UNISWAP_DAI_POOL=", address(uniswapDAI));
        console.log("");
        console.log("====================================");
        console.log("Deployment Complete!");
        console.log("====================================");
    }
}
