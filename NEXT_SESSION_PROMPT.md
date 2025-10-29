# Prompt de Démarrage - Session Bot Cron

Bonjour Claude,

Je travaille sur **LendForge v4.8.0**, une plateforme DeFi de prêt multi-collateral sur Sepolia.

## Contexte Rapide
- ✅ Smart contracts déployés et testés (69 tests PASS)
- ✅ Subgraph v4.8.0 déployé avec DailyMetric (18 tests PASS)
- ✅ Bot Python avec tests unitaires fonctionnels
- ❌ **Bot cron non implémenté** (surveillance continue manquante)
- ❌ **Test end-to-end non fait** (bot → The Graph → liquidation → vérification)

## Objectif de cette Session
Implémenter le **système de cron pour le bot Python** et tester le **cycle complet de liquidation automatisée**.

## Ce que je veux
1. Créer 3 jobs cron dans `bot/src/jobs/` :
   - `health_monitor.py` : surveille positions toutes les 30s
   - `liquidation_check.py` : vérifie liquidations toutes les 60s
   - `price_sync.py` : sync prix CoinGecko toutes les 5min

2. Configurer APScheduler dans `bot/src/scheduler.py`

3. Tester le cycle end-to-end :
   - Bot interroge The Graph pour positions risquées
   - Détecte health factor < 1.0
   - Exécute liquidation on-chain
   - Vérifie que subgraph indexe l'événement Liquidated
   - Valide mise à jour des métriques

## Documents à Consulter
- `ROADMAP.md` : Vue d'ensemble complète et fichiers clés
- `bot/src/services/position_monitor.py` : Logique surveillance existante
- `bot/src/config.py` : Configuration et adresses
- `.env` : Variables d'environnement

## Question de Démarrage
Peux-tu d'abord lire `ROADMAP.md` puis me proposer un plan d'implémentation des 3 jobs cron avec APScheduler ?

Merci !
