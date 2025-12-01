# Phase 1: ANO_002 + ANO_003 - CollateralManager Enhancements

**Durée Estimée:** 2-3 jours
**Risque:** FAIBLE
**Prérequis:** Aucun

---

## 🎯 Objectifs

Corriger les anomalies liées aux données subgraph:
- **ANO_002:** Ajouter paramètre `decimals` à l'événement `AssetAdded`
- **ANO_003:** Créer fonction `getAssetValueUSD(user, asset)` pour valeur per-asset

**Bénéfices:**
- Subgraph stocke les bonnes décimales (USDC = 6, ETH/DAI = 18)
- Calcul correct de valueUSD per-asset au lieu du total
- Suppression du workaround ASSET_DECIMALS mapping frontend

---

## 📋 Checklist WEB3 RULESET

Avant de commencer:
- [x] Vérifier si `_convertToUSD()` existe → **OUI** (CollateralManager.sol:324-333)
- [ ] Réutiliser `_convertToUSD()` pour `getAssetValueUSD()`
- [ ] Pas de duplication de logique de conversion
- [ ] Vérifier si erreurs custom existent déjà

---

## 🔧 Modifications de Code

### 1. CollateralManager.sol - Événement AssetAdded

**Fichier:** `contracts/CollateralManager.sol`

**Modification 1: Ajouter decimals à l'événement (ligne ~56-62)**

```solidity
// AVANT:
event AssetAdded(
    address indexed asset,
    string symbol,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationPenalty
);

// APRÈS:
event AssetAdded(
    address indexed asset,
    string symbol,
    uint8 decimals,        // NOUVEAU PARAMÈTRE
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationPenalty
);
```

**Modification 2: Mettre à jour émission événement dans addAsset() (ligne ~284)**

```solidity
// AVANT:
emit AssetAdded(asset, symbol, ltv, liquidationThreshold, liquidationPenalty);

// APRÈS:
emit AssetAdded(asset, symbol, decimals_, ltv, liquidationThreshold, liquidationPenalty);
```

**Note:** La variable `decimals_` existe déjà dans la fonction addAsset(), il suffit de l'ajouter à l'émission.

---

### 2. CollateralManager.sol - Fonction getAssetValueUSD

**Ajouter après la fonction getMaxBorrowValue() (ligne ~255)**

```solidity
/**
 * @notice Get USD value of a specific collateral asset for a user
 * @param user Address of the user
 * @param asset Address of the collateral asset
 * @return USD value with 8 decimals (Chainlink format)
 */
function getAssetValueUSD(address user, address asset)
    external
    returns (uint256)
{
    // Get user's balance for this specific asset
    uint256 balance = userCollateral[user][asset];
    if (balance == 0) return 0;

    // Get current price from oracle
    int256 price = oracle.getPrice(asset);
    require(price > 0, "Invalid price");

    // Get asset configuration for decimals
    CollateralConfig memory config = assetConfigs[asset];

    // RÉUTILISER la fonction existante _convertToUSD (WEB3 RULESET)
    return _convertToUSD(balance, uint256(price), config.decimals);
}
```

**Considération EVO_001/003:** Cette fonction utilise `oracle.getPrice()` qui sera agnostique de la source (Chainlink, Uniswap, Manual) après implémentation des EVOs.

---

## 🧪 Tests à Mettre à Jour/Créer

### Fichier: `contracts/test/unit/CollateralManager.t.sol`

**Test 1: Mettre à jour test existant addAsset**

Chercher le test `test_AddAsset_Success()` (environ ligne 112-113) et mettre à jour expectEmit:

```solidity
// AVANT:
vm.expectEmit(true, false, false, true);
emit AssetAdded(address(newToken), "NEW", 80, 85, 8);

// APRÈS:
vm.expectEmit(true, false, false, true);
emit AssetAdded(address(newToken), "NEW", 18, 80, 85, 8); // Ajouter decimals=18
```

**Test 2: Ajouter nouveaux tests pour getAssetValueUSD**

```solidity
function test_GetAssetValueUSD_ETH_SingleAsset() public {
    vm.startPrank(user1);

    // Déposer 1 ETH
    collateralManager.depositETH{value: 1 ether}();

    // Vérifier valueUSD pour ETH uniquement
    uint256 valueUSD = collateralManager.getAssetValueUSD(user1, ETH_ADDRESS);

    // 1 ETH * $2000 = $2000 (format 8 decimals)
    assertEq(valueUSD, 2000e8, "ETH value should be $2000");

    vm.stopPrank();
}

function test_GetAssetValueUSD_USDC_CorrectDecimals() public {
    vm.startPrank(user1);

    // Approuver et déposer 1000 USDC (6 decimals)
    usdc.approve(address(collateralManager), 1000e6);
    collateralManager.depositERC20(address(usdc), 1000e6);

    // Vérifier valueUSD pour USDC
    uint256 valueUSD = collateralManager.getAssetValueUSD(user1, address(usdc));

    // 1000 USDC * $1.00 = $1000 (format 8 decimals)
    assertEq(valueUSD, 1000e8, "USDC value should be $1000");

    vm.stopPrank();
}

function test_GetAssetValueUSD_MultipleAssets_ReturnsPerAsset() public {
    vm.startPrank(user1);

    // Déposer ETH + USDC
    collateralManager.depositETH{value: 2 ether}();
    usdc.approve(address(collateralManager), 500e6);
    collateralManager.depositERC20(address(usdc), 500e6);

    // Vérifier que chaque asset retourne sa propre valeur
    uint256 ethValue = collateralManager.getAssetValueUSD(user1, ETH_ADDRESS);
    uint256 usdcValue = collateralManager.getAssetValueUSD(user1, address(usdc));

    assertEq(ethValue, 4000e8, "ETH value should be $4000 (2 ETH * $2000)");
    assertEq(usdcValue, 500e8, "USDC value should be $500 (500 USDC * $1)");

    // Vérifier que ce n'est PAS le total collateral
    uint256 totalCollateral = collateralManager.getCollateralValueUSD(user1);
    assertEq(totalCollateral, 4500e8, "Total should be $4500");
    assertTrue(ethValue != totalCollateral, "ETH value should NOT equal total");

    vm.stopPrank();
}

function test_GetAssetValueUSD_ZeroBalance_ReturnsZero() public {
    uint256 valueUSD = collateralManager.getAssetValueUSD(user1, ETH_ADDRESS);
    assertEq(valueUSD, 0, "Should return 0 for user with no collateral");
}

function test_GetAssetValueUSD_InvalidPrice_Reverts() public {
    // Setup mock oracle to return invalid price
    vm.mockCall(
        address(oracle),
        abi.encodeWithSelector(oracle.getPrice.selector, ETH_ADDRESS),
        abi.encode(int256(0))
    );

    vm.startPrank(user1);
    collateralManager.depositETH{value: 1 ether}();

    vm.expectRevert("Invalid price");
    collateralManager.getAssetValueUSD(user1, ETH_ADDRESS);

    vm.stopPrank();
}
```

---

## 🔄 Modifications Subgraph

### Fichier: `subgraph/src/collateral-manager.ts`

**Modification 1: handleAssetAdded - Lire decimals de l'événement**

Trouver la fonction `handleAssetAdded` (environ ligne 270-278):

```typescript
// AVANT:
export function handleAssetAdded(event: AssetAdded): void {
  let asset = getOrCreateCollateralAsset(event.params.asset)

  asset.symbol = event.params.symbol
  asset.ltv = event.params.ltv.toI32()
  asset.liquidationThreshold = event.params.liquidationThreshold.toI32()
  asset.enabled = true

  asset.save()
}

// APRÈS:
export function handleAssetAdded(event: AssetAdded): void {
  let asset = getOrCreateCollateralAsset(event.params.asset)

  asset.symbol = event.params.symbol
  asset.decimals = event.params.decimals  // NOUVEAU: Lire de l'événement
  asset.ltv = event.params.ltv.toI32()
  asset.liquidationThreshold = event.params.liquidationThreshold.toI32()
  asset.enabled = true

  asset.save()
}
```

**Modification 2: handleCollateralDeposited - Utiliser getAssetValueUSD()**

Trouver `handleCollateralDeposited` (environ ligne 150-156):

```typescript
// AVANT:
let valueUSD = calculateAssetValueUSD(
  event.address,
  event.params.user,
  event.params.asset,
  userCollateral.amount
)
userCollateral.valueUSD = valueUSD  // PROBLÈME: retourne total, pas per-asset

// APRÈS:
// Appeler la nouvelle fonction contract getAssetValueUSD()
let valueUSD = collateralManagerContract.try_getAssetValueUSD(
  event.params.user,
  event.params.asset
)

userCollateral.valueUSD = valueUSD.reverted
  ? BigInt.fromI32(0)
  : valueUSD.value
```

**Note Schema:** Aucune modification nécessaire - `Asset.decimals` existe déjà dans schema.graphql.

---

## ✅ Commandes de Test

### 1. Compiler les contrats

```bash
cd contracts
forge build
```

### 2. Lancer les tests unitaires

```bash
# Tous les tests CollateralManager
forge test --match-contract CollateralManager -vv

# Seulement les nouveaux tests
forge test --match-test test_GetAssetValueUSD -vvv
```

### 3. Vérifier couverture de tests

```bash
forge coverage --match-contract CollateralManager
```

**Critère de succès:** Couverture > 90% pour CollateralManager.sol

---

## 🚀 Déploiement

### 1. Déployer sur Fork Sepolia

```bash
# Lancer fork local
anvil --fork-url $SEPOLIA_RPC_URL --fork-block-number latest

# Dans un autre terminal, déployer
forge script script/DeployCollateralManager.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### 2. Tester sur Fork

```bash
# Ajouter asset avec decimals
cast send $COLLATERAL_MANAGER \
  "addAsset(address,string,uint8,uint256,uint256,uint256)" \
  $USDC_ADDRESS "USDC" 6 75 85 10 \
  --private-key $DEPLOYER_KEY \
  --rpc-url http://127.0.0.1:8545

# Vérifier événement émis
cast logs --address $COLLATERAL_MANAGER \
  --rpc-url http://127.0.0.1:8545

# Tester getAssetValueUSD
cast call $COLLATERAL_MANAGER \
  "getAssetValueUSD(address,address)" \
  $USER_ADDRESS $USDC_ADDRESS \
  --rpc-url http://127.0.0.1:8545
```

### 3. Déployer sur Sepolia Testnet

```bash
forge script script/DeployCollateralManager.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Sauvegarder nouvelle adresse
echo "COLLATERAL_MANAGER_V1_1=<adresse>" >> .env
```

---

## ✅ Critères de Validation

### Contrats

- [ ] `forge test` passe à 100%
- [ ] Event `AssetAdded` contient `decimals` parameter
- [ ] `getAssetValueUSD(user, USDC)` retourne valeur correcte (6 decimals)
- [ ] `getAssetValueUSD(user, ETH)` retourne valeur correcte (18 decimals)
- [ ] Fonction retourne 0 pour balance vide
- [ ] Fonction revert sur prix invalide

### Subgraph

- [ ] Asset.decimals stocke 6 pour USDC (pas 18)
- [ ] Asset.decimals stocke 18 pour ETH/DAI
- [ ] UserCollateral.valueUSD montre valeur per-asset (pas total)
- [ ] Subgraph se synchronise sans erreur

### Regression Tests

- [ ] Dépôts ETH/USDC/DAI fonctionnent toujours
- [ ] Retraits fonctionnent toujours
- [ ] Calcul de Health Factor inchangé
- [ ] Frontend affiche toujours bonnes données

---

## 📊 Tests de Regression Manuels

### Scénario 1: Dépôt Multi-Assets

```bash
# 1. Déposer 1 ETH
cast send $COLLATERAL_MANAGER "depositETH()" \
  --value 1ether \
  --private-key $USER_KEY

# 2. Déposer 1000 USDC
cast send $USDC "approve(address,uint256)" $COLLATERAL_MANAGER 1000000000
cast send $COLLATERAL_MANAGER "depositERC20(address,uint256)" $USDC 1000000000

# 3. Vérifier valeurs individuelles
cast call $COLLATERAL_MANAGER "getAssetValueUSD(address,address)" $USER $ETH_ADDRESS
# Attendu: 2000e8 ($2000)

cast call $COLLATERAL_MANAGER "getAssetValueUSD(address,address)" $USER $USDC
# Attendu: 1000e8 ($1000)

# 4. Vérifier total
cast call $COLLATERAL_MANAGER "getCollateralValueUSD(address)" $USER
# Attendu: 3000e8 ($3000)
```

### Scénario 2: Vérification Subgraph

```graphql
query {
  user(id: "<user_address_lowercase>") {
    collaterals {
      asset {
        symbol
        decimals  # Doit être 6 pour USDC, 18 pour ETH/DAI
      }
      amount
      valueUSD  # Doit être per-asset, PAS total
    }
  }
}
```

---

## 🔄 Rollback Plan

Si problème détecté:

### 1. Contrats

```bash
# Revenir à ancienne version CollateralManager
cast send $LENDING_POOL \
  "setCollateralManager(address)" \
  $OLD_COLLATERAL_MANAGER_ADDRESS \
  --private-key $DEPLOYER_KEY
```

### 2. Subgraph

```bash
cd subgraph
git revert HEAD  # Annuler changements handlers
npm run codegen
npm run deploy
```

### 3. Frontend

- Remettre workaround `ASSET_DECIMALS` mapping si nécessaire
- Garder calcul manuel valueUSD temporairement

---

## 📝 Documentation à Mettre à Jour

### 1. CLAUDE.md

Ajouter dans section "Current Version":

```markdown
**v6.4.0 (2025-11-XX):**
- ✅ RESOLVED: ANO_002 (Asset decimals in event)
- ✅ RESOLVED: ANO_003 (getAssetValueUSD function)
- CollateralManager v1.1 deployed
```

### 2. KNOWN_ISSUES_ANO.json

Mettre à jour statut:

```json
{
  "id": "ANO_002",
  "status": "RESOLVED",
  "resolvedVersion": "6.4.0"
},
{
  "id": "ANO_003",
  "status": "RESOLVED",
  "resolvedVersion": "6.4.0"
}
```

---

## 🔗 Prochaine Phase

Une fois Phase 1 validée → [Phase 2: ANO_010](./PHASE_2_ANO_010.md)

**Dépendances Phase 2:** Aucune - peut commencer immédiatement

---

**Dernier Update:** 2025-11-26
**Status:** ✅ Prêt pour implémentation
