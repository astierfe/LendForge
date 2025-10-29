import atexit
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
from utils.logger import logger
from jobs import run_health_monitor, run_liquidation_check, run_price_sync
import jobs.health_monitor as health_monitor_module
import jobs.liquidation_check as liquidation_check_module
import jobs.price_sync as price_sync_module

class BotScheduler:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self._job_stats = {
            "health_monitor": {"runs": 0, "errors": 0, "last_run": None},
            "liquidation_check": {"runs": 0, "errors": 0, "last_run": None},
            "price_sync": {"runs": 0, "errors": 0, "last_run": None}
        }

    def initialize(self, monitor, graph_client, web3_client, liquidator):
        logger.info("Initializing scheduler dependencies...")

        health_monitor_module.set_monitor(monitor)
        liquidation_check_module.set_clients(graph_client, web3_client, liquidator)
        price_sync_module.set_web3_client(web3_client)

        logger.info("Dependencies injected successfully")

    def _wrapped_job(self, job_name: str, job_func):
        try:
            logger.debug(f"[SCHEDULER] Running {job_name}")
            result = job_func()
            self._job_stats[job_name]["runs"] += 1
            self._job_stats[job_name]["last_run"] = datetime.utcnow().isoformat()

            if result and "error" in result:
                self._job_stats[job_name]["errors"] += 1

        except Exception as e:
            self._job_stats[job_name]["errors"] += 1
            logger.error(f"[SCHEDULER] Job {job_name} failed: {e}")

    def start(self, intervals: dict = None):
        if intervals is None:
            intervals = {
                "health_monitor": 30,
                "liquidation_check": 60,
                "price_sync": 300
            }

        self.scheduler.add_job(
            func=lambda: self._wrapped_job("health_monitor", run_health_monitor),
            trigger=IntervalTrigger(seconds=intervals["health_monitor"]),
            id="health_monitor",
            name="Health Monitor",
            replace_existing=True
        )

        self.scheduler.add_job(
            func=lambda: self._wrapped_job("liquidation_check", run_liquidation_check),
            trigger=IntervalTrigger(seconds=intervals["liquidation_check"]),
            id="liquidation_check",
            name="Liquidation Check",
            replace_existing=True
        )

        self.scheduler.add_job(
            func=lambda: self._wrapped_job("price_sync", run_price_sync),
            trigger=IntervalTrigger(seconds=intervals["price_sync"]),
            id="price_sync",
            name="Price Sync",
            replace_existing=True
        )

        self.scheduler.start()

        logger.info("=" * 60)
        logger.info("Scheduler started successfully")
        logger.info(f"  - health_monitor: every {intervals['health_monitor']}s")
        logger.info(f"  - liquidation_check: every {intervals['liquidation_check']}s")
        logger.info(f"  - price_sync: every {intervals['price_sync']}s")
        logger.info("=" * 60)

        atexit.register(self.shutdown)

    def get_status(self) -> dict:
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None
            })

        return {
            "scheduler_running": self.scheduler.running,
            "jobs": jobs,
            "job_stats": self._job_stats
        }

    def shutdown(self):
        if self.scheduler.running:
            logger.info("Shutting down scheduler...")
            self.scheduler.shutdown()
            logger.info("Scheduler stopped")
