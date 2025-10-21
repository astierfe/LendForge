// script/DemoDeviation.s.sol - v1.0
// Script pour simuler deviations de prix (DEMO MODE uniquement)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../OracleAggregator.sol";
import "../oracles/mocks/MockETHFallbackProvider.sol";

contract DemoDeviation is Script {
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        address aggregatorAddr = vm.envAddress("ORACLE_AGGREGATOR_ADDRESS");
        address fallbackAddr = vm.envAddress("MOCK_ETH_FALLBACK_ADDRESS");
        address registryAddr = vm.envAddress("PRICE_REGISTRY_ADDRESS");
        
        OracleAggregator aggregator = OracleAggregator(aggregatorAddr);
        MockETHFallbackProvider falbackProvider = MockETHFallbackProvider(fallbackAddr);
        PriceRegistry registry = PriceRegistry(registryAddr);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== Initial State ===");
        
        // Clear emergency mode FIRST if active
        if (aggregator.emergencyMode()) {
            console.log("Emergency mode detected, clearing...");
            aggregator.setEmergencyMode(false, "Demo reset");
            aggregator.clearDeviation(ETH_ADDRESS);
        }
        
        // Sync fallback to current Chainlink price BEFORE first getPrice
        console.log("Syncing fallback to Chainlink price...");
        (,, int256 currentPrimary,) = aggregator.getDeviationInfo(ETH_ADDRESS);
        if (currentPrimary == 0) {
            // No deviation data yet, get it from registry
            address primaryProvider = registry.getPrimaryProvider(ETH_ADDRESS);
            currentPrimary = IPriceProvider(primaryProvider).getPrice();
        }
        falbackProvider.setPrice(currentPrimary);
        console.log("Fallback synced to:", uint256(currentPrimary));
        
        // Now safe to call getPrice
        int256 initialPrice = aggregator.getPrice(ETH_ADDRESS);
        console.log("ETH price:", uint256(initialPrice));
        
        (bool hasDev, uint256 devBps, int256 primaryPrice, int256 fallbackPrice) = aggregator.getDeviationInfo(ETH_ADDRESS);
        console.log("Has deviation:", hasDev);
        console.log("Deviation bps:", devBps);
        console.log("Primary price:", uint256(primaryPrice));
        console.log("Fallback price:", uint256(fallbackPrice));
        
        console.log("\n=== Scenario 1: Small Deviation (3%) ===");
        int256 newPrice = (primaryPrice * 103) / 100;
        falbackProvider.setPrice(newPrice);
        console.log("Set fallback to:", uint256(newPrice));
        
        aggregator.getPrice(ETH_ADDRESS);
        (hasDev, devBps,,) = aggregator.getDeviationInfo(ETH_ADDRESS);
        console.log("New deviation bps:", devBps);
        console.log("New deviation %:", devBps / 100);
        
        console.log("\n=== Scenario 2: Warning Deviation (6%) ===");
        newPrice = (primaryPrice * 106) / 100;
        falbackProvider.setPrice(newPrice);
        console.log("Set fallback to:", uint256(newPrice));
        
        aggregator.getPrice(ETH_ADDRESS);
        (hasDev, devBps,,) = aggregator.getDeviationInfo(ETH_ADDRESS);
        console.log("New deviation bps:", devBps);
        console.log("New deviation %:", devBps / 100);
        console.log("WARNING triggered");
        
        console.log("\n=== Scenario 3: Critical Deviation (12%) ===");
        newPrice = (primaryPrice * 112) / 100;
        falbackProvider.setPrice(newPrice);
        console.log("Set fallback to:", uint256(newPrice));
        
        aggregator.getPrice(ETH_ADDRESS);
        console.log("Emergency mode:", aggregator.emergencyMode());
        
        if (aggregator.emergencyMode()) {
            console.log("CRITICAL: Emergency mode activated!");
            console.log("Resolving emergency...");
            aggregator.setEmergencyMode(false, "Demo resolved");
        }
        
        console.log("\n=== Reset to Normal ===");
        falbackProvider.setPrice(primaryPrice);
        aggregator.clearDeviation(ETH_ADDRESS);
        
        aggregator.getPrice(ETH_ADDRESS);
        console.log("System back to normal");
        
        vm.stopBroadcast();
    }
}