// contracts/CollateralManager.sol - v1.0
// Multi-collateral manager avec integration Oracle Phase 2
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./OracleAggregator.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CollateralManager {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    OracleAggregator public immutable oracle;
    address public owner;
    
    // User collateral: user => asset => amount
    mapping(address => mapping(address => uint256)) public userCollateral;
    
    // User's list of deposited assets
    mapping(address => address[]) private userAssets;
    
    // Asset configs
    struct CollateralConfig {
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationPenalty;
        uint8 decimals;
        bool enabled;
        string symbol;
    }
    
    mapping(address => CollateralConfig) public assetConfigs;
    address[] public supportedAssets;
    
    // ETH placeholder address
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    // ============ Events ============
    
    event CollateralDeposited(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 timestamp
    );
    
    event CollateralWithdrawn(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 timestamp
    );
    
    event AssetAdded(
        address indexed asset,
        string symbol,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationPenalty
    );
    
    event AssetConfigUpdated(
        address indexed asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationPenalty
    );
    
    event AssetEnabled(address indexed asset, bool enabled);
    
    // ============ Errors ============
    
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error AssetNotSupported();
    error AssetAlreadyExists();
    error InsufficientCollateral();
    error InvalidConfig();
    error TransferFailed();
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier validAsset(address asset) {
        if (!assetConfigs[asset].enabled) revert AssetNotSupported();
        _;
    }
    
    modifier nonZeroAmount(uint256 amount) {
        if (amount == 0) revert InvalidAmount();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _oracle) {
        if (_oracle == address(0)) revert InvalidAddress();
        oracle = OracleAggregator(_oracle);
        owner = msg.sender;
    }
    
    // ============ Deposit Functions ============
    
    function depositETH() external payable nonZeroAmount(msg.value) validAsset(ETH_ADDRESS) {
        userCollateral[msg.sender][ETH_ADDRESS] += msg.value;
        _addAssetToUser(msg.sender, ETH_ADDRESS);
        
        emit CollateralDeposited(msg.sender, ETH_ADDRESS, msg.value, block.timestamp);
    }
    
    function depositERC20(address asset, uint256 amount) 
        external 
        nonZeroAmount(amount) 
        validAsset(asset) 
    {
        if (asset == ETH_ADDRESS) revert InvalidAddress();
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        userCollateral[msg.sender][asset] += amount;
        _addAssetToUser(msg.sender, asset);
        
        emit CollateralDeposited(msg.sender, asset, amount, block.timestamp);
    }
    
    // ============ Withdraw Functions ============
    
    function withdrawETH(uint256 amount) 
        external 
        nonZeroAmount(amount) 
        validAsset(ETH_ADDRESS) 
    {
        if (userCollateral[msg.sender][ETH_ADDRESS] < amount) {
            revert InsufficientCollateral();
        }
        
        userCollateral[msg.sender][ETH_ADDRESS] -= amount;
        _removeAssetIfZero(msg.sender, ETH_ADDRESS);
        
        emit CollateralWithdrawn(msg.sender, ETH_ADDRESS, amount, block.timestamp);
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
    }
    
    function withdrawERC20(address asset, uint256 amount) 
        external 
        nonZeroAmount(amount) 
        validAsset(asset) 
    {
        if (asset == ETH_ADDRESS) revert InvalidAddress();
        if (userCollateral[msg.sender][asset] < amount) {
            revert InsufficientCollateral();
        }
        
        userCollateral[msg.sender][asset] -= amount;
        _removeAssetIfZero(msg.sender, asset);
        
        emit CollateralWithdrawn(msg.sender, asset, amount, block.timestamp);
        
        IERC20(asset).safeTransfer(msg.sender, amount);
    }
    
    // ============ View Functions ============
    
    function getCollateralValueUSD(address user) external returns (uint256 totalValueUSD) {
        address[] memory assets = userAssets[user];
        
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 balance = userCollateral[user][asset];
            
            if (balance == 0) continue;
            
            int256 price = oracle.getPrice(asset);
            require(price > 0, "Invalid price");
            
            CollateralConfig memory config = assetConfigs[asset];
            uint256 valueUSD = _convertToUSD(balance, uint256(price), config.decimals);
            
            totalValueUSD += valueUSD;
        }
        
        return totalValueUSD;
    }
    
    function getUserCollaterals(address user) external view returns (
        address[] memory assets,
        uint256[] memory amounts,
        uint256[] memory valuesUSD
    ) {
        assets = userAssets[user];
        amounts = new uint256[](assets.length);
        valuesUSD = new uint256[](assets.length);
        
        for (uint256 i = 0; i < assets.length; i++) {
            amounts[i] = userCollateral[user][assets[i]];
        }
        
        return (assets, amounts, valuesUSD);
    }
    
    function getUserCollateralBalance(address user, address asset) 
        external 
        view 
        returns (uint256) 
    {
        return userCollateral[user][asset];
    }
    
    function getUserAssets(address user) external view returns (address[] memory) {
        return userAssets[user];
    }
    
    function getAssetConfig(address asset) external view returns (CollateralConfig memory) {
        return assetConfigs[asset];
    }
    
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }
    
    function isAssetSupported(address asset) external view returns (bool) {
        return assetConfigs[asset].enabled;
    }
    
    function getMaxBorrowValue(address user) external returns (uint256) {
        address[] memory assets = userAssets[user];
        uint256 totalMaxBorrow = 0;
        
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 balance = userCollateral[user][asset];
            
            if (balance == 0) continue;
            
            int256 price = oracle.getPrice(asset);
            require(price > 0, "Invalid price");
            
            CollateralConfig memory config = assetConfigs[asset];
            uint256 valueUSD = _convertToUSD(balance, uint256(price), config.decimals);
            uint256 maxBorrowForAsset = (valueUSD * config.ltv) / 100;
            
            totalMaxBorrow += maxBorrowForAsset;
        }
        
        return totalMaxBorrow;
    }
    
    // ============ Admin Functions ============
    
    function addAsset(
        address asset,
        string calldata symbol,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationPenalty,
        uint8 decimals_
    ) external onlyOwner {
        if (asset == address(0)) revert InvalidAddress();
        if (assetConfigs[asset].enabled) revert AssetAlreadyExists();
        if (ltv >= liquidationThreshold) revert InvalidConfig();
        if (liquidationThreshold > 100) revert InvalidConfig();
        if (liquidationPenalty > 50) revert InvalidConfig();
        
        assetConfigs[asset] = CollateralConfig({
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            liquidationPenalty: liquidationPenalty,
            decimals: decimals_,
            enabled: true,
            symbol: symbol
        });
        
        supportedAssets.push(asset);
        
        emit AssetAdded(asset, symbol, ltv, liquidationThreshold, liquidationPenalty);
    }
    
    function updateAssetConfig(
        address asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationPenalty
    ) external onlyOwner validAsset(asset) {
        if (ltv >= liquidationThreshold) revert InvalidConfig();
        if (liquidationThreshold > 100) revert InvalidConfig();
        if (liquidationPenalty > 50) revert InvalidConfig();
        
        assetConfigs[asset].ltv = ltv;
        assetConfigs[asset].liquidationThreshold = liquidationThreshold;
        assetConfigs[asset].liquidationPenalty = liquidationPenalty;
        
        emit AssetConfigUpdated(asset, ltv, liquidationThreshold, liquidationPenalty);
    }
    
    function setAssetEnabled(address asset, bool enabled) external onlyOwner {
        if (assetConfigs[asset].decimals == 0) revert AssetNotSupported();
        
        assetConfigs[asset].enabled = enabled;
        emit AssetEnabled(asset, enabled);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
    
    // ============ Internal Helpers ============
    
    function _convertToUSD(
        uint256 amount,
        uint256 priceUSD8Decimals,
        uint8 assetDecimals
    ) internal pure returns (uint256) {
        // Convert to 8 decimal USD format (Chainlink standard)
        if (assetDecimals == 18) {
            return (amount * priceUSD8Decimals) / 1e18;
        } else if (assetDecimals == 6) {
            return (amount * priceUSD8Decimals) / 1e6;
        } else if (assetDecimals == 8) {
            return amount * priceUSD8Decimals / 1e8;
        } else {
            return (amount * priceUSD8Decimals) / (10 ** assetDecimals);
        }
    }
    
    function _addAssetToUser(address user, address asset) internal {
        address[] storage assets = userAssets[user];
        
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == asset) return;
        }
        
        assets.push(asset);
    }
    
    function _removeAssetIfZero(address user, address asset) internal {
        if (userCollateral[user][asset] != 0) return;
        
        address[] storage assets = userAssets[user];
        
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == asset) {
                assets[i] = assets[assets.length - 1];
                assets.pop();
                break;
            }
        }
    }
    
    // ============ Receive ETH ============
    
    receive() external payable {
        revert("Use depositETH()");
    }
}
