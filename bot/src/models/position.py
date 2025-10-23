# bot/src/models/position.py - v1.0 - Position data model
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

@dataclass
class Position:
    user_address: str
    collateral_amount: int  # USD with 8 decimals (multi-collateral total)
    borrowed: int  # USD with 8 decimals
    health_factor: Decimal
    status: str

    # Legacy field for backward compatibility
    collateral: Optional[int] = None  # Deprecated
    collateral_ratio: Optional[int] = None  # Deprecated
    
    # Calculated fields
    collateral_usd: Optional[Decimal] = None
    liquidation_bonus_usd: Optional[Decimal] = None
    expected_profit_usd: Optional[Decimal] = None
    gas_cost_usd: Optional[Decimal] = None
    is_profitable: Optional[bool] = None
    
    @classmethod
    def from_graph_response(cls, data: dict) -> "Position":
        return cls(
            user_address=data["user"]["id"],
            collateral_amount=int(data.get("totalCollateralUSD", data.get("collateral", 0))),
            borrowed=int(data["borrowed"]),
            health_factor=Decimal(data["healthFactor"]),
            status=data["status"],
            # Legacy fields for backward compatibility
            collateral=int(data.get("collateral", 0)),
            collateral_ratio=int(data.get("collateralRatio", 0))
        )
    
    def is_liquidatable(self) -> bool:
        return self.health_factor < Decimal("1.0")
    
    def collateral_usd_decimal(self) -> Decimal:
        """Get collateral value in USD (multi-collateral total)"""
        return Decimal(self.collateral_amount) / Decimal(10**8)

    def collateral_eth(self) -> Decimal:
        """Legacy method - use collateral_usd_decimal() for multi-collateral"""
        if self.collateral:
            return Decimal(self.collateral) / Decimal(10**18)
        return Decimal(0)

    def borrowed_usd_decimal(self) -> Decimal:
        return Decimal(self.borrowed) / Decimal(10**8)
    
    def __repr__(self) -> str:
        return (
            f"Position(user={self.user_address[:8]}..., "
            f"HF={self.health_factor:.2f}, "
            f"debt=${self.borrowed_usd_decimal():.2f})"
        )