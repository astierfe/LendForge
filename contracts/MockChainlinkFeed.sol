// contracts/src/MockChainlinkFeed.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockChainlinkFeed {
    int256 public price = 2000e8;
    uint256 public updatedAt = block.timestamp;
    
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt_,
            uint80 answeredInRound
        )
    {
        return (1, price, block.timestamp, updatedAt, 1);
    }
    
    function decimals() external pure returns (uint8) {
        return 8;
    }
    
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }
}