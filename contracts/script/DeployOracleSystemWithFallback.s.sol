// script/DeployOracleSystemWithFallback.s.sol - v1.0
// Deploy avec mode DEMO (fallback mock) ou PROD (pas de fallback)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../oracles/PriceRegistry.sol";
import "../OracleAggregator.sol";
import "../oracles/mocks/MockETHFallbackProvider.sol";

contract DeployOracleSystemWithFallback is Script {
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        address chainlinkEthProvider = vm.envAddress("CHAINLINK_ETH_PROVIDER");
        address mockUsdcProvider = vm.envAddress("MOCK_USDC_PROVIDER");
        address mockDaiProvider = vm.envAddress("MOCK_DAI_PROVIDER");
        
        bool demoMode = vm.envOr("DEMO_MODE", true);
        
        vm.startBroadcast(deployerPrivateKey);
        
        PriceRegistry registry = new PriceRegistry();
        console.log("PriceRegistry deployed at:", address(registry));
        
        address ethFallback = address(0);
        
        if (demoMode) {
            int256 chainlinkPrice = 2500e8;
            MockETHFallbackProvider fallbackProvider = new MockETHFallbackProvider(chainlinkPrice);
            ethFallback = address(fallbackProvider);
            console.log("MockETHFallback deployed at:", ethFallback);
            console.log("MODE: DEMO (fallback enabled for testing)");
        } else {
            console.log("MODE: PROD (no fallback)");
        }
        
        registry.addAsset(
            ETH_ADDRESS,
            "ETH",
            chainlinkEthProvider,
            ethFallback,
            18
        );
        console.log("ETH configured in registry");
        
        registry.addAsset(
            mockUsdcProvider,
            "USDC",
            mockUsdcProvider,
            address(0),
            6
        );
        console.log("USDC configured in registry");
        
        registry.addAsset(
            mockDaiProvider,
            "DAI",
            mockDaiProvider,
            address(0),
            18
        );
        console.log("DAI configured in registry");
        
        OracleAggregator aggregator = new OracleAggregator(address(registry));
        console.log("OracleAggregator deployed at:", address(aggregator));
        
        console.log("\n=== Verification ===");
        console.log("Supported assets:", registry.getSupportedAssets().length);
        
        vm.stopBroadcast();
        
        console.log("\n=== Add to .env ===");
        console.log("PRICE_REGISTRY_ADDRESS=", address(registry));
        console.log("ORACLE_AGGREGATOR_ADDRESS=", address(aggregator));
        if (demoMode) {
            console.log("MOCK_ETH_FALLBACK_ADDRESS=", ethFallback);
        }
    }
}