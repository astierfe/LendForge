# LendForge - Roadmap Développement

**Version actuelle:** v6.0.3
**Dernière mise à jour:** 9 novembre 2025

---

## Statut Global du Projet

### ✅ Complété et Validé

**Smart Contracts (Solidity) - v4.1**
- CollateralManager v1.1 - Multi-collateral (ETH, USDC, DAI)
- LendingPool v4.1 - Fixed ETH-to-USD conversion in borrow validation
- OracleAggregator v3.1 - Fallback Chainlink/Uniswap avec emergency mode
- PriceRegistry v1.1 - Routage des price providers
- Tests: 59 tests unitaires + intégration PASS
- Déployé sur Sepolia Testnet

**The Graph Subgraph - v5.0.0**
- GlobalMetric: TVL total + TVL par asset (ETH/USDC/DAI)
- DailyMetric: Métriques quotidiennes complètes
- Position lifecycle: Status ACTIVE/REPAID/LIQUIDATED
- Tests: 18 tests Matchstick PASS
- Bug fixes: position status reactivation, totalCollateralUSD tracking, user.activePositions counter
- Déployé et indexé sur The Graph Studio

**Bot Python - Opérationnel** ✅
- APScheduler: 3 jobs cron (health_monitor 30s, liquidation_check 60s, price_sync 5min)
- Multi-asset liquidation: ETH, USDC, DAI support
- Profitability calculation avec gas estimation
- Flask API exposée sur port 5000
- Tests end-to-end validés: détection < 60s, liquidation automatique réussie

**Frontend Phase 1 & 2 - Infrastructure** ✅
- Next.js 15 + React 19 + TypeScript
- RainbowKit v2 + wagmi v2 (Sepolia)
- Apollo Client avec @apollo/experimental-nextjs-app-support
- Landing page avec stats réelles (GET_GLOBAL_METRICS query)
- Layout authenticated (Sidebar, Header, MobileNav)
- Composants layout réutilisables (PageContainer, Section, ContentGrid)
- Styles organization (Tailwind utility-first, globals.css minimal)

**Frontend Phase 3 - Dashboard** ✅
- TVLOverviewCard avec breakdown par asset (ETH/USDC/DAI)
- UserPositionCard avec position utilisateur complète
- HealthFactorDisplay avec gauge visuel et alertes
- QuickActionsCard avec navigation
- Hooks: useUserPosition, useHealthFactor, useGlobalMetrics
- Formules: Health Factor, Max Borrowable, LTV ratios
- Tests validés avec données réelles Sepolia

**Frontend Phase 4 - Deposit Flow** ✅ (v5.2.3)
- AssetSelector: Tabs ETH/USDC/DAI avec balance et prix
- AmountInput: Validation temps réel, bouton MAX, calcul USD
- DepositForm: Orchestrateur complet avec approval flow
- CollateralManager integration (depositETH + depositERC20)
- Position preview avec nouveau collateral et max borrowable
- Auto-refresh dashboard après transaction (refetch Apollo)
- Test pages interactives (/test-asset-selector, /test-amount-input, /test-deposit-form)
- Production page /deposit avec guide utilisateur
- Tests validés: ETH, USDC, DAI deposits sur Sepolia

**Frontend Phase 5A - Borrow Flow** ✅ (v5.3.0)
- BorrowForm: Amount input avec validation HF temps réel, bouton MAX, transaction flow complet
- Hooks: useBorrowSimulation (ANO_003 workaround), useEmergencyMode (oracle check)
- Health Factor preview: Current → Simulated avec color coding (seuils 1.0/1.5/2.0)
- Interest rate display: Fetch LendingPool.getCurrentBorrowRate() avec fallback 5% hardcoded
- Emergency mode: Form disabled si oracle en mode urgence (simple disabled, pas de banner v1)
- Transaction flow: LendingPool.borrow() + auto-refresh dashboard (2s delay pour subgraph)
- Production page /borrow avec sidebar info (How Borrowing Works, HF Guide, Risk Warning, LTV Ratios)
- Bug fixes: Dashboard "Available to Borrow" affichait 0.0000 ETH (ANO_003 workaround + USDC decimals 6), hasActiveBorrow robust check (3 fallbacks)
- Tests validés: USER (200 DAI + 3,050 USDC, 0.99 ETH borrowed) et DEPLOYER (10,100 DAI + 101 USDC + 0.014 ETH)

**Frontend Phase 5B - Analytics & Metrics** ✅ (v5.4.0)
- 7 composants analytics: ProtocolMetricsCard, AssetDistributionChart, UtilizationGauge, TVLChart, RecentActivityCard, OraclePricesCard, LiquidationsHistoryCard
- Hooks: useDailyMetrics, useRecentTransactions, useRecentLiquidations, useOraclePrices
- Charts historiques: Recharts (LineChart/AreaChart/PieChart), période filters (7d/30d/all), responsive design
- TVLChart: Affichage TVL historique avec avg utilization rate (ANO_005 workaround: pass ethPrice from useGlobalMetrics)
- RecentActivityCard: Dernières 10 transactions DEPOSIT/BORROW/REPAY/WITHDRAW avec asset symbols (fix BORROW/REPAY showing "UNKNOWN")
- LiquidationsHistoryCard: Historique liquidations avec time filters (asset filters removed: collateralAsset non-existant dans schema)
- OraclePricesCard: Prix temps réel ETH/USDC/DAI depuis PriceRegistry contract
- Production page /analytics fully functional avec données subgraph + on-chain
- Known Issues: ANO_001-005 avec workarounds frontend documentés (_docs/KNOWN_ISSUES.md + _docs/issues/ANO_005_dailymetric-missing-eth-price.md)

**Frontend Phase 5C - Repay & Withdraw Flows** ✅ (v5.5.0)
- 2 hooks simulation: useRepaySimulation (HF après repay, pas d'intérêts time-based dans contrat actuel), useWithdrawSimulation (HF safety >= 1.2, maxSafeWithdraw vs maxAbsoluteWithdraw)
- RepayForm: Input ETH, MAX button (borrowed amount sans intérêts estimés), HF preview (Current → New ↑), LendingPool.repay() payable, validation wallet balance avec gas reserve (0.002 ETH)
- WithdrawForm: AssetSelector tabs (ETH/USDC/DAI), MAX button (safe threshold 1.2), HF preview avec safety warnings (orange < 1.2, red block < 1.0), CollateralManager.withdrawETH/withdrawERC20
- Navigation: Sidebar links "Repay" + "Withdraw" (icons ArrowUpFromLine/ArrowDownFromLine), QuickActionsCard grid 4 colonnes (Deposit/Borrow/Repay/Withdraw)
- Pages /repay et /withdraw: Layout 2-colonnes (Form 60% | Sidebar Info 40%), info contextuelle (How Repayment Works, Withdrawal Rules, HF Safety, Liquidation Risk)
- Fixes: Interest estimation retirée (contract refund excess LendingPool.sol:143-147), MAX button cohérent (0.35 ETH au lieu de 0.351438), TVLOverviewCard affiche toujours 3 assets même si 0 collateral
- Tests validés: Repay partiel/total USER (0.99 ETH → 0), Withdraw USDC+DAI USER (3,050 USDC + 200 DAI → 0), Edge cases (HF < 1.0 blocked, HF 1.0-1.2 warning)
- ANO_007 créée: Hardcoded Prices & Duplicated Calculations (ETH=$2500, USDC/DAI=$1, formules HF/USD dupliquées 8+ fichiers), fix planifié Phase 6 (lib/contracts/prices.ts + lib/utils/calculations.ts)
- Subgraph delay: Dashboard refresh ~30s Sepolia testnet (acceptable pour MVP, amélioration Vercel+mainnet attendue)

**Frontend Phase 6A: - End-to-end Testing** ✅ (v6.0.3)
- 3 scénarios testes : 1.Liquidation Bot End-to-End, 2. REPAY Flow (Partiel + Total) et 3.Gains Scenario (Price Increase)
Resultat :  
- Bot détecte et liquide positions risquées en < 2 minutes
- REPAY flow fonctionne (partiel + total) sans erreurs
- Frontend Dashboard + Analytics 100% cohérents après chaque transaction
- Aucun nouveau bug critique découvert (ou documenté si trouvé) 

---

## 🎯 Prochaine Priorité: Phase 6B - Code Quality & Refactoring

**Objectif:** Eliminate hardcoded values, centralize calculations, and establish utility layer architecture across frontend, bot, contracts, and subgraph to prepare for production and future asset expansion.

**Why Now:**
- Phase 6A revealed ~30 instances of code duplication (decimals, formulas, conversions)
- ANO_014 fix (v6.0.2) created `lib/utils/tvl.ts` as proof-of-concept for refactoring benefits
- Current hardcoded values (ETH=$2500, decimals=18/6) scattered across 15+ files create maintenance burden
- **Mainnet blocker:** Production deployment requires centralized price fetching and consistent formula execution

**Success Criteria:**
- Zero magic numbers (18, 6, 1e8, 1e18) in business logic
- Zero duplicated formulas (HF, TVL, USD conversion) - single source of truth per calculation
- All regression tests pass with identical results before/after refactor
- New asset addition (e.g., LINK) requires only updating constants, not touching 8+ files

**Scope:**
1. **Frontend utilities** (calculations, prices, formatting, constants) - Week 1-2
2. **Bot utilities** (conversions, calculations, constants) - Week 3
3. **Documentation & validation** - Week 4
4. **Contracts/Subgraph** (deferred unless duplication audit reveals critical issues)

**Estimated Duration:** 3-4 weeks | **Priority:** High (pre-mainnet requirement)

See detailed implementation plan in ANO_007 and "Phase 6B" section below.

---

## Fait / Reste à Faire (Vue d'ensemble)

### Phase 1: Bot Automatisé ✅ (Complété v4.3.0)

### Phase 2: Frontend Infrastructure ✅ (Complété v5.1.0)

### Phase 3: Dashboard Principal ✅ (Complété v5.2.0)

### Phase 4: Deposit Flow ✅ (Complété v5.2.3)

### Phase 5A: Borrow Flow ✅ (Complété v5.3.0)

### Phase 5B: Analytics & Metrics ✅ (Complété v5.4.0)

### Phase 5C: REPAY & WITHDRAW Flows ✅ (Complété v5.5.0)

### Phase 6: Testing & Stabilization ✅ (Complété v6.0.0)

### Phase 6A: End-to-End Testing ✅ (Complété v6.0.2)

### Phase 6B: Code Quality & Refactoring ⏳ (En cours v6.0.2+)

**Objectif:** Eliminate code duplication, centralize constants/calculations, establish production-grade utility architecture across all layers (frontend, bot, contracts, subgraph).

**Status:** Partial (15% complete) - `lib/utils/tvl.ts` (v6.0.2) + `lib/utils/position.ts` (v6.0.3) + `hooks/useOnChainPosition.ts` (v6.0.3)

**Architecture Plan:**

**Frontend Utilities** (`frontend/lib/utils/`)
- ✅ `tvl.ts` - TVL calculations with correct decimal handling (created v6.0.2)
- ✅ `position.ts` - **LTV calculation, collateral USD parsing (ANO_003 workaround), borrowed amount parsing (created v6.0.3)**
- ✅ `index.ts` - **Barrel exports for utils (created v6.0.3)**
- 📝 `calculations.ts` - Health Factor, max borrow/withdraw, weighted LTV/LT formulas
- 📝 `prices.ts` - USD conversion, price parsing, decimal handling
- 📝 `formatting.ts` - formatUSD, formatTokenAmount, formatPercentage, formatCompactNumber
- 📝 `constants.ts` - ASSET_DECIMALS, LTV_RATIOS, LIQUIDATION_THRESHOLDS, HF_THRESHOLDS

**Bot Utilities** (`bot/src/utils/`)
- 📝 `conversions.py` - wei_to_usd, parse_collateral_amount (eliminate `(amount * price) // 10**18` duplication)
- 📝 `calculations.py` - calculate_health_factor, calculate_liquidation_profit (same formulas as frontend)
- 📝 `constants.py` - ASSET_DECIMALS, LTV_RATIOS (centralize config instead of scattered in 4 modules)

**Contracts** (audit-dependent)
- 📝 `libraries/HealthFactorLib.sol` - Only if HF duplicated in LendingPool + CollateralManager
- 📝 `libraries/Constants.sol` - Centralize thresholds/decimals (if duplication found)

**Subgraph** (deferred to ANO_004 fix)
- 📝 `src/utils/calculations.ts` - convertToUSD for decimal normalization
- 📝 `src/utils/constants.ts` - ASSET_DECIMALS mapping

**Implementation Tasks:**

**Week 1: Audit & Create**
- [ ] Grep audit: Find all `18`, `6`, `1e8`, `1e18`, `10 ** 18` instances
- [ ] Create 4 frontend utilities (calculations, prices, formatting, constants)
- [ ] Create 3 bot utilities (conversions, calculations, constants)
- [ ] Write unit tests for all functions

**Week 2: Frontend Refactoring**
- [ ] Replace hardcoded decimals (18/6) with `ASSET_DECIMALS[symbol]` (15+ instances)
- [ ] Replace duplicated HF formula with `calculateHealthFactor()` (6 files)
- [ ] Replace Wei→USD conversions with `convertToUSD()` (10+ instances)
- [ ] Replace max borrow/withdraw logic with shared utilities (3 hooks)
- [ ] Regression test all flows (deposit, borrow, repay, withdraw)

**Week 3: Bot Refactoring**
- [ ] Replace `(amount * price) // (10 ** 18)` with `wei_to_usd()` (5 instances)
- [ ] Centralize decimal handling in `conversions.py` (eliminate hardcoded 18/6)
- [ ] Use shared `calculate_health_factor()` from `calculations.py`
- [ ] Update bot tests to use new utilities

**Week 4: Validation**
- [ ] JSDoc/docstrings for all utilities with examples
- [ ] Create `PHASE_6B_COMPLETION_REPORT.md`
- [ ] Verify consistency: Same inputs → Same outputs across frontend/bot
- [ ] Performance benchmark: No regression in calculation speed

**Benefits:**
- **Maintainability:** Price change = 1 constant update (not 8 files)
- **Evolvability:** New asset (LINK) = 1 line in constants (not 15+ files)
- **Testability:** Unit test `calculateHealthFactor()` once with 100% coverage
- **Consistency:** Frontend HF = Bot HF = Contract HF (same formula, zero drift)
- **Production-Ready:** Centralized price fetching required for mainnet launch

**Related:** ANO_007 (detailed plan), ANO_014 (TVL fix proof-of-concept), EVO_001 (price injection integration)

---

### Phase 6C: Smart Contracts Fixes 📅 (Préparation, Déploiement si Blindé)

**Objectif:** Corriger ANO_002 (decimals) et ANO_003 (valueUSD per-asset) dans smart contracts. **Déploiement uniquement après validation Phase 6A+6B.**

**Modifications Requises:**

**1. Fix ANO_002: Asset Decimals Event**
- Fichier: `contracts/CollateralManager.sol`
- Event actuel: `event AssetAdded(address indexed asset, uint256 liquidationThreshold, bool isActive)`
- Event modifié: `event AssetAdded(address indexed asset, uint8 decimals, uint256 liquidationThreshold, bool isActive)`
- Modifier `addAsset()` pour émettre decimals
- Impact subgraph: Handler `handleAssetAdded()` peut parser decimals correctement

**2. Fix ANO_003: Per-Asset Collateral Value**
- Fichier: `contracts/CollateralManager.sol`
- Ajouter fonction:
```solidity
function getAssetValueUSD(address user, address asset) external view returns (uint256) {
    uint256 amount = collateralBalances[user][asset];
    uint256 price = priceRegistry.getPrice(asset);
    return (amount * price) / (10 ** IERC20Metadata(asset).decimals());
}
```
- Impact subgraph: Handler peut fetch valueUSD per-asset au lieu de total position

**3. Impact Analysis**
- Couplage faible: Pas de modification ABI breaking (ajout de fonctions, pas suppression)
- Paramétrage: Aucun changement config (liquidation thresholds, oracles inchangés)
- Migration: Positions existantes compatibles (pas de storage layout change)

**Déploiement:**
- [ ] Valider tests unitaires contracts (npm test)
- [ ] Déployer sur Sepolia: CollateralManager v1.2
- [ ] Update frontend .env: NEXT_PUBLIC_COLLATERAL_MANAGER_ADDRESS
- [ ] Update subgraph subgraph.yaml: CollateralManager address + startBlock
- [ ] Redeploy subgraph v3.1 avec handlers ANO_002/003 fixes
- [ ] Supprimer workarounds frontend (ASSET_DECIMALS mapping, ANO_003 calculations)

**Critères Go/No-Go Déploiement:**
- ✅ Phase 6A tests passed (bot + repay validés)
- ✅ Phase 6B refactoring done (code maintenable)
- ✅ Aucun bug critique en cours
- ✅ Backup addresses contracts v1.1 documentées

---

### Phase 6D: Subgraph Fixes (v3.1) 📅 (Après 6C ou en parallèle)

**Objectif:** Corriger ANO_001, ANO_004, ANO_005 dans subgraph (sans redeployer contracts).

**Tasks:**
- [ ] Fix ANO_001: activePositions counter → handler user-position.ts
- [ ] Fix ANO_004: currentTVL USD normalization → global-metrics.ts
- [ ] Fix ANO_005: Add ethPriceUSD, tvlUSD, borrowedUSD fields → DailyMetric schema + daily-metrics.ts
- [ ] Deploy subgraph v3.1
- [ ] Remove frontend workarounds (ethPriceFromGlobal parameter, manual TVL calculation)

---

### Phase 7: Oracles Réels Sepolia (Optionnel - 2-3h)
- [ ] Rechercher Chainlink feeds non-stale (USDC/DAI)
- [ ] Vérifier pools Uniswap V3 Sepolia actifs
- [ ] Déployer providers si disponibles
- [ ] Mise à jour PriceRegistry via updatePrimaryProvider()
- [ ] **Note :** Faible priorité, graphiques CoinGecko suffisants pour portfolio

### Phase 7: Tests Avancés (Optionnel - 2-3 jours)
- [ ] Scénario oracle deviation > 10%
- [ ] Test emergency mode activation
- [ ] Multiple users simultanés
- [ ] Stress test liquidations multiples

### Phase Finale: Documentation Finale
- [ ] README principal avec quick start
- [ ] Architecture diagram (contracts, bot, subgraph, frontend)
- [ ] Deployment guide complet
- [ ] Video demo (optionnel)
- [ ] Portfolio presentation notes

---

---

## Notes Techniques Importantes

### Adresses Assets (LOWERCASE obligatoire)
```python
ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
USDC_ADDRESS = "0xc47095ad18c67fba7e46d56bdbb014901f3e327b"
DAI_ADDRESS = "0x2fa332e8337642891885453fd40a7a7bb010b71a"
```

### Contracts Sepolia
- CollateralManager: `0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758`
- LendingPool: `0x504BD0CcAF75881CfCD8f432983A56A5C4e5Aa84` (v4.1)
- OracleAggregator: `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe`

### The Graph Endpoint
- Subgraph v5.0.0: https://api.studio.thegraph.com/query/122308/lendforge-v-4/version/latest

---

## Décisions Prises

### Architecture
- ETH comme token principal (pas de token custom)
- Multi-collateral: ETH, USDC, DAI
- Oracle fallback Chainlink → Uniswap TWAP
- **CollateralManager** pour tous les dépôts (ETH + ERC20) - architecture unifiée
- **LendingPool** pour emprunts et remboursements uniquement

### Frontend Phase 4 (Deposit Flow)
- Utilisation de **CollateralManager** au lieu de LendingPool.depositCollateral()
  - `depositETH()` pour ETH (payable)
  - `depositERC20(asset, amount)` pour USDC/DAI
- Approval ERC20 vers **COLLATERAL_MANAGER** (pas LENDING_POOL)
- Auto-refresh dashboard via `refetch()` Apollo après transaction (délai 2s pour subgraph indexing)
- Pas de vérification emergency mode sur deposits (seulement sur borrow/liquidate)
- **Positions multiples:** 1 user = 1 position unique avec multiple collaterals agrégés
  - `activePositions` = 0 ou 1 max (pas de positions séparées par emprunt)
  - Historique des emprunts via `BorrowEvent[]` dans subgraph
- Bot Python (pas de bot TypeScript)
- **Unified Position Model**: Un user = une position globale (MVP v5.2.0)
  - Design choice: Simplicité pour MVP
  - Limitation: Pas de positions multiples par user
  - Future upgrade: Multiple Positions planned for v6.0+

### Frontend Phase 5A (Borrow Flow)
- **Stablecoin prices hardcoded to $1:** DAI = USDC = $1 dans frontend (testnet limitation)
  - Pourquoi: Chainlink feeds USDC/DAI sur Sepolia sont stale/inexistants
  - Impact: Pas de test de depeg scenarios (ex: USDC $0.90)
  - Solution future: EVO_001 (Real Price Injection System) pour injecter prix mainnet
- **ETH price from OracleAggregator:** Fetch getPrice(TOKENS.ETH) pour cohérence Dashboard/Borrow
- **ANO_003 workaround pattern:** Calcul manuel valueUSD = amount × price dans tous les hooks
  - Appliqué: useBorrowSimulation.ts, calculateMaxBorrowable() (useHealthFactor.ts)
  - Raison: Subgraph stocke total position value au lieu de per-asset value
- **USDC decimals fix:** Utiliser 6 au lieu de 18 dans calculateMaxBorrowable (subgraph bug ANO_002)
- **Emergency mode simple:** Form disabled si oracle.emergencyMode = true (pas de banner v1)
- **Interest rate:** Fetch from LendingPool.getCurrentBorrowRate() avec fallback 5% hardcoded + note
- **hasActiveBorrow robust check:** 3 fallbacks (activePositions > 0 || totalBorrowed > 0 || positions check)

### Déploiement
- Sepolia pour testnet
- The Graph Studio (pas de hosted service)
- FastAPI pour bot (API REST exposée)

---

## 📋 Known Issues & Planned Evolutions

For detailed information about known bugs, anomalies, and planned enhancements, see:

**📄 [_docs/KNOWN_ISSUES.md](_docs/KNOWN_ISSUES.md)**

**Quick Reference:**
- **ANO_001-004:** Active anomalies with workarounds (subgraph fields, decimal handling, TVL calculation)
- **EVO_001:** Real Price Injection System (mainnet price data → Sepolia mocks)
- **EVO_002:** Multiple Positions Support v6.0 (isolated risk management)
- **EVO_003:** UniswapV3PriceProvider Deployment (real TWAP fallback)

Each issue has a dedicated specification file in `_docs/issues/` with full technical details, implementation steps, and effort estimates.
