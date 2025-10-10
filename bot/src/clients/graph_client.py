# bot/src/clients/graph_client.py - v1.0 - The Graph GraphQL client
from typing import List, Optional
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport
from config import Config
from models.position import Position
from utils.logger import logger

class GraphClient:
    def __init__(self):
        transport = RequestsHTTPTransport(
            url=Config.SUBGRAPH_URL,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        self.client = Client(transport=transport, fetch_schema_from_transport=False)
    
    def get_risky_positions(self, threshold: float = None) -> List[Position]:
        if threshold is None:
            threshold = Config.HEALTH_FACTOR_THRESHOLD
        
        query = gql("""
            query GetRiskyPositions($threshold: BigDecimal!) {
                positions(
                    where: { 
                        healthFactor_lt: $threshold
                        status: ACTIVE
                        borrowed_gt: "0"
                    }
                    orderBy: healthFactor
                    orderDirection: asc
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
            result = self.client.execute(
                query, 
                variable_values={"threshold": str(threshold)}
            )
            
            positions = [
                Position.from_graph_response(pos) 
                for pos in result.get("positions", [])
            ]
            
            logger.debug(f"Found {len(positions)} risky positions from The Graph")
            return positions
            
        except Exception as e:
            logger.error(f"Failed to query The Graph: {e}")
            return []
    
    def get_position_details(self, user_address: str) -> Optional[Position]:
        query = gql("""
            query GetPosition($userId: ID!) {
                position(id: $userId) {
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
            result = self.client.execute(
                query,
                variable_values={"userId": user_address.lower()}
            )
            
            if result.get("position"):
                return Position.from_graph_response(result["position"])
            return None
            
        except Exception as e:
            logger.error(f"Failed to get position details: {e}")
            return None
    
    def get_global_metrics(self) -> dict:
        query = gql("""
            query GetGlobalMetrics {
                globalMetric(id: "global") {
                    totalUsers
                    totalPositions
                    activePositions
                    currentTVL
                    currentBorrowed
                    totalLiquidations
                    updatedAt
                }
            }
        """)
        
        try:
            result = self.client.execute(query)
            return result.get("globalMetric", {})
        except Exception as e:
            logger.error(f"Failed to get global metrics: {e}")
            return {}
    
    def get_liquidation_history(self, limit: int = 10) -> List[dict]:
        query = gql("""
            query GetLiquidations($limit: Int!) {
                liquidations(
                    first: $limit
                    orderBy: timestamp
                    orderDirection: desc
                ) {
                    id
                    user {
                        id
                    }
                    liquidator
                    debtCleared
                    collateralSeized
                    healthFactorBefore
                    timestamp
                    txHash
                }
            }
        """)
        
        try:
            result = self.client.execute(
                query,
                variable_values={"limit": limit}
            )
            return result.get("liquidations", [])
        except Exception as e:
            logger.error(f"Failed to get liquidation history: {e}")
            return []