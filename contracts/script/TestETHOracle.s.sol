// script/TestETHOracle.s.sol - v1.0
// Test direct de l'Oracle ETH pour reproduire le bug
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../OracleAggregator.sol";
import "../interfaces/IPriceProvider.sol";

contract TestETHOracle is Script {
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function run() external {
        address oracleAggregator = vm.envAddress("ORACLE_AGGREGATOR_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        OracleAggregator oracle = OracleAggregator(oracleAggregator);

        console.log("=== TEST ETH ORACLE GETPRICE ===");
        console.log("OracleAggregator:", address(oracle));
        console.log("ETH_ADDRESS:", ETH_ADDRESS);

        // Test 1: Essayer getCachedPrice (devrait fail car pas de cache)
        console.log("\n1. TEST CACHED PRICE (should fail):");
        try oracle.getCachedPrice(ETH_ADDRESS) returns (int256 price, uint256 updatedAt, string memory source) {
            console.log("SUCCESS: Cached Price:", uint256(price));
            console.log("   Updated At:", updatedAt);
            console.log("   Source:", source);
        } catch {
            console.log("FAILED: No cached price or cache stale (EXPECTED)");
        }

        // Test 2: Essayer getPrice (devrait initialiser le cache)
        console.log("\n2. TEST GETPRICE (should initialize cache):");

        vm.startBroadcast(deployerPrivateKey);

        try oracle.getPrice(ETH_ADDRESS) returns (int256 price) {
            console.log("SUCCESS: ETH Price retrieved:", uint256(price));

            // Test 3: Essayer getCachedPrice maintenant (devrait marcher)
            console.log("\n3. TEST CACHED PRICE AFTER INIT:");
            try oracle.getCachedPrice(ETH_ADDRESS) returns (int256 cachedPrice, uint256 updatedAt, string memory source) {
                console.log("SUCCESS: Cached Price NOW:", uint256(cachedPrice));
                console.log("   Updated At:", updatedAt);
                console.log("   Source:", source);
                console.log("   Age:", block.timestamp - updatedAt, "seconds");
            } catch {
                console.log("FAILED: Still no cached price (UNEXPECTED)");
            }

        } catch Error(string memory reason) {
            console.log("GETPRICE FAILED:", reason);
            console.log("   This is the ROOT CAUSE of depositETH() revert!");
        } catch {
            console.log("GETPRICE FAILED: Unknown error");
            console.log("   This is the ROOT CAUSE of depositETH() revert!");
        }

        vm.stopBroadcast();

        console.log("\n=== SOLUTION ===");
        console.log("1. If getPrice() failed, fix the ETH price providers");
        console.log("2. If getPrice() worked, run this script to initialize ETH cache");
        console.log("3. Then try depositETH() again");
    }
}