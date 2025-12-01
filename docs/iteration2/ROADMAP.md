# LendForge Itération 2 - Roadmap Complète

**Date:** 2025-11-26
**Version:** 1.0 FINAL
**Objectif:** Résoudre toutes les anomalies, implémenter EVO_001/EVO_003, garantir smart contracts parfaits sans redéploiement futur.

---

## 📋 Vue d'Ensemble

Cette roadmap détaille l'implémentation de l'itération 2 de LendForge, organisée en 7 phases séquentielles.

### Ordre d'Implémentation

1. **[Phase 1: ANO_002 + ANO_003](./PHASE_1_ANO_002_003.md)** - CollateralManager (2-3 jours)
2. **[Phase 2: ANO_010](./PHASE_2_ANO_010.md)** - Event Parameter Fix (1-2 jours)
3. **[Phase 3: ANO_006](./PHASE_3_ANO_006.md)** - Pool Liquidity Validation (1 jour)
4. **[Phase 4: ANO_008](./PHASE_4_ANO_008.md)** - Liquidation Collateral Transfer (5-7 jours)
5. **[Phase 5: Subgraph](./PHASE_5_SUBGRAPH.md)** - ANO_004, ANO_005 Refactoring (2-3 jours)
6. **[Phase 6: Frontend/Bot](./PHASE_6_FRONTEND_BOT.md)** - Cleanup Workarounds (3-4 jours)
7. **[Phase 7: EVO_001/003](./PHASE_7_EVO_001_003.md)** - Price Systems (4-5 jours)

**Durée Totale:** 4-5 semaines

---

## 🎯 Décisions Stratégiques

✅ **Testing:** Partir des tests existants (contracts/test/), mettre à jour tests obsolètes
✅ **Ordre:** Progressive et logique pour éviter régressions
✅ **Déploiement:** Fork Sepolia → Tests → Déploiement réel
✅ **Subgraph:** Nouveau startBlock (reset historique testnet)
✅ **EVO_001/003:** Parallèle - garder en tête à chaque modification

---

## 📊 Timeline Globale

| Phase | Durée | Cumul | Risque |
|-------|-------|-------|--------|
| Phase 1 (ANO_002+003) | 2-3 jours | 3 jours | FAIBLE |
| Phase 2 (ANO_010) | 1-2 jours | 5 jours | MOYEN |
| Phase 3 (ANO_006) | 1 jour | 6 jours | FAIBLE |
| Phase 4 (ANO_008) | 5-7 jours | 13 jours | CRITIQUE |
| Phase 5 (Subgraph) | 2-3 jours | 16 jours | FAIBLE |
| Phase 6 (Cleanup) | 3-4 jours | 20 jours | MOYEN |
| Phase 7 (EVO_001+003) | 4-5 jours | 25 jours | FAIBLE |

---

## ✅ Checklist Globale de Déploiement

### Avant Déploiement Production

- [ ] Tous les tests passent (forge test)
- [ ] Tests integration LiquidationScenario 100% pass
- [ ] Déployé et testé sur fork Sepolia
- [ ] 5+ scénarios E2E validés manuellement
- [ ] ABIs générés et distribués (frontend, bot, subgraph)
- [ ] Documentation mise à jour (CLAUDE.md)
- [ ] Nouveau startBlock calculé
- [ ] Subgraph redéployé et synced
- [ ] Frontend déployé avec nouveaux ABIs
- [ ] Bot redémarré avec nouveaux contrats
- [ ] Monitoring 48h sans incident

### Après Déploiement

- [ ] Marquer ANO_002, 003, 006, 008, 010 comme RESOLVED
- [ ] Archiver scripts workarounds
- [ ] Mettre à jour README.md
- [ ] Créer tag git v7.0.0

---

## 🔗 Navigation

- [Phase 1: ANO_002 + ANO_003](./PHASE_1_ANO_002_003.md)
- [Phase 2: ANO_010](./PHASE_2_ANO_010.md)
- [Phase 3: ANO_006](./PHASE_3_ANO_006.md)
- [Phase 4: ANO_008](./PHASE_4_ANO_008.md)
- [Phase 5: Subgraph](./PHASE_5_SUBGRAPH.md)
- [Phase 6: Frontend/Bot](./PHASE_6_FRONTEND_BOT.md)
- [Phase 7: EVO_001/003](./PHASE_7_EVO_001_003.md)
