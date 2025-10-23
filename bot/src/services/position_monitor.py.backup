# bot/src/services/position_monitor.py - v1.1 - On-chain fallback for HF
from typing import List
from clients.graph_client import GraphClient
from clients.web3_client import Web3Client
from services.liquidator import Liquidator
from models.position import Position
from config import Config
from utils.logger import logger, log_monitor_cycle
from decimal import Decimal

class PositionMonitor:
    def __init__(
        self,
        graph_client: GraphClient,
        web3_client: Web3Client,
        liquidator: Liquidator
    ):
        self.graph_client = graph_client
        self.web3_client = web3_client
        self.liquidator = liquidator
    
    def monitor_cycle(self) -> dict:
        logger.info("=" * 60)
        logger.info("Starting monitor cycle")
        
        # Query positions from The Graph
        risky_positions = self.graph_client.get_risky_positions(
            threshold=Config.HEALTH_FACTOR_THRESHOLD
        )
        
        # FIX: Vérifier toutes les positions ACTIVE avec dette (pas juste risky)
        # Car The Graph peut avoir HF obsolète si prix oracle changé
        all_active_positions = self._get_all_active_positions()
        
        if not all_active_positions:
            logger.info("No active positions found")
            log_monitor_cycle(0, 0)
            return {"risky_count": 0, "profitable_count": 0, "liquidated_count": 0}
        
        logger.info(f"Found {len(all_active_positions)} active positions to check")
        
        # FIX: Vérifier HF on-chain pour chaque position
        liquidatable = []
        for position in all_active_positions:
            # Récupérer HF réel on-chain
            try:
                hf_raw = self.web3_client.get_health_factor(position.user_address)
                hf_onchain = Decimal(hf_raw) / Decimal(100)
                
                # Mettre à jour position avec HF réel
                position.health_factor = hf_onchain
                
                logger.info(
                    f"Position {position.user_address[:10]}... | "
                    f"HF on-chain={hf_onchain:.2f} | "
                    f"HF graph={position.health_factor:.2f}"
                )
                
                # Vérifier si liquidatable avec HF réel
                if hf_onchain < Decimal("1.0"):
                    liquidatable.append(position)
                    logger.warning(
                        f"[ALERT] POSITION LIQUIDATABLE! "
                        f"user={position.user_address[:10]}... HF={hf_onchain:.2f}"
                    )
                    
            except Exception as e:
                logger.error(f"Failed to get on-chain HF for {position.user_address[:10]}...: {e}")
                continue
        
        logger.info(f"Liquidatable positions (on-chain HF < 1.0): {len(liquidatable)}")
        
        # Attempt liquidations
        profitable_count = 0
        liquidated_count = 0
        
        for position in liquidatable:
            logger.info(f"Processing {position}")
            
            # Attempt liquidation
            success = self.liquidator.attempt_liquidation(position)
            
            if position.is_profitable:
                profitable_count += 1
            
            if success:
                liquidated_count += 1
        
        # Log summary
        log_monitor_cycle(len(liquidatable), profitable_count)
        
        logger.info(
            f"Monitor cycle completed | risky={len(liquidatable)} | "
            f"profitable={profitable_count} | liquidated={liquidated_count}"
        )
        logger.info("=" * 60)
        
        return {
            "risky_count": len(liquidatable),
            "profitable_count": profitable_count,
            "liquidated_count": liquidated_count
        }
    
    def _get_all_active_positions(self) -> List[Position]:
        """
        Récupère toutes les positions ACTIVE avec dette > 0
        (pas juste celles sous threshold)
        """
        from gql import gql
        
        query = gql("""
            query GetActivePositions {
                positions(
                    where: { 
                        status: ACTIVE
                        borrowed_gt: "0"
                    }
                    first: 100
                ) {
                    id
                    user {
                        id
                    }
                    collateral
                    borrowed
                    collateralRatio
                    healthFactor
                    status
                }
            }
        """)
        
        try:
            result = self.graph_client.client.execute(query)
            
            positions = [
                Position.from_graph_response(pos) 
                for pos in result.get("positions", [])
            ]
            
            logger.debug(f"Found {len(positions)} active positions from The Graph")
            return positions
            
        except Exception as e:
            logger.error(f"Failed to query active positions: {e}")
            return []
    
    def get_status(self) -> dict:
        global_metrics = self.graph_client.get_global_metrics()
        if not global_metrics:
            global_metrics = {
                "currentTVL": "0",
                "currentBorrowed": "0",
                "activePositions": 0,
                "totalLiquidations": 0
            }
        
        liquidation_metrics = self.liquidator.get_metrics()
        wallet_balance = float(self.web3_client.get_wallet_balance())
        
        return {
            "protocol": {
                "tvl": global_metrics.get("currentTVL", "0"),
                "borrowed": global_metrics.get("currentBorrowed", "0"),
                "active_positions": global_metrics.get("activePositions", 0),
                "total_liquidations": global_metrics.get("totalLiquidations", 0)
            },
            "bot": {
                "wallet_balance_eth": round(wallet_balance, 4),
                "liquidations": liquidation_metrics,
                "config": {
                    "monitor_interval": Config.MONITOR_INTERVAL_SECONDS,
                    "min_profit_usd": Config.MIN_PROFIT_USD,
                    "max_gas_gwei": Config.MAX_GAS_PRICE_GWEI
                }
            }
        }