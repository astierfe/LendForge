// test/unit/UniswapV3PriceProvider.t.sol - v1.2
// Tests unitaires standalone
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

// Import le provider
import "../../oracles/UniswapV3PriceProvider.sol";

// Mini mock inline pour éviter les conflits
contract TestMockPool {
    int256 public mockPrice;
    
    function setMockPrice(int256 price) external {
        mockPrice = price;
    }
    
    function getMockPrice() external view returns (int256) {
        return mockPrice;
    }
    
    function observe(uint32[] calldata) 
        external 
        pure 
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory
        ) 
    {
        tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = 3600;
        
        return (tickCumulatives, new uint160[](2));
    }
}

contract UniswapV3PriceProviderTest is Test {
    UniswapV3PriceProvider provider;
    TestMockPool mockPool;
    
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
    uint32 constant TWAP_PERIOD = 3600;
    string constant DESCRIPTION = "Uniswap V3 WETH/USDC TWAP";
    
    function setUp() public {
        mockPool = new TestMockPool();
        mockPool.setMockPrice(2000e8);
        
        provider = new UniswapV3PriceProvider(
            address(mockPool),
            WETH,
            USDC,
            TWAP_PERIOD,
            DESCRIPTION
        );
    }
    
    function testConstructorInitialization() public view {
        assertEq(address(provider.pool()), address(mockPool));
        assertEq(provider.baseToken(), WETH);
        assertEq(provider.quoteToken(), USDC);
        assertEq(provider.twapPeriod(), TWAP_PERIOD);
    }
    
    function testGetPriceReturnsValidPrice() public view {
        int256 price = provider.getPrice();
        assertEq(price, 2000e8);
    }
    
    function testGetPriceUpdatesWithPoolPrice() public {
        mockPool.setMockPrice(2500e8);
        assertEq(provider.getPrice(), 2500e8);
    }
    
    function testIsHealthyReturnsTrueWhenPoolOK() public view {
        assertTrue(provider.isHealthy());
    }
    
    function testIsHealthyReturnsFalseOnZeroPrice() public {
        mockPool.setMockPrice(0);
        assertFalse(provider.isHealthy());
    }
    
    function testIsHealthyReturnsFalseOnNegativePrice() public {
        mockPool.setMockPrice(-100);
        assertFalse(provider.isHealthy());
    }
    
    function testDescriptionReturnsCorrectString() public view {
        assertEq(provider.description(), DESCRIPTION);
    }
    
    function testConstructorRevertsOnZeroPoolAddress() public {
        vm.expectRevert(UniswapV3PriceProvider.InvalidPool.selector);
        new UniswapV3PriceProvider(address(0), WETH, USDC, TWAP_PERIOD, DESCRIPTION);
    }
    
    function testConstructorRevertsOnZeroBaseToken() public {
        vm.expectRevert(UniswapV3PriceProvider.InvalidPool.selector);
        new UniswapV3PriceProvider(address(mockPool), address(0), USDC, TWAP_PERIOD, DESCRIPTION);
    }
    
    function testConstructorRevertsOnZeroPeriod() public {
        vm.expectRevert(UniswapV3PriceProvider.InvalidPeriod.selector);
        new UniswapV3PriceProvider(address(mockPool), WETH, USDC, 0, DESCRIPTION);
    }
    
    function testFuzzGetPrice(int256 price) public {
        vm.assume(price > 100e8 && price < 100000e8);
        
        mockPool.setMockPrice(price);
        assertEq(provider.getPrice(), price);
    }
}
