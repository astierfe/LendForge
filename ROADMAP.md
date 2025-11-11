# LendForge - Roadmap Développement

**Version actuelle:** v6.1.0
**Dernière mise à jour:** 10 novembre 2025

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

**Frontend Phase 6B - Critical Bug Fixes** ✅ (v6.1.0)
- **ANO_009 RESOLVED:** Cross-user data contamination (subgraph + Apollo cache)
  - Centralized entity creation (`subgraph/src/helpers.ts`)
  - Added INACTIVE position status, address normalization lowercase
  - Disabled Apollo cache (network-only fetchPolicy)
  - Clean deployment startBlock 9598500
- **Oracle price integration:** Fixed USDC/DAI hardcoded $1.00 → fetch from OracleAggregator
- **PositionsTable fix:** Borrowed amount display (Wei → ETH, not USD)
- **Documentation:** Created JSON format (`KNOWN_ISSUES_ANO.json`, `ANO_*.json`)
- **CLAUDE.md:** Compressed 500→152 lines (machine-readable only)

---

## 🎯 Prochaine Priorité: Iteration 2 - Oracle Improvements

**Décision:** Skip Phase 6C/6D (contract fixes) + EVO_002 (multi-positions) → Focus oracle realism

**Objectif Iteration 2:**
1. **EVO_001** - Real Price Injection System (2-3 weeks)
2. **EVO_003** - UniswapV3 Oracle Deployment (1-2 weeks)

**Rationale:**
- **Production readiness:** Real oracle data required for realistic testing & demos
- **Testnet realism:** Mock prices ($0.60 USDC) unrealistic, need mainnet data injection
- **Learning value:** Mainnet data fetching, oracle integration, TWAP calculations
- **ANO_008 acceptable:** Workaround script (`scripts/transfer_liquidated_collateral.sh`) sufficient for testnet
- **Quick wins:** EVO_001 + EVO_003 = 3-5 weeks (vs EVO_002 = 4-5 weeks alone)

**EVO_001 - Real Price Injection System:**
- Fetch mainnet prices (Chainlink + Uniswap V3) via Python collection script
- Store in SQLite database (24h-7d historical data)
- Inject into Sepolia mock providers via Foundry (`cast send` automation)
- Cron job: Update prices every 5-10 minutes
- Enable: Realistic volatility testing, deviation scenarios, emergency mode triggers

**EVO_003 - UniswapV3 Oracle Deployment:**
- Deploy real UniswapV3PriceProvider contracts (code exists, 225+ tests passing)
- Identify liquid Sepolia pools (ETH/USDC, ETH/DAI) or use mainnet forks
- Configure 30-minute TWAP windows
- Register in PriceRegistry as fallback providers
- Test deviation-based fallback (>5% triggers Uniswap TWAP instead of Chainlink)

**Estimated Duration:** 3-5 weeks total (EVO_001: 2-3w, EVO_003: 1-2w)

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

### Phase 7: EVO_001 + EVO_003 - Oracle Improvements ⏳ (Iteration 2 - En cours)

**Week 1-2: EVO_001 - Real Price Injection System**
- [ ] Design architecture: Python collector → SQLite → Foundry injection
- [ ] Create database schema (assets, prices, timestamps, sources)
- [ ] Python collector script:
  - [ ] Fetch Chainlink mainnet feeds (ETH/USD, USDC/USD, DAI/USD)
  - [ ] Fetch Uniswap V3 TWAP (ETH/USDC pool 0x88e6A0c..., ETH/DAI pool)
  - [ ] Store in SQLite with 5-min granularity
- [ ] Foundry injection script:
  - [ ] Read latest prices from database
  - [ ] `cast send` to update MockUSDCProvider, MockDAIProvider, MockUniswapFallback
  - [ ] Handle gas estimation, nonce management
- [ ] Cron job setup (every 5-10 minutes)
- [ ] Testing: Verify realistic volatility, deviation triggers

**Week 3: EVO_003 - UniswapV3 Oracle Deployment**
- [ ] Identify liquid Sepolia pools (or use mainnet fork testing)
- [ ] Deploy UniswapV3PriceProvider for ETH/USDC (30-min TWAP)
- [ ] Deploy UniswapV3PriceProvider for ETH/DAI (30-min TWAP)
- [ ] Register in PriceRegistry as fallback providers
- [ ] Configure deviation thresholds (5% warning, 10% emergency)
- [ ] Integration tests: Trigger fallback manually, verify emergency mode
- [ ] Update frontend: Remove "Mock" labels from OraclePricesCard

**Week 4-5: Testing & Documentation**
- [ ] E2E scenarios: Flash crash protection, manipulation resistance
- [ ] Historical replay: ETH -30% crash, observe TWAP smoothing
- [ ] Bot integration: Liquidations with real price volatility
- [ ] Documentation: EVO_001+003 completion report
- [ ] Demo preparation: Screenshots of real price charts, deviation events

---

### Phase 6C/6D: Contract & Subgraph Fixes 📅 (Deferred - Pre-Production Only)

**Status:** DEFERRED - ANO_008 workaround acceptable for testnet (`scripts/transfer_liquidated_collateral.sh`)

**Tasks (if mainnet launch planned):**
- [ ] ANO_008: Add `CollateralManager.seizeCollateral()`
- [ ] ANO_006: Add pool liquidity validation
- [ ] ANO_002/003: Fix decimals event + per-asset valueUSD
- [ ] ANO_001/004/005: Subgraph fixes (activePositions, TVL, historical prices)

---

### Phase Finale: Documentation & Portfolio Preparation
- [ ] Update README with multi-position feature
- [ ] Architecture diagram update (position IDs flow)
- [ ] Record demo video (3-5 min): Deposit → Multiple positions → Isolated liquidation
- [ ] Portfolio presentation notes: Technical challenges, architecture decisions
- [ ] Deployment guide for reviewers

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
- Subgraph v6.1.6: https://api.studio.thegraph.com/query/122308/lendforge-v-4/version/latest

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
