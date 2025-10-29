import time
from datetime import datetime
from typing import Optional

try:
    from utils.logger import logger
except ImportError:
    from src.utils.logger import logger

_monitor_instance: Optional['PositionMonitor'] = None

def set_monitor(monitor):
    global _monitor_instance
    _monitor_instance = monitor

def run_health_monitor():
    if _monitor_instance is None:
        logger.error("[HEALTH_MONITOR] Monitor not initialized")
        return

    start_time = time.time()
    timestamp = datetime.utcnow().isoformat()

    try:
        logger.info(f"[HEALTH_MONITOR] Starting at {timestamp}")

        result = _monitor_instance.monitor_cycle()

        execution_time = time.time() - start_time

        logger.info(
            f"[HEALTH_MONITOR] Completed | "
            f"risky={result.get('risky_count', 0)} | "
            f"profitable={result.get('profitable_count', 0)} | "
            f"liquidated={result.get('liquidated_count', 0)} | "
            f"time={execution_time:.2f}s"
        )

        return result

    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(
            f"[HEALTH_MONITOR] Failed after {execution_time:.2f}s | error={str(e)}"
        )
        return {"error": str(e)}
