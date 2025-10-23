# bot/src/services/profit_calculator.py - v2.0 - Multi-asset liquidation support
from decimal import Decimal
from typing import Tuple
from config import Config
from models.position import Position
from clients.web3_client import Web3Client
from utils.logger import logger

class ProfitCalculator:
    def __init__(self, web3_client: Web3Client):
        self.web3_client = web3_client
    
    def calculate_profit(self, position: Position) -> Tuple[bool, Decimal]:
        """Calculate liquidation profit for multi-collateral position"""
        try:
            return self._calculate_multi_asset_profit(position)
        except Exception as e:
            logger.error(f"Failed to calculate profit for {position.user_address}: {e}")
            return False, Decimal("0")

    def _calculate_multi_asset_profit(self, position: Position) -> Tuple[bool, Decimal]:
        """Enhanced profit calculation for multi-collateral liquidation"""
        user_address = position.user_address

        # Get comprehensive position data
        collaterals = self.web3_client.get_user_collaterals(user_address)
        total_collateral_usd = self.web3_client.get_collateral_value_usd(user_address)
        _, borrowed, _ = self.web3_client.get_position_onchain(user_address)

        # Convert to decimal USD values
        collateral_usd_decimal = Decimal(total_collateral_usd) / Decimal(10**Config.USD_DECIMALS)
        debt_usd_decimal = Decimal(borrowed) / Decimal(10**Config.USD_DECIMALS)

        logger.info(
            f"Multi-asset profit calc | user={user_address[:10]}... | "
            f"Assets={len(collaterals)} | "
            f"Collateral=${collateral_usd_decimal:.2f} | "
            f"Debt=${debt_usd_decimal:.2f}"
        )
        
        # Calculate liquidation bonus (10% of debt in USD)
        liquidation_bonus_usd = debt_usd_decimal * Decimal(Config.LIQUIDATION_BONUS)

        # Calculate total collateral to seize (debt + bonus)
        total_seized_usd = debt_usd_decimal + liquidation_bonus_usd

        # Verify sufficient collateral available
        if total_seized_usd > collateral_usd_decimal:
            logger.warning(
                f"Insufficient collateral | Required=${total_seized_usd:.2f} | "
                f"Available=${collateral_usd_decimal:.2f}"
            )
            # Cap to available collateral
            total_seized_usd = collateral_usd_decimal
            liquidation_bonus_usd = total_seized_usd - debt_usd_decimal

        # Log detailed collateral breakdown
        for collateral in collaterals:
            asset_config = Config.COLLATERAL_CONFIGS.get(collateral['asset'], {})
            amount_human = collateral['amount'] / 10**asset_config.get('decimals', 18)
            logger.debug(
                f"Asset: {collateral['symbol']} | "
                f"Amount: {amount_human:.6f} | "
                f"LTV: {asset_config.get('ltv', 0)}%"
            )

        logger.info(
            f"Liquidation calculation | "
            f"Total seized: ${total_seized_usd:.2f} | "
            f"Bonus: ${liquidation_bonus_usd:.2f}"
        )
        
        # Estimate gas cost (higher for multi-asset liquidation)
        gas_cost_usd = self._estimate_multi_asset_gas_cost(len(collaterals))
        
        logger.info(f"Multi-asset gas cost: ${gas_cost_usd:.2f}")
        
        # Calculate net profit
        net_profit_usd = liquidation_bonus_usd - gas_cost_usd

        # Check if profitable
        is_profitable = net_profit_usd >= Decimal(Config.MIN_PROFIT_USD)

        # Store calculated values in position
        position.collateral_usd = collateral_usd_decimal
        position.liquidation_bonus_usd = liquidation_bonus_usd
        position.gas_cost_usd = gas_cost_usd
        position.expected_profit_usd = net_profit_usd
        position.is_profitable = is_profitable

        logger.info(
            f"✓ Multi-asset profit calc | user={user_address[:10]}... | "
            f"Collateral=${collateral_usd_decimal:.2f} | "
            f"Debt=${debt_usd_decimal:.2f} | "
            f"Bonus=${liquidation_bonus_usd:.2f} | "
            f"Gas=${gas_cost_usd:.2f} | "
            f"Profit=${net_profit_usd:.2f} | "
            f"Profitable={is_profitable} | "
            f"Assets={len(collaterals)}"
        )

        return is_profitable, net_profit_usd
    
    def _estimate_multi_asset_gas_cost(self, asset_count: int) -> Decimal:
        """Estimate gas cost for multi-asset liquidation"""
        gas_price_wei = self.web3_client.estimate_gas_price()
        gas_price_gwei = Decimal(gas_price_wei) / Decimal(10**9)

        # Base liquidation gas + additional cost per asset
        base_gas = 300000
        additional_gas_per_asset = 50000  # Extra gas for complex liquidations
        estimated_gas_units = base_gas + (asset_count * additional_gas_per_asset)

        # Get ETH price for USD conversion
        eth_price_usd = self.web3_client.get_asset_price(Config.ETH_ADDRESS)
        eth_price_decimal = Decimal(eth_price_usd) / Decimal(10**Config.USD_DECIMALS)

        # Calculate cost in ETH
        gas_cost_eth = (gas_price_gwei * Decimal(estimated_gas_units)) / Decimal(10**9)

        # Convert to USD
        gas_cost_usd = gas_cost_eth * eth_price_decimal

        logger.debug(
            f"Multi-asset gas estimation | price={gas_price_gwei:.2f} gwei | "
            f"base_units={base_gas} | assets={asset_count} | "
            f"total_units={estimated_gas_units} | cost=${gas_cost_usd:.2f}"
        )

        return gas_cost_usd
    
    def calculate_liquidation_amount(self, position: Position) -> int:
        """Calculate total debt amount to repay in liquidation"""
        # For multi-collateral, liquidate full debt position
        _, borrowed, _ = self.web3_client.get_position_onchain(position.user_address)
        return borrowed

    def get_liquidation_summary(self, position: Position) -> dict:
        """Get detailed liquidation summary for multi-asset position"""
        try:
            user_address = position.user_address
            collaterals = self.web3_client.get_user_collaterals(user_address)
            collateral_usd = self.web3_client.get_collateral_value_usd(user_address)
            _, borrowed, _ = self.web3_client.get_position_onchain(user_address)

            return {
                'user_address': user_address,
                'total_debt_usd': borrowed / 10**Config.USD_DECIMALS,
                'total_collateral_usd': collateral_usd / 10**Config.USD_DECIMALS,
                'asset_count': len(collaterals),
                'assets': [{
                    'symbol': c['symbol'],
                    'amount': c['amount'] / 10**Config.COLLATERAL_CONFIGS.get(c['asset'], {}).get('decimals', 18),
                    'asset_address': c['asset']
                } for c in collaterals],
                'liquidation_bonus_usd': position.liquidation_bonus_usd if hasattr(position, 'liquidation_bonus_usd') else 0,
                'expected_profit_usd': position.expected_profit_usd if hasattr(position, 'expected_profit_usd') else 0,
                'is_profitable': position.is_profitable if hasattr(position, 'is_profitable') else False
            }
        except Exception as e:
            logger.error(f"Failed to get liquidation summary: {e}")
            return {'error': str(e)}
    
    def check_gas_price_acceptable(self) -> bool:
        gas_price_wei = self.web3_client.estimate_gas_price()
        gas_price_gwei = gas_price_wei / 10**9
        
        acceptable = gas_price_gwei <= Config.MAX_GAS_PRICE_GWEI
        
        if not acceptable:
            logger.warning(
                f"Gas price too high: {gas_price_gwei:.2f} gwei "
                f"(max: {Config.MAX_GAS_PRICE_GWEI})"
            )
        
        return acceptable