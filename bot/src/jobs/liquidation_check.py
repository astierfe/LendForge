import time
from datetime import datetime
from typing import Optional
from decimal import Decimal
from gql import gql

try:
    from utils.logger import logger
    from config import Config
except ImportError:
    from src.utils.logger import logger
    from src.config import Config

_graph_client_instance: Optional['GraphClient'] = None
_web3_client_instance: Optional['Web3Client'] = None
_liquidator_instance: Optional['Liquidator'] = None

def set_clients(graph_client, web3_client, liquidator):
    global _graph_client_instance, _web3_client_instance, _liquidator_instance
    _graph_client_instance = graph_client
    _web3_client_instance = web3_client
    _liquidator_instance = liquidator

def run_liquidation_check():
    if not all([_graph_client_instance, _web3_client_instance, _liquidator_instance]):
        logger.error("[LIQUIDATION_CHECK] Clients not initialized")
        return

    start_time = time.time()
    timestamp = datetime.utcnow().isoformat()

    try:
        logger.info(f"[LIQUIDATION_CHECK] Starting at {timestamp}")

        query = gql("""
            query GetLiquidatablePositions {
                positions(
                    where: {
                        status: ACTIVE
                        healthFactor_lt: "1.0"
                        borrowed_gt: "0"
                    }
                    orderBy: healthFactor
                    orderDirection: asc
                    first: 20
                ) {
                    id
                    user { id }
                    totalCollateralUSD
                    borrowed
                    healthFactor
                    status
                }
            }
        """)

        result = _graph_client_instance.client.execute(query)
        graph_positions = result.get("positions", [])

        logger.info(f"[LIQUIDATION_CHECK] Found {len(graph_positions)} positions from The Graph")

        liquidatable = []
        for pos in graph_positions:
            user_addr = pos["user"]["id"]

            hf_raw = _web3_client_instance.get_health_factor(user_addr)
            hf_onchain = Decimal(hf_raw) / Decimal(100) if hf_raw < 999999 else Decimal("999.99")

            collateral_usd, borrowed, _ = _web3_client_instance.get_position_onchain(user_addr)

            logger.debug(
                f"[LIQUIDATION_CHECK] {user_addr[:10]}... | "
                f"HF_graph={pos['healthFactor']} | HF_onchain={hf_onchain:.2f}"
            )

            if hf_onchain < Decimal("1.0") and borrowed > 0:
                liquidatable.append({
                    "user": user_addr,
                    "health_factor": hf_onchain,
                    "collateral_usd": collateral_usd,
                    "borrowed": borrowed
                })
                logger.warning(
                    f"[LIQUIDATION_CHECK] 🚨 LIQUIDATABLE | "
                    f"user={user_addr[:10]}... | HF={hf_onchain:.2f} | "
                    f"debt=${borrowed / 10**Config.USD_DECIMALS:.2f}"
                )

        logger.info(f"[LIQUIDATION_CHECK] Validated {len(liquidatable)} liquidatable positions on-chain")

        liquidated_count = 0
        for liq_pos in liquidatable:
            from models.position import Position

            position = Position(
                user_address=liq_pos["user"],
                collateral_amount=liq_pos["collateral_usd"],
                borrowed_amount=liq_pos["borrowed"],
                health_factor=liq_pos["health_factor"],
                status="ACTIVE"
            )

            success = _liquidator_instance.attempt_liquidation(position)
            if success:
                liquidated_count += 1

        execution_time = time.time() - start_time

        logger.info(
            f"[LIQUIDATION_CHECK] Completed | "
            f"found={len(graph_positions)} | "
            f"liquidatable={len(liquidatable)} | "
            f"liquidated={liquidated_count} | "
            f"time={execution_time:.2f}s"
        )

        return {
            "found": len(graph_positions),
            "liquidatable": len(liquidatable),
            "liquidated": liquidated_count
        }

    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(
            f"[LIQUIDATION_CHECK] Failed after {execution_time:.2f}s | error={str(e)}"
        )
        return {"error": str(e)}
