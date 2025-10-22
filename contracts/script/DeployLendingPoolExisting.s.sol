// script/DeployLendingPoolExisting.s.sol - v1.0
// Deploy LendingPool avec infrastructure existante (.env)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../LendingPool.sol";
import "../CollateralManager.sol";
import "../OracleAggregator.sol";

contract DeployLendingPoolExisting is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load existing addresses from .env
        address oracleAggregator = vm.envAddress("ORACLE_AGGREGATOR_ADDRESS");
        address collateralManager = vm.envAddress("COLLATERAL_MANAGER_ADDRESS");
        
        console.log("\n=== Deploy LendingPool with Existing Infrastructure ===");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance / 1e18, "ETH");
        console.log("\nUsing existing contracts:");
        console.log("  OracleAggregator:", oracleAggregator);
        console.log("  CollateralManager:", collateralManager);
        
        // Verify addresses are set
        require(oracleAggregator != address(0), "ORACLE_AGGREGATOR_ADDRESS not set in .env");
        require(collateralManager != address(0), "COLLATERAL_MANAGER_ADDRESS not set in .env");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy LendingPool
        LendingPool pool = new LendingPool(
            oracleAggregator,
            collateralManager
        );
        
        console.log("\n=== Deployment Complete ===");
        console.log("LendingPool:", address(pool));
        
        // Fund pool with minimal ETH
        uint256 deployerBalance = deployer.balance;
        uint256 fundAmount = 0.1 ether;
        
        if (deployerBalance >= fundAmount + 0.05 ether) {
            (bool success, ) = payable(address(pool)).call{value: fundAmount}("");
            require(success, "Failed to fund pool");
            console.log("Funded pool with", fundAmount / 1e18, "ETH");
        } else {
            console.log("WARNING: Insufficient balance to fund pool");
        }
        
        vm.stopBroadcast();
        
        // Verification
        console.log("\n=== Verification ===");
        _verifyDeployment(
            address(pool),
            oracleAggregator,
            collateralManager
        );
        
        // Print .env update
        console.log("\n=== Update .env ===");
        console.log("Add this line:");
        console.log("LENDING_POOL_ADDRESS=%s", address(pool));
        
        // Print verification command
        console.log("\n=== Etherscan Verification ===");
        console.log("forge verify-contract %s LendingPool \\", address(pool));
        console.log("  --chain sepolia \\");
        console.log("  --constructor-args $(cast abi-encode 'constructor(address,address)' %s %s)", 
            oracleAggregator, collateralManager);
        
        // Print user instructions
        console.log("\n=== User Flow ===");
        _printUserInstructions(collateralManager, address(pool));
    }
    
    function _verifyDeployment(
        address poolAddr,
        address oracleAddr,
        address collateralManagerAddr
    ) internal view {
        LendingPool pool = LendingPool(payable(poolAddr));
        OracleAggregator oracle = OracleAggregator(oracleAddr);
        CollateralManager cm = CollateralManager(payable(collateralManagerAddr));
        
        console.log("Pool owner:", pool.owner());
        console.log("Pool paused:", pool.paused());
        console.log("Pool oracle:", address(pool.oracle()));
        console.log("Pool collateralManager:", address(pool.collateralManager()));
        console.log("Pool balance:", address(pool).balance / 1e18, "ETH");
        
        require(address(pool.oracle()) == oracleAddr, "Oracle mismatch");
        require(address(pool.collateralManager()) == collateralManagerAddr, "CollateralManager mismatch");
        
        // Check oracle not in emergency
        console.log("\nOracle emergency mode:", oracle.emergencyMode());
        require(!oracle.emergencyMode(), "Oracle in emergency mode");
        
        // Check CollateralManager has assets
        address[] memory assets = cm.getSupportedAssets();
        console.log("CollateralManager assets:", assets.length);
        require(assets.length >= 3, "CollateralManager should have 3+ assets");
        
        console.log("All checks passed!");
    }
    
    function _printUserInstructions(address collateralManager, address pool) internal pure {
        console.log("1. Deposit collateral:");
        console.log("   CollateralManager.depositETH{value: amount}()");
        console.log("   Address: %s", collateralManager);
        
        console.log("\n2. Check max borrow:");
        console.log("   LendingPool.getMaxBorrowAmount(user)");
        
        console.log("\n3. Borrow (amount in 8 decimals USD):");
        console.log("   LendingPool.borrow(amount)");
        console.log("   Address: %s", pool);
        
        console.log("\n4. Repay:");
        console.log("   LendingPool.repay{value: amount}()");
        
        console.log("\n5. Withdraw:");
        console.log("   CollateralManager.withdrawETH(amount)");
    }
}

// ============ Usage ============
//
// 1. Make sure .env has:
//    ORACLE_AGGREGATOR_ADDRESS=0xf582E166a209630F6743B30aDe474CB4196E6C58
//    COLLATERAL_MANAGER_ADDRESS=0xa124Bee15E751E1C167b8ED841f0085dC0B996b9
//
// 2. Deploy:
//    forge script script/DeployLendingPoolExisting.s.sol:DeployLendingPoolExisting \
//      --rpc-url sepolia --broadcast --verify -vvvv
//
// 3. Dry run:
//    forge script script/DeployLendingPoolExisting.s.sol:DeployLendingPoolExisting \
//      --rpc-url sepolia -vvvv