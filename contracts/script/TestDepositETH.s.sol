// script/TestDepositETH.s.sol - v1.0
// Test de validation que depositETH() fonctionne maintenant
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../CollateralManager.sol";

contract TestDepositETH is Script {
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function run() external {
        address collateralManager = vm.envAddress("COLLATERAL_MANAGER_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        CollateralManager manager = CollateralManager(payable(collateralManager));

        console.log("=== TEST DEPOSITETH APRES CACHE INIT ===");
        console.log("CollateralManager:", address(manager));
        console.log("Deployer:", deployer);
        console.log("Balance before:", deployer.balance / 1e18, "ETH");

        // 1. Vérifier l'état avant
        uint256 balanceBefore = manager.getUserCollateralBalance(deployer, ETH_ADDRESS);
        console.log("ETH Collateral before:", balanceBefore);

        // 2. Tester depositETH avec un petit montant
        uint256 depositAmount = 0.001 ether; // 0.001 ETH test

        console.log("\nAttempting depositETH with", depositAmount / 1e15, "mETH");

        vm.startBroadcast(deployerPrivateKey);

        try manager.depositETH{value: depositAmount}() {
            console.log("SUCCESS: depositETH() executed successfully!");

            uint256 balanceAfter = manager.getUserCollateralBalance(deployer, ETH_ADDRESS);
            console.log("ETH Collateral after:", balanceAfter);
            console.log("Increase:", (balanceAfter - balanceBefore) / 1e15, "mETH");

            // 3. Vérifier que l'utilisateur est dans la liste des assets
            address[] memory userAssets = manager.getUserAssets(deployer);
            console.log("User assets count:", userAssets.length);

            bool ethFound = false;
            for (uint i = 0; i < userAssets.length; i++) {
                if (userAssets[i] == ETH_ADDRESS) {
                    ethFound = true;
                    console.log("ETH found in user assets at index", i);
                    break;
                }
            }

            if (!ethFound) {
                console.log("WARNING: ETH not found in user assets");
            }

            // 4. Test getCollateralValueUSD (utilise getPrice en interne)
            try manager.getCollateralValueUSD(deployer) returns (uint256 totalValueUSD) {
                console.log("Total collateral value:", totalValueUSD, "USD (8 decimals)");
                console.log("Total collateral value:", totalValueUSD / 1e8, "USD");
            } catch {
                console.log("WARNING: getCollateralValueUSD failed");
            }

        } catch Error(string memory reason) {
            console.log("FAILED: depositETH() reverted:", reason);
            console.log("This means the bug is NOT fixed yet");
        } catch {
            console.log("FAILED: depositETH() reverted with unknown error");
            console.log("This means the bug is NOT fixed yet");
        }

        vm.stopBroadcast();

        console.log("\nDeployer balance after:", deployer.balance / 1e18, "ETH");

        console.log("\n=== CONCLUSION ===");
        console.log("If SUCCESS: Bug is FIXED - cache initialization resolved the issue");
        console.log("If FAILED: Need to investigate further - may be another issue");
    }
}