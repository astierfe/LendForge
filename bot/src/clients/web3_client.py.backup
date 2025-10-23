# bot/src/clients/web3_client.py - v1.1 - Fix transaction signing
import json
from decimal import Decimal
from typing import Tuple, Optional
from web3 import Web3
from web3.exceptions import ContractLogicError
from eth_account import Account
from config import Config
from utils.logger import logger

class Web3Client:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(Config.SEPOLIA_RPC_URL))
        
        if not self.w3.is_connected():
            raise ConnectionError("Failed to connect to Sepolia RPC")
        
        # Load ABIs
        with open(Config.LENDING_POOL_ABI_PATH) as f:
            lending_pool_abi = json.load(f)["abi"]
        
        with open(Config.ORACLE_ABI_PATH) as f:
            oracle_abi = json.load(f)["abi"]
        
        # Initialize contracts
        self.lending_pool = self.w3.eth.contract(
            address=Web3.to_checksum_address(Config.LENDING_POOL_ADDRESS),
            abi=lending_pool_abi
        )
        
        self.oracle = self.w3.eth.contract(
            address=Web3.to_checksum_address(Config.ORACLE_ADDRESS),
            abi=oracle_abi
        )
        
        # Setup account
        self.account = Account.from_key(Config.PRIVATE_KEY)
        logger.info(f"Web3Client initialized | wallet={self.account.address}")
    
    def get_eth_price(self) -> int:
        try:
            price = self.oracle.functions.getLatestPrice().call()
            logger.debug(f"ETH price from oracle: ${price / 10**8}")
            return price
        except Exception as e:
            logger.error(f"Failed to get ETH price: {e}")
            return 2000_00000000  # Fallback $2000
    
    def get_position_onchain(self, user_address: str) -> Tuple[int, int, int]:
        try:
            position = self.lending_pool.functions.getPosition(
                Web3.to_checksum_address(user_address)
            ).call()
            
            collateral, borrowed, last_update, interest = position
            logger.debug(
                f"Position on-chain | user={user_address[:10]}... | "
                f"collateral={collateral} | borrowed={borrowed}"
            )
            return collateral, borrowed, last_update
            
        except Exception as e:
            logger.error(f"Failed to get position on-chain: {e}")
            return 0, 0, 0
    
    def get_health_factor(self, user_address: str) -> int:
        try:
            hf = self.lending_pool.functions.getHealthFactor(
                Web3.to_checksum_address(user_address)
            ).call()
            return hf
        except Exception as e:
            logger.error(f"Failed to get health factor: {e}")
            return 999999
    
    def estimate_gas_price(self) -> int:
        try:
            gas_price = self.w3.eth.gas_price
            gas_price_gwei = gas_price / 10**9
            
            if gas_price_gwei > Config.MAX_GAS_PRICE_GWEI:
                logger.warning(
                    f"Gas price too high: {gas_price_gwei:.2f} gwei "
                    f"(max: {Config.MAX_GAS_PRICE_GWEI})"
                )
            
            return gas_price
            
        except Exception as e:
            logger.error(f"Failed to estimate gas price: {e}")
            return 20 * 10**9  # Fallback 20 gwei
    
    def build_liquidation_tx(self, user_address: str, debt_amount: int) -> dict:
        user_checksum = Web3.to_checksum_address(user_address)
        
        tx = self.lending_pool.functions.liquidate(user_checksum).build_transaction({
            'from': self.account.address,
            'value': debt_amount,
            'gas': 500000,
            'gasPrice': self.estimate_gas_price(),
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'chainId': 11155111  # Sepolia
        })
        
        return tx
    
    def execute_liquidation(
        self, 
        user_address: str, 
        debt_amount: int
    ) -> Optional[str]:
        try:
            logger.info(
                f"Building liquidation tx | user={user_address[:10]}... | "
                f"debt=${debt_amount / 10**8:.2f}"
            )
            
            tx = self.build_liquidation_tx(user_address, debt_amount)
            
            # Sign transaction
            signed_tx = self.account.sign_transaction(tx)
            
            # FIX: Correct attribute name (underscore not camelCase)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash_hex = tx_hash.hex()
            
            logger.info(f"Liquidation tx sent | tx_hash={tx_hash_hex[:10]}...")
            
            # Wait for confirmation
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
            
            if receipt.status == 1:
                logger.info(f"Liquidation confirmed | tx_hash={tx_hash_hex}")
                return tx_hash_hex
            else:
                logger.error(f"Liquidation failed | tx_hash={tx_hash_hex}")
                return None
                
        except ContractLogicError as e:
            logger.error(f"Contract reverted: {e}")
            return None
        except Exception as e:
            logger.error(f"Liquidation execution failed: {e}")
            return None
    
    def get_wallet_balance(self) -> Decimal:
        balance_wei = self.w3.eth.get_balance(self.account.address)
        return Decimal(balance_wei) / Decimal(10**18)