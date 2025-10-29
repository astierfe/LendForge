# LendForge - Roadmap Développement

**Version actuelle:** v4.8.0
**Dernière mise à jour:** 29 octobre 2025

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

**The Graph Subgraph - v4.8.0**
- GlobalMetric: TVL total + TVL par asset (ETH/USDC/DAI)
- DailyMetric: Métriques quotidiennes complètes
- DailyUserActivity: Tracking utilisateurs uniques (pas de double-comptage)
- PriceDeviation: Historique des déviations oracle
- Tests: 18 tests Matchstick PASS
- Déployé et indexé sur The Graph Studio

**Bot Python - Tests Unitaires**
- Configuration multi-collateral validée
- Position monitoring: détection positions à risque
- Emergency mode support
- Oracle deviation handling
- Tests pytest: PASS

---

## 🎯 Prochaine Priorité: Bot Cron + Test End-to-End

### Objectif
Implémenter le système de cron pour le bot Python et valider le cycle complet de liquidation automatisée.

### Fonctionnalités à Implémenter

**1. Système de Cron (jobs/)**
- `health_monitor.py`: Surveillance positions toutes les 30s
- `liquidation_check.py`: Vérification liquidations toutes les 60s
- `price_sync.py`: Synchronisation prix CoinGecko toutes les 5min

**2. Scheduler (APScheduler)**
- Configuration des intervalles d'exécution
- Gestion des erreurs et retry logic
- Logging structuré des exécutions

**3. Test End-to-End**
- Bot interroge The Graph pour positions à risque
- Détecte health factor < 1.0
- Exécute liquidation on-chain (cast send)
- Vérifie indexation événement Liquidated dans subgraph
- Valide mise à jour des métriques (GlobalMetric, DailyMetric)

### Critères de Succès
- [ ] Bot tourne en continu sans crash
- [ ] Détection position risquée < 1 minute
- [ ] Liquidation exécutée automatiquement
- [ ] Événement Liquidated indexé dans subgraph
- [ ] Métriques mises à jour correctement

---

## Reste à Faire (Vue d'ensemble)

### Phase 1: Bot Automatisé (2-3 jours)
- [ ] Implémenter les 3 jobs cron
- [ ] Configurer APScheduler
- [ ] Tester cycle complet end-to-end
- [ ] Documenter résultats dans `bot/INTEGRATION_TEST_RESULTS.md`

### Phase 2: Frontend Dashboard (1 semaine)
- [ ] Interface connexion wallet (RainbowKit)
- [ ] Page dépôt/retrait collateral
- [ ] Page emprunt ETH avec calcul temps réel
- [ ] Affichage health factor avec alertes
- [ ] Dashboard analytics (TVL, prix, metrics)

### Phase 3: Tests Avancés (2-3 jours)
- [ ] Scénario oracle deviation > 10%
- [ ] Test emergency mode activation
- [ ] Multiple users simultanés
- [ ] Stress test liquidations multiples

### Phase 4: Documentation Finale
- [ ] README principal avec quick start
- [ ] Architecture diagram (contracts, bot, subgraph, frontend)
- [ ] Deployment guide complet
- [ ] Video demo (optionnel)

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
