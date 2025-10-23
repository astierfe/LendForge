# bot/src/config.py - v2.0 - Multi-collateral configuration
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Blockchain
    SEPOLIA_RPC_URL = os.getenv("SEPOLIA_RPC_URL")
    PRIVATE_KEY = os.getenv("PRIVATE_KEY")

    # ===== NEW CONTRACTS (v3.1) =====
    LENDING_POOL_ADDRESS = os.getenv("LENDING_POOL_ADDRESS")  # v3.0
    COLLATERAL_MANAGER_ADDRESS = os.getenv("COLLATERAL_MANAGER_ADDRESS")
    ORACLE_AGGREGATOR_ADDRESS = os.getenv("ORACLE_AGGREGATOR_ADDRESS")  # v3.1
    PRICE_REGISTRY_ADDRESS = os.getenv("PRICE_REGISTRY_ADDRESS")

    # Token addresses
    LFTKN_ADDRESS = os.getenv("LFTKN_ADDRESS")
    USDC_TOKEN_ADDRESS = os.getenv("USDC_TOKEN_ADDRESS")
    DAI_TOKEN_ADDRESS = os.getenv("DAI_TOKEN_ADDRESS")

    # Staking contracts
    STAKING_POOL_ADDRESS = os.getenv("STAKING_POOL_ADDRESS")
    REWARD_DISTRIBUTOR_ADDRESS = os.getenv("REWARD_DISTRIBUTOR_ADDRESS")

    # ===== DEPRECATED - REMOVE =====
    # ORACLE_ADDRESS = os.getenv("ORACLE_ADDRESS")  # OLD SimpleOracle
    # CHAINLINK_FEED_ADDRESS = os.getenv("CHAINLINK_FEED_ADDRESS")  # OLD
    
    # The Graph
    SUBGRAPH_URL = os.getenv("SUBGRAPH_URL")
    
    # Bot Configuration
    MONITOR_INTERVAL_SECONDS = int(os.getenv("MONITOR_INTERVAL_SECONDS", "60"))
    MIN_PROFIT_USD = float(os.getenv("MIN_PROFIT_USD", "5.0"))
    MAX_GAS_PRICE_GWEI = int(os.getenv("MAX_GAS_PRICE_GWEI", "50"))
    HEALTH_FACTOR_THRESHOLD = float(os.getenv("HEALTH_FACTOR_THRESHOLD", "1.0"))
    
    # Liquidator
    LIQUIDATOR_WALLET = os.getenv("LIQUIDATOR_WALLET")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.getenv("LOG_FILE", "logs/bot.log")
    LOG_MAX_BYTES = int(os.getenv("LOG_MAX_BYTES", "10485760"))
    LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", "5"))
    
    # Flask
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
    
    # ===== NEW ABI PATHS =====
    LENDING_POOL_ABI_PATH = "abis/LendingPool.json"
    COLLATERAL_MANAGER_ABI_PATH = "abis/CollateralManager.json"
    ORACLE_AGGREGATOR_ABI_PATH = "abis/OracleAggregator.json"
    PRICE_REGISTRY_ABI_PATH = "abis/PriceRegistry.json"
    LFTKN_ABI_PATH = "abis/LFTKN.json"

    # ===== DEPRECATED - REMOVE =====
    # ORACLE_ABI_PATH = "../out/SimpleOracle.sol/SimpleOracle.json"  # OLD
    
    # ===== NEW MULTI-COLLATERAL CONSTANTS =====
    # Asset addresses for collateral tracking
    ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"  # Placeholder for ETH

    # Collateral configs (LTV ratios)
    COLLATERAL_CONFIGS = {
        ETH_ADDRESS: {
            "symbol": "ETH",
            "ltv": 66,  # 66% LTV
            "liquidation_threshold": 83,  # 83%
            "decimals": 18
        },
        # Will be populated with actual USDC/DAI addresses from env
    }

    # Constants
    LIQUIDATION_BONUS = 0.10  # 10%
    ETH_DECIMALS = 18
    USD_DECIMALS = 8  # Chainlink standard
    
    @classmethod
    def validate(cls):
        required = [
            "SEPOLIA_RPC_URL",
            "PRIVATE_KEY",
            "LENDING_POOL_ADDRESS",
            "COLLATERAL_MANAGER_ADDRESS",
            "ORACLE_AGGREGATOR_ADDRESS",
            "SUBGRAPH_URL",
            "LIQUIDATOR_WALLET"
        ]

        missing = [key for key in required if not getattr(cls, key)]

        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

        # Populate token addresses in collateral configs
        if cls.USDC_TOKEN_ADDRESS:
            cls.COLLATERAL_CONFIGS[cls.USDC_TOKEN_ADDRESS] = {
                "symbol": "USDC",
                "ltv": 90,
                "liquidation_threshold": 95,
                "decimals": 6
            }

        if cls.DAI_TOKEN_ADDRESS:
            cls.COLLATERAL_CONFIGS[cls.DAI_TOKEN_ADDRESS] = {
                "symbol": "DAI",
                "ltv": 90,
                "liquidation_threshold": 95,
                "decimals": 18
            }

        return True