// script/DeployStaking.s.sol - v1.0
// Deploy StakingPool + RewardDistributor sur Sepolia
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../StakingPool.sol";
import "../RewardDistributor.sol";
import "../token/LFTKN.sol";

contract DeployStaking is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Deploying Staking System ===");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Get or deploy LFTKN
        address lftknAddress = vm.envOr("LFTKN_ADDRESS", address(0));
        LFTKN lftkn;
        
        if (lftknAddress == address(0)) {
            console.log("\nDeploying new LFTKN...");
            lftkn = new LFTKN();
            console.log("LFTKN deployed at:", address(lftkn));
        } else {
            console.log("\nUsing existing LFTKN at:", lftknAddress);
            lftkn = LFTKN(lftknAddress);
        }
        
        // 2. Deploy StakingPool
        console.log("\nDeploying StakingPool...");
        StakingPool stakingPool = new StakingPool(address(lftkn));
        console.log("StakingPool deployed at:", address(stakingPool));
        
        // 3. Deploy RewardDistributor
        console.log("\nDeploying RewardDistributor...");
        RewardDistributor distributor = new RewardDistributor(address(lftkn));
        console.log("RewardDistributor deployed at:", address(distributor));
        
        // 4. Link contracts
        console.log("\nLinking contracts...");
        stakingPool.setRewardDistributor(address(distributor));
        console.log("StakingPool -> RewardDistributor linked");
        
        distributor.setStakingPool(address(stakingPool));
        console.log("RewardDistributor -> StakingPool linked");
        
        // 5. Fund reward pool (50% of supply = 5M tokens)
        uint256 rewardPoolAmount = 5_000_000 * 1e18;
        console.log("\nFunding reward pool...");
        console.log("Amount:", rewardPoolAmount / 1e18, "LFTKN");
        
        uint256 deployerBalance = lftkn.balanceOf(deployer);
        console.log("Deployer balance:", deployerBalance / 1e18, "LFTKN");
        
        if (deployerBalance >= rewardPoolAmount) {
            lftkn.approve(address(distributor), rewardPoolAmount);
            distributor.fundPool(rewardPoolAmount);
            console.log("Reward pool funded successfully");
        } else {
            console.log("WARNING: Insufficient balance to fund pool");
            console.log("Please fund manually after deployment");
        }
        
        vm.stopBroadcast();
        
        // 6. Verification info
        console.log("\n=== Deployment Summary ===");
        console.log("LFTKN:", address(lftkn));
        console.log("StakingPool:", address(stakingPool));
        console.log("RewardDistributor:", address(distributor));
        console.log("\n=== Configuration ===");
        console.log("Base APY (bps):", distributor.getBaseAPY());
        console.log("Base APY (%):", distributor.getBaseAPY() / 100);
        console.log("Reward Pool Balance:", distributor.getPoolBalance() / 1e18, "LFTKN");
        console.log("\n=== Next Steps ===");
        console.log("1. Verify contracts on Etherscan:");
        console.log("   forge verify-contract", address(stakingPool), "StakingPool --chain sepolia");
        console.log("   forge verify-contract", address(distributor), "RewardDistributor --chain sepolia");
        console.log("2. Update frontend config with addresses");
        console.log("3. Test staking flow on testnet");
        
        // Save addresses to file
        string memory addresses = string(abi.encodePacked(
            "LFTKN_ADDRESS=", vm.toString(address(lftkn)), "\n",
            "STAKING_POOL_ADDRESS=", vm.toString(address(stakingPool)), "\n",
            "REWARD_DISTRIBUTOR_ADDRESS=", vm.toString(address(distributor)), "\n"
        ));
        
        vm.writeFile("staking-addresses.txt", addresses);
        console.log("\nAddresses saved to staking-addresses.txt");
    }
}
