// contracts/interfaces/IUniswapV3Pool.sol - v1.0
// Interface Uniswap V3 Pool pour TWAP
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (
            int56[] memory tickCumulatives, 
            uint160[] memory secondsPerLiquidityCumulativeX128s
        );
}

interface IUniswapV3PoolMock {
    function getMockPrice() external view returns (int256);
}