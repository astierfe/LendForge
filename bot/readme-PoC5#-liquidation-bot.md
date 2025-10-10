# 🐍 ChainStaker V2 - Liquidation Bot

Bot Python automatisé qui monitore et liquide les positions unhealthy du protocole ChainStaker V2.

---

## 🎯 Features

- ✅ **Monitor positions** - Query The Graph toutes les 60s
- ✅ **Profit calculator** - Calcule rentabilité avant liquidation
- ✅ **Auto-liquidation** - Exécute liquidations profitables (>$5)
- ✅ **Gas optimization** - Check gas price avant exécution
- ✅ **Logging complet** - Console + fichiers rotatifs
- ✅ **Metrics tracking** - Stats temps réel
- ✅ **Flask API** - Endpoints monitoring et contrôle

---

## 📁 Structure

```
bot/
├── src/
│   ├── main.py                 # Entry point Flask + Scheduler
│   ├── config.py               # Configuration
│   ├── clients/
│   │   ├── graph_client.py     # The Graph queries
│   │   └── web3_client.py      # Blockchain interactions
│   ├── services/
│   │   ├── position_monitor.py # Monitor positions
│   │   ├── liquidator.py       # Execute liquidations
│   │   └── profit_calculator.py# Calculate profitability
│   ├── models/
│   │   └── position.py         # Position dataclass
│   └── utils/
│       └── logger.py           # Custom logger
├── tests/
│   └── test_profit_calculator.py
├── logs/                       # Generated logs
├── requirements.txt
├── .env
└── README.md
```

---

## 🚀 Setup

### **1. Install Dependencies**

```bash
cd bot
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### **2. Configure Environment**

Copie `.env.example` vers `.env` et configure :

```bash
# Blockchain
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
LENDING_POOL_ADDRESS=0x16CbF8825A11eAa25DA636E5bC9202190D4E8c5B
ORACLE_ADDRESS=0x4eC7F58b90A2aEAb6206ae62f8494b5b7E6aAfcF

# The Graph
SUBGRAPH_URL=https://api.studio.thegraph.com/query/122308/chainstaker-poc-4/v0.0.1

# Bot Config
MONITOR_INTERVAL_SECONDS=60
MIN_PROFIT_USD=5.0
MAX_GAS_PRICE_GWEI=50
```

### **3. Verify ABI Paths**

Le bot cherche les ABIs ici :
```
../contracts/out/LendingPoolV2.sol/LendingPoolV2.json
../contracts/out/SimpleOracle.sol/SimpleOracle.json
```

Génère-les depuis le dossier contracts :
```bash
cd ../contracts
forge build
```

---

## 🎮 Usage

### **Start Bot**

```bash
cd bot
source venv/bin/activate
python src/main.py
```

Le bot :
1. Démarre Flask sur `http://localhost:5000`
2. Lance le scheduler (monitor toutes les 60s)
3. Log dans console + `logs/bot.log`

### **API Endpoints**

```bash
# Health check
curl http://localhost:5000/health

# Status complet (TVL, metrics, wallet)
curl http://localhost:5000/status

# Metrics liquidations
curl http://localhost:5000/metrics

# Trigger monitor manuellement
curl -X POST http://localhost:5000/monitor

# Liste positions à risque
curl http://localhost:5000/risky-positions
```

---

## 🧪 Tests

```bash
cd bot
pytest tests/ -v
```

Tests couvrent :
- ✅ Profit calculator (9 tests)
- ✅ Gas estimation
- ✅ Liquidation amount calculation
- ✅ Edge cases (low profit, high gas, etc.)

---

## 📊 Logging

### **Console Output**

```
2024-01-06 10:30:15 | INFO     | Starting monitor cycle
2024-01-06 10:30:18 | INFO     | Found 2 risky positions
2024-01-06 10:30:20 | WARNING  | Position 0x123... HF=0.95 - Calculating profit...
2024-01-06 10:30:22 | INFO     | LIQUIDATION SUCCESS | user=0x123... | profit=$15.32 | tx=0xabc...
```

### **Log Files**

- `logs/bot.log` - Log principal (rotatif 10MB max)
- `logs/bot.log.1` - Archives automatiques

---

## 🔧 Configuration Avancée

### **Ajuster Seuils**

```bash
# .env
MIN_PROFIT_USD=10.0          # Minimum profit requis
MAX_GAS_PRICE_GWEI=30        # Max gas price acceptable
HEALTH_FACTOR_THRESHOLD=1.2  # Threshold pour detection
MONITOR_INTERVAL_SECONDS=30  # Fréquence monitoring
```

### **Changer Log Level**

```bash
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARNING, ERROR
```

---

## 🐛 Troubleshooting

### **Erreur "Failed to connect to Sepolia RPC"**

- Vérifier `SEPOLIA_RPC_URL` dans `.env`
- Tester : `curl $SEPOLIA_RPC_URL`

### **Erreur "Missing required environment variables"**

- Vérifier tous les champs requis dans `.env`
- Lancer : `python -c "from src.config import Config; Config.validate()"`

### **Erreur "Failed to query The Graph"**

- Vérifier `SUBGRAPH_URL`
- Tester query manuellement :
```bash
curl -X POST $SUBGRAPH_URL \
  -H "Content-Type: application/json" \
  -d '{"query": "{ globalMetric(id: \"global\") { currentTVL } }"}'
```

### **Erreur "Contract reverted"**

- Position déjà liquidée par quelqu'un d'autre
- Health factor remonté entre detection et execution
- Vérifier balance wallet (assez d'ETH ?)

---

## 📈 Metrics Exemple

```json
{
  "total_liquidations": 5,
  "successful": 4,
  "failed": 1,
  "total_profit_usd": 87.50,
  "total_gas_spent_usd": 15.20,
  "net_profit_usd": 72.30
}
```

---

## 🚀 Production Deploy (Railway/Render)

### **1. Créer Procfile**

```
web: python src/main.py
```

### **2. Push to Git**

```bash
git add .
git commit -m "Add liquidation bot"
git push
```

### **3. Configure env vars sur Railway**

Ajoute toutes les vars de `.env` dans le dashboard.

---

## 🔒 Security

- ⚠️ **PRIVATE_KEY** - Ne jamais commit dans Git
- ⚠️ **Wallet balance** - Garde assez d'ETH pour gas
- ⚠️ **Rate limiting** - Max 1 req/s vers The Graph

---

## 📝 TODO / Améliorations

- [ ] Flashloan integration (Aave)
- [ ] Multi-position batch liquidation
- [ ] MEV protection (Flashbots)
- [ ] Telegram notifications
- [ ] PostgreSQL pour analytics
- [ ] Dashboard frontend (React)

---
