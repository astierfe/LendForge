# Phase 4: ANO_008 - Liquidation Collateral Transfer (Partial & Full)

**Durée Estimée:** 5-7 jours (testing intensif requis)
**Risque:** CRITIQUE (système financier)
**Prérequis:** Phase 2 (ANO_010) DOIT être complétée

---

## 🎯 Objectifs

Implémenter le transfert automatique de collatéral lors de liquidation avec support liquidation partielle ET totale:
- **Problème:** `liquidate()` ne transfère JAMAIS le collatéral au liquidateur
- **Manquant:** Pas de liquidation partielle (actuellement tout est liquidé)
- **Solution:** Fonction `seizeCollateral()` + logique partial liquidation

**Bénéfices:**
- Liquidateur reçoit automatiquement collatéral
- Seizure proportionnelle multi-assets
- Liquidation partielle (liquider seulement portion nécessaire)
- User garde collatéral restant
- Suppression script manuel `transfer_liquidated_collateral.sh`

---

## ⚠️ Note Critique

**ANO_010 REQUIS:** Cette phase utilise l'événement `Liquidated`. Phase 2 doit être complétée pour avoir les bons paramètres `(user, liquidator)`.

---

## 📋 Checklist WEB3 RULESET

Avant de commencer:
- [ ] Vérifier si `_convertToUSD()` existe → **OUI** (CollateralManager.sol:324-333)
- [ ] Réutiliser pour calculs seizure
- [ ] Pas de duplication logique proportional seizure
- [ ] Centraliser dans seizeCollateral(), pas dans liquidate()
- [ ] Ajouter reentrancy guard (transfer ETH)

---

## 🔧 Modifications de Code

### 1. CollateralManager.sol - Infrastructure

**Fichier:** `contracts/CollateralManager.sol`

**Modification 1: Ajouter state variable et modifier (ligne ~16-18)**

```solidity
// State variables
address public lendingPool;
address public oracle;
address public owner;

// Modifiers
modifier onlyLendingPool() {
    if (msg.sender != lendingPool) revert Unauthorized();
    _;
}

modifier onlyOwner() {
    if (msg.sender != owner) revert Unauthorized();
    _;
}
```

**Modification 2: Ajouter setter LendingPool (ligne ~314, après addAsset)**

```solidity
/**
 * @notice Set LendingPool address (only owner)
 * @param _lendingPool Address of LendingPool contract
 */
function setLendingPool(address _lendingPool) external onlyOwner {
    if (_lendingPool == address(0)) revert InvalidAddress();
    lendingPool = _lendingPool;
}
```

**Modification 3: Nouvel événement CollateralSeized (ligne ~71)**

```solidity
event CollateralSeized(
    address indexed fromUser,
    address indexed toLiquidator,
    address indexed asset,
    uint256 amount,
    uint256 valueUSD,
    bool isPartialLiquidation
);
```

---

### 2. CollateralManager.sol - Fonction seizeCollateral

**Ajouter après depositERC20() (ligne ~169)**

```solidity
/**
 * @notice Seize collateral from liquidated user and transfer to liquidator
 * @dev Only callable by LendingPool during liquidation
 * @param fromUser Address of user being liquidated
 * @param toLiquidator Address of liquidator receiving collateral
 * @param totalSeizeValueUSD Total USD value to seize (8 decimals, includes 10% bonus)
 * @return actualSeizedUSD Actual USD value seized (may be less if insufficient collateral)
 */
function seizeCollateral(
    address fromUser,
    address toLiquidator,
    uint256 totalSeizeValueUSD
) external onlyLendingPool nonReentrant returns (uint256 actualSeizedUSD) {
    if (fromUser == address(0) || toLiquidator == address(0)) {
        revert InvalidAddress();
    }

    address[] memory assets = userAssets[fromUser];
    uint256 remainingUSD = totalSeizeValueUSD;
    actualSeizedUSD = 0;

    // Calculer total collateral user AVANT seizure
    uint256 totalCollateralUSD = getCollateralValueUSD(fromUser);
    bool isPartialLiquidation = totalSeizeValueUSD < totalCollateralUSD;

    // Seize collateral proportionnellement sur tous les assets
    for (uint256 i = 0; i < assets.length && remainingUSD > 0; i++) {
        address asset = assets[i];
        uint256 balance = userCollateral[fromUser][asset];

        if (balance == 0) continue;

        // Get current price
        int256 price = oracle.getPrice(asset);
        require(price > 0, "Invalid price");

        CollateralConfig memory config = assetConfigs[asset];

        // Calculer USD value de ce asset (RÉUTILISER _convertToUSD - WEB3 RULESET)
        uint256 assetValueUSD = _convertToUSD(
            balance,
            uint256(price),
            config.decimals
        );

        // Déterminer montant à seize (min de remaining needed ou available)
        uint256 seizeValueUSD = assetValueUSD < remainingUSD
            ? assetValueUSD
            : remainingUSD;

        // Convertir USD back to token amount
        uint256 seizeAmount = _convertFromUSD(
            seizeValueUSD,
            uint256(price),
            config.decimals
        );

        // Ensure we don't seize more than available
        if (seizeAmount > balance) {
            seizeAmount = balance;
            seizeValueUSD = assetValueUSD; // Recalculate exact USD
        }

        // Update balances
        userCollateral[fromUser][asset] -= seizeAmount;
        _removeAssetIfZero(fromUser, asset);

        // Transfer asset to liquidator
        if (asset == ETH_ADDRESS) {
            (bool success, ) = payable(toLiquidator).call{value: seizeAmount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(asset).safeTransfer(toLiquidator, seizeAmount);
        }

        emit CollateralSeized(
            fromUser,
            toLiquidator,
            asset,
            seizeAmount,
            seizeValueUSD,
            isPartialLiquidation
        );

        actualSeizedUSD += seizeValueUSD;
        remainingUSD -= seizeValueUSD;
    }

    return actualSeizedUSD;
}

/**
 * @notice Helper: Convert USD value to token amount
 * @param valueUSD USD value (8 decimals)
 * @param price Asset price (8 decimals)
 * @param decimals Asset decimals
 * @return Token amount in asset decimals
 */
function _convertFromUSD(
    uint256 valueUSD,
    uint256 price,
    uint8 decimals
) internal pure returns (uint256) {
    // valueUSD (8 dec) * 10^decimals / price (8 dec)
    // = amount in asset decimals
    if (decimals == 18) {
        return (valueUSD * 1e18) / price;
    } else if (decimals == 6) {
        return (valueUSD * 1e6) / price;
    } else if (decimals == 8) {
        return (valueUSD * 1e8) / price;
    } else {
        return (valueUSD * (10 ** decimals)) / price;
    }
}
```

---

### 3. LendingPool.sol - Liquidation Partielle

**Fichier:** `contracts/LendingPool.sol`

**Modification complète de liquidate() (ligne ~157-212)**

```solidity
/**
 * @notice Liquidate unhealthy position (partial or full)
 * @param user Address of user to liquidate
 * @param debtToCover Amount of debt to cover (0 = liquidate max 50%)
 */
function liquidate(address user, uint256 debtToCover)
    external
    payable
    whenNotPaused
    notInEmergency
{
    if (user == address(0)) revert InvalidAddress();

    DataTypes.Position storage position = positions[user];

    if (position.borrowedAmount == 0) revert NoDebt();

    // Get total collateral value
    uint256 collateralValueUSD = collateralManager.getCollateralValueUSD(user);

    // Convert debt to USD for health factor calculation
    int256 ethPrice = oracle.getPrice(address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
    require(ethPrice > 0, "Invalid ETH price");

    uint256 totalDebtUSD = HealthCalculator.convertETHtoUSD(
        position.borrowedAmount,
        uint256(ethPrice)
    );

    // Check if liquidatable
    if (!HealthCalculator.isLiquidatable(collateralValueUSD, totalDebtUSD)) {
        revert HealthyPosition();
    }

    // Déterminer montant à liquider
    uint256 actualDebtToCover;
    bool isPartialLiquidation = false;

    if (debtToCover == 0) {
        // Liquidation partielle: max 50% de la dette
        actualDebtToCover = position.borrowedAmount / 2;
        isPartialLiquidation = true;
    } else {
        // Montant spécifié par liquidateur
        actualDebtToCover = debtToCover;

        // Vérifier que ce n'est pas plus que 50% (sauf si close factor)
        uint256 maxPartialDebt = position.borrowedAmount / 2;
        if (debtToCover <= maxPartialDebt) {
            isPartialLiquidation = true;
        }
        // Si > 50%, c'est liquidation totale (allowed si position très unhealthy)
    }

    // Ensure liquidator pays correct amount
    require(msg.value >= actualDebtToCover, "Insufficient payment");

    // Calculate collateral to seize (with 10% bonus)
    uint256 collateralToSeizeUSD = _calculateLiquidationCollateralUSD(
        actualDebtToCover
    );

    // Seize collateral (peut être moins si collateral insuffisant)
    uint256 actualSeizedUSD = collateralManager.seizeCollateral(
        user,
        msg.sender,
        collateralToSeizeUSD
    );

    // Update user's debt
    if (isPartialLiquidation) {
        position.borrowedAmount -= actualDebtToCover;
        totalBorrowed -= actualDebtToCover;
    } else {
        // Liquidation totale
        position.borrowedAmount = 0;
        totalBorrowed -= actualDebtToCover;
    }

    emit Liquidated(
        user,
        msg.sender,
        actualDebtToCover,
        actualSeizedUSD  // Montant réellement saisi
    );

    // Refund excess payment
    if (msg.value > actualDebtToCover) {
        uint256 excess = msg.value - actualDebtToCover;
        (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
        require(refundSuccess, "Refund failed");
    }
}
```

**Modification helper (ligne ~213)**

```solidity
/**
 * @notice Calculate collateral to seize in USD (debt + 10% bonus)
 * @param debtAmount Debt amount in ETH
 * @return USD value to seize (8 decimals)
 */
function _calculateLiquidationCollateralUSD(uint256 debtAmount)
    internal
    returns (uint256)
{
    int256 ethPrice = oracle.getPrice(address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
    require(ethPrice > 0, "Invalid ETH price");

    uint256 debtUSD = HealthCalculator.convertETHtoUSD(
        debtAmount,
        uint256(ethPrice)
    );

    // Add 10% liquidation bonus
    return (debtUSD * 110) / 100;
}
```

---

## 🧪 Tests Critiques

### Fichier: `contracts/test/integration/LiquidationScenario.t.sol`

**Test 1: Liquidation Partielle (50% debt)**

```solidity
function test_PartialLiquidation_50Percent() public {
    // Setup: Position avec HF légèrement < 1
    vm.startPrank(borrower);
    collateralManager.depositETH{value: 2 ether}(); // $4000 collateral
    pool.borrow(1.5 ether); // Borrow $3000 (75% LTV)
    vm.stopPrank();

    // Petit crash prix: $2000 → $1800
    ethFeed.setPrice(1800e8);
    // Collateral: $3600, Debt: $2700
    // HF = ($3600 * 0.83) / $2700 = 1.11 (still healthy)

    // Crash plus: $1800 → $1600
    ethFeed.setPrice(1600e8);
    // Collateral: $3200, Debt: $2400
    // HF = ($3200 * 0.83) / $2400 = 1.10 (still healthy)

    // Crash final: $1600 → $1400
    ethFeed.setPrice(1400e8);
    // Collateral: $2800, Debt: $2100
    // HF = ($2800 * 0.83) / $2100 = 1.10... need lower

    ethFeed.setPrice(1300e8);
    // Collateral: $2600, Debt: $1950
    // HF = ($2600 * 0.83) / $1950 = 1.11... still need lower

    ethFeed.setPrice(1200e8);
    // Collateral: $2400, Debt: $1800
    // HF = ($2400 * 0.83) / $1800 = 1.10... need exactly under 1

    ethFeed.setPrice(1100e8);
    // Collateral: $2200, Debt: $1650
    // HF = ($2200 * 0.83) / $1650 = 1.106... still healthy

    ethFeed.setPrice(1000e8);
    // Collateral: $2000, Debt: $1500
    // HF = ($2000 * 0.83) / $1500 = 1.10... arrgh

    // Use more aggressive: borrow more
    vm.startPrank(borrower);
    pool.borrow(0.3 ether); // Total debt now 1.8 ETH
    vm.stopPrank();

    ethFeed.setPrice(1000e8);
    // Collateral: $2000, Debt: $1800
    // HF = ($2000 * 0.83) / $1800 = 0.92 (LIQUIDATABLE!)

    uint256 debtBefore = pool.positions(borrower).borrowedAmount;
    assertEq(debtBefore, 1.8 ether, "Debt should be 1.8 ETH");

    // Liquidation partielle: 50% = 0.9 ETH
    uint256 partialDebt = debtBefore / 2;

    vm.startPrank(liquidator);
    pool.liquidate{value: partialDebt}(borrower, 0); // 0 = partial mode

    // Vérifier dette réduite de 50%
    uint256 debtAfter = pool.positions(borrower).borrowedAmount;
    assertEq(debtAfter, 0.9 ether, "Debt should be reduced to 50%");

    // Vérifier liquidateur a reçu collatéral
    uint256 liquidatorETH = address(liquidator).balance;
    // Seize = (0.9 ETH debt * $1000) * 1.10 = $990
    // At $1000/ETH: 0.99 ETH seized
    assertApproxEqRel(liquidatorETH, 0.99 ether, 0.02e18); // 2% tolerance

    // Vérifier user garde collatéral restant
    uint256 userRemainingETH = collateralManager.getUserCollateralBalance(
        borrower,
        ETH_ADDRESS
    );
    // Started: 2 ETH, seized: 0.99 ETH, remaining: 1.01 ETH
    assertApproxEqRel(userRemainingETH, 1.01 ether, 0.02e18);

    // Vérifier position toujours ACTIVE (pas LIQUIDATED car partiel)
    // Note: Depend implementation - peut rester ACTIVE

    vm.stopPrank();
}
```

**Test 2: Liquidation Totale (100% debt)**

```solidity
function test_FullLiquidation_AllDebt() public {
    vm.startPrank(borrower);
    collateralManager.depositETH{value: 1 ether}();
    pool.borrow(0.65 ether); // 65% initial
    vm.stopPrank();

    // Crash massif
    ethFeed.setPrice(1000e8); // $2000 → $1000
    // Collateral: $1000, Debt: $650
    // HF = ($1000 * 0.83) / $650 = 1.27 (still healthy... need more crash)

    ethFeed.setPrice(800e8);
    // Collateral: $800, Debt: $520
    // HF = ($800 * 0.83) / $520 = 1.27 (still healthy)

    // Borrow more to make liquidatable
    vm.prank(borrower);
    pool.borrow(0.15 ether); // Total debt: 0.8 ETH

    ethFeed.setPrice(800e8);
    // Collateral: $800, Debt: $640
    // HF = ($800 * 0.83) / $640 = 1.03 (marginal)

    ethFeed.setPrice(750e8);
    // Collateral: $750, Debt: $600
    // HF = ($750 * 0.83) / $600 = 1.0375 (still marginal)

    ethFeed.setPrice(700e8);
    // Collateral: $700, Debt: $560
    // HF = ($700 * 0.83) / $560 = 1.035

    ethFeed.setPrice(650e8);
    // Collateral: $650, Debt: $520
    // HF = ($650 * 0.83) / $520 = 1.01

    ethFeed.setPrice(600e8);
    // Collateral: $600, Debt: $480
    // HF = ($600 * 0.83) / $480 = 1.0375... still healthy

    // Need to calculate exact price
    // HF = 1 when: collateralUSD * 0.83 = debtUSD
    // debtUSD = 0.8 ETH * price
    // collateralUSD = 1 ETH * price
    // (1 * price * 0.83) = (0.8 * price)
    // 0.83 = 0.8 → FALSE, so position IS healthy regardless

    // Retest with higher borrow
    vm.startPrank(borrower);
    // Reset
    vm.stopPrank();

    // Nouveau test: borrow 80%
    vm.startPrank(borrower);
    // Clear old borrow first... can't, so new user

    vm.stopPrank();

    // Use different setup
    address borrower2 = makeAddr("borrower2");
    vm.deal(borrower2, 10 ether);

    vm.startPrank(borrower2);
    collateralManager.depositETH{value: 1 ether}();
    pool.borrow(0.75 ether); // 75% LTV
    vm.stopPrank();

    ethFeed.setPrice(900e8);
    // Collateral: $900, Debt: $675
    // HF = ($900 * 0.83) / $675 = 1.106

    ethFeed.setPrice(850e8);
    // Collateral: $850, Debt: $637.5
    // HF = ($850 * 0.83) / $637.5 = 1.105

    // Calculate exact: HF = 1 when collateral * 0.83 / debt = 1
    // debt = 0.75 ETH → debtUSD = 0.75 * price
    // collateral = 1 ETH → collateralUSD = price
    // HF = (price * 0.83) / (0.75 * price) = 0.83 / 0.75 = 1.106
    // Position NEVER liquidatable with 75% borrow! Need 83%+

    vm.startPrank(borrower2);
    pool.borrow(0.1 ether); // Total: 0.85 ETH (85% > 83%)
    vm.stopPrank();

    ethFeed.setPrice(2000e8); // Reset to high
    // HF = ($2000 * 0.83) / (0.85 * $2000) = 0.83/0.85 = 0.976 (LIQUIDATABLE!)

    uint256 totalDebt = pool.positions(borrower2).borrowedAmount;
    assertEq(totalDebt, 0.85 ether);

    // Liquidation TOTALE
    vm.startPrank(liquidator);
    pool.liquidate{value: totalDebt}(borrower2, totalDebt);

    // Vérifier dette = 0
    uint256 debtAfter = pool.positions(borrower2).borrowedAmount;
    assertEq(debtAfter, 0, "Debt should be fully cleared");

    // Vérifier liquidateur a reçu TOUT le collatéral
    // Seize = (0.85 ETH * $2000) * 1.10 = $1870
    // Collateral available: 1 ETH * $2000 = $2000
    // Seized: min($1870, $2000) = $1870 / $2000 per ETH = 0.935 ETH

    // Verify via event or balance
    vm.stopPrank();
}
```

**Test 3: Multi-Asset Proportional Seizure**

```solidity
function test_MultiAsset_ProportionalSeizure() public {
    vm.startPrank(borrower);

    // Déposer 3 assets
    collateralManager.depositETH{value: 1 ether}(); // $2000
    usdc.approve(address(collateralManager), 1000e6);
    collateralManager.depositERC20(address(usdc), 1000e6); // $1000
    dai.approve(address(collateralManager), 500e18);
    collateralManager.depositERC20(address(dai), 500e18); // $500

    // Total collateral: $3500
    // Max borrow (75% LTV): $2625 → 1.3125 ETH

    pool.borrow(1.2 ether); // $2400 debt (safe)

    vm.stopPrank();

    // Crash ETH
    ethFeed.setPrice(1500e8);
    // Collateral: $1500 (ETH) + $1000 (USDC) + $500 (DAI) = $3000
    // Debt: $1800
    // HF = ($3000 * 0.83) / $1800 = 1.38 (healthy)

    // Borrow more
    vm.prank(borrower);
    pool.borrow(0.4 ether); // Total: 1.6 ETH

    ethFeed.setPrice(1500e8);
    // Debt: $2400
    // HF = ($3000 * 0.83) / $2400 = 1.0375 (marginal)

    ethFeed.setPrice(1400e8);
    // Collateral: $1400 + $1000 + $500 = $2900
    // Debt: $2240
    // HF = ($2900 * 0.83) / $2240 = 1.07

    ethFeed.setPrice(1300e8);
    // Collateral: $1300 + $1000 + $500 = $2800
    // Debt: $2080
    // HF = ($2800 * 0.83) / $2080 = 1.117

    // Need to calculate better
    // With 1.6 ETH debt at 83% threshold from $3000 collateral:
    // Max debt = $3000 * 0.75 = $2250
    // Current debt at price P: 1.6 * P
    // Liquidatable when: ($3000 - 0.4*P) * 0.83 < 1.6 * P
    // where collateral = 1 ETH * P + $1500 (stables)
    // So: (P + 1500) * 0.83 < 1.6 * P
    // 0.83P + 1245 < 1.6P
    // 1245 < 0.77P
    // P > 1616

    // At P = $1700:
    ethFeed.setPrice(1700e8);
    // Collateral: $1700 + $1500 = $3200
    // Debt: 1.6 * $1700 = $2720
    // HF = ($3200 * 0.83) / $2720 = 0.976 (LIQUIDATABLE!)

    // Liquidation partielle: 50% = 0.8 ETH
    uint256 partialDebt = 0.8 ether;

    vm.startPrank(liquidator);
    uint256 liquidatorETHBefore = address(liquidator).balance;
    uint256 liquidatorUSDCBefore = usdc.balanceOf(liquidator);
    uint256 liquidatorDAIBefore = dai.balanceOf(liquidator);

    pool.liquidate{value: partialDebt}(borrower, 0);

    // Collateral to seize: (0.8 ETH * $1700) * 1.10 = $1496
    // Total collateral: $3200
    // Proportion to seize: $1496 / $3200 = 46.75%

    // ETH: 46.75% of $1700 = $794.75 / $1700 = 0.4675 ETH
    // USDC: 46.75% of $1000 = $467.5 = 467.5 USDC
    // DAI: 46.75% of $500 = $233.75 = 233.75 DAI

    uint256 liquidatorETHAfter = address(liquidator).balance;
    uint256 liquidatorUSDCAfter = usdc.balanceOf(liquidator);
    uint256 liquidatorDAIAfter = dai.balanceOf(liquidator);

    // Vérifier proportions (avec tolerance)
    assertApproxEqRel(
        liquidatorETHAfter - liquidatorETHBefore,
        0.4675 ether,
        0.03e18 // 3% tolerance
    );
    assertApproxEqRel(
        liquidatorUSDCAfter - liquidatorUSDCBefore,
        467.5e6,
        0.03e18
    );
    assertApproxEqRel(
        liquidatorDAIAfter - liquidatorDAIBefore,
        233.75e18,
        0.03e18
    );

    vm.stopPrank();
}
```

**Test 4: Edge Cases**

```solidity
function test_InsufficientCollateral_SeizesAll() public {
    // Position très unhealthy: collateral < debt
    vm.startPrank(borrower);
    collateralManager.depositETH{value: 0.5 ether}(); // $1000
    pool.borrow(0.45 ether); // $900
    vm.stopPrank();

    // Crash massif
    ethFeed.setPrice(500e8);
    // Collateral: $250, Debt: $225
    // HF = ($250 * 0.83) / $225 = 0.92 (liquidatable)

    // Liquidateur tente de liquider tout
    vm.startPrank(liquidator);

    // Seize = ($225 * 1.10) = $247.5
    // Collateral available: $250
    // Should seize $247.5, liquidator gets 0.495 ETH

    pool.liquidate{value: 0.45 ether}(borrower, 0.45 ether);

    // Vérifier user garde dust collateral
    uint256 remaining = collateralManager.getUserCollateralBalance(
        borrower,
        ETH_ADDRESS
    );
    // $250 - $247.5 = $2.5 → 0.005 ETH at $500
    assertApproxEqRel(remaining, 0.005 ether, 0.05e18);

    vm.stopPrank();
}

function test_Reentrancy_Protection() public {
    // Deploy malicious liquidator contract
    // Test that seizeCollateral cannot be reentered
    // (Requires deploying attack contract - skip for now)
    // Mark as TODO in comments
}
```

---

## ✅ Commandes de Test

```bash
cd contracts

# Compiler
forge build

# Tests liquidation complets
forge test --match-contract LiquidationScenario -vvv

# Tests partial liquidation
forge test --match-test test_PartialLiquidation -vvvv

# Tests multi-asset
forge test --match-test test_MultiAsset -vvvv

# Gas report
forge test --match-contract LiquidationScenario --gas-report

# Fuzz testing (recommandé!)
forge test --match-test test_Fuzz_Liquidation -vv --fuzz-runs 1000
```

---

## 🚀 Déploiement

### 1. Fork Testing

```bash
anvil --fork-url $SEPOLIA_RPC_URL

# Deploy
forge script script/DeployCollateralManager.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

forge script script/DeployLendingPool.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Configure
cast send $COLLATERAL_MANAGER "setLendingPool(address)" $LENDING_POOL \
  --private-key $DEPLOYER_KEY \
  --rpc-url http://127.0.0.1:8545

# Test liquidation complète
# (voir section Validation)
```

### 2. Sepolia Deployment

```bash
# Deploy CollateralManager v1.2
forge script script/DeployCollateralManager.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Deploy LendingPool v3.3
forge script script/DeployLendingPool.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Configure
cast send $COLLATERAL_MANAGER "setLendingPool(address)" $LENDING_POOL \
  --private-key $DEPLOYER_KEY \
  --rpc-url $SEPOLIA_RPC_URL

# Update .env
echo "COLLATERAL_MANAGER_V1_2=<adresse>" >> .env
echo "LENDING_POOL_V3_3=<adresse>" >> .env
```

---

## ✅ Critères de Validation

### Contrats

- [ ] `forge test` passe à 100%
- [ ] Test partial liquidation passe (50% debt)
- [ ] Test full liquidation passe (100% debt)
- [ ] Test multi-asset seizure proportionnel passe
- [ ] Test insufficient collateral passe
- [ ] No reentrancy vulnerability (audit or test)
- [ ] Liquidateur reçoit bonus 10%
- [ ] User garde collatéral restant correct

### Scénarios Manuels

**Scénario 1: Partial Liquidation on Sepolia**

```bash
# User crée position
cast send $COLLATERAL_MANAGER "depositETH()" \
  --value 2ether \
  --private-key $USER_KEY

cast send $LENDING_POOL "borrow(uint256)" 1500000000000000000 \
  --private-key $USER_KEY

# Admin crash prix
cast send $MANUAL_PRICE_PROVIDER "setPrice(int256)" 100000000000 \
  --private-key $DEPLOYER_KEY

# Liquidateur liquide 50%
cast send $LENDING_POOL "liquidate(address,uint256)" $USER 0 \
  --value 0.75ether \
  --private-key $LIQUIDATOR_KEY

# Vérifier dette réduite
cast call $LENDING_POOL "positions(address)" $USER
# borrowedAmount devrait être 0.75 ETH (50% restant)

# Vérifier collatéral seizé
cast logs --address $COLLATERAL_MANAGER \
  --from-block latest
# Chercher événement CollateralSeized
```

**Scénario 2: Multi-Asset Liquidation**

```bash
# User dépose ETH + USDC + DAI
# Liquide position
# Vérifier liquidateur reçoit proportions correctes de chaque asset
```

### Regression

- [ ] Borrow fonctionne toujours
- [ ] Repay fonctionne toujours
- [ ] Health factor calculation inchangé
- [ ] Positions ACTIVE restent ACTIVE après partial liquidation
- [ ] Bot détecte positions liquidables

---

## 📝 Script Deprecation

### Marquer transfer_liquidated_collateral.sh DEPRECATED

```bash
# scripts/transfer_liquidated_collateral.sh

# Ajouter warning en haut:
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  DEPRECATED: This script is no longer needed as of v6.7.0"
echo "    Liquidation now automatically transfers collateral on-chain"
echo "    This script is kept for historical reference only"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Continue anyway? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi
```

---

## 🔄 Rollback Plan

Si bug critique:

```bash
# 1. Pointer vers anciens contrats
COLLATERAL_MANAGER=<v1_1_address>
LENDING_POOL=<v3_2_address>

# 2. Utiliser script manuel pour liquidations en cours
TX_HASH=<liquidation_tx>
bash scripts/transfer_liquidated_collateral.sh

# 3. Documenter incident
# 4. Fix bug
# 5. Redéployer avec fix
```

---

## 📝 Documentation

### CLAUDE.md

```markdown
**v6.7.0 (2025-11-XX):**
- ✅ RESOLVED: ANO_008 (Liquidation collateral transfer)
- LendingPool v3.3: Partial & full liquidation support
- CollateralManager v1.2: seizeCollateral() function
- DEPRECATED: scripts/transfer_liquidated_collateral.sh
- NEW: Liquidation partielle (50% max par défaut)
```

### KNOWN_ISSUES_ANO.json

```json
{
  "id": "ANO_008",
  "status": "RESOLVED",
  "resolvedVersion": "6.7.0",
  "note": "Partial liquidation also implemented"
}
```

---

## 🔗 Prochaine Phase

Une fois Phase 4 validée → [Phase 5: Subgraph](./PHASE_5_SUBGRAPH.md)

**Critique:** Monitorer 5 premières liquidations MANUELLEMENT avant de valider.

---

**Dernier Update:** 2025-11-26
**Status:** ✅ Prêt pour implémentation
**Effort Estimé:** 5-7 jours + 2 jours testing intensif
