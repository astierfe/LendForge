# LendForge - Roadmap Développement

**Version actuelle:** v4.3.0
**Dernière mise à jour:** 30 janvier 2025

---

## Statut Global du Projet

### ✅ Complété et Validé

**Smart Contracts (Solidity) - v3.1**
- CollateralManager v1.1 - Multi-collateral (ETH, USDC, DAI)
- LendingPool v3.0 - Emprunts ETH avec gestion santé
- OracleAggregator v3.1 - Fallback Chainlink/Uniswap avec emergency mode
- PriceRegistry v1.1 - Routage des price providers
- Tests: 69 tests unitaires + intégration PASS
- Déployé sur Sepolia Testnet

**The Graph Subgraph - v4.10.0**
- GlobalMetric: TVL total + TVL par asset (ETH/USDC/DAI)
- DailyMetric: Métriques quotidiennes complètes
- Position lifecycle: Status ACTIVE/REPAID/LIQUIDATED
- Tests: 18 tests Matchstick PASS
- Bug fixes: position status reactivation, totalCollateralUSD tracking
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

---

## 🎯 Prochaine Priorité: Frontend Dashboard

### Objectif
Créer interface utilisateur pour interagir avec le protocole (dépôt, emprunt, monitoring).

### Fonctionnalités à Implémenter

**1. Connexion Wallet**
- RainbowKit + wagmi v2
- Support Sepolia testnet
- Affichage balance utilisateur

**2. Dashboard Principal**
- Vue positions utilisateur (collateral, dette, HF)
- Alertes liquidation si HF < 1.5
- TVL global du protocole

**3. Pages Dépôt/Emprunt**
- Formulaires dépôt multi-collateral
- Calcul temps réel max empruntable (LTV)
- Validation transactions

**4. Analytics**
- Graphiques TVL historique (subgraph)
- Liquidations récentes
- Comparaison prix Chainlink vs CoinGecko

### Critères de Succès
- [ ] Connexion wallet fonctionnelle
- [ ] Dépôt/retrait collateral opérationnel
- [ ] Emprunt ETH avec calcul LTV temps réel
- [ ] Affichage health factor dynamique
- [ ] Graphiques analytics avec données réelles

---

## Reste à Faire (Vue d'ensemble)

### Phase 1: Bot Automatisé ✅ (Complété v4.3.0)
- ✅ Implémenter les 3 jobs cron
- ✅ Configurer APScheduler
- ✅ Tester cycle complet end-to-end
- ✅ Validation: liquidation automatique réussie

### Phase 2: Frontend Dashboard (1-2 semaines) 🚧
- [ ] Setup Next.js 14 + RainbowKit + wagmi
- [ ] Interface connexion wallet
- [ ] Page dépôt/retrait collateral
- [ ] Page emprunt ETH avec calcul temps réel
- [ ] Affichage health factor avec alertes
- [ ] Dashboard analytics avec données mixtes :
  - Graphiques The Graph (vraies données protocole)
  - Prix CoinGecko API (display only, graphiques réalistes)
  - Label clair distinction on-chain vs off-chain
- [ ] Tests e2e avec Playwright (optionnel)

### Phase 3: Oracles Réels Sepolia (Optionnel - 2-3h)
- [ ] Rechercher Chainlink feeds non-stale (USDC/DAI)
- [ ] Vérifier pools Uniswap V3 Sepolia actifs
- [ ] Déployer providers si disponibles
- [ ] Mise à jour PriceRegistry via updatePrimaryProvider()
- [ ] **Note :** Faible priorité, graphiques CoinGecko suffisants pour portfolio

### Phase 4: Tests Avancés (Optionnel - 2-3 jours)
- [ ] Scénario oracle deviation > 10%
- [ ] Test emergency mode activation
- [ ] Multiple users simultanés
- [ ] Stress test liquidations multiples

### Phase 5: Documentation Finale
- [ ] README principal avec quick start
- [ ] Architecture diagram (contracts, bot, subgraph, frontend)
- [ ] Deployment guide complet
- [ ] Video demo (optionnel)
- [ ] Portfolio presentation notes

---

## Fichiers Clés pour Prochaine Session

### À Consulter
- `bot/src/services/position_monitor.py` - Logique surveillance positions
- `bot/src/config.py` - Configuration Graph URL, addresses, etc.
- `subgraph/schema.graphql` - Entités disponibles pour queries
- `.env` - Adresses contracts et clés API

### À Créer
- `bot/src/jobs/health_monitor.py`
- `bot/src/jobs/liquidation_check.py`
- `bot/src/jobs/price_sync.py`
- `bot/src/scheduler.py`
- `bot/INTEGRATION_TEST_RESULTS.md`

### Queries GraphQL Utiles
```graphql
# Récupérer positions à risque
query RiskyPositions {
  positions(where: {healthFactor_lt: "1.0", status: "ACTIVE"}) {
    id
    user { id }
    totalCollateralUSD
    borrowed
    healthFactor
  }
}

# Vérifier dernières liquidations
query RecentLiquidations {
  liquidations(first: 5, orderBy: timestamp, orderDirection: desc) {
    id
    user { id }
    liquidator
    debtRepaid
    collateralSeized
    timestamp
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
- LendingPool: `0x06AF08708B45968492078A1900124DaA832082cD`
- OracleAggregator: `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe`

### The Graph Endpoint
- Subgraph v4.8.0: https://api.studio.thegraph.com/query/122308/lendforge-v-4/version/latest

---

## Décisions Prises

### Architecture
- ETH comme token principal (pas de token custom)
- Multi-collateral: ETH, USDC, DAI
- Oracle fallback Chainlink → Uniswap TWAP
- Bot Python (pas de bot TypeScript)

### Tests
- Matchstick pour subgraph (pas de tests manuels)
- Pytest pour bot (couverture unitaire)
- Tests end-to-end manuels pour intégration complète

### Déploiement
- Sepolia pour testnet
- The Graph Studio (pas de hosted service)
- FastAPI pour bot (API REST exposée)
