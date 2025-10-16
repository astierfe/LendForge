// script/DeployChainlinkProvider.s.sol - v1.2
// Deploy Chainlink providers sur Sepolia
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../oracles/ChainlinkPriceProvider.sol";
import "../oracles/mocks/MockUSDCPriceProvider.sol";
import "../oracles/mocks/MockDAIPriceProvider.sol";

contract DeployChainlinkProvider is Script {
    // Chainlink feeds Sepolia (only ETH is reliable)
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy ETH/USD provider
        ChainlinkPriceProvider ethProvider = new ChainlinkPriceProvider(
            ETH_USD_FEED,
            "Chainlink ETH/USD"
        );
        console.log("ETH Provider deployed at:", address(ethProvider));
        
        // Deploy USDC/USD mock provider (Chainlink feed unreliable)
        MockUSDCPriceProvider usdcProvider = new MockUSDCPriceProvider();
        console.log("USDC Mock Provider deployed at:", address(usdcProvider));
        
        // Deploy DAI/USD mock provider (Chainlink feed unreliable)
        MockDAIPriceProvider daiProvider = new MockDAIPriceProvider();
        console.log("DAI Mock Provider deployed at:", address(daiProvider));
        
        vm.stopBroadcast();
        
        // Verify deployment
        console.log("\n=== Verification ===");
        console.log("ETH price:", uint256(ethProvider.getPrice()));
        console.log("ETH healthy:", ethProvider.isHealthy());
        console.log("USDC price (mock):", uint256(usdcProvider.getPrice()));
        console.log("USDC healthy:", usdcProvider.isHealthy());
        console.log("DAI price (mock):", uint256(daiProvider.getPrice()));
        console.log("DAI healthy:", daiProvider.isHealthy());
    }
}
