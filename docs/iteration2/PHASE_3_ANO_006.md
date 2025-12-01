# Phase 3: ANO_006 - Pool Liquidity Validation

**Durée Estimée:** 1 jour
**Risque:** FAIBLE
**Prérequis:** Aucun (peut être fait en parallèle des Phases 1-2)

---

## 🎯 Objectif

Ajouter validation de liquidité du pool avant d'autoriser un emprunt:
- **Problème:** `borrow()` ne vérifie pas si pool a assez d'ETH
- **Impact:** Transaction revert avec erreur générique "ETH transfer failed"
- **Solution:** Valider `amount <= address(this).balance` avec erreur explicite

**Bénéfices:**
- Meilleure UX (erreur claire au lieu de revert générique)
- Sécurité renforcée (validation explicite)
- Conformité DeFi standards (Aave/Compound font cette vérification)

---

## 🔧 Modifications de Code

### 1. ILendingPool.sol - Nouvelle Erreur Custom

**Fichier:** `contracts/interfaces/ILendingPool.sol`

**Ajouter après les autres erreurs (ligne ~26)**

```solidity
/// @notice Erreur levée quand pool n'a pas assez de liquidité
/// @param requested Montant demandé
/// @param available Montant disponible dans pool
error InsufficientPoolLiquidity(uint256 requested, uint256 available);
```

**Considération EVO_001:** Cette erreur est indépendante du système de prix.

---

### 2. LendingPool.sol - Validation dans borrow()

**Fichier:** `contracts/LendingPool.sol`

**Modification 1: Ajouter validation AVANT check collateral (ligne ~73)**

```solidity
function borrow(uint256 amount)
    external
    whenNotPaused
    notInEmergency
    nonZeroAmount(amount)
{
    // NOUVEAU: Vérifier liquidité AVANT autres checks
    uint256 availableLiquidity = address(this).balance;
    if (amount > availableLiquidity) {
        revert InsufficientPoolLiquidity(amount, availableLiquidity);
    }

    DataTypes.Position storage position = positions[msg.sender];

    // ... reste du code existant inchangé
}
```

**Modification 2: Ajouter fonction view (ligne ~283, après getHealthFactor)**

```solidity
/**
 * @notice Get available liquidity in the pool
 * @return Available ETH balance in the pool
 */
function getAvailableLiquidity() external view returns (uint256) {
    return address(this).balance;
}
```

**Rationale de l'ordre:** Vérifier liquidité EN PREMIER évite de gaspiller gas sur checks collateral/HF si pool vide.

---

## 🧪 Tests à Créer

### Fichier: `contracts/test/unit/LendingPool.t.sol`

**Test 1: Borrow revert si pool liquidity insuffisante**

```solidity
function test_BorrowRevertsInsufficientPoolLiquidity() public {
    // Setup: User avec beaucoup de collateral
    vm.startPrank(user1);
    collateralManager.depositETH{value: 100 ether}();

    // Pool balance actuel (depuis setUp): 1000 ETH
    uint256 poolBalance = address(pool).balance;
    assertEq(poolBalance, 1000 ether, "Pool should have 1000 ETH");

    // Tenter d'emprunter PLUS que disponible
    uint256 borrowAmount = 1001 ether;

    // Expect custom error avec montants
    vm.expectRevert(
        abi.encodeWithSelector(
            ILendingPool.InsufficientPoolLiquidity.selector,
            borrowAmount,    // requested
            poolBalance      // available
        )
    );

    pool.borrow(borrowAmount);

    vm.stopPrank();
}

function test_BorrowSucceedsWithSufficientLiquidity() public {
    vm.startPrank(user1);

    // Déposer collateral
    collateralManager.depositETH{value: 2 ether}();

    // Pool a 1000 ETH, emprunter 0.5 ETH devrait passer
    uint256 borrowAmount = 0.5 ether;
    uint256 poolBalanceBefore = address(pool).balance;

    pool.borrow(borrowAmount);

    // Vérifier que pool balance a diminué
    uint256 poolBalanceAfter = address(pool).balance;
    assertEq(
        poolBalanceBefore - poolBalanceAfter,
        borrowAmount,
        "Pool balance should decrease by borrow amount"
    );

    vm.stopPrank();
}

function test_GetAvailableLiquidity() public view {
    uint256 liquidity = pool.getAvailableLiquidity();

    // Pool devrait avoir 1000 ETH depuis setUp
    assertEq(liquidity, 1000 ether, "Available liquidity should be 1000 ETH");
}

function test_GetAvailableLiquidity_AfterBorrows() public {
    // User1 emprunte
    vm.startPrank(user1);
    collateralManager.depositETH{value: 2 ether}();
    pool.borrow(0.5 ether);
    vm.stopPrank();

    // User2 emprunte
    vm.startPrank(user2);
    collateralManager.depositETH{value: 2 ether}();
    pool.borrow(0.3 ether);
    vm.stopPrank();

    // Liquidity devrait être 1000 - 0.5 - 0.3 = 999.2 ETH
    uint256 liquidity = pool.getAvailableLiquidity();
    assertEq(liquidity, 999.2 ether, "Liquidity should decrease after borrows");
}

function test_BorrowFailsExactlyAtLiquidityLimit() public {
    vm.startPrank(user1);
    collateralManager.depositETH{value: 200 ether}();

    uint256 poolBalance = address(pool).balance;

    // Essayer d'emprunter EXACTEMENT pool balance + 1 wei
    vm.expectRevert(
        abi.encodeWithSelector(
            ILendingPool.InsufficientPoolLiquidity.selector,
            poolBalance + 1,
            poolBalance
        )
    );

    pool.borrow(poolBalance + 1);

    vm.stopPrank();
}
```

**Test 2: Vérifier ordre des validations**

```solidity
function test_Borrow_LiquidityCheckBeforeCollateralCheck() public {
    vm.startPrank(user1);

    // User SANS collateral
    uint256 userCollateral = collateralManager.getCollateralValueUSD(user1);
    assertEq(userCollateral, 0, "User should have no collateral");

    // Pool vide (retirer funds)
    vm.startPrank(deployer);
    uint256 poolBalance = address(pool).balance;
    (bool success, ) = deployer.call{value: 0}("");
    // On ne peut pas retirer facilement, donc tester avec montant > balance
    vm.stopPrank();

    vm.startPrank(user1);

    // Tenter d'emprunter
    // Devrait revert avec InsufficientPoolLiquidity AVANT InsufficientCollateral
    // (car check liquidité est AVANT check collateral)

    uint256 borrowAmount = 5000 ether; // Plus que pool balance

    // Si liquidity check en premier, revert InsufficientPoolLiquidity
    // Si collateral check en premier, revert InsufficientCollateral
    vm.expectRevert(
        abi.encodeWithSelector(
            ILendingPool.InsufficientPoolLiquidity.selector,
            borrowAmount,
            1000 ether
        )
    );

    pool.borrow(borrowAmount);

    vm.stopPrank();
}
```

---

## ✅ Commandes de Test

### 1. Compiler

```bash
cd contracts
forge build
```

### 2. Lancer tests

```bash
# Tous les tests LendingPool
forge test --match-contract LendingPool -vv

# Seulement tests liquidity
forge test --match-test test_.*Liquidity -vvv

# Test gas usage
forge test --match-test test_BorrowSucceedsWithSufficientLiquidity --gas-report
```

### 3. Vérifier couverture

```bash
forge coverage --match-contract LendingPool
```

**Critère:** Couverture > 95% pour borrow() function

---

## 🚀 Déploiement

### 1. Tester sur Fork

```bash
# Lancer fork
anvil --fork-url $SEPOLIA_RPC_URL

# Déployer
forge script script/DeployLendingPool.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Test manuel
POOL=<adresse_deployed>

# 1. Vérifier liquidity initiale
cast call $POOL "getAvailableLiquidity()"

# 2. Tenter emprunt > liquidity
cast send $POOL "borrow(uint256)" 10000000000000000000000 \
  --private-key $USER_KEY
# Devrait revert avec InsufficientPoolLiquidity

# 3. Emprunt valide
cast send $POOL "borrow(uint256)" 1000000000000000000 \
  --private-key $USER_KEY
# Devrait passer
```

### 2. Déployer Sepolia

```bash
forge script script/DeployLendingPool.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Sauvegarder adresse
echo "LENDING_POOL_V3_2=<adresse>" >> .env
```

### 3. Mettre à jour Frontend/Bot ABIs

```bash
# Générer nouvel ABI
forge inspect LendingPool abi > ../frontend/lib/contracts/abis/LendingPool.json

# Copier pour bot
cp ../frontend/lib/contracts/abis/LendingPool.json ../bot/src/abis/

# Mettre à jour config
# frontend/.env.local
NEXT_PUBLIC_LENDING_POOL=<nouvelle_adresse>

# bot/.env
LENDING_POOL_ADDRESS=<nouvelle_adresse>
```

---

## ✅ Critères de Validation

### Contrats

- [ ] `forge test` passe à 100%
- [ ] Test `test_BorrowRevertsInsufficientPoolLiquidity` passe
- [ ] Test `test_GetAvailableLiquidity` passe
- [ ] Borrow valide fonctionne toujours
- [ ] Error custom contient requested + available amounts

### Frontend

- [ ] Error message montre "Pool liquidity insufficient"
- [ ] UI peut afficher available liquidity
- [ ] Max borrow limité par min(collateral_limit, pool_liquidity)

### Bot

- [ ] Bot peut lire `getAvailableLiquidity()`
- [ ] Logs montrent si borrow échoue par liquidity
- [ ] Aucune régression sur monitoring positions

---

## 📊 Tests de Regression Manuels

### Scénario 1: Borrow Normal

```bash
# 1. User dépose collateral
cast send $COLLATERAL_MANAGER "depositETH()" \
  --value 2ether \
  --private-key $USER_KEY

# 2. User emprunte montant valide
cast send $LENDING_POOL "borrow(uint256)" 1000000000000000000 \
  --private-key $USER_KEY

# 3. Vérifier position créée
cast call $LENDING_POOL "positions(address)" $USER_ADDRESS

# 4. Vérifier liquidity diminuée
cast call $LENDING_POOL "getAvailableLiquidity()"
```

### Scénario 2: Pool Low Liquidity

```bash
# 1. Plusieurs users empruntent jusqu'à épuiser pool
# (simulation avec fork)

# 2. Nouveau user tente emprunt
cast send $LENDING_POOL "borrow(uint256)" 100000000000000000000 \
  --private-key $NEW_USER_KEY

# 3. Devrait revert avec InsufficientPoolLiquidity

# 4. Frontend affiche erreur claire
```

### Scénario 3: Repay augmente liquidity

```bash
# 1. Vérifier liquidity avant
cast call $LENDING_POOL "getAvailableLiquidity()"
# Exemple: 950 ETH

# 2. User rembourse
cast send $LENDING_POOL "repay()" \
  --value 1ether \
  --private-key $USER_KEY

# 3. Vérifier liquidity après
cast call $LENDING_POOL "getAvailableLiquidity()"
# Devrait être 951 ETH
```

---

## 📝 Frontend Integration

### usePoolLiquidity Hook (Optionnel)

Créer hook pour afficher liquidity dans UI:

```typescript
// frontend/hooks/usePoolLiquidity.ts
import { useContractRead } from 'wagmi'
import { LENDING_POOL_ABI } from '@/lib/contracts/abis/LendingPool'

export function usePoolLiquidity() {
  const { data: liquidity, isLoading } = useContractRead({
    address: process.env.NEXT_PUBLIC_LENDING_POOL,
    abi: LENDING_POOL_ABI,
    functionName: 'getAvailableLiquidity',
    watch: true,
  })

  return {
    liquidity: liquidity ? formatEther(liquidity) : '0',
    isLoading,
  }
}
```

### Borrow Page Update

```typescript
// frontend/app/borrow/page.tsx
const { liquidity } = usePoolLiquidity()
const maxBorrow = Math.min(
  maxBorrowFromCollateral,
  parseFloat(liquidity)
)

// Afficher warning si pool low
{parseFloat(liquidity) < 10 && (
  <Alert variant="warning">
    Pool liquidity low ({liquidity} ETH). Max borrow limited.
  </Alert>
)}
```

---

## 🔄 Rollback Plan

Si problème:

```bash
# Pointer vers ancienne version
# .env
LENDING_POOL_ADDRESS=<v3_1_address>

# Frontend/bot redémarrent automatiquement avec ancienne adresse
```

**Pas d'impact subgraph** car pas d'événement modifié.

---

## 📝 Documentation à Mettre à Jour

### CLAUDE.md

```markdown
**v6.6.0 (2025-11-XX):**
- ✅ RESOLVED: ANO_006 (Pool liquidity validation)
- LendingPool v3.2 deployed
- New error: InsufficientPoolLiquidity(requested, available)
- New view: getAvailableLiquidity()
```

### KNOWN_ISSUES_ANO.json

```json
{
  "id": "ANO_006",
  "status": "RESOLVED",
  "resolvedVersion": "6.6.0"
}
```

---

## 🔗 Prochaine Phase

Une fois Phase 3 validée → [Phase 4: ANO_008](./PHASE_4_ANO_008.md)

**Dépendances Phase 4:**
- Phase 2 (ANO_010) DOIT être complétée
- Phase 1 recommandée mais pas obligatoire

---

**Dernier Update:** 2025-11-26
**Status:** ✅ Prêt pour implémentation
