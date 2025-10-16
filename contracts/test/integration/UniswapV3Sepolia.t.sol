// test/integration/UniswapV3Sepolia.t.sol - v1.0
// Tests integration avec vrais pools Uniswap V3 Sepolia
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../oracles/UniswapV3PriceProvider.sol";
import "../../oracles/ChainlinkPriceProvider.sol";

contract UniswapV3SepoliaTest is Test {
    UniswapV3PriceProvider usdcWethProvider;
    UniswapV3PriceProvider daiWethProvider;
    ChainlinkPriceProvider chainlinkETHProvider;
    
    // Sepolia addresses
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
    address constant DAI = 0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357;
    
    // Uniswap V3 Pools (0.3% fee)
    address constant USDC_WETH_POOL = 0x9799b5EDC1aA7D3FAd350309B08df3F64914E244;
    address constant DAI_WETH_POOL = 0x1C9d93e574BE622821398E3fE677e3A279F256F7;
    
    // Chainlink feed ETH/USD
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    
    uint32 constant TWAP_PERIOD = 3600; // 1 hour
    
    function setUp() public {
        // Fork Sepolia
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));
        
        // Deploy Chainlink provider pour comparaison
        chainlinkETHProvider = new ChainlinkPriceProvider(
            ETH_USD_FEED,
            "Chainlink ETH/USD"
        );
        
        // Deploy Uniswap provider USDC/WETH
        usdcWethProvider = new UniswapV3PriceProvider(
            USDC_WETH_POOL,
            WETH,
            USDC,
            TWAP_PERIOD,
            "Uniswap V3 WETH/USDC TWAP"
        );
        
        // Deploy Uniswap provider DAI/WETH
        daiWethProvider = new UniswapV3PriceProvider(
            DAI_WETH_POOL,
            WETH,
            DAI,
            TWAP_PERIOD,
            "Uniswap V3 WETH/DAI TWAP"
        );
    }
    
    function testUSDCWETHPoolReturnsPrice() public view {
        int256 price = usdcWethProvider.getPrice();
        
        // ETH price should be reasonable
        assertGt(price, 500e8, "ETH price too low");
        assertLt(price, 10000e8, "ETH price too high");
        
        console.log("USDC/WETH TWAP price:", uint256(price) / 1e8);
    }
    
    function testDAIWETHPoolReturnsPrice() public view {
        int256 price = daiWethProvider.getPrice();
        
        // ETH price should be reasonable
        assertGt(price, 500e8, "ETH price too low");
        assertLt(price, 10000e8, "ETH price too high");
        
        console.log("DAI/WETH TWAP price:", uint256(price) / 1e8);
    }
    
    function testBothProvidersHealthy() public view {
        assertTrue(usdcWethProvider.isHealthy(), "USDC/WETH provider unhealthy");
        assertTrue(daiWethProvider.isHealthy(), "DAI/WETH provider unhealthy");
    }
    
    function testPricesConsistentWithChainlink() public view {
        int256 chainlinkPrice = chainlinkETHProvider.getPrice();
        int256 usdcTWAP = usdcWethProvider.getPrice();
        int256 daiTWAP = daiWethProvider.getPrice();
        
        console.log("Chainlink ETH/USD:", uint256(chainlinkPrice) / 1e8);
        console.log("USDC/WETH TWAP:", uint256(usdcTWAP) / 1e8);
        console.log("DAI/WETH TWAP:", uint256(daiTWAP) / 1e8);
        
        // Calculate deviation between Chainlink and USDC TWAP
        uint256 deviationUSDC = _calculateDeviation(chainlinkPrice, usdcTWAP);
        uint256 deviationDAI = _calculateDeviation(chainlinkPrice, daiTWAP);
        
        console.log("USDC TWAP deviation from Chainlink:", deviationUSDC, "bps");
        console.log("DAI TWAP deviation from Chainlink:", deviationDAI, "bps");
        
        // Deviation should be less than 10% (1000 bps)
        assertLt(deviationUSDC, 1000, "USDC TWAP deviation too high");
        assertLt(deviationDAI, 1000, "DAI TWAP deviation too high");
    }
    
    function testUSDCAndDAITWAPConsistent() public view {
        int256 usdcTWAP = usdcWethProvider.getPrice();
        int256 daiTWAP = daiWethProvider.getPrice();
        
        // Both TWAPs should be close to each other
        uint256 deviation = _calculateDeviation(usdcTWAP, daiTWAP);
        
        console.log("USDC vs DAI TWAP deviation:", deviation, "bps");
        
        // Should be within 5% of each other
        assertLt(deviation, 500, "USDC and DAI TWAPs too different");
    }
    
    function testDescriptions() public view {
        assertEq(usdcWethProvider.description(), "Uniswap V3 WETH/USDC TWAP");
        assertEq(daiWethProvider.description(), "Uniswap V3 WETH/DAI TWAP");
    }
    
    function testProviderConfiguration() public view {
        // USDC/WETH provider
        assertEq(address(usdcWethProvider.pool()), USDC_WETH_POOL);
        assertEq(usdcWethProvider.baseToken(), WETH);
        assertEq(usdcWethProvider.quoteToken(), USDC);
        assertEq(usdcWethProvider.twapPeriod(), TWAP_PERIOD);
        
        // DAI/WETH provider
        assertEq(address(daiWethProvider.pool()), DAI_WETH_POOL);
        assertEq(daiWethProvider.baseToken(), WETH);
        assertEq(daiWethProvider.quoteToken(), DAI);
        assertEq(daiWethProvider.twapPeriod(), TWAP_PERIOD);
    }
    
    // Helper function to calculate deviation in basis points
    function _calculateDeviation(int256 price1, int256 price2) 
        internal 
        pure 
        returns (uint256) 
    {
        if (price1 == 0 || price2 == 0) return 10000; // 100%
        
        int256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        uint256 deviation = (uint256(diff) * 10000) / uint256(price1);
        
        return deviation;
    }
}
