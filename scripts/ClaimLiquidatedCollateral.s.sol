// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/CollateralManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * RUSTINE - Script pour récupérer le collateral après liquidation
 *
 * Usage: Le DEPLOYER exécute ce script pour transférer le collateral
 *        du USER liquidé vers le LIQUIDATOR
 *
 * TEMPORAIRE - En attendant de fixer le bug dans LendingPool.liquidate()
 *
 * forge script scripts/ClaimLiquidatedCollateral.s.sol:ClaimLiquidatedCollateral \
 *   --rpc-url $SEPOLIA_RPC_URL \
 *   --broadcast \
 *   --verify \
 *   -vvvv
 */
contract ClaimLiquidatedCollateral is Script {

    CollateralManager public collateralManager;

    // Addresses from .env
    address public liquidatedUser;      // USER_ADDRESS
    address public liquidator;          // LIQUIDATOR_WALLET
    address public usdcToken;           // USDC_TOKEN_ADDRESS
    address public daiToken;            // DAI_TOKEN_ADDRESS

    function run() external {
        // Load environment variables
        collateralManager = CollateralManager(vm.envAddress("COLLATERAL_MANAGER_ADDRESS"));
        liquidatedUser = vm.envAddress("USER_ADDRESS");
        liquidator = vm.envAddress("LIQUIDATOR_WALLET");
        usdcToken = vm.envAddress("USDC_TOKEN_ADDRESS");
        daiToken = vm.envAddress("DAI_TOKEN_ADDRESS");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Claiming Liquidated Collateral (RUSTINE) ===");
        console.log("Liquidated User:", liquidatedUser);
        console.log("Liquidator:", liquidator);

        // Get user's collateral balances
        address[] memory assets = collateralManager.getUserAssets(liquidatedUser);

        if (assets.length == 0) {
            console.log("No collateral to claim");
            vm.stopBroadcast();
            return;
        }

        console.log("Assets to transfer:", assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 balance = collateralManager.getUserCollateralBalance(liquidatedUser, asset);

            if (balance == 0) continue;

            // Get asset info
            CollateralManager.CollateralConfig memory config = collateralManager.getAssetConfig(asset);

            console.log("");
            console.log("Asset:", config.symbol);
            console.log("  Amount:", balance / (10 ** config.decimals));
            console.log("  Address:", asset);

            // RUSTINE: Transfer collateral from USER to LIQUIDATOR
            // This is a MANUAL workaround because LendingPool.liquidate() doesn't transfer collateral

            // Step 1: Withdraw from USER's collateral (we can do this as owner)
            // Note: This is a HACK - in production, only USER should be able to withdraw
            //       But since liquidate() should have transferred it, we're fixing the bug

            // IMPORTANT: We need to temporarily transfer ownership or add a special function
            // For now, we'll just LOG what needs to be done manually

            console.log("");
            console.log("MANUAL ACTION REQUIRED:");
            console.log("1. USER must call: collateralManager.withdrawERC20(", asset, ",", balance, ")");
            console.log("2. USER must call: IERC20(", asset, ").transfer(", liquidator, ",", balance, ")");
            console.log("");
        }

        vm.stopBroadcast();

        console.log("=== Claim Summary ===");
        console.log("RUSTINE applied: Manual transfer instructions logged");
        console.log("TODO: Fix LendingPool.liquidate() to automatically transfer collateral");
    }
}
