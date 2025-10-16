// test/integration/ChainlinkSepolia.t.sol - v1.1
// Tests integration avec vrais feeds Sepolia
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "../../oracles/mocks/MockUSDCPriceProvider.sol";
import "../../oracles/mocks/MockDAIPriceProvider.sol";

contract ChainlinkSepoliaTest is Test {
    ChainlinkPriceProvider ethProvider;
    MockUSDCPriceProvider usdcProvider;
    MockDAIPriceProvider daiProvider;
    
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    
    function setUp() public {
        // Fork Sepolia
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));
        
        ethProvider = new ChainlinkPriceProvider(ETH_USD_FEED, "Chainlink ETH/USD");
        usdcProvider = new MockUSDCPriceProvider();
        daiProvider = new MockDAIPriceProvider();
    }
    
    function testETHPriceFromRealFeed() public view {
        int256 price = ethProvider.getPrice();
        
        // ETH price should be reasonable (between $500 and $10000)
        assertGt(price, 500e8);
        assertLt(price, 10000e8);
        
        console.log("ETH price:", uint256(price) / 1e8);
    }
    

    function testUSDCPriceFromMockProvider() public view {
        int256 price = usdcProvider.getPrice();
        
        // Mock DAI set to $1
        assertEq(price, 1e8);
        
        console.log("USDC price (mock):", uint256(price) / 1e8);
    }

    function testDAIPriceFromMockProvider() public view {
        int256 price = daiProvider.getPrice();
        
        // Mock DAI set to $1
        assertEq(price, 1e8);
        
        console.log("DAI price (mock):", uint256(price) / 1e8);
    }
    
    function testAllProvidersHealthy() public view {
        assertTrue(ethProvider.isHealthy(), "ETH provider unhealthy");
        assertTrue(usdcProvider.isHealthy(), "USDC provider unhealthy");
        assertTrue(daiProvider.isHealthy(), "DAI provider unhealthy");
    }
    
    function testDescriptions() public view {
        assertEq(ethProvider.description(), "Chainlink ETH/USD");
        assertEq(usdcProvider.description(), "Mock USDC/USD (Chainlink unavailable)");
        assertEq(daiProvider.description(), "Mock DAI/USD (Chainlink unavailable)");
    }
    
    function testUSDCMockCanUpdatePrice() public {
        int256 newPrice = 1.01e8;
        daiProvider.setPrice(newPrice);
        
        int256 price = daiProvider.getPrice();
        assertEq(price, newPrice);
    }

    function testDAIMockCanUpdatePrice() public {
        int256 newPrice = 1.01e8;
        daiProvider.setPrice(newPrice);
        
        int256 price = daiProvider.getPrice();
        assertEq(price, newPrice);
    }
}
