# bot/src/utils/logger.py - v1.1 - UTF-8 fix for Windows
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from config import Config

def setup_logger(name: str = "liquidation_bot") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, Config.LOG_LEVEL))
    
    logger.handlers.clear()
    
    # Console handler with UTF-8 encoding
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, Config.LOG_LEVEL))
    
    # FIX: Force UTF-8 on Windows to support emojis
    if sys.platform == 'win32':
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    
    console_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler
    os.makedirs(os.path.dirname(Config.LOG_FILE), exist_ok=True)
    file_handler = RotatingFileHandler(
        Config.LOG_FILE,
        maxBytes=Config.LOG_MAX_BYTES,
        backupCount=Config.LOG_BACKUP_COUNT,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    return logger

# Global logger instance
logger = setup_logger()

def log_liquidation(user: str, profit: float, tx_hash: str):
    logger.info(
        f"LIQUIDATION SUCCESS | user={user[:10]}... | "
        f"profit=${profit:.2f} | tx={tx_hash[:10]}..."
    )

def log_liquidation_failed(user: str, reason: str):
    logger.warning(
        f"LIQUIDATION FAILED | user={user[:10]}... | reason={reason}"
    )

def log_monitor_cycle(risky_count: int, profitable_count: int):
    logger.info(
        f"Monitor cycle completed | risky_positions={risky_count} | "
        f"profitable={profitable_count}"
    )