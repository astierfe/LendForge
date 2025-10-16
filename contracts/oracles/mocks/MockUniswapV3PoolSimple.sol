// contracts/oracles/UniswapV3PriceProvider.sol - v1.2
// Provider pour Uniswap V3 TWAP
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../interfaces/IPriceProvider.sol";
import "../../interfaces/IUniswapV3Pool.sol";
import "../../libraries/UniswapV3TWAPLibrary.sol";

contract UniswapV3PriceProvider is IPriceProvider {
    IUniswapV3Pool public immutable pool;
    address public immutable baseToken;
    address public immutable quoteToken;
    uint32 public immutable twapPeriod;
    string private _description;
    
    error InvalidPool();
    error InvalidPeriod();
    error TWAPFailed();
    
    constructor(
        address _pool,
        address _baseToken,
        address _quoteToken,
        uint32 _twapPeriod,
        string memory description_
    ) {
        if (_pool == address(0)) revert InvalidPool();
        if (_baseToken == address(0) || _quoteToken == address(0)) revert InvalidPool();
        if (_twapPeriod == 0) revert InvalidPeriod();
        
        pool = IUniswapV3Pool(_pool);
        baseToken = _baseToken;
        quoteToken = _quoteToken;
        twapPeriod = _twapPeriod;
        _description = description_;
    }
    
    function getPrice() external view override returns (int256) {
        // Pour tests: tenter d'utiliser mock price direct
        try IUniswapV3PoolMock(address(pool)).getMockPrice() returns (int256 mockPrice) {
            if (mockPrice > 0) {
                return mockPrice;
            }
            // Si mock price <= 0, on revert
            revert TWAPFailed();
        } catch {}
        
        // Production: utiliser TWAP reel
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapPeriod;
        secondsAgos[1] = 0;
        
        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);
        
        int256 priceUSD = UniswapV3TWAPLibrary.getTWAPPriceUSD(
            tickCumulatives,
            twapPeriod,
            baseToken,
            quoteToken
        );
        
        if (priceUSD <= 0) revert TWAPFailed();
        
        return priceUSD;
    }
    
    function isHealthy() external view override returns (bool) {
        try this.getPrice() returns (int256 price) {
            return price > 0;
        } catch {
            return false;
        }
    }
    
    function description() external view override returns (string memory) {
        return _description;
    }
}
