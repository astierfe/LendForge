// contracts/interfaces/IPriceProvider.sol - v1.0
// Interface commune pour tous les price providers
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceProvider {
    // Retourne le prix de l'asset en 8 decimals (format Chainlink)
    function getPrice() external view returns (int256);
    
    // Indique si le provider est operationnel
    function isHealthy() external view returns (bool);
    
    // Description lisible du provider (ex: "Chainlink ETH/USD")
    function description() external view returns (string memory);
}
