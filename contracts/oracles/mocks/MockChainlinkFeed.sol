// contracts/MockChainlinkFeed.sol - v1.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockChainlinkFeed {
    int256 public price;
    uint8 private _decimals;
    uint256 public updatedAt = block.timestamp;
    
    constructor(int256 initialPrice, uint8 decimals_) {
        price = initialPrice;
        _decimals = decimals_;
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt_,
        uint80 answeredInRound
    ) {
        return (1, price, block.timestamp, updatedAt, 1);
    }
    
    function decimals() external view returns (uint8) {
        return _decimals;
    }
    
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }
}