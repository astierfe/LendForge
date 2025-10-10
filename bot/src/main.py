# bot/src/main.py - v1.0 - Flask app with APScheduler
from flask import Flask, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import atexit
import sys

from config import Config
from clients.graph_client import GraphClient
from clients.web3_client import Web3Client
from services.profit_calculator import ProfitCalculator
from services.liquidator import Liquidator
from services.position_monitor import PositionMonitor
from utils.logger import logger

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global instances
graph_client = None
web3_client = None
profit_calculator = None
liquidator = None
monitor = None
scheduler = None

def initialize_services():
    global graph_client, web3_client, profit_calculator, liquidator, monitor
    
    logger.info("Initializing services...")
    
    try:
        # Validate config
        Config.validate()
        
        # Initialize clients
        graph_client = GraphClient()
        web3_client = Web3Client()
        
        # Initialize services
        profit_calculator = ProfitCalculator(web3_client)
        liquidator = Liquidator(web3_client, profit_calculator)
        monitor = PositionMonitor(graph_client, web3_client, liquidator)
        
        logger.info("All services initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        sys.exit(1)

def scheduled_monitor():
    try:
        monitor.monitor_cycle()
    except Exception as e:
        logger.error(f"Monitor cycle failed: {e}")

# Flask routes
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "bot": "liquidation_bot",
        "version": "1.0.0"
    })

@app.route("/status", methods=["GET"])
def status():
    try:
        status_data = monitor.get_status()
        return jsonify(status_data)
    except Exception as e:
        logger.error(f"Failed to get status: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/metrics", methods=["GET"])
def metrics():
    try:
        metrics_data = liquidator.get_metrics()
        return jsonify(metrics_data)
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/monitor", methods=["POST"])
def trigger_monitor():
    try:
        result = monitor.monitor_cycle()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Manual monitor trigger failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/risky-positions", methods=["GET"])
def risky_positions():
    try:
        positions = graph_client.get_risky_positions()
        positions_data = [
            {
                "user": p.user_address,
                "health_factor": float(p.health_factor),
                "collateral": str(p.collateral),
                "borrowed": str(p.borrowed),
                "status": p.status
            }
            for p in positions
        ]
        return jsonify({"positions": positions_data, "count": len(positions_data)})
    except Exception as e:
        logger.error(f"Failed to get risky positions: {e}")
        return jsonify({"error": str(e)}), 500

def start_scheduler():
    global scheduler
    
    scheduler = BackgroundScheduler()
    
    scheduler.add_job(
        func=scheduled_monitor,
        trigger=IntervalTrigger(seconds=Config.MONITOR_INTERVAL_SECONDS),
        id="monitor_job",
        name="Monitor risky positions",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info(
        f"Scheduler started | interval={Config.MONITOR_INTERVAL_SECONDS}s"
    )
    
    # Shutdown scheduler on exit
    atexit.register(lambda: scheduler.shutdown())

def main():
    logger.info("=" * 60)
    logger.info("Starting Liquidation Bot")
    logger.info("=" * 60)
    
    # Initialize services
    initialize_services()
    
    # Start scheduler
    start_scheduler()
    
    # Run Flask app
    logger.info(f"Starting Flask server on port {Config.FLASK_PORT}")
    app.run(
        host="0.0.0.0",
        port=Config.FLASK_PORT,
        debug=(Config.FLASK_ENV == "development")
    )

if __name__ == "__main__":
    main()