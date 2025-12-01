# LendForge API Reference

REST API documentation for the Python liquidation bot.

## Base URL

```
http://localhost:5000
```

## Endpoints

### 1. Health Check

Basic health check to verify the bot is running.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "bot": "liquidation_bot",
  "version": "1.0.0"
}
```

---

### 2. Bot Status

Returns comprehensive bot and protocol status.

**Request:**
```http
GET /status
```

**Response:**
```json
{
  "protocol": {
    "tvl": "125000.00",
    "borrowed": "45000.00",
    "active_positions": 12,
    "total_liquidations": 3
  },
  "bot": {
    "wallet_balance_eth": 1.5,
    "liquidations": {
      "total_liquidations": 3,
      "successful": 2,
      "failed": 1,
      "total_profit_usd": 125.50,
      "total_gas_spent_usd": 15.20,
      "net_profit_usd": 110.30
    },
    "config": {
      "monitor_interval": 60,
      "min_profit_usd": 5.0,
      "max_gas_gwei": 50
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `protocol.tvl` | string | Total Value Locked in USD |
| `protocol.borrowed` | string | Total borrowed amount in USD |
| `protocol.active_positions` | int | Number of active borrowing positions |
| `bot.wallet_balance_eth` | float | Liquidator wallet ETH balance |
| `bot.liquidations.net_profit_usd` | float | Total profit after gas costs |

---

### 3. Liquidation Metrics

Returns aggregated liquidation performance metrics.

**Request:**
```http
GET /metrics
```

**Response:**
```json
{
  "total_liquidations": 3,
  "successful": 2,
  "failed": 1,
  "total_profit_usd": 125.50,
  "total_gas_spent_usd": 15.20,
  "net_profit_usd": 110.30
}
```

---

### 4. Trigger Monitor Cycle

Manually trigger a complete monitor cycle.

**Request:**
```http
POST /monitor
Content-Type: application/json

{}
```

**Response:**
```json
{
  "risky_count": 5,
  "profitable_count": 2,
  "liquidated_count": 1
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `risky_count` | int | Positions with HF < 1.0 found |
| `profitable_count` | int | Liquidations that would be profitable |
| `liquidated_count` | int | Liquidations actually executed |

**Process:**
1. Queries subgraph for all active positions
2. Checks on-chain health factor for each
3. Filters positions with HF < 1.0
4. Calculates profitability (collateral seized - debt - gas)
5. Executes profitable liquidations

---

### 5. Get Risky Positions

Returns list of positions near or below liquidation threshold.

**Request:**
```http
GET /risky-positions
```

**Response:**
```json
{
  "positions": [
    {
      "user": "0x5056AB0F67695F3af9F828a1cFccF1daa1b671c3",
      "health_factor": 0.95,
      "collateral": "1000000000000000000",
      "borrowed": "600000000000000000",
      "status": "ACTIVE"
    },
    {
      "user": "0xabcd...1234",
      "health_factor": 1.15,
      "collateral": "2500000000000000000",
      "borrowed": "1200000000000000000",
      "status": "ACTIVE"
    }
  ],
  "count": 2
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `positions[].user` | string | User wallet address |
| `positions[].health_factor` | float | Current health factor |
| `positions[].collateral` | string | Total collateral in Wei |
| `positions[].borrowed` | string | Total borrowed in Wei |
| `positions[].status` | string | ACTIVE, INACTIVE, REPAID, LIQUIDATED |

**Note:** Positions are sorted by health factor (lowest first).

---

### 6. Scheduler Status

Returns background job scheduler status.

**Request:**
```http
GET /scheduler/status
```

**Response:**
```json
{
  "scheduler_running": true,
  "jobs": [
    {
      "id": "health_monitor",
      "name": "Health Monitor",
      "next_run": "2025-01-15T10:30:00Z"
    },
    {
      "id": "liquidation_check",
      "name": "Liquidation Check",
      "next_run": "2025-01-15T10:31:00Z"
    },
    {
      "id": "price_sync",
      "name": "Price Sync",
      "next_run": "2025-01-15T10:35:00Z"
    }
  ],
  "job_stats": {
    "health_monitor": {
      "runs": 150,
      "errors": 2,
      "last_run": "2025-01-15T10:29:30Z"
    },
    "liquidation_check": {
      "runs": 75,
      "errors": 0,
      "last_run": "2025-01-15T10:30:00Z"
    },
    "price_sync": {
      "runs": 15,
      "errors": 0,
      "last_run": "2025-01-15T10:25:00Z"
    }
  }
}
```

---

## Background Jobs

The bot runs these scheduled jobs automatically:

| Job ID | Interval | Purpose |
|--------|----------|---------|
| `health_monitor` | 30 seconds | Log positions at risk (HF 1.0-1.5) |
| `liquidation_check` | 60 seconds | Find and execute liquidations |
| `price_sync` | 5 minutes | Sync oracle prices from on-chain |

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad request (invalid parameters) |
| `500` | Internal server error |

---

## Configuration

Environment variables that control the bot:

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_PORT` | 5000 | HTTP server port |
| `FLASK_ENV` | development | Environment mode |
| `MONITOR_INTERVAL_SECONDS` | 60 | Monitor cycle interval |
| `MIN_PROFIT_USD` | 5.0 | Minimum profit to execute liquidation |
| `MAX_GAS_PRICE_GWEI` | 50 | Maximum gas price in Gwei |
| `HEALTH_FACTOR_THRESHOLD` | 1.0 | HF threshold for liquidation |
| `LOG_LEVEL` | INFO | Logging verbosity |

---

## Usage Examples

### cURL

```bash
# Health check
curl http://localhost:5000/health

# Get status
curl http://localhost:5000/status

# Trigger manual monitor
curl -X POST http://localhost:5000/monitor

# Get risky positions
curl http://localhost:5000/risky-positions
```

### Python

```python
import requests

BASE_URL = "http://localhost:5000"

# Get status
response = requests.get(f"{BASE_URL}/status")
status = response.json()
print(f"TVL: ${status['protocol']['tvl']}")

# Trigger monitor cycle
response = requests.post(f"{BASE_URL}/monitor")
result = response.json()
print(f"Liquidated: {result['liquidated_count']} positions")
```

### JavaScript

```javascript
// Get risky positions
const response = await fetch('http://localhost:5000/risky-positions');
const data = await response.json();

data.positions.forEach(pos => {
  if (pos.health_factor < 1.0) {
    console.log(`Liquidatable: ${pos.user} (HF: ${pos.health_factor})`);
  }
});
```
