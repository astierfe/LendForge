// contracts/script/DeployAll.s.sol - v2.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Script.sol";
import "../contracts/LendingPoolV2.sol";
import "../contracts/SimpleOracle.sol";
import "../contracts/MockChainlinkFeed.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying MockChainlinkFeed...");
        MockChainlinkFeed chainlinkFeed = new MockChainlinkFeed();
        console.log("MockChainlinkFeed deployed at:", address(chainlinkFeed));
        
        console.log("Deploying SimpleOracle...");
        SimpleOracle oracle = new SimpleOracle(address(chainlinkFeed));
        console.log("SimpleOracle deployed at:", address(oracle));
        
        console.log("Deploying LendingPoolV2...");
        LendingPoolV2 lendingPool = new LendingPoolV2(address(oracle));
        console.log("LendingPoolV2 deployed at:", address(lendingPool));
        
        vm.stopBroadcast();
        
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("MockChainlinkFeed:", address(chainlinkFeed));
        console.log("SimpleOracle:", address(oracle));
        console.log("LendingPoolV2:", address(lendingPool));
        console.log("\nSave these addresses to .env:");
        console.log("CHAINLINK_FEED_ADDRESS=", address(chainlinkFeed));
        console.log("ORACLE_ADDRESS=", address(oracle));
        console.log("LENDING_POOL_ADDRESS=", address(lendingPool));
    }
}