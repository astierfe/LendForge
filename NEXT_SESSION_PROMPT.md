# Prompt de Démarrage - Session Frontend Dashboard

Bonjour Claude,

Je travaille sur **LendForge v4.3.0**, une plateforme DeFi de prêt multi-collateral sur Sepolia.

## Contexte Rapide
- ✅ Smart contracts déployés et testés (69 tests PASS)
- ✅ Subgraph v4.10.0 déployé avec tracking complet (18 tests PASS)
- ✅ Bot Python opérationnel avec liquidations automatiques
- ✅ Test end-to-end validé (détection < 60s, liquidation automatique réussie)
- ❌ **Frontend dashboard non implémenté** (pas d'interface utilisateur)

## Objectif de cette Session
Implémenter le **dashboard frontend** avec Next.js 14 + RainbowKit pour interagir avec le protocole.

## Ce que je veux
1. **Page Connexion Wallet**
   - Integration RainbowKit (wagmi v2)
   - Support Sepolia testnet
   - Affichage adresse + balance

2. **Page Dashboard Principal**
   - Vue d'ensemble TVL global
   - Positions utilisateur (collateral, dette, health factor)
   - Alertes si HF < 1.5 (risque de liquidation)

3. **Page Dépôt/Emprunt**
   - Formulaire dépôt collateral (ETH, USDC, DAI)
   - Calcul temps réel du max empruntable (LTV)
   - Bouton emprunt ETH avec validation

4. **Page Analytics**
   - Graphiques TVL historique (données subgraph)
   - Liquidations récentes
   - Prix assets (Chainlink vs CoinGecko)

## Documents à Consulter
- `ROADMAP.md` : Vue d'ensemble et fichiers clés
- `_docs/spec_lending_pool_v1_3_0.md` : Formules HF, LTV, liquidation
- `.env` : Adresses contracts déployés
- `subgraph/schema.graphql` : Entités GraphQL disponibles

## Fichiers Clés Existants
- `contracts/interfaces/*.sol` : ABIs à exporter pour wagmi
- `subgraph/` : Source de données pour analytics
- Bot opérationnel sur `http://localhost:5000` (Flask API)

## Question de Démarrage
Peux-tu d'abord lire `ROADMAP.md` et `spec_lending_pool_v1_3_0.md`, puis me proposer une stack technique pour le frontend et un plan d'implémentation par ordre de priorité ?

Merci !
