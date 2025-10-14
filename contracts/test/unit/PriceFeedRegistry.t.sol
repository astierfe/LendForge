// test/unit/PriceFeedRegistry.t.sol - v1.1 - Fixed address(0) and event issues
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../oracles/PriceFeedRegistry.sol";
import "../../OracleAggregator.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";
import "../../oracles/mocks/MockUniswapV3Pool.sol";

contract PriceFeedRegistryTest is Test {
    PriceFeedRegistry registry;
    
    OracleAggregator oracleETH;
    OracleAggregator oracleUSDC;
    OracleAggregator oracleDAI;
    
    MockChainlinkFeed chainlinkETH;
    MockChainlinkFeed chainlinkUSDC;
    MockChainlinkFeed chainlinkDAI;
    
    MockUniswapV3Pool uniswapETH;
    MockUniswapV3Pool uniswapUSDC;
    MockUniswapV3Pool uniswapDAI;
    
    address owner = address(this);
    address user = address(0x123);
    
    // FIX: Use valid addresses (not address(0))
    address constant ETH = address(0x1); // Mock ETH address
    address USDC = address(0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8);
    address DAI = address(0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357);
    
    function setUp() public {
        // Deploy mocks
        chainlinkETH = new MockChainlinkFeed(2000e8, 8);
        chainlinkUSDC = new MockChainlinkFeed(1e8, 8);
        chainlinkDAI = new MockChainlinkFeed(1e8, 8);
        
        uniswapETH = new MockUniswapV3Pool();
        uniswapUSDC = new MockUniswapV3Pool();
        uniswapDAI = new MockUniswapV3Pool();
        
        uniswapETH.setMockPrice(2000e8);
        uniswapUSDC.setMockPrice(1e8);
        uniswapDAI.setMockPrice(1e8);
        
        // Deploy oracles
        oracleETH = new OracleAggregator(address(chainlinkETH), address(uniswapETH));
        oracleUSDC = new OracleAggregator(address(chainlinkUSDC), address(uniswapUSDC));
        oracleDAI = new OracleAggregator(address(chainlinkDAI), address(uniswapDAI));
        
        // Deploy registry
        registry = new PriceFeedRegistry();
    }
    
    // ============ Constructor Tests ============
    
    function testConstructorSetsOwner() public view {
        assertEq(registry.owner(), owner);
    }
    
    function testInitiallyNoAssets() public view {
        address[] memory assets = registry.getSupportedAssets();
        assertEq(assets.length, 0);
    }
    
    // ============ AddFeed Tests ============
    
    function testAddFeedETH() public {
        registry.addFeed(
            ETH,
            "ETH",
            address(chainlinkETH),
            address(uniswapETH),
            address(oracleETH),
            8
        );
        
        assertTrue(registry.isSupported(ETH));
        
        (
            address chainlink,
            address uniswap,
            address oracle,
            bool enabled,
            uint8 decimals_,
            string memory symbol
        ) = registry.getFeedConfig(ETH);
        
        assertEq(chainlink, address(chainlinkETH));
        assertEq(uniswap, address(uniswapETH));
        assertEq(oracle, address(oracleETH));
        assertTrue(enabled);
        assertEq(decimals_, 8);
        assertEq(symbol, "ETH");
    }
    
    function testAddFeedUSDC() public {
        registry.addFeed(
            USDC,
            "USDC",
            address(chainlinkUSDC),
            address(uniswapUSDC),
            address(oracleUSDC),
            8
        );
        
        assertTrue(registry.isSupported(USDC));
    }
    
    function testAddFeedDAI() public {
        registry.addFeed(
            DAI,
            "DAI",
            address(chainlinkDAI),
            address(uniswapDAI),
            address(oracleDAI),
            8
        );
        
        assertTrue(registry.isSupported(DAI));
    }
    
    function testAddFeedMultipleAssets() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        registry.addFeed(USDC, "USDC", address(chainlinkUSDC), address(uniswapUSDC), address(oracleUSDC), 8);
        registry.addFeed(DAI, "DAI", address(chainlinkDAI), address(uniswapDAI), address(oracleDAI), 8);
        
        address[] memory assets = registry.getSupportedAssets();
        assertEq(assets.length, 3);
    }
    
    function testAddFeedEmitsEvent() public {
        // FIX: All event parameters must match exactly
        vm.expectEmit(true, true, true, true);
        emit PriceFeedRegistry.FeedAdded(
            ETH,
            "ETH",
            address(chainlinkETH),
            address(uniswapETH),
            address(oracleETH)
        );
        
        registry.addFeed(
            ETH,
            "ETH",
            address(chainlinkETH),
            address(uniswapETH),
            address(oracleETH),
            8
        );
    }
    
    function testAddFeedRevertsZeroAddress() public {
        vm.expectRevert(PriceFeedRegistry.InvalidAddress.selector);
        registry.addFeed(
            address(0),
            "ZERO",
            address(chainlinkETH),
            address(uniswapETH),
            address(oracleETH),
            8
        );
    }
    
    function testAddFeedRevertsAlreadyExists() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        vm.expectRevert(PriceFeedRegistry.FeedAlreadyExists.selector);
        registry.addFeed(ETH, "ETH2", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
    }
    
    function testAddFeedOnlyOwner() public {
        vm.prank(user);
        
        vm.expectRevert(PriceFeedRegistry.Unauthorized.selector);
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
    }
    
    // ============ UpdateFeed Tests ============
    
    function testUpdateFeed() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        MockChainlinkFeed newChainlink = new MockChainlinkFeed(2100e8, 8);
        MockUniswapV3Pool newUniswap = new MockUniswapV3Pool();
        
        registry.updateFeed(ETH, address(newChainlink), address(newUniswap));
        
        (address chainlink, address uniswap, , , , ) = registry.getFeedConfig(ETH);
        
        assertEq(chainlink, address(newChainlink));
        assertEq(uniswap, address(newUniswap));
    }
    
    function testUpdateFeedEmitsEvent() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        address newChainlink = address(0x999);
        address newUniswap = address(0x888);
        
        vm.expectEmit(true, true, true, true);
        emit PriceFeedRegistry.FeedUpdated(ETH, newChainlink, newUniswap);
        
        registry.updateFeed(ETH, newChainlink, newUniswap);
    }
    
    function testUpdateFeedRevertsNotFound() public {
        vm.expectRevert(PriceFeedRegistry.FeedNotFound.selector);
        registry.updateFeed(ETH, address(0x123), address(0x456));
    }
    
    function testUpdateFeedOnlyOwner() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        vm.prank(user);
        
        vm.expectRevert(PriceFeedRegistry.Unauthorized.selector);
        registry.updateFeed(ETH, address(0x123), address(0x456));
    }
    
    // ============ SetFeedEnabled Tests ============
    
    function testSetFeedEnabledFalse() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        registry.setFeedEnabled(ETH, false);
        
        assertFalse(registry.isSupported(ETH));
    }
    
    function testSetFeedEnabledTrue() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        registry.setFeedEnabled(ETH, false);
        
        registry.setFeedEnabled(ETH, true);
        
        assertTrue(registry.isSupported(ETH));
    }
    
    function testSetFeedEnabledEmitsEvent() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        vm.expectEmit(true, true, true, true);
        emit PriceFeedRegistry.FeedEnabled(ETH, false);
        
        registry.setFeedEnabled(ETH, false);
    }
    
    function testSetFeedEnabledRevertsNotFound() public {
        vm.expectRevert(PriceFeedRegistry.FeedNotFound.selector);
        registry.setFeedEnabled(ETH, false);
    }
    
    function testSetFeedEnabledOnlyOwner() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        vm.prank(user);
        
        vm.expectRevert(PriceFeedRegistry.Unauthorized.selector);
        registry.setFeedEnabled(ETH, false);
    }
    
    // ============ GetPrice Tests ============
    
    function testGetPriceETH() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        int256 price = registry.getPrice(ETH);
        
        assertEq(price, 2000e8);
    }
    
    function testGetPriceUSDC() public {
        registry.addFeed(USDC, "USDC", address(chainlinkUSDC), address(uniswapUSDC), address(oracleUSDC), 8);
        
        int256 price = registry.getPrice(USDC);
        
        assertEq(price, 1e8);
    }
    
    function testGetPriceDAI() public {
        registry.addFeed(DAI, "DAI", address(chainlinkDAI), address(uniswapDAI), address(oracleDAI), 8);
        
        int256 price = registry.getPrice(DAI);
        
        assertEq(price, 1e8);
    }
    
    function testGetPriceMultipleAssets() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        registry.addFeed(USDC, "USDC", address(chainlinkUSDC), address(uniswapUSDC), address(oracleUSDC), 8);
        registry.addFeed(DAI, "DAI", address(chainlinkDAI), address(uniswapDAI), address(oracleDAI), 8);
        
        int256 priceETH = registry.getPrice(ETH);
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2000e8);
        assertEq(priceUSDC, 1e8);
        assertEq(priceDAI, 1e8);
    }
    
    function testGetPriceRevertsDisabled() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        registry.setFeedEnabled(ETH, false);
        
        vm.expectRevert(PriceFeedRegistry.FeedDisabled.selector);
        registry.getPrice(ETH);
    }
    
    function testGetPriceRevertsNotFound() public {
        vm.expectRevert(PriceFeedRegistry.FeedDisabled.selector);
        registry.getPrice(ETH);
    }
    
    // ============ GetCachedPrice Tests ============
    
    function testGetCachedPrice() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        // Update price first to populate cache
        registry.getPrice(ETH);
        
        (int256 price, uint256 updatedAt, string memory source) = registry.getCachedPrice(ETH);
        
        assertEq(price, 2000e8);
        assertEq(updatedAt, block.timestamp);
        assertEq(source, "chainlink");
    }
    
    function testGetCachedPriceRevertsDisabled() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        registry.setFeedEnabled(ETH, false);
        
        vm.expectRevert(PriceFeedRegistry.FeedDisabled.selector);
        registry.getCachedPrice(ETH);
    }
    
    function testGetCachedPriceRevertsNotFound() public {
        vm.expectRevert(PriceFeedRegistry.FeedDisabled.selector);
        registry.getCachedPrice(ETH);
    }
    
    // ============ View Functions Tests ============
    
    function testGetOracleAggregator() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        address oracle = registry.getOracleAggregator(ETH);
        
        assertEq(oracle, address(oracleETH));
    }
    
    function testGetOracleAggregatorRevertsDisabled() public {
        vm.expectRevert(PriceFeedRegistry.FeedDisabled.selector);
        registry.getOracleAggregator(ETH);
    }
    
    function testIsSupported() public {
        assertFalse(registry.isSupported(ETH));
        
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        assertTrue(registry.isSupported(ETH));
    }
    
    function testGetSupportedAssets() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        registry.addFeed(USDC, "USDC", address(chainlinkUSDC), address(uniswapUSDC), address(oracleUSDC), 8);
        registry.addFeed(DAI, "DAI", address(chainlinkDAI), address(uniswapDAI), address(oracleDAI), 8);
        
        address[] memory assets = registry.getSupportedAssets();
        
        assertEq(assets.length, 3);
        assertEq(assets[0], ETH);
        assertEq(assets[1], USDC);
        assertEq(assets[2], DAI);
    }
    
    function testGetFeedConfig() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        (
            address chainlink,
            address uniswap,
            address oracle,
            bool enabled,
            uint8 decimals_,
            string memory symbol
        ) = registry.getFeedConfig(ETH);
        
        assertEq(chainlink, address(chainlinkETH));
        assertEq(uniswap, address(uniswapETH));
        assertEq(oracle, address(oracleETH));
        assertTrue(enabled);
        assertEq(decimals_, 8);
        assertEq(symbol, "ETH");
    }
    
    function testDecimals() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        uint8 decimals_ = registry.decimals(ETH);
        
        assertEq(decimals_, 8);
    }
    
    function testDecimalsRevertsDisabled() public {
        vm.expectRevert(PriceFeedRegistry.FeedDisabled.selector);
        registry.decimals(ETH);
    }
    
    // ============ TransferOwnership Tests ============
    
    function testTransferOwnership() public {
        assertEq(registry.owner(), owner);
        
        registry.transferOwnership(user);
        
        assertEq(registry.owner(), user);
    }
    
    function testTransferOwnershipRevertsZeroAddress() public {
        vm.expectRevert(PriceFeedRegistry.InvalidAddress.selector);
        registry.transferOwnership(address(0));
    }
    
    function testTransferOwnershipOnlyOwner() public {
        vm.prank(user);
        
        vm.expectRevert(PriceFeedRegistry.Unauthorized.selector);
        registry.transferOwnership(user);
    }
    
    // ============ Integration Scenarios ============
    
    function testFullLifecycle() public {
        // Add 3 feeds
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        registry.addFeed(USDC, "USDC", address(chainlinkUSDC), address(uniswapUSDC), address(oracleUSDC), 8);
        registry.addFeed(DAI, "DAI", address(chainlinkDAI), address(uniswapDAI), address(oracleDAI), 8);
        
        // Get all prices
        int256 priceETH = registry.getPrice(ETH);
        int256 priceUSDC = registry.getPrice(USDC);
        int256 priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2000e8);
        assertEq(priceUSDC, 1e8);
        assertEq(priceDAI, 1e8);
        
        // Disable USDC
        registry.setFeedEnabled(USDC, false);
        assertFalse(registry.isSupported(USDC));
        
        // ETH and DAI still work
        priceETH = registry.getPrice(ETH);
        priceDAI = registry.getPrice(DAI);
        
        assertEq(priceETH, 2000e8);
        assertEq(priceDAI, 1e8);
        
        // Re-enable USDC
        registry.setFeedEnabled(USDC, true);
        priceUSDC = registry.getPrice(USDC);
        assertEq(priceUSDC, 1e8);
    }
    
    function testPriceUpdates() public {
        registry.addFeed(ETH, "ETH", address(chainlinkETH), address(uniswapETH), address(oracleETH), 8);
        
        int256 price1 = registry.getPrice(ETH);
        assertEq(price1, 2000e8);
        
        // Update Chainlink price
        chainlinkETH.setPrice(2500e8);
        
        int256 price2 = registry.getPrice(ETH);
        assertEq(price2, 2500e8);
    }
}
