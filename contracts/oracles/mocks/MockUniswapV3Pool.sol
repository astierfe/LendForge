// contracts/oracles/mocks/MockUniswapV3Pool.sol - v1.2
// Mock Uniswap V3 Pool avec prix direct (contourne problème tick→price)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../interfaces/IUniswapV3Pool.sol";
import "./MockChainlinkFeed.sol";


contract MockUniswapV3Pool is IUniswapV3Pool {
    int24 public currentTick = 0;
    int56 public tickCumulative0 = 0;
    int56 public tickCumulative1 = 0;
    
    // Prix USD stocké directement (évite conversion tick→price)
    int256 public mockPriceUSD = 0;
    MockChainlinkFeed public linkedChainlink;

    function linkToChainlink(address _chainlink) external {
        linkedChainlink = MockChainlinkFeed(_chainlink);
    }
    
    function setMockPrice(int256 priceUSD) external {
        mockPriceUSD = priceUSD;
        
        // Calculer tick approximatif pour cohérence
        if (priceUSD > 0) {
            int256 percentChange = ((priceUSD - 2000e8) * 10000) / 2000e8;
            currentTick = int24(percentChange);
            tickCumulative1 = int56(currentTick) * 3600;
        }
    }
    
    function observe(uint32[] calldata) 
        external 
        view 
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        ) 
    {
        tickCumulatives = new int56[](2);
        tickCumulatives[0] = tickCumulative0;
        tickCumulatives[1] = tickCumulative1;
        
        secondsPerLiquidityCumulativeX128s = new uint160[](2);
        secondsPerLiquidityCumulativeX128s[0] = 1;
        secondsPerLiquidityCumulativeX128s[1] = 1;
        
        return (tickCumulatives, secondsPerLiquidityCumulativeX128s);
    }
    
    // Helper pour OracleAggregator (évite calcul tick→price)
    function getMockPrice() external view returns (int256) {
        if (mockPriceUSD == 0 && address(linkedChainlink) != address(0)) {
            try linkedChainlink.latestRoundData() returns (
                uint80, int256 price, uint256, uint256, uint80
            ) {
                if (price > 0) return price;
            } catch {}
        }
        
        return mockPriceUSD;
    }
}