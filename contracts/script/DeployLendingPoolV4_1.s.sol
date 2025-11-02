// script/DeployLendingPoolV4_1.s.sol
// Redeploy LendingPool v4.1 with ETH→USD conversion fix
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../LendingPool.sol";

contract DeployLendingPoolV4_1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Load existing contract addresses (unchanged)
        address oracleAggregator = vm.envAddress("ORACLE_AGGREGATOR_ADDRESS");
        address collateralManager = vm.envAddress("COLLATERAL_MANAGER_ADDRESS");

        console.log("\n=== Deploy LendingPool v4.1 ===");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance / 1e18, "ETH");
        console.log("\nUsing existing contracts:");
        console.log("  OracleAggregator:", oracleAggregator);
        console.log("  CollateralManager:", collateralManager);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new LendingPool with bug fix
        LendingPool pool = new LendingPool(oracleAggregator, collateralManager);

        console.log("\n=== Deployment Successful ===");
        console.log("LendingPool v4.1:", address(pool));
        console.log("\nBlock Number:", block.number);
        console.log("\n=== Next Steps ===");
        console.log("1. Update .env:");
        console.log("   LENDING_POOL_ADDRESS=", address(pool));
        console.log("\n2. Update subgraph/subgraph.yaml:");
        console.log("   address:", address(pool));
        console.log("   startBlock:", block.number);
        console.log("\n3. Update frontend/.env.local:");
        console.log("   NEXT_PUBLIC_LENDING_POOL_ADDRESS=", address(pool));
        console.log("\n4. Redeploy subgraph:");
        console.log("   cd subgraph && graph deploy --studio lendforge-v4 --version-label v4.1.0");

        vm.stopBroadcast();

        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("Owner:", pool.owner());
        console.log("Oracle:", address(pool.oracle()));
        console.log("CollateralManager:", address(pool.collateralManager()));
        console.log("Paused:", pool.paused());
        console.log("TotalBorrowed:", pool.totalBorrowed());

        require(pool.owner() == deployer, "Owner mismatch");
        require(address(pool.oracle()) == oracleAggregator, "Oracle mismatch");
        require(address(pool.collateralManager()) == collateralManager, "CollateralManager mismatch");
        require(!pool.paused(), "Should not be paused");

        console.log("\n All checks passed!");
    }
}
