# LendForge - Roadmap Développement

**Version actuelle:** v5.2.3
**Dernière mise à jour:** 4 novembre 2025

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

**Documentation - v1.3.0** ✅
- Spec technique complète avec formules correctes
- Liquidation threshold: 83% ETH, 95% stablecoins (vérifié on-chain)
- Leverage mechanism documenté avec exemples
- Alignment report: code vs spec validation

**Frontend Phase 1 & 2 - Infrastructure** ✅
- Next.js 15 + React 19 + TypeScript
- RainbowKit v2 + wagmi v2 (Sepolia)
- Apollo Client avec @apollo/experimental-nextjs-app-support
- Landing page avec stats réelles (GET_GLOBAL_METRICS query)
- Layout authenticated (Sidebar, Header, MobileNav)
- Routes protection et navigation
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

---

## 🎯 Prochaine Priorité: Frontend Phase 5A - Borrow Flow

### Objectif
Implémenter le flux d'emprunt avec validation health factor et gestion des limites.

### Composants à Créer (Phase 5A)

**1. Borrow Page (`/borrow`)**
- BorrowForm: Saisie montant ETH à emprunter
- HealthFactorPreview: Simulation HF après emprunt
- AvailableCreditDisplay: Max borrowable en temps réel
- RiskWarnings: Alertes si HF simulé < 1.5

**2. Validations**
- Amount ≤ Available to Borrow
- Simulated HF > 1.0 (minimum threshold)
- Warning if simulated HF < 1.5
- Oracle emergency mode check (notInEmergency modifier)

**3. Transaction Flow**
- Call LendingPool.borrow(amount)
- Wait confirmation
- Update dashboard (refetch)
- Redirect to /positions

### Critères de Succès Phase 5A
- [ ] Borrow form avec validation temps réel
- [ ] Simulation health factor avant transaction
- [ ] Vérification emergency mode oracle
- [ ] Transaction borrow fonctionnelle
- [ ] Dashboard mis à jour automatiquement

---

## Fait / Reste à Faire (Vue d'ensemble)

### Phase 1: Bot Automatisé ✅ (Complété v4.3.0)

### Phase 2: Frontend Infrastructure ✅ (Complété v5.1.0)

### Phase 3: Dashboard Principal ✅ (Complété v5.2.0)

### Phase 4: Deposit Flow ✅ (Complété v5.2.3)

### Phase 5A: Borrow Flow (Prochaine priorité) 🎯
- [ ] BorrowForm avec validation health factor
- [ ] Simulation HF temps réel
- [ ] Vérification emergency mode oracle
- [ ] Transaction LendingPool.borrow()
- [ ] Auto-refresh dashboard

### Phase 5B: Analytics (À venir)
- [ ] Graphiques TVL historique (DailyMetrics)
- [ ] Liquidations récentes
- [ ] Prix assets (Chainlink vs CoinGecko - display only)

### Phase 6: Oracles Réels Sepolia (Optionnel - 2-3h)
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

## Fichiers Clés pour Prochaine Session (Phase 5A - Borrow Flow)

### À Consulter
- `frontend/components/forms/DepositForm.tsx` - Pattern à réutiliser pour BorrowForm
- `frontend/hooks/useUserPosition.ts` - Position data + refetch
- `frontend/hooks/useHealthFactor.ts` - `simulateHealthFactor()` pour preview
- `frontend/lib/contracts/abis/LendingPool.json` - Fonction `borrow(amount)`
- `contracts/LendingPool.sol` - Vérifier modifier `notInEmergency`

### À Créer (Phase 5)
- `frontend/components/forms/BorrowForm.tsx` - Orchestrateur principal
- `frontend/app/(authenticated)/borrow/page.tsx` - Production page
- `frontend/app/(authenticated)/test-borrow-form/page.tsx` - Test page (optionnel)

### Pattern Borrow Transaction
```typescript
// Dans BorrowForm.tsx
import LendingPoolABI from "@/lib/contracts/abis/LendingPool.json";

const handleBorrow = async () => {
  borrow({
    address: CONTRACTS.LENDING_POOL,
    abi: LendingPoolABI.abi,
    functionName: "borrow",
    args: [parseEther(amount)], // amount en ETH
  });
};

// Après succès: refetchUserPosition() + redirect dashboard
```

### Queries GraphQL Utiles
```graphql
# Position utilisateur pour calculs
query UserPosition($userId: ID!) {
  user(id: $userId) {
    totalCollateralUSD
    totalBorrowed
    activePositions
    collaterals {
      asset { symbol ltv }
      amount
      valueUSD
    }
  }
}
```

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

### Tests
- Matchstick pour subgraph (pas de tests manuels)
- Pytest pour bot (couverture unitaire)
- Tests end-to-end manuels pour intégration complète

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
