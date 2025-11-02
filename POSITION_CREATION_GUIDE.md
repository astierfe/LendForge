# Guide : Créer des Positions de Test

## 🎯 Objectif
Créer des positions actives avec différents health factors pour tester le dashboard.

**⚠️ IMPORTANT :** Ce guide utilise le prix ETH à **$1600** (configuré dans PriceRegistry)

---

## 📊 Scénarios Proposés (Corrigés v4.1)

### Scénario 1 : Position SAFE (HF ≈ 8.5) 🟢

**Collateral :** 5000 DAI = $5000
**Borrow :** 0.35 ETH @ $1600 = $560
**Health Factor attendu :** 8.48

**Calcul :**
```
Max borrow = 5000 × 0.90 (LTV) = $4500
Debt USD = 0.35 ETH × $1600 = $560
HF = (5000 × 0.95) / 560 = 8.48 🟢 SAFE
```

**Pourquoi safe :** Debt très faible par rapport au max borrowable ($560 vs $4500)

---

### Scénario 2 : Position WARNING (HF ≈ 1.8) 🟡

**Collateral :** 3000 USDC = $3000
**Borrow :** 0.99 ETH @ $1600 = $1584
**Health Factor attendu :** 1.80

**Calcul :**
```
Max borrow = 3000 × 0.90 (LTV) = $2700
Debt USD = 0.99 ETH × $1600 = $1584
HF = (3000 × 0.95) / 1584 = 1.80 🟡 WARNING
```

**Pourquoi warning :** HF entre 1.5 et 2.0 (proche de la limite de sécurité)

---

### Scénario 3 : Position DANGER (HF ≈ 1.06) 🟠

**Collateral :** 250 USDC = $250
**Borrow :** 0.14 ETH @ $1600 = $224
**Health Factor attendu :** 1.06

**Calcul :**
```
Max borrow = 250 × 0.90 (LTV) = $225
Debt USD = 0.14 ETH × $1600 = $224
HF = (250 × 0.95) / 224 = 1.06 🟠 DANGER
```

**Pourquoi danger :** Très proche du max LTV, risque de liquidation si prix ETH monte légèrement

**⚠️ Note :** On utilise USDC au lieu d'ETH pour éviter que le HF reste constant quand le prix change

---

## 🛠️ Commandes Cast (Windows)

### Variables d'environnement
```powershell
$RPC = "https://eth-sepolia.g.alchemy.com/v2/3NWC-_k0lKo09jP1siznT"
$PK = "0xf6d4a9501570437c223e0dc8030478a4b8489152fc532c8a0e03e8be5ff2d22d"
$COLLATERAL_MGR = "0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758"
$LENDING_POOL = "0x06AF08708B45968492078A1900124DaA832082cD"
$DAI = "0x2FA332E8337642891885453Fd40a7a7Bb010B71a"
$USDC = "0xC47095AD18C67FBa7E46D56BDBB014901f3e327b"
$ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
```

---

### 🟢 Scénario 1 : Position SAFE (5000 DAI → Borrow 0.35 ETH)

#### Étape 1 : Approve DAI
```bash
cast send $DAI_TOKEN_ADDRESS "approve(address,uint256)" $COLLATERAL_MANAGER_ADDRESS 5000000000000000000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

#### Étape 2 : Deposit DAI
```bash
cast send $COLLATERAL_MANAGER_ADDRESS "depositERC20(address,uint256)" $DAI_TOKEN_ADDRESS 5000000000000000000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

#### Étape 3 : Borrow 0.35 ETH
```bash
cast send $LENDING_POOL_ADDRESS "borrow(uint256)" 350000000000000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

#### Étape 4 : Vérifier le health factor
```bash
cast send $LENDING_POOL_ADDRESS "getHealthFactor(address)" $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

---

### 🟡 Scénario 2 : Position WARNING (3000 USDC → Borrow 0.99 ETH)

#### Étape 1 : Approve USDC
```bash
cast send $USDC_ADDRESS "approve(address,uint256)" $COLLATERAL_MANAGER_ADDRESS 3000000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

#### Étape 2 : Deposit USDC
```bash
cast send $COLLATERAL_MANAGER_ADDRESS "depositERC20(address,uint256)" $USDC_ADDRESS 3000000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

#### Étape 3 : Borrow 0.99 ETH (WARNING level)
```bash
cast send $LENDING_POOL_ADDRESS "borrow(uint256)" 990000000000000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

---

### 🟠 Scénario 3 : Position DANGER (250 USDC → Borrow 0.14 ETH)

#### Étape 1 : Approve USDC
```bash
cast send $USDC_ADDRESS "approve(address,uint256)" $COLLATERAL_MANAGER_ADDRESS 250000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

#### Étape 2 : Deposit 250 USDC
```bash
cast send $COLLATERAL_MANAGER_ADDRESS "depositERC20(address,uint256)" $USDC_ADDRESS 250000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

#### Étape 3 : Borrow 0.14 ETH (DANGER level)
```bash
cast send $LENDING_POOL_ADDRESS "borrow(uint256)" 140000000000000000 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

---

## 🔍 Vérifications

### 1. Vérifier le collateral total (USD)
```bash
cast send $COLLATERAL_MANAGER_ADDRESS "getCollateralValueUSD(address)" $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

**Retour attendu :** Valeur en Wei (18 décimales)

---

### 2. Vérifier le health factor
```bash
cast send $LENDING_POOL_ADDRESS "getHealthFactor(address)" $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

**Retour attendu :** Health factor × 100 (ex: 848 = HF 8.48)

---

### 3. Vérifier la dette
```bash
cast call $LENDING_POOL_ADDRESS "getBorrowedAmount(address)" $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL
```

**Retour attendu :** Montant en Wei (18 décimales)

---

### 4. Attendre l'indexation du subgraph

**Temps d'attente :** ~30-60 secondes après le déploiement du nouveau LendingPool

**Vérifier dans The Graph Playground :**
```graphql
{
  user(id: "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01") {
    totalCollateralUSD
    totalBorrowed
    activePositions
    positions(where: { status: ACTIVE }) {
      healthFactor
      borrowed
      totalCollateralUSD
    }
    collaterals {
      amount
      valueUSD
      asset {
        symbol
      }
    }
  }
}
```

---

## 📌 Recommandations

1. **Commence par le Scénario 1 (SAFE)** pour vérifier que tout fonctionne
2. **Attends 30-60 secondes** entre chaque position pour que le subgraph indexe
3. **Vérifie dans The Graph** avant de tester le frontend
4. **Utilise des petits montants** pour ne pas épuiser tes fonds de test

---

## 🧹 Nettoyer les positions (optionnel)

### Repayer tout et retirer collateral

```bash
# 1. Repay full debt
cast send $LENDING_POOL "repay()" --value [BORROWED_AMOUNT] --rpc-url $RPC --private-key $PK --legacy

# 2. Withdraw collateral
cast send $COLLATERAL_MGR "withdrawCollateral(address,uint256)" $DAI [AMOUNT] --rpc-url $RPC --private-key $PK --legacy
```

---

## ❓ Troubleshooting

### Erreur : "Insufficient collateral"
- Ton health factor serait < 1 après l'emprunt
- Réduis le montant à emprunter

### Erreur : "Insufficient allowance"
- Tu n'as pas approuvé le token
- Relance la commande `approve`

### Subgraph ne met pas à jour
- Attends 2-3 minutes
- Vérifie que les transactions sont confirmées sur Sepolia Etherscan
- Regarde les logs du subgraph dans The Graph Studio

---

## 🎯 Résultat Attendu

Après avoir créé une position, tu devrais voir dans le dashboard :

✅ **TVL Overview** : Total collateral en USD
✅ **User Position Card** : Ton collateral + dette
✅ **Health Factor Display** : Gauge visuel avec couleur (vert/jaune/orange)
✅ **Quick Actions** : Boutons Deposit/Borrow/Repay

---

**Bon test !** 🚀
