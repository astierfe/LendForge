// test/unit/PriceRegistry.t.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "lib/forge-std/src/Test.sol";
import "../../oracles/PriceRegistry.sol";
import "../../oracles/ChainlinkPriceProvider.sol";
import "../../oracles/mocks/MockUSDCPriceProvider.sol";
import "../../oracles/mocks/MockDAIPriceProvider.sol";
import "../../oracles/mocks/MockUniswapFallbackProvider.sol";
import "../../oracles/mocks/MockChainlinkFeed.sol";

// Mock provider that always fails
contract FailingProvider {
    function getPrice() external pure returns (int256) {
        revert("Provider failed");
    }
    function isHealthy() external pure returns (bool) {
        return false;
    }
    function description() external pure returns (string memory) {
        return "Failing";
    }
}

contract PriceRegistryTest is Test {
    PriceRegistry registry;
    
    ChainlinkPriceProvider ethProvider;
    MockUSDCPriceProvider usdcProvider;
    MockDAIPriceProvider daiProvider;
    MockUniswapFallbackProvider uniFallback;
    
    MockChainlinkFeed mockChainlink;
    
    address owner = address(this);
    address user = address(0x1);
    
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
    address constant DAI = 0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357;
    
    function setUp() public {
        registry = new PriceRegistry();
        
        // Deploy providers
        mockChainlink = new MockChainlinkFeed(2000e8, 8);
        ethProvider = new ChainlinkPriceProvider(address(mockChainlink), "Chainlink ETH/USD");
        usdcProvider = new MockUSDCPriceProvider();
        daiProvider = new MockDAIPriceProvider();
        uniFallback = new MockUniswapFallbackProvider(2000e8);
    }
    
    // ============ Constructor & Ownership Tests ============
    
    function testConstructorSetsOwner() public view {
        assertEq(registry.owner(), owner);
    }
    
    function testTransferOwnership() public {
        registry.transferOwnership(user);
        assertEq(registry.owner(), user);
    }
    
    function testTransferOwnershipOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(PriceRegistry.Unauthorized.selector);
        registry.transferOwnership(user);
    }
    
    function testTransferOwnershipRevertsZeroAddress() public {
        vm.expectRevert(PriceRegistry.InvalidAddress.selector);
        registry.transferOwnership(address(0));
    }
    
    // ============ Add Asset Tests ============
    
    function testAddAssetETH() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        assertTrue(registry.isSupported(WETH));
        assertEq(registry.getPrimaryProvider(WETH), address(ethProvider));
        assertEq(registry.getFallbackProvider(WETH), address(uniFallback));
    }
    
    function testAddAssetUSDC() public {
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        
        assertTrue(registry.isSupported(USDC));
        assertEq(registry.decimals(USDC), 6);
    }
    
    function testAddAssetDAI() public {
        registry.addAsset(DAI, "DAI", address(daiProvider), address(0), 18);
        
        assertTrue(registry.isSupported(DAI));
    }
    
    function testAddAssetMultiple() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        registry.addAsset(DAI, "DAI", address(daiProvider), address(0), 18);
        
        address[] memory supported = registry.getSupportedAssets();
        assertEq(supported.length, 3);
    }
    
    function testAddAssetEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit PriceRegistry.AssetAdded(WETH, "WETH", address(ethProvider), address(uniFallback));
        
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
    }
    
    function testAddAssetOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(PriceRegistry.Unauthorized.selector);
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
    }
    
    function testAddAssetRevertsAlreadyExists() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        vm.expectRevert(PriceRegistry.AssetAlreadyExists.selector);
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
    }
    
    function testAddAssetRevertsZeroAddress() public {
        vm.expectRevert(PriceRegistry.InvalidAddress.selector);
        registry.addAsset(address(0), "WETH", address(ethProvider), address(uniFallback), 18);
    }
    
    function testAddAssetWithoutFallback() public {
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        
        assertEq(registry.getFallbackProvider(USDC), address(0));
    }
    
    // ============ Update Asset Tests ============
    
    function testUpdateAsset() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        MockUniswapFallbackProvider newFallback = new MockUniswapFallbackProvider(2100e8);
        registry.updateAsset(WETH, address(ethProvider), address(newFallback));
        
        assertEq(registry.getFallbackProvider(WETH), address(newFallback));
    }
    
    function testUpdateAssetEmitsEvent() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        vm.expectEmit(true, false, false, true);
        emit PriceRegistry.AssetUpdated(WETH, address(ethProvider), address(0));
        
        registry.updateAsset(WETH, address(ethProvider), address(0));
    }
    
    function testUpdateAssetOnlyOwner() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        vm.prank(user);
        vm.expectRevert(PriceRegistry.Unauthorized.selector);
        registry.updateAsset(WETH, address(ethProvider), address(0));
    }
    
    function testUpdateAssetRevertsNotFound() public {
        vm.expectRevert(PriceRegistry.AssetNotFound.selector);
        registry.updateAsset(WETH, address(ethProvider), address(uniFallback));
    }
    
    function testUpdatePrimaryProviderOnly() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        MockChainlinkFeed newMock = new MockChainlinkFeed(2100e8, 8);
        ChainlinkPriceProvider newProvider = new ChainlinkPriceProvider(
            address(newMock),
            "New ETH Provider"
        );
        
        registry.updatePrimaryProvider(WETH, address(newProvider));
        
        assertEq(registry.getPrimaryProvider(WETH), address(newProvider));
        assertEq(registry.getFallbackProvider(WETH), address(uniFallback));
    }
    
    function testUpdateFallbackProviderOnly() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        MockUniswapFallbackProvider newFallback = new MockUniswapFallbackProvider(2100e8);
        registry.updateFallbackProvider(WETH, address(newFallback));
        
        assertEq(registry.getPrimaryProvider(WETH), address(ethProvider));
        assertEq(registry.getFallbackProvider(WETH), address(newFallback));
    }
    
    // ============ Enable/Disable Tests ============
    
    function testSetAssetEnabledTrue() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.setAssetEnabled(WETH, false);
        registry.setAssetEnabled(WETH, true);
        
        assertTrue(registry.isSupported(WETH));
    }
    
    function testSetAssetEnabledFalse() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.setAssetEnabled(WETH, false);
        
        assertFalse(registry.isSupported(WETH));
    }
    
    function testSetAssetEnabledEmitsEvent() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        vm.expectEmit(true, false, false, true);
        emit PriceRegistry.AssetEnabled(WETH, false);
        
        registry.setAssetEnabled(WETH, false);
    }
    
    function testSetAssetEnabledOnlyOwner() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        vm.prank(user);
        vm.expectRevert(PriceRegistry.Unauthorized.selector);
        registry.setAssetEnabled(WETH, false);
    }
    
    function testSetAssetEnabledRevertsNotFound() public {
        vm.expectRevert(PriceRegistry.AssetNotFound.selector);
        registry.setAssetEnabled(WETH, false);
    }
    
    // ============ Get Price Tests ============
    
    function testGetPriceETH() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        int256 price = registry.getPrice(WETH);
        assertEq(price, 2000e8);
    }
    
    function testGetPriceUSDC() public {
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        
        int256 price = registry.getPrice(USDC);
        assertEq(price, 1e8);
    }
    
    function testGetPriceDAI() public {
        registry.addAsset(DAI, "DAI", address(daiProvider), address(0), 18);
        
        int256 price = registry.getPrice(DAI);
        assertEq(price, 1e8);
    }
    
    function testGetPriceMultipleAssets() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        registry.addAsset(DAI, "DAI", address(daiProvider), address(0), 18);
        
        assertEq(registry.getPrice(WETH), 2000e8);
        assertEq(registry.getPrice(USDC), 1e8);
        assertEq(registry.getPrice(DAI), 1e8);
    }
    
    function testGetPriceRevertsNotFound() public {
        vm.expectRevert(PriceRegistry.AssetNotFound.selector);
        registry.getPrice(WETH);
    }
    
    function testGetPriceRevertsDisabled() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.setAssetEnabled(WETH, false);
        
        vm.expectRevert(PriceRegistry.AssetDisabled.selector);
        registry.getPrice(WETH);
    }
    
    function testPriceUpdates() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        assertEq(registry.getPrice(WETH), 2000e8);
        
        mockChainlink.setPrice(2500e8);
        assertEq(registry.getPrice(WETH), 2500e8);
    }
    
    function testGetPriceFallsBackWhenPrimaryFails() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        // Make Chainlink stale
        vm.warp(block.timestamp + 2 hours);
        
        // Should fallback to Uniswap mock
        int256 price = registry.getPrice(WETH);
        assertEq(price, 2000e8);
    }
    
    function testGetPriceRevertsWhenBothFail() public {
        FailingProvider failPrimary = new FailingProvider();
        FailingProvider failFallback = new FailingProvider();
        
        registry.addAsset(WETH, "WETH", address(failPrimary), address(failFallback), 18);
        
        vm.expectRevert(PriceRegistry.AllProvidersFailed.selector);
        registry.getPrice(WETH);
    }
    
    // ============ Get Config Tests ============
    
    function testGetAssetConfig() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        (
            address primary,
            address fallbackPrimary,
            bool enabled,
            uint8 decimals_,
            string memory symbol
        ) = registry.getAssetConfig(WETH);
        
        assertEq(primary, address(ethProvider));
        assertEq(fallbackPrimary, address(uniFallback));
        assertTrue(enabled);
        assertEq(decimals_, 18);
        assertEq(symbol, "WETH");
    }
    
    function testGetPrimaryProvider() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        assertEq(registry.getPrimaryProvider(WETH), address(ethProvider));
    }
    
    function testGetPrimaryProviderRevertsDisabled() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.setAssetEnabled(WETH, false);
        
        vm.expectRevert(PriceRegistry.AssetDisabled.selector);
        registry.getPrimaryProvider(WETH);
    }
    
    function testGetFallbackProvider() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        assertEq(registry.getFallbackProvider(WETH), address(uniFallback));
    }
    
    function testDecimals() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        
        assertEq(registry.decimals(WETH), 18);
        assertEq(registry.decimals(USDC), 6);
    }
    
    function testDecimalsRevertsDisabled() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.setAssetEnabled(WETH, false);
        
        vm.expectRevert(PriceRegistry.AssetDisabled.selector);
        registry.decimals(WETH);
    }
    
    function testIsSupported() public {
        assertFalse(registry.isSupported(WETH));
        
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        assertTrue(registry.isSupported(WETH));
        
        registry.setAssetEnabled(WETH, false);
        assertFalse(registry.isSupported(WETH));
    }
    
    function testGetSupportedAssets() public {
        address[] memory supported = registry.getSupportedAssets();
        assertEq(supported.length, 0);
        
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        registry.addAsset(USDC, "USDC", address(usdcProvider), address(0), 6);
        
        supported = registry.getSupportedAssets();
        assertEq(supported.length, 2);
        assertEq(supported[0], WETH);
        assertEq(supported[1], USDC);
    }
    
    // ============ Other Tests ============
    
    function testInitiallyNoAssets() public view {
        address[] memory supported = registry.getSupportedAssets();
        assertEq(supported.length, 0);
    }
    
    function testFullLifecycle() public {
        // Add asset
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        assertTrue(registry.isSupported(WETH));
        
        // Get price
        assertEq(registry.getPrice(WETH), 2000e8);
        
        // Update providers
        MockUniswapFallbackProvider newFallback = new MockUniswapFallbackProvider(2100e8);
        registry.updateFallbackProvider(WETH, address(newFallback));
        
        // Disable
        registry.setAssetEnabled(WETH, false);
        assertFalse(registry.isSupported(WETH));
        
        // Re-enable
        registry.setAssetEnabled(WETH, true);
        assertTrue(registry.isSupported(WETH));
    }
    
    // ============ Provider Health Tests ============
    
    function testGetPriceSkipsUnhealthyPrimary() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        // Primary becomes unhealthy (stale)
        vm.warp(block.timestamp + 2 hours);
        
        // Should use fallback
        int256 price = registry.getPrice(WETH);
        assertEq(price, 2000e8);
    }
    
    function testGetPriceUsesHealthyPrimary() public {
        registry.addAsset(WETH, "WETH", address(ethProvider), address(uniFallback), 18);
        
        // Update fallback to different price
        uniFallback.setPrice(2500e8);
        
        // Should still use primary (healthy)
        int256 price = registry.getPrice(WETH);
        assertEq(price, 2000e8);
    }
}
