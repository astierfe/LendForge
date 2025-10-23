# bot/src/config.py - v1.0 - Configuration management
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Blockchain
    SEPOLIA_RPC_URL = os.getenv("SEPOLIA_RPC_URL")
    PRIVATE_KEY = os.getenv("PRIVATE_KEY")
    LENDING_POOL_ADDRESS = os.getenv("LENDING_POOL_ADDRESS")
    ORACLE_ADDRESS = os.getenv("ORACLE_ADDRESS")
    CHAINLINK_FEED_ADDRESS = os.getenv("CHAINLINK_FEED_ADDRESS")
    
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
    
    # Contract ABIs (paths relatifs)
    LENDING_POOL_ABI_PATH = "../out/LendingPoolV2.sol/LendingPoolV2.json"
    ORACLE_ABI_PATH = "../out/SimpleOracle.sol/SimpleOracle.json"
    
    # Constants
    LIQUIDATION_BONUS = 0.10  # 10%
    LIQUIDATION_THRESHOLD = 0.83  # 83%
    ETH_DECIMALS = 18
    USD_DECIMALS = 8
    
    @classmethod
    def validate(cls):
        required = [
            "SEPOLIA_RPC_URL",
            "PRIVATE_KEY",
            "LENDING_POOL_ADDRESS",
            "ORACLE_ADDRESS",
            "SUBGRAPH_URL",
            "LIQUIDATOR_WALLET"
        ]
        
        missing = [key for key in required if not getattr(cls, key)]
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        return True