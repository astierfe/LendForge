// script/DeployMockTokens.s.sol - v1.0
// Deploy mock USDC et DAI pour tests Sepolia
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000 * 10**6); // 1M USDC
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockDAI is ERC20 {
    constructor() ERC20("Mock Dai Stablecoin", "DAI") {
        _mint(msg.sender, 1_000_000 * 10**18); // 1M DAI
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DeployMockTokens is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));
        console.log("USDC balance:", usdc.balanceOf(msg.sender));
        
        MockDAI dai = new MockDAI();
        console.log("MockDAI deployed at:", address(dai));
        console.log("DAI balance:", dai.balanceOf(msg.sender));
        
        vm.stopBroadcast();
        
        console.log("\n=== Add to .env ===");
        console.log("USDC_TOKEN_ADDRESS=", address(usdc));
        console.log("DAI_TOKEN_ADDRESS=", address(dai));
    }
}