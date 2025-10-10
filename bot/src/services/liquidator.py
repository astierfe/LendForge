# bot/src/services/liquidator.py - v1.0 - Liquidation execution service
from typing import Optional
from models.position import Position
from clients.web3_client import Web3Client
from services.profit_calculator import ProfitCalculator
from utils.logger import logger, log_liquidation, log_liquidation_failed

class LiquidationMetrics:
    def __init__(self):
        self.total_liquidations = 0
        self.successful_liquidations = 0
        self.failed_liquidations = 0
        self.total_profit_usd = 0.0
        self.total_gas_spent_usd = 0.0
    
    def record_success(self, profit: float, gas: float):
        self.total_liquidations += 1
        self.successful_liquidations += 1
        self.total_profit_usd += profit
        self.total_gas_spent_usd += gas
    
    def record_failure(self):
        self.total_liquidations += 1
        self.failed_liquidations += 1
    
    def get_summary(self) -> dict:
        return {
            "total_liquidations": self.total_liquidations,
            "successful": self.successful_liquidations,
            "failed": self.failed_liquidations,
            "total_profit_usd": round(self.total_profit_usd, 2),
            "total_gas_spent_usd": round(self.total_gas_spent_usd, 2),
            "net_profit_usd": round(self.total_profit_usd - self.total_gas_spent_usd, 2)
        }

class Liquidator:
    def __init__(self, web3_client: Web3Client, profit_calculator: ProfitCalculator):
        self.web3_client = web3_client
        self.profit_calculator = profit_calculator
        self.metrics = LiquidationMetrics()
    
    def attempt_liquidation(self, position: Position) -> bool:
        logger.info(
            f"Attempting liquidation | user={position.user_address[:10]}... | "
            f"HF={position.health_factor:.2f}"
        )
        
        # Step 1: Verify position is still liquidatable on-chain
        if not self._verify_liquidatable(position):
            log_liquidation_failed(position.user_address, "Not liquidatable on-chain")
            self.metrics.record_failure()
            return False
        
        # Step 2: Calculate profitability
        is_profitable, expected_profit = self.profit_calculator.calculate_profit(position)
        
        if not is_profitable:
            log_liquidation_failed(
                position.user_address, 
                f"Not profitable (expected: ${expected_profit:.2f})"
            )
            self.metrics.record_failure()
            return False
        
        # Step 3: Check gas price
        if not self.profit_calculator.check_gas_price_acceptable():
            log_liquidation_failed(position.user_address, "Gas price too high")
            self.metrics.record_failure()
            return False
        
        # Step 4: Check wallet balance
        debt_amount = self.profit_calculator.calculate_liquidation_amount(position)
        if not self._check_wallet_balance(debt_amount):
            log_liquidation_failed(position.user_address, "Insufficient wallet balance")
            self.metrics.record_failure()
            return False
        
        # Step 5: Execute liquidation
        tx_hash = self.web3_client.execute_liquidation(
            position.user_address,
            debt_amount
        )
        
        if tx_hash:
            log_liquidation(
                position.user_address, 
                float(expected_profit), 
                tx_hash
            )
            self.metrics.record_success(
                float(expected_profit),
                float(position.gas_cost_usd)
            )
            return True
        else:
            log_liquidation_failed(position.user_address, "Transaction failed")
            self.metrics.record_failure()
            return False
    
    def _verify_liquidatable(self, position: Position) -> bool:
        try:
            hf = self.web3_client.get_health_factor(position.user_address)
            hf_decimal = float(hf) / 100.0
            
            is_liquidatable = hf_decimal < 1.0
            
            if not is_liquidatable:
                logger.warning(
                    f"Position no longer liquidatable | "
                    f"user={position.user_address[:10]}... | HF={hf_decimal:.2f}"
                )
            
            return is_liquidatable
            
        except Exception as e:
            logger.error(f"Failed to verify liquidatable status: {e}")
            return False
    
    def _check_wallet_balance(self, required_amount: int) -> bool:
        balance = self.web3_client.get_wallet_balance()
        required_eth = float(required_amount) / 10**18
        
        has_balance = float(balance) >= required_eth
        
        if not has_balance:
            logger.error(
                f"Insufficient balance | required={required_eth:.4f} ETH | "
                f"available={float(balance):.4f} ETH"
            )
        
        return has_balance
    
    def get_metrics(self) -> dict:
        return self.metrics.get_summary()