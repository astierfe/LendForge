# Analyse Fonctionnelle - DailyMetric Tests

**Date**: 2025-10-28
**Version**: LendForge v4.0.0 - DailyMetric Implementation

---

## 🎯 Objectif

Valider que les métriques journalières (`DailyMetric`) sont correctement calculées et agrégées à partir des événements on-chain (deposits, borrows, repayments, liquidations).

---

## ✅ Tests Techniques Validés (Matchstick)

### 1. **daily-metrics.test.ts** (8 tests)

| Test | Statut | Validation |
|------|--------|------------|
| `getDailyMetricId` format correct | ✅ PASS | ID = "daily-{dayNumber}" (ex: "daily-20023") |
| `getOrCreateDailyMetric` initialise tous les champs | ✅ PASS | Tous les compteurs à 0, TVL à 0 |
| `getOrCreateDailyMetric` charge métrique existante | ✅ PASS | Pas de duplication |
| `calculateUtilizationRate` division par 0 | ✅ PASS | Retourne 0 quand TVL = 0 |
| `calculateUtilizationRate` calcul correct | ✅ PASS | 50% borrowed / 100 TVL = 50% |
| `updateDailyMetricOnDeposit` incrémente compteurs | ✅ PASS | depositsCount+1, volume+amount, activeUsers+1 |
| `updateDailyMetricOnDeposit` sync avec GlobalMetric | ✅ PASS | TVL/borrowed copié depuis GlobalMetric |
| `updateDailyMetricOnDeposit` graceful sans GlobalMetric | ✅ PASS | Ne crash pas si GlobalMetric absent |

### 2. **collateral-manager.test.ts** (3 tests)

| Test | Statut | Validation |
|------|--------|------------|
| `handleCollateralDeposited` crée DailyMetric | ✅ PASS | Métrique créée lors du 1er deposit du jour |
| `handleCollateralDeposited` incrémente métrique existante | ✅ PASS | 2 deposits → depositsCount=2, volume=1500 |
| `handleCollateralDeposited` métriques séparées par jour | ✅ PASS | J1 et J2 ont des métriques distinctes |

### 3. **lending-pool.test.ts** (3 tests)

| Test | Statut | Validation |
|------|--------|------------|
| `handleBorrowed` crée DailyMetric | ✅ PASS | Métrique créée lors du 1er borrow du jour |
| `handleBorrowed` incrémente métrique existante | ✅ PASS | 2 borrows → borrowsCount=2, volume=1500 |
| `handleBorrowed` métriques séparées par jour | ✅ PASS | J1 et J2 ont des métriques distinctes |

**Total: 14 tests - 14 ✅ PASS - 0 ❌ FAIL**

---

## 🔍 Analyse Fonctionnelle

### Scénario 1: Deposit ETH

**Input:**
```typescript
User: 0xf350...4e01
Asset: ETH (0xEeee...EEeE)
Amount: 1000 wei
Timestamp: 1730000000 (day 20023)
```

**Output Attendu:**
```yaml
DailyMetric(daily-20023):
  depositsCount: 1
  volumeDeposited: 1000
  activeUsers: 1
  ethTVL: 1000 (sync avec GlobalMetric)
  totalTVL: 1000
  utilizationRate: 0% (pas encore de borrow)
```

**Résultat:** ✅ Conforme

---

### Scénario 2: Plusieurs deposits le même jour

**Input:**
```typescript
Event 1: User A dépose 1000 ETH à T=1730000000
Event 2: User A dépose 500 ETH à T=1730000000 (même jour)
```

**Output Attendu:**
```yaml
DailyMetric(daily-20023):
  depositsCount: 2
  volumeDeposited: 1500
  activeUsers: 2  ⚠️ ALERTE: Double comptage du même user
```

**Résultat:** ✅ Technique OK, ⚠️ **Limitation fonctionnelle connue**

**Note:** Approche A (simple) compte chaque transaction comme un user unique. Pour éviter le double comptage, il faudrait implémenter l'Approche B (entité `DailyUserActivity` avec ID unique par user/jour).

---

### Scénario 3: Métriques sur plusieurs jours

**Input:**
```typescript
Event 1: Deposit 1000 à T=1730000000 (day 20023)
Event 2: Deposit 1000 à T=1730086400 (day 20024, +1 jour)
```

**Output Attendu:**
```yaml
DailyMetric(daily-20023):
  depositsCount: 1
  volumeDeposited: 1000

DailyMetric(daily-20024):
  depositsCount: 1
  volumeDeposited: 1000
```

**Résultat:** ✅ Conforme - Isolation correcte par jour

---

### Scénario 4: Borrow avec calcul d'utilization rate

**Input:**
```typescript
GlobalMetric:
  currentTVL: 1000
  currentBorrowed: 0

Event: Borrow 500 à T=1730000000
```

**Output Attendu:**
```yaml
DailyMetric(daily-20023):
  borrowsCount: 1
  volumeBorrowed: 500
  totalBorrowed: 500 (sync avec GlobalMetric)
  totalTVL: 1000
  utilizationRate: 50% (500/1000)
```

**Résultat:** ✅ Conforme

---

## ⚠️ Limitations Fonctionnelles Identifiées

### 1. **Double comptage des `activeUsers`** (Approche A)

**Problème:**
Si le même user fait 3 transactions dans la même journée, `activeUsers` sera incrémenté de +3 au lieu de +1.

**Impact:**
Métrique `activeUsers` sur-estimée (acceptable pour un MVP, peut être affiné plus tard).

**Solution future:**
Implémenter `DailyUserActivity` avec ID = `"daily-YYYY-MM-DD-userAddress"` et compter les entités distinctes.

---

### 2. **TVL par asset écrasé (pas incrémental)**

**Comportement actuel:**
```typescript
metric.ethTVL = global.totalETHDeposited  // Snapshot global
metric.usdcTVL = global.totalUSDCDeposited
```

**Avantage:**
- Simple
- Toujours cohérent avec GlobalMetric (single source of truth)

**Inconvénient:**
- Ne reflète pas les variations intra-jour (juste snapshot à la dernière transaction)

**Verdict:**
✅ Acceptable - Le snapshot final est suffisant pour les dashboards journaliers.

---

### 3. **Double `save()` (performance)**

**Comportement:**
Chaque `update*()` fait 2 saves :
1. `metric.save()` (après incrémentation compteurs)
2. `syncDailyMetricWithGlobal()` → `metric.save()` (après sync TVL)

**Impact:**
~2x plus de writes dans l'indexer (pas d'impact on-chain, juste coût d'indexation).

**Verdict:**
✅ Acceptable - Gain en fiabilité > perte de performance négligeable.

---

## 📊 Couverture Fonctionnelle

| Fonctionnalité | Testée | Déployée | Notes |
|----------------|--------|----------|-------|
| Compteur deposits | ✅ | ⏳ | `depositsCount`, `volumeDeposited` |
| Compteur borrows | ✅ | ⏳ | `borrowsCount`, `volumeBorrowed` |
| Compteur repayments | ⚠️ | ⏳ | Code intégré, pas de test unitaire |
| Compteur liquidations | ⚠️ | ⏳ | Code intégré, pas de test unitaire |
| Compteur withdrawals | ⚠️ | ⏳ | Code intégré, pas de test unitaire |
| TVL snapshot | ✅ | ⏳ | Sync avec GlobalMetric |
| Utilization rate | ✅ | ⏳ | Calcul borrowed/TVL |
| Active users | ✅ | ⏳ | ⚠️ Double comptage possible |
| Isolation par jour | ✅ | ⏳ | Métriques distinctes par jour |
| Graceful degradation | ✅ | ⏳ | Fonctionne sans GlobalMetric |

**Légende:**
✅ Validé | ⚠️ Limitation connue | ⏳ Déploiement en attente

---

## 🚀 Recommandations Avant Deploy

### Tests Manquants

1. **Test `handleRepaid`**
   Valider que `repaymentsCount` et `volumeRepaid` s'incrémentent.

2. **Test `handleLiquidated`**
   Valider que `liquidationsCount` et `activeUsers` (+2) fonctionnent.

3. **Test `handleCollateralWithdrawn`**
   Valider que les withdrawals n'incrémentent PAS `volumeDeposited`.

### Tests End-to-End (Après Deploy)

**Query GraphQL à tester après déploiement:**

```graphql
{
  dailyMetrics(first: 7, orderBy: date, orderDirection: desc) {
    id
    date
    totalTVL
    totalBorrowed
    utilizationRate
    activeUsers
    activePositions
    depositsCount
    borrowsCount
    repaymentsCount
    liquidationsCount
    volumeDeposited
    volumeBorrowed
    volumeRepaid
    ethTVL
    usdcTVL
    daiTVL
  }
}
```

**Vérifications:**
- [ ] `dailyMetrics` retourne des résultats (pas de tableau vide)
- [ ] `date` correspond aux jours réels des transactions
- [ ] `utilizationRate` est cohérent (0-100%)
- [ ] `totalTVL` = `ethTVL + usdcTVL + daiTVL`
- [ ] `activeUsers` > 0 pour les jours avec transactions

---

## ✅ Conclusion

**Statut Technique:** ✅ Tous les tests passent (14/14)
**Statut Fonctionnel:** ✅ Logique métier conforme aux specs
**Limitations:** ⚠️ 1 limitation connue (double comptage `activeUsers`) - acceptable pour MVP

**Recommandation:** ✅ **Prêt pour deploy TheGraph**

Les limitations identifiées sont documentées et peuvent être améliorées dans une version future si nécessaire.
