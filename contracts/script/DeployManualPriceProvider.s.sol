// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../oracles/ManualPriceProvider.sol";
import "../oracles/PriceRegistry.sol";

contract DeployManualPriceProvider is Script {
    // From .env
    address constant PRICE_REGISTRY = 0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED;
    address constant LFTKN_TOKEN = 0x773349C9f052082e7c2d20feb0dECf3CF24c982d;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying ManualPriceProvider for LFTKN...");
        console.log("Deployer:", deployer);
        console.log("LFTKN Token:", LFTKN_TOKEN);
        console.log("PriceRegistry:", PRICE_REGISTRY);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy ManualPriceProvider with $1.00 initial price
        // $1.00 = 100000000 (8 decimals Chainlink format)
        int256 initialPrice = 100000000; // $1.00
        string memory description = "Manual LFTKN/USD Price Feed";

        ManualPriceProvider manualProvider = new ManualPriceProvider(
            initialPrice,
            description
        );

        console.log(" ManualPriceProvider deployed:", address(manualProvider));
        console.log("   Initial price:", uint256(initialPrice), "($1.00)");

        // Add LFTKN to PriceRegistry with ManualPriceProvider
        PriceRegistry registry = PriceRegistry(PRICE_REGISTRY);

        registry.addAsset(
            LFTKN_TOKEN,           // asset address
            "LFTKN",               // symbol
            address(manualProvider), // primary provider
            address(0),            // no fallback provider
            18                     // LFTKN decimals
        );

        console.log(" LFTKN added to PriceRegistry");
        console.log("   Asset:", LFTKN_TOKEN);
        console.log("   Provider:", address(manualProvider));

        // Verify setup
        bool isSupported = registry.isSupported(LFTKN_TOKEN);
        console.log(" LFTKN supported in registry:", isSupported);

        // Test price retrieval
        int256 retrievedPrice = registry.getPrice(LFTKN_TOKEN);
        console.log(" Retrieved price:", uint256(retrievedPrice));

        vm.stopBroadcast();

        console.log("\n DEPLOYMENT COMPLETE!");
        console.log(" Next steps:");
        console.log("1. Update .env with:");
        console.log("   MANUAL_PRICE_PROVIDER_ADDRESS=", address(manualProvider));
        console.log("2. Test borrow() function - should work now!");
        console.log("3. Adjust LFTKN price if needed:");
        console.log("   cast send", address(manualProvider), '"setPrice(int256)"', "NEW_PRICE");
    }
}

// Usage:
// forge script contracts/script/DeployManualPriceProvider.s.sol:DeployManualPriceProvider --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY