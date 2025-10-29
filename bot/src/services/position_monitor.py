# bot/src/services/position_monitor.py - v2.0 - Multi-collateral support
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
        
        # ENHANCED: Multi-collateral position checking with detailed analysis
        liquidatable = []
        for position in all_active_positions:
            try:
                user_addr = position.user_address
                logger.debug(f"Analyzing position {user_addr[:10]}...")

                # Get multi-collateral data from contracts
                collateral_usd, borrowed, last_update = self.web3_client.get_position_onchain(user_addr)
                hf_raw = self.web3_client.get_health_factor(user_addr)
                hf_onchain = Decimal(hf_raw) / Decimal(100) if hf_raw < 999999 else Decimal("999.99")

                # Get detailed collateral breakdown
                user_collaterals = self.web3_client.get_user_collaterals(user_addr)

                # Update position with real on-chain data
                position.health_factor = hf_onchain
                position.collateral_amount = collateral_usd
                position.borrowed_amount = borrowed

                # Enhanced logging with multi-collateral details
                collateral_summary = ", ".join([
                    f"{c['symbol']}:{c['amount'] / 10**Config.COLLATERAL_CONFIGS.get(c['asset'], {}).get('decimals', 18):.4f}"
                    for c in user_collaterals
                ]) if user_collaterals else "None"

                logger.info(
                    f"Position {user_addr[:10]}... | "
                    f"HF={hf_onchain:.2f} | "
                    f"Collateral=${collateral_usd / 10**Config.USD_DECIMALS:.2f} | "
                    f"Borrowed=${borrowed / 10**Config.USD_DECIMALS:.2f} | "
                    f"Assets=[{collateral_summary}]"
                )

                # Check if liquidatable
                if hf_onchain < Decimal("1.0") and borrowed > 0:
                    liquidatable.append(position)
                    logger.warning(
                        f"🚨 [LIQUIDATABLE] Position {user_addr[:10]}... | "
                        f"HF={hf_onchain:.2f} | "
                        f"Value=${collateral_usd / 10**Config.USD_DECIMALS:.2f} | "
                        f"Debt=${borrowed / 10**Config.USD_DECIMALS:.2f} | "
                        f"Assets={len(user_collaterals)}"
                    )

            except Exception as e:
                logger.error(f"Failed to analyze position {position.user_address[:10]}...: {e}")
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
                    orderBy: updatedAt
                    orderDirection: desc
                    first: 100
                ) {
                    id
                    user {
                        id
                    }
                    totalCollateralUSD
                    borrowed
                    healthFactor
                    status
                    updatedAt
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
    
    def analyze_multi_collateral_position(self, user_address: str) -> dict:
        """
        Analyze a position's multi-collateral composition and risk factors
        """
        try:
            # Get comprehensive position data
            collaterals = self.web3_client.get_user_collaterals(user_address)
            collateral_usd = self.web3_client.get_collateral_value_usd(user_address)
            max_borrow = self.web3_client.get_max_borrow_value(user_address)
            _, borrowed, _ = self.web3_client.get_position_onchain(user_address)
            hf = self.web3_client.get_health_factor(user_address)

            # Calculate risk metrics
            utilization = (borrowed / max_borrow * 100) if max_borrow > 0 else 0
            liquidation_distance = (Decimal(hf) / 100 - 1) * 100  # % above liquidation

            # Asset breakdown
            asset_breakdown = []
            for collateral in collaterals:
                asset_config = Config.COLLATERAL_CONFIGS.get(collateral['asset'], {})
                asset_breakdown.append({
                    'symbol': collateral['symbol'],
                    'amount': collateral['amount'] / 10**asset_config.get('decimals', 18),
                    'ltv': asset_config.get('ltv', 0),
                    'liquidation_threshold': asset_config.get('liquidation_threshold', 0)
                })

            return {
                'user_address': user_address,
                'health_factor': float(Decimal(hf) / 100),
                'collateral_usd': collateral_usd / 10**Config.USD_DECIMALS,
                'borrowed_usd': borrowed / 10**Config.USD_DECIMALS,
                'max_borrow_usd': max_borrow / 10**Config.USD_DECIMALS,
                'utilization_percent': utilization,
                'liquidation_distance_percent': float(liquidation_distance),
                'asset_count': len(collaterals),
                'asset_breakdown': asset_breakdown,
                'is_liquidatable': hf < 100 and borrowed > 0,  # HF < 1.0 (contract returns 100 = 1.0)
                'risk_level': 'HIGH' if hf < 120 else 'MEDIUM' if hf < 150 else 'LOW'
            }

        except Exception as e:
            logger.error(f"Failed to analyze multi-collateral position {user_address}: {e}")
            return {'error': str(e)}

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