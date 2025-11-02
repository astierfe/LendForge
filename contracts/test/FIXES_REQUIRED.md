# Tests à corriger après fix ETH→USD

## Changement global

**AVANT (bugué) :** `pool.borrow()` acceptait des montants USD avec 8 décimales
**APRÈS (fixé) :** `pool.borrow()` accepte des montants ETH en Wei (18 décimales)

---

## Tests à modifier

### LendingPool.t.sol (4 tests)

#### 1. `testCannotExceedMaxBorrow()` - Ligne 193
**Problème :** Attend un revert qui n'arrive plus car le montant est maintenant valide

**AVANT :**
```solidity
pool.borrow(1500e8); // 1500 USD (8 déc) = dépasse max
```

**APRÈS :**
```solidity
// Collateral: 1 ETH @ $2000 = $2000
// Max borrow: $2000 × 66% = $1320
// Pour dépasser: emprunter > $1320 / $2000 = 0.66 ETH
pool.borrow(0.75 ether); // 0.75 ETH @ $2000 = $1500, dépasse $1320
```

---

#### 2. `testHealthFactorUnhealthy()` - Ligne ~250
**Problème :** Health factor est maintenant calculé correctement et la position n'est plus liquidable

**Solution :** Augmenter le montant emprunté pour rendre la position vraiment liquidable

**AVANT :**
```solidity
pool.borrow(XXXe8); // Montant en USD
```

**APRÈS :**
```solidity
// Emprunter plus pour HF < 1.0
// Calculer: maxBorrow × (liquidationThreshold / 100) + petit extra
pool.borrow(0.9 ether); // Ajuster selon le collateral
```

---

#### 3. `testLiquidateUnhealthyPosition()` - Ligne ~270
**Problème :** Même que #2

**Solution :** Même que #2

---

#### 4. `testLiquidationRequiresSufficientPayment()` - Ligne ~290
**Problème :** Position n'est plus liquidable + montant de paiement incorrect

**Solution :** Ajuster pour créer position liquidable ET payer le bon montant en ETH

---

### LendingPoolEdgeCases.t.sol (5 tests)

#### 5. `testHealthFactorAfterPriceChange()` - Ligne ~470
**Problème :** Assertion sur health factor incorrecte

**Solution :** Recalculer les valeurs attendues avec le nouveau calcul

---

#### 6. `testLiquidateCalculatesCorrectBonus()` - Ligne ~500
**Problème :** Position n'est pas liquidable

**Solution :** Augmenter montant emprunté

---

#### 7. `testLiquidateEmitsLiquidatedEvent()` - Ligne ~520
**Problème :** Event data incorrect (montants en ETH vs USD)

**Solution :** Ajuster assertions sur event data

---

#### 8. `testLiquidateRefundsExcess()` - Ligne ~540
**Problème :** Position non liquidable

**Solution :** Même que #6

---

#### 9. `testLiquidateUpdatesTotalBorrowed()` - Ligne ~560
**Problème :** Position non liquidable

**Solution :** Même que #6

---

## Stratégie de correction

### Option A : Corriger tous les tests maintenant (temps : ~30min)
- Modifier les 9 tests
- Vérifier que 59/59 passent
- Déployer en confiance

### Option B : Déployer maintenant, corriger les tests plus tard
- 50/59 tests passent (85%)
- Les tests qui échouent sont des edge cases de liquidation
- Risque : bugs non détectés dans liquidations

---

## Recommandation

**Option A** : Corriger les tests maintenant car :
1. Les tests de liquidation sont critiques pour la sécurité
2. 9 tests seulement à corriger
3. Gain de confiance avant déploiement

---

## Notes pour le déploiement

Une fois les tests à 100%, suivre cette procédure :

1. **Deploy LendingPool**
   ```bash
   forge script script/DeployLendingPool.s.sol --broadcast --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --verify
   ```

2. **Update .env**
   ```bash
   LENDING_POOL_ADDRESS=0x[NOUVELLE_ADRESSE]
   ```

3. **Update subgraph/subgraph.yaml**
   - Ligne 12: nouvelle adresse
   - Ligne 14: nouveau startBlock

4. **Redeploy subgraph**
   ```bash
   cd subgraph
   graph build
   graph deploy --studio lendforge-v4 --version-label v4.1.0
   ```

5. **Update frontend/.env.local**
   ```bash
   NEXT_PUBLIC_LENDING_POOL_ADDRESS=0x[NOUVELLE_ADRESSE]
   ```
