// script/DiagnoseCollateralETH.s.sol - v1.0
// Script de diagnostic pour debugger depositETH() qui revert
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../CollateralManager.sol";
import "../OracleAggregator.sol";
import "../oracles/PriceRegistry.sol";

contract DiagnoseCollateralETH is Script {
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function run() external view {
        address collateralManager = vm.envAddress("COLLATERAL_MANAGER_ADDRESS");
        address oracleAggregator = vm.envAddress("ORACLE_AGGREGATOR_ADDRESS");

        CollateralManager manager = CollateralManager(payable(collateralManager));
        OracleAggregator oracle = OracleAggregator(oracleAggregator);

        console.log("=== DIAGNOSTIC DEPOSITETH BUG ===");
        console.log("CollateralManager:", address(manager));
        console.log("OracleAggregator:", address(oracle));
        console.log("ETH_ADDRESS:", ETH_ADDRESS);

        // 1. Vérifier configuration ETH dans CollateralManager
        console.log("\n1. ETH ASSET CONFIGURATION:");
        try manager.isAssetSupported(ETH_ADDRESS) returns (bool supported) {
            console.log(" ETH isAssetSupported:", supported);

            if (supported) {
                CollateralManager.CollateralConfig memory config = manager.getAssetConfig(ETH_ADDRESS);
                console.log("   LTV:", config.ltv);
                console.log("   Liquidation Threshold:", config.liquidationThreshold);
                console.log("   Liquidation Penalty:", config.liquidationPenalty);
                console.log("   Decimals:", config.decimals);
                console.log("   Enabled:", config.enabled);
                console.log("   Symbol:", config.symbol);
            }
        } catch {
            console.log(" ETH asset check FAILED");
        }

        // 2. Vérifier les assets supportés
        console.log("\n2. ALL SUPPORTED ASSETS:");
        try manager.getSupportedAssets() returns (address[] memory assets) {
            console.log("Total assets:", assets.length);
            for (uint i = 0; i < assets.length; i++) {
                console.log("Asset", i, ":", assets[i]);
                if (assets[i] == ETH_ADDRESS) {
                    console.log("    ETH found in supported assets");
                }
            }
        } catch {
            console.log(" getSupportedAssets FAILED");
        }

        // 3. Vérifier l'état de l'Oracle
        console.log("\n3. ORACLE STATE:");
        try oracle.emergencyMode() returns (bool emergency) {
            console.log("Emergency Mode:", emergency);
            if (emergency) {
                console.log("  EMERGENCY MODE ACTIVE - This blocks getPrice()");
            } else {
                console.log(" Emergency mode disabled");
            }
        } catch {
            console.log(" Oracle emergencyMode check FAILED");
        }

        try oracle.deviationChecksEnabled() returns (bool enabled) {
            console.log("Deviation Checks:", enabled);
        } catch {
            console.log(" Oracle deviationChecksEnabled check FAILED");
        }

        // 4. Tester getPrice pour ETH
        console.log("\n4. ETH PRICE TEST:");
        try oracle.getCachedPrice(ETH_ADDRESS) returns (int256 price, uint256 updatedAt, string memory source) {
            console.log(" Cached ETH Price:", uint256(price));
            console.log("   Updated At:", updatedAt);
            console.log("   Source:", source);
            console.log("   Age:", block.timestamp - updatedAt, "seconds");
        } catch {
            console.log(" No cached ETH price or cache stale");
        }

        // 5. Vérifier la PriceRegistry
        console.log("\n5. PRICE REGISTRY CHECK:");
        address registryAddr = address(oracle.registry());
        console.log("PriceRegistry:", registryAddr);

        if (registryAddr != address(0)) {
            PriceRegistry registry = PriceRegistry(registryAddr);

            try registry.getPrimaryProvider(ETH_ADDRESS) returns (address primary) {
                console.log("Primary ETH Provider:", primary);
                if (primary == address(0)) {
                    console.log(" NO PRIMARY ETH PROVIDER CONFIGURED");
                }
            } catch {
                console.log(" Primary provider check FAILED");
            }

            try registry.getFallbackProvider(ETH_ADDRESS) returns (address fallbackP) {
                console.log("Fallback ETH Provider:", fallbackP);
                if (fallbackP == address(0)) {
                    console.log("  No fallback ETH provider");
                } else {
                    console.log(" Fallback provider available");
                }
            } catch {
                console.log(" Fallback provider check FAILED");
            }
        }

        // 6. Simulation du modifier validAsset
        console.log("\n6. VALID ASSET MODIFIER SIMULATION:");
        try manager.getAssetConfig(ETH_ADDRESS) returns (CollateralManager.CollateralConfig memory config) {
            if (!config.enabled) {
                console.log(" FOUND THE BUG: ETH asset is NOT ENABLED");
                console.log("   config.enabled =", config.enabled);
            } else {
                console.log(" ETH asset is enabled");
            }
        } catch {
            console.log(" FOUND THE BUG: ETH asset NOT CONFIGURED AT ALL");
        }

        console.log("\n=== DIAGNOSTIC COMPLETE ===");
        console.log("Run this script to identify the exact cause of depositETH() revert");
    }
}