// script/DeployCollateralManager.s.sol - v1.0
// Deploy CollateralManager avec configuration multi-assets
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../../contracts/CollateralManager.sol";

contract DeployCollateralManager is Script {
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        address oracleAggregator = vm.envAddress("ORACLE_AGGREGATOR_ADDRESS");
        address usdcToken = vm.envAddress("USDC_TOKEN_ADDRESS");
        address daiToken = vm.envAddress("DAI_TOKEN_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        CollateralManager manager = new CollateralManager(oracleAggregator);
        console.log("CollateralManager deployed at:", address(manager));
        
        manager.addAsset(
            ETH_ADDRESS,
            "ETH",
            66,  // LTV
            83,  // Liquidation threshold
            10,  // Liquidation penalty
            18   // Decimals
        );
        console.log("ETH configured: LTV=66%, Threshold=83%, Penalty=10%");
        
        manager.addAsset(
            usdcToken,
            "USDC",
            90,  // LTV
            95,  // Liquidation threshold
            5,   // Liquidation penalty
            6    // Decimals
        );
        console.log("USDC configured: LTV=90%, Threshold=95%, Penalty=5%");
        
        manager.addAsset(
            daiToken,
            "DAI",
            90,  // LTV
            95,  // Liquidation threshold
            5,   // Liquidation penalty
            18   // Decimals
        );
        console.log("DAI configured: LTV=90%, Threshold=95%, Penalty=5%");
        
        vm.stopBroadcast();
        
        console.log("\n=== Verification ===");
        console.log("Owner:", manager.owner());
        console.log("Oracle:", address(manager.oracle()));
        
        address[] memory assets = manager.getSupportedAssets();
        console.log("Supported assets:", assets.length);
        
        console.log("\n=== Add to .env ===");
        console.log("COLLATERAL_MANAGER_ADDRESS=", address(manager));
    }
}
