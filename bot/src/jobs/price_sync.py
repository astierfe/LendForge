import time
import requests
from datetime import datetime
from typing import Optional
from decimal import Decimal

try:
    from utils.logger import logger
    from config import Config
except ImportError:
    from src.utils.logger import logger
    from src.config import Config

_web3_client_instance: Optional['Web3Client'] = None

COINGECKO_API_KEY = "CG-cGctu1xDb4iRiJAmbT1HNSLD"
COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price"
COINGECKO_PRO_URL = "https://pro-api.coingecko.com/api/v3/simple/price"

ASSETS = {
    "ethereum": {
        "symbol": "ETH",
        "address": Config.ETH_ADDRESS,
        "decimals": 18
    },
    "usd-coin": {
        "symbol": "USDC",
        "address": Config.USDC_TOKEN_ADDRESS,
        "decimals": 6
    },
    "dai": {
        "symbol": "DAI",
        "address": Config.DAI_TOKEN_ADDRESS,
        "decimals": 18
    }
}

def set_web3_client(web3_client):
    global _web3_client_instance
    _web3_client_instance = web3_client

def fetch_coingecko_prices():
    try:
        ids = ",".join(ASSETS.keys())
        params = {
            "ids": ids,
            "vs_currencies": "usd"
        }

        headers = {}
        api_url = COINGECKO_API_URL

        if COINGECKO_API_KEY:
            headers["x-cg-pro-api-key"] = COINGECKO_API_KEY
            api_url = COINGECKO_PRO_URL

        response = requests.get(api_url, params=params, headers=headers, timeout=10)

        if response.status_code == 401 or response.status_code == 400:
            logger.warning("[PRICE_SYNC] Pro API failed, falling back to public API")
            response = requests.get(COINGECKO_API_URL, params=params, timeout=10)

        response.raise_for_status()

        data = response.json()

        prices = {}
        for coin_id, asset_info in ASSETS.items():
            if coin_id in data and "usd" in data[coin_id]:
                price_usd = data[coin_id]["usd"]
                prices[asset_info["symbol"]] = {
                    "address": asset_info["address"],
                    "price_usd": price_usd,
                    "price_chainlink": int(price_usd * 10**8)
                }

        return prices

    except requests.exceptions.RequestException as e:
        logger.error(f"[PRICE_SYNC] Failed to fetch CoinGecko prices: {e}")
        return None
    except Exception as e:
        logger.error(f"[PRICE_SYNC] Unexpected error fetching prices: {e}")
        return None

def run_price_sync():
    if _web3_client_instance is None:
        logger.error("[PRICE_SYNC] Web3Client not initialized")
        return

    start_time = time.time()
    timestamp = datetime.utcnow().isoformat()

    try:
        logger.info(f"[PRICE_SYNC] Starting at {timestamp}")

        coingecko_prices = fetch_coingecko_prices()
        if not coingecko_prices:
            logger.warning("[PRICE_SYNC] No prices fetched from CoinGecko")
            return {"error": "Failed to fetch prices"}

        logger.info(f"[PRICE_SYNC] Fetched {len(coingecko_prices)} prices from CoinGecko")

        deviations = []
        for symbol, price_data in coingecko_prices.items():
            asset_address = price_data["address"]
            coingecko_price = price_data["price_chainlink"]

            try:
                onchain_price = _web3_client_instance.get_asset_price(asset_address)

                if onchain_price == 0:
                    logger.warning(f"[PRICE_SYNC] {symbol} on-chain price is 0, skipping")
                    continue

                deviation_pct = abs(coingecko_price - onchain_price) / onchain_price * 100

                logger.info(
                    f"[PRICE_SYNC] {symbol} | "
                    f"CoinGecko=${coingecko_price / 10**8:.2f} | "
                    f"OnChain=${onchain_price / 10**8:.2f} | "
                    f"Deviation={deviation_pct:.2f}%"
                )

                if deviation_pct > 2.0:
                    deviations.append({
                        "symbol": symbol,
                        "coingecko_price": coingecko_price,
                        "onchain_price": onchain_price,
                        "deviation_pct": deviation_pct
                    })

                    if deviation_pct > 10.0:
                        logger.warning(
                            f"[PRICE_SYNC] ⚠️ HIGH DEVIATION | {symbol} | {deviation_pct:.2f}%"
                        )

            except Exception as e:
                logger.error(f"[PRICE_SYNC] Failed to check {symbol}: {e}")
                continue

        execution_time = time.time() - start_time

        logger.info(
            f"[PRICE_SYNC] Completed | "
            f"prices_checked={len(coingecko_prices)} | "
            f"deviations={len(deviations)} | "
            f"time={execution_time:.2f}s"
        )

        return {
            "prices_checked": len(coingecko_prices),
            "deviations": deviations,
            "high_deviations": [d for d in deviations if d["deviation_pct"] > 10.0]
        }

    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(
            f"[PRICE_SYNC] Failed after {execution_time:.2f}s | error={str(e)}"
        )
        return {"error": str(e)}
