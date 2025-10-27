// script/DeployFullStackV3.s.sol - v1.0
// Deploy complete stack with OracleAggregator v3.1
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../OracleAggregator.sol";
import "../oracles/PriceRegistry.sol";
import "../CollateralManager.sol";
import "../LendingPool.sol";

contract DeployFullStackV3 is Script {
    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load existing provider addresses (from step 2)
        address chainlinkEthProvider = vm.envAddress("CHAINLINK_ETH_PROVIDER");
        address mockUsdcProvider = vm.envAddress("MOCK_USDC_PROVIDER");
        address mockDaiProvider = vm.envAddress("MOCK_DAI_PROVIDER");
        address mockEthSecondary = vm.envAddress("MOCK_ETH_FALLBACK_ADDRESS");
        
        // Load token addresses (from step 3)
        address usdcToken = vm.envAddress("USDC_TOKEN_ADDRESS");
        address daiToken = vm.envAddress("DAI_TOKEN_ADDRESS");
        
        console.log("\n=== Deploy Full Stack with OracleAggregator v3.1 ===");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance / 1e18, "ETH");
        
        console.log("\nUsing existing providers:");
        console.log("  Chainlink ETH:", chainlinkEthProvider);
        console.log("  Mock USDC:", mockUsdcProvider);
        console.log("  Mock DAI:", mockDaiProvider);
        console.log("  Mock ETH Fallback:", mockEthSecondary);
        
        console.log("\nUsing tokens:");
        console.log("  USDC:", usdcToken);
        console.log("  DAI:", daiToken);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy PriceRegistry
        PriceRegistry registry = new PriceRegistry();
        console.log("\n Step 1: PriceRegistry:", address(registry));
        
        // 2. Register assets in PriceRegistry
        registry.addAsset(
            ETH_ADDRESS,
            "ETH",
            chainlinkEthProvider,      // Primary
            mockEthSecondary,           // Fallback
            18
        );
        console.log("   Registered ETH (primary + fallback)");
        
        registry.addAsset(
            usdcToken,
            "USDC",
            mockUsdcProvider,           // Primary
            address(0),                 // No fallback
            6
        );
        console.log("   Registered USDC (primary only)");
        
        registry.addAsset(
            daiToken,
            "DAI",
            mockDaiProvider,            // Primary
            address(0),                 // No fallback
            18
        );
        console.log("   Registered DAI (primary only)");
        
        // 3. Deploy OracleAggregator v3.1
        OracleAggregator oracle = new OracleAggregator(address(registry));
        console.log("\n*  Step 2: OracleAggregator v3.1:", address(oracle));
        
        // 4. Deploy CollateralManager
        CollateralManager collateralManager = new CollateralManager(address(oracle));
        console.log("\n Step 3: CollateralManager:", address(collateralManager));
        
        // Add assets to CollateralManager
        collateralManager.addAsset(ETH_ADDRESS, "ETH", 66, 83, 10, 18);
        console.log("   Added ETH: LTV 66%, Threshold 83%, Penalty 10%");
        
        collateralManager.addAsset(usdcToken, "USDC", 90, 95, 5, 6);
        console.log("   Added USDC: LTV 90%, Threshold 95%, Penalty 5%");
        
        collateralManager.addAsset(daiToken, "DAI", 90, 95, 5, 18);
        console.log("   Added DAI: LTV 90%, Threshold 95%, Penalty 5%");
        
        // 5. Deploy LendingPool
        LendingPool lendingPool = new LendingPool(
            address(oracle),
            address(collateralManager)
        );
        console.log("\n Step 4: LendingPool:", address(lendingPool));
        
        // 6. Fund pool
        uint256 fundAmount = 0.1 ether;
        if (deployer.balance >= fundAmount + 0.05 ether) {
            (bool success, ) = payable(address(lendingPool)).call{value: fundAmount}("");
            require(success, "Failed to fund pool");
            console.log("   Funded with", fundAmount / 1e18, "ETH");
        } else {
            console.log("   WARNING: Insufficient balance to fund pool");
        }
        
        vm.stopBroadcast();
        
        // Verification
        console.log("\n=== Verification ===");
        _verifyDeployment(
            address(registry),
            address(oracle),
            address(collateralManager),
            address(lendingPool)
        );
        
        // Print .env updates
        console.log("\n=== Update .env ===");
        console.log("Add these lines:");
        console.log("PRICE_REGISTRY_ADDRESS=%s", address(registry));
        console.log("ORACLE_AGGREGATOR_ADDRESS=%s", address(oracle));
        console.log("COLLATERAL_MANAGER_ADDRESS=%s", address(collateralManager));
        console.log("LENDING_POOL_ADDRESS=%s", address(lendingPool));
        
        // Print verification commands
        console.log("\n=== Etherscan Verification ===");
        console.log("\n# 1. PriceRegistry");
        console.log("forge verify-contract %s PriceRegistry --chain sepolia", address(registry));
        
        console.log("\n# 2. OracleAggregator");
        console.log("forge verify-contract %s OracleAggregator \\", address(oracle));
        console.log("  --chain sepolia \\");
        console.log("  --constructor-args $(cast abi-encode 'constructor(address)' %s)", address(registry));
        
        console.log("\n# 3. CollateralManager");
        console.log("forge verify-contract %s CollateralManager \\", address(collateralManager));
        console.log("  --chain sepolia \\");
        console.log("  --constructor-args $(cast abi-encode 'constructor(address)' %s)", address(oracle));
        
        console.log("\n# 4. LendingPool");
        console.log("forge verify-contract %s LendingPool \\", address(lendingPool));
        console.log("  --chain sepolia \\");
        console.log("  --constructor-args $(cast abi-encode 'constructor(address,address)' %s %s)", 
            address(oracle), address(collateralManager));
    }
    
    function _verifyDeployment(
        address registryAddr,
        address oracleAddr,
        address collateralManagerAddr,
        address lendingPoolAddr
    ) internal view {
        PriceRegistry registry = PriceRegistry(registryAddr);
        OracleAggregator oracle = OracleAggregator(oracleAddr);
        CollateralManager cm = CollateralManager(payable(collateralManagerAddr));
        LendingPool pool = LendingPool(payable(lendingPoolAddr));
        
        // Check registry
        address[] memory registryAssets = registry.getSupportedAssets();
        console.log("Registry assets:", registryAssets.length);
        require(registryAssets.length == 3, "Should have 3 assets in registry");
        
        // Check oracle
        console.log("Oracle owner:", oracle.owner());
        console.log("Oracle emergency:", oracle.emergencyMode());
        console.log("Oracle registry:", address(oracle.registry()));
        require(!oracle.emergencyMode(), "Oracle should not be in emergency");
        require(address(oracle.registry()) == registryAddr, "Oracle registry mismatch");
        
        // Check CollateralManager
        address[] memory cmAssets = cm.getSupportedAssets();
        console.log("CollateralManager assets:", cmAssets.length);
        require(cmAssets.length == 3, "Should have 3 assets in CM");
        
        // Check LendingPool
        console.log("LendingPool owner:", pool.owner());
        console.log("LendingPool paused:", pool.paused());
        console.log("LendingPool balance:", address(pool).balance / 1e18, "ETH");
        require(!pool.paused(), "Pool should not be paused");
        require(address(pool.oracle()) == oracleAddr, "Pool oracle mismatch");
        require(address(pool.collateralManager()) == collateralManagerAddr, "Pool CM mismatch");
        
        console.log("\n All verifications passed!");
    }
}

// ============ Usage ============
//
// Prerequisites in .env:
//   CHAINLINK_ETH_PROVIDER (from step 2)
//   MOCK_USDC_PROVIDER (from step 2)
//   MOCK_DAI_PROVIDER (from step 2)
//   MOCK_ETH_FALLBACK_ADDRESS (from step 2)
//   USDC_TOKEN_ADDRESS (from step 3)
//   DAI_TOKEN_ADDRESS (from step 3)
//
// Deploy:
//   forge script script/DeployFullStackV3.s.sol:DeployFullStackV3 \
//     --rpc-url sepolia --broadcast --verify -vvvv
//
// Dry run:
//   forge script script/DeployFullStackV3.s.sol:DeployFullStackV3 \
//     --rpc-url sepolia -vvvv