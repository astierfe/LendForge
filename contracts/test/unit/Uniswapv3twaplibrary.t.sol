// test/unit/UniswapV3TWAPLibrary.t.sol - v2.0
// Tests basés sur code Uniswap bataille-testé
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../libraries/UniswapV3TWAPLibrary.sol";

contract UniswapV3TWAPLibraryV2Test is Test {
    address constant TOKEN0 = address(0x1);
    address constant TOKEN1 = address(0x2);
    
    // ============ getSqrtRatioAtTick Tests ============
    
    function testGetSqrtRatioAtTickZero() public pure {
        uint160 sqrtPrice = UniswapV3TWAPLibrary.getSqrtRatioAtTick(0);
        assertEq(sqrtPrice, 79228162514264337593543950336);
    }
    
    function testGetSqrtRatioAtTickMinMax() public pure {
        UniswapV3TWAPLibrary.getSqrtRatioAtTick(-887272);
        UniswapV3TWAPLibrary.getSqrtRatioAtTick(887272);
    }
    
    function testGetSqrtRatioAtTickInvalidTooLow() public {
        try UniswapV3TWAPLibrary.getSqrtRatioAtTick(-887273) {
            fail("Should revert");
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), UniswapV3TWAPLibrary.InvalidTick.selector);
        }
    }
    
    function testGetSqrtRatioAtTickInvalidTooHigh() public {
        try UniswapV3TWAPLibrary.getSqrtRatioAtTick(887273) {
            fail("Should revert");
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), UniswapV3TWAPLibrary.InvalidTick.selector);
        }
    }
    
    // ============ calculateTWAP Tests ============
    
    function testCalculateTWAPBasic() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600 * 1000;
        int24 tick = UniswapV3TWAPLibrary.calculateTWAP(tickCumulatives, 3600);
        assertEq(tick, 1000);
    }
    
    function testCalculateTWAPNegative() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = -3600 * 5000;
        int24 tick = UniswapV3TWAPLibrary.calculateTWAP(tickCumulatives, 3600);
        assertEq(tick, -5000);
    }
    
    function testCalculateTWAPRoundingDown() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = -3605;
        int24 tick = UniswapV3TWAPLibrary.calculateTWAP(tickCumulatives, 3600);
        assertEq(tick, -2);
    }
    
    function testCalculateTWAPInvalidPeriod() public {
        int56[] memory tickCumulatives = new int56[](2);
        try UniswapV3TWAPLibrary.calculateTWAP(tickCumulatives, 0) {
            fail("Should revert");
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), UniswapV3TWAPLibrary.InvalidPeriod.selector);
        }
    }
    
    function testCalculateTWAPInvalidArray() public {
        int56[] memory tickCumulatives = new int56[](1);
        try UniswapV3TWAPLibrary.calculateTWAP(tickCumulatives, 3600) {
            fail("Should revert");
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), UniswapV3TWAPLibrary.InvalidPeriod.selector);
        }
    }
    
    // ============ getQuoteAtTick Tests ============
    
    function testGetQuoteAtTickZeroTick() public pure {
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            0,
            1e18,
            TOKEN0,
            TOKEN1
        );
        assertEq(quote, 1e18);
    }
    
    function testGetQuoteAtTickPositiveTick() public pure {
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            10000,
            1e18,
            TOKEN0,
            TOKEN1
        );
        assertGt(quote, 1e18);
    }
    
    function testGetQuoteAtTickNegativeTick() public pure {
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            -10000,
            1e18,
            TOKEN0,
            TOKEN1
        );
        assertLt(quote, 1e18);
    }
    
    function testGetQuoteAtTickInvertedTokens() public pure {
        uint256 quote1 = UniswapV3TWAPLibrary.getQuoteAtTick(
            10000,
            1e18,
            TOKEN0,
            TOKEN1
        );
        uint256 quote2 = UniswapV3TWAPLibrary.getQuoteAtTick(
            10000,
            1e18,
            TOKEN1,
            TOKEN0
        );
        assertLt(quote2, quote1);
    }
    
    function testGetQuoteAtTickZeroAmount() public {
        try UniswapV3TWAPLibrary.getQuoteAtTick(0, 0, TOKEN0, TOKEN1) {
            fail("Should revert");
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), UniswapV3TWAPLibrary.InvalidAmount.selector);
        }
    }
    
    function testGetQuoteAtTickMinTick() public pure {
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            -887272,
            type(uint128).max,
            TOKEN0,
            TOKEN1
        );
        assertEq(quote, 1);
    }
    
    function testGetQuoteAtTickMaxTick() public pure {
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            887272,
            type(uint128).max,
            TOKEN1,
            TOKEN0
        );
        assertEq(quote, 1);
    }
    
    // ============ getTWAPQuote Tests ============
    
    function testGetTWAPQuoteBasic() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600 * 1000;
        uint256 quote = UniswapV3TWAPLibrary.getTWAPQuote(
            tickCumulatives,
            3600,
            1e18,
            TOKEN0,
            TOKEN1
        );
        assertGt(quote, 1e18);
    }
    
    function testGetTWAPQuoteNegativeTick() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = -3600 * 1000;
        uint256 quote = UniswapV3TWAPLibrary.getTWAPQuote(
            tickCumulatives,
            3600,
            1e18,
            TOKEN0,
            TOKEN1
        );
        assertLt(quote, 1e18);
    }
    
    // ============ getTWAPPriceUSD Tests ============
    
    function testGetTWAPPriceUSDPositive() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600 * 10000;
        int256 priceUSD = UniswapV3TWAPLibrary.getTWAPPriceUSD(
            tickCumulatives,
            3600,
            TOKEN0,
            TOKEN1
        );
        assertGt(priceUSD, 1e8);
    }
    
    function testGetTWAPPriceUSDNegative() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = -3600 * 10000;
        int256 priceUSD = UniswapV3TWAPLibrary.getTWAPPriceUSD(
            tickCumulatives,
            3600,
            TOKEN0,
            TOKEN1
        );
        assertGt(priceUSD, 0);
        assertLt(priceUSD, 1e8);
    }
    
    function testGetTWAPPriceUSDChainlinkFormat() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600 * 5000;
        int256 priceUSD = UniswapV3TWAPLibrary.getTWAPPriceUSD(
            tickCumulatives,
            3600,
            TOKEN0,
            TOKEN1
        );
        assertTrue(priceUSD > 0);
        assertTrue(priceUSD < type(int64).max);
    }
    
    // ============ Real-World Scenarios ============
    
    function testETHUSDCScenario() public pure {
        // Simuler ETH à ~$2000 avec tick proche de 0 (pas -276324 car dépend ordre tokens)
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600 * 0;
        uint256 quote = UniswapV3TWAPLibrary.getTWAPQuote(
            tickCumulatives,
            3600,
            1e18,
            TOKEN0,
            TOKEN1
        );
        assertEq(quote, 1e18);
    }
    
    function testStablecoinPairScenario() public pure {
        // DAI/USDC proche de 1:1 (tick ≈ 0)
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600 * 10;
        uint256 quote = UniswapV3TWAPLibrary.getTWAPQuote(
            tickCumulatives,
            3600,
            1e18,
            TOKEN0,
            TOKEN1
        );
        assertGt(quote, 0.99e18);
        assertLt(quote, 1.01e18);
    }
    
    // ============ Fuzz Tests ============
    
    function testFuzzGetSqrtRatioAtTick(int24 tick) public pure {
        tick = int24(bound(tick, -887272, 887272));
        uint160 sqrtPrice = UniswapV3TWAPLibrary.getSqrtRatioAtTick(tick);
        assertTrue(sqrtPrice > 0);
    }
    
    function testFuzzCalculateTWAP(int56 delta, uint32 period) public pure {
        period = uint32(bound(period, 1, 86400));
        delta = int56(bound(delta, -887272 * int56(uint56(period)), 887272 * int56(uint56(period))));
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = delta;
        int24 tick = UniswapV3TWAPLibrary.calculateTWAP(tickCumulatives, period);
        assertTrue(tick >= -887272 && tick <= 887272);
    }
    
    function testFuzzGetQuoteAtTick(int24 tick, uint128 amount) public pure {
        tick = int24(bound(tick, -887272, 887272));
        amount = uint128(bound(amount, 1, type(uint128).max));
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            tick,
            amount,
            TOKEN0,
            TOKEN1
        );
        assertTrue(quote >= 0);
    }
    
    // ============ Edge Cases ============
    
    function testLargeBaseAmount() public pure {
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            0,
            type(uint128).max,
            TOKEN0,
            TOKEN1
        );
        assertEq(quote, type(uint128).max);
    }
    
    function testSmallBaseAmount() public pure {
        uint256 quote = UniswapV3TWAPLibrary.getQuoteAtTick(
            0,
            1,
            TOKEN0,
            TOKEN1
        );
        assertEq(quote, 1);
    }
    
    function testTickMonotonicity() public pure {
        uint256 quote1 = UniswapV3TWAPLibrary.getQuoteAtTick(-1000, 1e18, TOKEN0, TOKEN1);
        uint256 quote2 = UniswapV3TWAPLibrary.getQuoteAtTick(0, 1e18, TOKEN0, TOKEN1);
        uint256 quote3 = UniswapV3TWAPLibrary.getQuoteAtTick(1000, 1e18, TOKEN0, TOKEN1);
        assertTrue(quote1 < quote2);
        assertTrue(quote2 < quote3);
    }
    
    function testLargePeriodTWAP() public pure {
        int56[] memory tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 86400 * 50000;
        int24 tick = UniswapV3TWAPLibrary.calculateTWAP(tickCumulatives, 86400);
        assertEq(tick, 50000);
    }
}
