# bot/src/services/profit_calculator.py - v1.1 - Debug profitability
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
        # Get current ETH price
        eth_price_usd = self.web3_client.get_eth_price()
        eth_price_decimal = Decimal(eth_price_usd) / Decimal(10**Config.USD_DECIMALS)
        
        # DEBUG: Log prix oracle
        logger.info(f"DEBUG Profit Calc | Oracle price raw: {eth_price_usd}")
        logger.info(f"DEBUG Profit Calc | Oracle price decimal: ${eth_price_decimal:.2f}")
        
        # Calculate collateral value in USD
        collateral_eth = position.collateral_eth()
        collateral_usd = collateral_eth * eth_price_decimal
        
        logger.info(f"DEBUG Profit Calc | Collateral: {collateral_eth:.4f} ETH = ${collateral_usd:.2f}")
        
        # Calculate debt in USD
        debt_usd = position.borrowed_usd_decimal()
        
        logger.info(f"DEBUG Profit Calc | Debt: ${debt_usd:.2f}")
        
        # Calculate collateral to seize (debt / eth_price * 1.1 bonus)
        collateral_seized_eth = (debt_usd / eth_price_decimal) * Decimal(1 + Config.LIQUIDATION_BONUS)
        
        logger.info(
            f"DEBUG Profit Calc | Collateral to seize (with bonus): "
            f"{collateral_seized_eth:.6f} ETH"
        )
        
        # Cap to available collateral
        if collateral_seized_eth > collateral_eth:
            logger.info(
                f"DEBUG Profit Calc | Capping seized collateral "
                f"from {collateral_seized_eth:.6f} to {collateral_eth:.6f} ETH"
            )
            collateral_seized_eth = collateral_eth
        
        # Calculate liquidation bonus in USD
        collateral_seized_usd = collateral_seized_eth * eth_price_decimal
        liquidation_bonus_usd = collateral_seized_usd - debt_usd
        
        logger.info(
            f"DEBUG Profit Calc | Seized value: ${collateral_seized_usd:.2f} | "
            f"Bonus: ${liquidation_bonus_usd:.2f}"
        )
        
        # Estimate gas cost
        gas_cost_usd = self._estimate_gas_cost(eth_price_decimal)
        
        logger.info(f"DEBUG Profit Calc | Gas cost: ${gas_cost_usd:.2f}")
        
        # Calculate net profit
        net_profit_usd = liquidation_bonus_usd - gas_cost_usd
        
        logger.info(
            f"DEBUG Profit Calc | Net profit: ${net_profit_usd:.2f} | "
            f"Min required: ${Config.MIN_PROFIT_USD}"
        )
        
        # Check if profitable
        is_profitable = net_profit_usd >= Decimal(Config.MIN_PROFIT_USD)
        
        # Store calculated values in position
        position.collateral_usd = collateral_usd
        position.liquidation_bonus_usd = liquidation_bonus_usd
        position.gas_cost_usd = gas_cost_usd
        position.expected_profit_usd = net_profit_usd
        position.is_profitable = is_profitable
        
        logger.debug(
            f"Profit calculation | user={position.user_address[:10]}... | "
            f"bonus=${liquidation_bonus_usd:.2f} | gas=${gas_cost_usd:.2f} | "
            f"profit=${net_profit_usd:.2f} | profitable={is_profitable}"
        )
        
        return is_profitable, net_profit_usd
    
    def _estimate_gas_cost(self, eth_price_decimal: Decimal) -> Decimal:
        gas_price_wei = self.web3_client.estimate_gas_price()
        gas_price_gwei = Decimal(gas_price_wei) / Decimal(10**9)
        
        # Estimate gas usage (based on tests)
        estimated_gas_units = 300000
        
        # Calculate cost in ETH
        gas_cost_eth = (gas_price_gwei * Decimal(estimated_gas_units)) / Decimal(10**9)
        
        # Convert to USD
        gas_cost_usd = gas_cost_eth * eth_price_decimal
        
        logger.debug(
            f"Gas estimation | price={gas_price_gwei:.2f} gwei | "
            f"units={estimated_gas_units} | cost=${gas_cost_usd:.2f}"
        )
        
        return gas_cost_usd
    
    def calculate_liquidation_amount(self, position: Position) -> int:
        # Return debt amount to pay (in wei with 8 decimals)
        return position.borrowed
    
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