// contracts/token/LFTKN.sol - v1.0
// LendForge Token - Fixed supply ERC-20
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LFTKN is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 10_000_000 * 10**18; // 10M tokens
    
    constructor() ERC20("LendForge Token", "LFTKN") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
