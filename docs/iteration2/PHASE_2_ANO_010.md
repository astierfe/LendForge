# Phase 2: ANO_010 - Liquidated Event Parameter Fix

**Durée Estimée:** 1-2 jours
**Risque:** MOYEN (coordination subgraph requise)
**Prérequis:** Phase 1 complétée (recommandé mais pas obligatoire)

---

## 🎯 Objectif

Corriger l'inversion des paramètres dans l'événement `Liquidated`:
- **Problème:** `emit Liquidated(liquidator, user)` au lieu de `(user, liquidator)`
- **Impact:** Subgraph attribue liquidation à mauvais utilisateur
- **Solution:** Inverser ordre + revert workaround subgraph

**Bénéfices:**
- Données on-chain correctes (event topics dans bon ordre)
- Subgraph simplifié (plus besoin de swap workaround)
- Données historiques cohérentes

---

## ⚠️ Note Importante

**ANO_010 DOIT être fixé AVANT ANO_008** car ANO_008 (transfert collatéral) utilise l'événement Liquidated. Si on fixe ANO_008 avant ANO_010, on aura des événements avec paramètres inversés dans le nouveau code.

---

## 🔧 Modifications de Code

### 1. LendingPool.sol - Événement Liquidated

**Fichier:** `contracts/LendingPool.sol`

**Modification unique: Ligne ~201**

```solidity
// AVANT (BUGGY):
emit Liquidated(
    msg.sender,     // ❌ liquidator en premier
    user,           // ❌ user en second
    debtToCover,
    collateralToSeizeUSD
);

// APRÈS (CORRECT):
emit Liquidated(
    user,           // ✅ user en premier (correspond à signature)
    msg.sender,     // ✅ liquidator en second
    debtToCover,
    collateralToSeizeUSD
);
```

**Note:** La signature de l'événement dans `ILendingPool.sol` est CORRECTE, pas besoin de la modifier:

```solidity
// contracts/interfaces/ILendingPool.sol:17 (CORRECT - NE PAS TOUCHER)
event Liquidated(
    address indexed user,        // Premier param
    address indexed liquidator,  // Second param
    uint256 debtRepaid,
    uint256 collateralSeized
);
```

---

## 🧪 Tests à Mettre à Jour

### Fichier: `contracts/test/integration/LiquidationScenario.t.sol`

**Test 1: Mettre à jour event expectation**

Chercher la définition de l'événement dans le test (ligne ~57-62):

```solidity
// AVANT:
event Liquidated(
    address indexed liquidator,  // ❌ Ordre inversé dans test
    address indexed user,
    uint256 debtCovered,
    uint256 collateralSeized
);

// APRÈS:
event Liquidated(
    address indexed user,        // ✅ Ordre correct
    address indexed liquidator,
    uint256 debtCovered,
    uint256 collateralSeized
);
```

**Test 2: Ajouter test vérifiant topics d'événement**

```solidity
function test_LiquidatedEvent_ParametersInCorrectOrder() public {
    // Setup: Créer position liquidable
    vm.startPrank(borrower);
    collateralManager.depositETH{value: 1 ether}();
    pool.borrow(0.6 ether);
    vm.stopPrank();

    // Crash prix pour rendre position liquidable
    ethFeed.setPrice(1500e8); // $2000 → $1500

    // Récupérer balance avant liquidation
    uint256 debtAmount = pool.positions(borrower).borrowedAmount;

    // Liquider
    vm.startPrank(liquidator);

    // Vérifier événement avec ORDRE CORRECT
    vm.expectEmit(true, true, false, false);
    emit Liquidated(
        borrower,    // ✅ Premier indexed param: user
        liquidator,  // ✅ Second indexed param: liquidator
        0,           // On ignore montants exacts pour ce test
        0
    );

    pool.liquidate{value: debtAmount}(borrower);

    vm.stopPrank();

    // Vérifier que les topics sont dans le bon ordre
    // topic[0] = keccak256 signature événement
    // topic[1] = user (borrower)
    // topic[2] = liquidator
    // Ce test passe si expectEmit ne revert pas
}

function test_LiquidatedEvent_TopicsOrder_OnChain() public {
    // Setup liquidation
    vm.startPrank(borrower);
    collateralManager.depositETH{value: 1 ether}();
    pool.borrow(0.6 ether);
    vm.stopPrank();

    ethFeed.setPrice(1500e8);

    vm.startPrank(liquidator);
    vm.recordLogs();

    pool.liquidate{value: 0.6 ether}(borrower);

    // Récupérer logs
    Vm.Log[] memory logs = vm.getRecordedLogs();

    // Trouver événement Liquidated
    bool found = false;
    for (uint i = 0; i < logs.length; i++) {
        if (logs[i].topics[0] == keccak256("Liquidated(address,address,uint256,uint256)")) {
            // Vérifier topics order
            address topic1User = address(uint160(uint256(logs[i].topics[1])));
            address topic2Liquidator = address(uint160(uint256(logs[i].topics[2])));

            assertEq(topic1User, borrower, "Topic[1] should be user (borrower)");
            assertEq(topic2Liquidator, liquidator, "Topic[2] should be liquidator");
            found = true;
            break;
        }
    }

    assertTrue(found, "Liquidated event should be emitted");
    vm.stopPrank();
}
```

---

## 🔄 Modifications Subgraph

### Fichier: `subgraph/src/lending-pool.ts`

**REVERT le swap workaround actuel**

Trouver `handleLiquidated` (environ ligne 166-234):

```typescript
// AVANT (WORKAROUND):
export function handleLiquidated(event: Liquidated): void {
  // ❌ SWAP pour compenser bug contrat
  let liquidatedUser = getOrCreateUser(
    event.params.liquidator.toHexString().toLowerCase(),  // INVERSÉ
    event.block.timestamp
  )

  let liquidatorUser = getOrCreateUser(
    event.params.user.toHexString().toLowerCase(),  // INVERSÉ
    event.block.timestamp
  )

  // ...reste du code avec variables swappées
}

// APRÈS (CORRECT - PAS DE SWAP):
export function handleLiquidated(event: Liquidated): void {
  // ✅ Utiliser params as-is (contrat maintenant correct)
  let liquidatedUser = getOrCreateUser(
    event.params.user.toHexString().toLowerCase(),  // CORRECT
    event.block.timestamp
  )

  let liquidatorUser = getOrCreateUser(
    event.params.liquidator.toHexString().toLowerCase(),  // CORRECT
    event.block.timestamp
  )

  // Marquer position comme LIQUIDATED
  let position = getOrCreatePosition(
    liquidatedUser.id,  // User liquidé, pas liquidateur
    "liquidate",
    event.block.timestamp
  )
  position.status = "LIQUIDATED"
  position.save()

  // Créer entité Liquidation
  let liquidation = new Liquidation(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )

  liquidation.user = liquidatedUser.id  // Utilisateur liquidé
  liquidation.liquidator = event.params.liquidator  // Liquidateur
  liquidation.debtRepaid = event.params.debtRepaid
  liquidation.collateralSeizedUSD = event.params.collateralSeizedUSD
  liquidation.timestamp = event.block.timestamp
  liquidation.transactionHash = event.transaction.hash

  liquidation.save()

  // Mettre à jour métriques
  updateDailyMetricOnLiquidate(
    event.block.timestamp,
    event.params.debtRepaid,
    liquidatedUser.id,
    event.params.liquidator.toHexString().toLowerCase()
  )
}
```

**Également revert swap dans updateDailyMetricOnLiquidate si présent** (daily-metrics.ts)

---

## ✅ Commandes de Test

### 1. Tests Contrats

```bash
cd contracts

# Tous les tests liquidation
forge test --match-contract LiquidationScenario -vvv

# Seulement les tests événements
forge test --match-test test_LiquidatedEvent -vvvv
```

### 2. Tester sur Fork

```bash
# Déployer sur fork
forge script script/DeployLendingPool.s.sol \
  --fork-url $SEPOLIA_RPC_URL \
  --broadcast

# Créer position liquidable et liquider
# (script complet dans section Validation)
```

### 3. Tests Subgraph

```bash
cd subgraph

# Regénérer types après changement event
npm run codegen

# Build
npm run build

# Déployer sur subgraph studio testnet
npm run deploy
```

---

## 🚀 Déploiement Coordonné

**CRITIQUE:** Contrat et subgraph doivent être déployés de manière synchronisée.

### Étape 1: Déployer Nouveau Contrat

```bash
cd contracts

forge script script/DeployLendingPool.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Noter adresse et block de déploiement
# Exemple: LendingPool v3.1 @ 0x... (block 9650000)
```

### Étape 2: Mettre à Jour Configuration

```bash
# .env
echo "LENDING_POOL_V3_1=<nouvelle_adresse>" >> .env
echo "DEPLOY_BLOCK_V3_1=<block_number>" >> .env
```

### Étape 3: Mettre à Jour Subgraph Config

```yaml
# subgraph/subgraph.yaml
dataSources:
  - kind: ethereum/contract
    name: LendingPool
    network: sepolia
    source:
      address: "<NOUVELLE_ADRESSE_LENDING_POOL>"
      abi: LendingPool
      startBlock: <DEPLOY_BLOCK_V3_1>  # NOUVEAU START BLOCK
```

### Étape 4: Déployer Subgraph

```bash
cd subgraph

# Nettoyer
rm -rf build generated

# Regénérer
npm run codegen
npm run build

# Déployer
graph auth --studio <DEPLOY_KEY>
graph deploy --studio lendforge-v-4
```

### Étape 5: Mettre à Jour Frontend/Bot

```bash
# Régénérer ABIs
cd contracts
forge inspect LendingPool abi > ../frontend/lib/contracts/abis/LendingPool.json
cp ../frontend/lib/contracts/abis/LendingPool.json ../bot/src/abis/

# Mettre à jour adresses
# frontend/.env.local
NEXT_PUBLIC_LENDING_POOL=<nouvelle_adresse>

# bot/.env
LENDING_POOL_ADDRESS=<nouvelle_adresse>
```

---

## ✅ Critères de Validation

### Contrats

- [ ] `forge test` passe à 100%
- [ ] Test `test_LiquidatedEvent_ParametersInCorrectOrder` passe
- [ ] Test `test_LiquidatedEvent_TopicsOrder_OnChain` passe
- [ ] Liquidation fonctionne toujours (integration test)

### Subgraph

- [ ] Déploiement sans erreur
- [ ] Sync démarre au nouveau startBlock
- [ ] Query `liquidations` retourne user/liquidator corrects
- [ ] Position.user = utilisateur liquidé (pas liquidateur)

### On-Chain Validation

Créer liquidation de test et vérifier événement:

```bash
# 1. Créer position
cast send $LENDING_POOL "borrow(uint256)" 1000000000000000000 \
  --private-key $USER_KEY

# 2. Crash prix (via ManualPriceProvider)
cast send $MANUAL_PRICE_PROVIDER "setPrice(int256)" 150000000000 \
  --private-key $DEPLOYER_KEY

# 3. Liquider
cast send $LENDING_POOL "liquidate(address)" $USER_ADDRESS \
  --value 1ether \
  --private-key $LIQUIDATOR_KEY

# 4. Vérifier événement
cast logs --address $LENDING_POOL \
  --from-block latest \
  --to-block latest

# 5. Décoder topics
# topic[1] devrait être $USER_ADDRESS (user)
# topic[2] devrait être $LIQUIDATOR_ADDRESS (liquidator)
```

### Subgraph Validation

```graphql
query {
  liquidations(orderBy: timestamp, orderDirection: desc, first: 1) {
    id
    user {
      id  # Devrait être user liquidé (lowercase)
    }
    liquidator  # Devrait être adresse liquidateur
    debtRepaid
    collateralSeizedUSD
    transactionHash
  }

  # Vérifier que position user est LIQUIDATED
  positions(where: { user: "<user_liquidé>" }) {
    status  # Devrait être "LIQUIDATED"
    user {
      id  # Devrait correspondre à user, pas liquidator
    }
  }
}
```

---

## ⚠️ Gestion Données Historiques

**Problème:** Anciennes liquidations (avant fix) ont paramètres inversés.

**Solutions:**

### Option A: Ignorer historique (Recommandé pour testnet)

- Nouveau startBlock = ignore ancien historique
- Subgraph propre avec données correctes uniquement

### Option B: Migration script (Si historique important)

Créer script de migration SQL pour inverser anciennes liquidations:

```sql
-- Inverser liquidations avant block X
UPDATE liquidations
SET
  user = liquidator,
  liquidator = user
WHERE block_number < <DEPLOY_BLOCK_V3_1>;
```

**Pour testnet:** Option A recommandée (nouveau startBlock).

---

## 🔄 Rollback Plan

Si problème critique détecté:

### 1. Revenir Ancien Contrat

```bash
# Pointer frontend/bot vers ancienne version
# .env
LENDING_POOL_ADDRESS=<ancienne_adresse_v3_0>
```

### 2. Rollback Subgraph

```bash
cd subgraph
git revert HEAD
npm run codegen
npm run deploy
```

### 3. Documenter Incident

```markdown
# INCIDENT_ANO_010_ROLLBACK.md
**Date:** YYYY-MM-DD
**Cause:** [Décrire problème]
**Action:** Rollback to v3.0
**Liquidations Affectées:** [Nombre]
**Next Steps:** [Plan de correction]
```

---

## 📝 Documentation à Mettre à Jour

### 1. CLAUDE.md

```markdown
**v6.5.0 (2025-11-XX):**
- ✅ RESOLVED: ANO_010 (Liquidated event parameter order)
- LendingPool v3.1 deployed
- Subgraph v6.2.5 deployed (reverted parameter swap workaround)
```

### 2. KNOWN_ISSUES_ANO.json

```json
{
  "id": "ANO_010",
  "status": "RESOLVED",
  "resolvedVersion": "6.5.0",
  "note": "Liquidations before block <DEPLOY_BLOCK> may have inverted data"
}
```

### 3. Subgraph README

Ajouter note:

```markdown
## Breaking Change v6.2.5

Event `Liquidated` parameters fixed in LendingPool v3.1 (block <DEPLOY_BLOCK>).

**Historical data:** Liquidations before block <DEPLOY_BLOCK> have inverted user/liquidator due to contract bug. New subgraph deployment ignores old data (startBlock = <DEPLOY_BLOCK>).
```

---

## 🔗 Prochaine Phase

Une fois Phase 2 validée → [Phase 3: ANO_006](./PHASE_3_ANO_006.md)

**Dépendances Phase 3:** Aucune - peut commencer immédiatement

**Note importante:** Phase 2 DOIT être complétée avant Phase 4 (ANO_008) car ANO_008 utilise l'événement Liquidated.

---

**Dernier Update:** 2025-11-26
**Status:** ✅ Prêt pour implémentation
