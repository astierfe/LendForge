// script/DeployLFTKN.s.sol - v1.0
// Deploy LFTKN token on Sepolia
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Script.sol";
import "../token/LFTKN.sol";

contract DeployLFTKN is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying LFTKN...");
        LFTKN token = new LFTKN();
        console.log("LFTKN deployed at:", address(token));
        
        console.log("\nToken Info:");
        console.log("Name:", token.name());
        console.log("Symbol:", token.symbol());
        console.log("Decimals:", token.decimals());
        console.log("Total Supply:", token.totalSupply() / 10**18, "tokens");
        console.log("Deployer Balance:", token.balanceOf(msg.sender) / 10**18, "tokens");
        
        vm.stopBroadcast();
        
        console.log("\nSave to .env:");
        console.log("LFTKN_ADDRESS=", address(token));
    }
}
