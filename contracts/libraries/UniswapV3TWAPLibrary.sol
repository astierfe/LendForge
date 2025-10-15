// contracts/libraries/UniswapV3TWAPLibrary.sol - v2.0
// Basé sur Uniswap v3-periphery OracleLibrary
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FullMath.sol";

library UniswapV3TWAPLibrary {
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;
    
    error InvalidTick();
    error InvalidPeriod();
    error InvalidAmount();
    
    // Calcul sqrtPriceX96 depuis tick (Uniswap TickMath)
    function getSqrtRatioAtTick(int24 tick) public pure returns (uint160 sqrtPriceX96) {
        if (tick < MIN_TICK || tick > MAX_TICK) revert InvalidTick();
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;
        if (tick > 0) ratio = type(uint256).max / ratio;
        sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
    }
    
    // Calcul TWAP depuis tickCumulatives (Notre code)
    function calculateTWAP(
        int56[] memory tickCumulatives,
        uint32 period
    ) public pure returns (int24 arithmeticMeanTick) {
        if (period == 0) revert InvalidPeriod();
        if (tickCumulatives.length < 2) revert InvalidPeriod();
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(period)));
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(period)) != 0)) {
            arithmeticMeanTick--;
        }
    }
    
    // Conversion tick → quote amount (Uniswap OracleLibrary.getQuoteAtTick)
    function getQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) public pure returns (uint256 quoteAmount) {
        if (baseAmount == 0) revert InvalidAmount();
        uint160 sqrtRatioX96 = getSqrtRatioAtTick(tick);
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }
    
    // Pipeline complet: tickCumulatives → TWAP → price en quote token
    function getTWAPQuote(
        int56[] memory tickCumulatives,
        uint32 period,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) public pure returns (uint256 quoteAmount) {
        int24 tick = calculateTWAP(tickCumulatives, period);
        quoteAmount = getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    }
    
    // Helper: convertir en prix USD avec 8 decimals (Chainlink compat)
    function getTWAPPriceUSD(
        int56[] memory tickCumulatives,
        uint32 period,
        address baseToken,
        address quoteToken
    ) public pure returns (int256 priceUSD8Decimals) {
        uint256 quoteAmount = getTWAPQuote(
            tickCumulatives,
            period,
            1e18,
            baseToken,
            quoteToken
        );
        priceUSD8Decimals = int256(quoteAmount / 1e10);
    }
}
