# bot/scripts/create_test_position.py - v1.0
# Script pour créer une position liquidatable sur Sepolia
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from config import Config
from web3 import Web3
from eth_account import Account
import json
import time

def main():
    print("=" * 60)
    print("Creating Test Liquidatable Position")
    print("=" * 60)
    
    # Connect to Sepolia
    w3 = Web3(Web3.HTTPProvider(Config.SEPOLIA_RPC_URL))
    account = Account.from_key(Config.PRIVATE_KEY)
    
    print(f"Wallet: {account.address}")
    print(f"Balance: {w3.eth.get_balance(account.address) / 10**18:.4f} ETH")
    
    # Load contracts
    with open(Config.LENDING_POOL_ABI_PATH) as f:
        lending_pool_abi = json.load(f)["abi"]
    
    with open(Config.ORACLE_ABI_PATH) as f:
        oracle_abi = json.load(f)["abi"]
    
    lending_pool = w3.eth.contract(
        address=Web3.to_checksum_address(Config.LENDING_POOL_ADDRESS),
        abi=lending_pool_abi
    )
    
    oracle = w3.eth.contract(
        address=Web3.to_checksum_address(Config.ORACLE_ADDRESS),
        abi=oracle_abi
    )
    
    # Step 1: Deposit 0.1 ETH as collateral
    print("\n1. Depositing 0.1 ETH as collateral...")
    
    deposit_tx = lending_pool.functions.depositCollateral().build_transaction({
        'from': account.address,
        'value': int(0.1 * 10**18),
        'gas': 200000,
        'gasPrice': w3.eth.gas_price,
        'nonce': w3.eth.get_transaction_count(account.address),
        'chainId': 11155111
    })
    
    signed_deposit = account.sign_transaction(deposit_tx)
    deposit_hash = w3.eth.send_raw_transaction(signed_deposit.raw_transaction)
    print(f"   Tx sent: {deposit_hash.hex()}")
    
    w3.eth.wait_for_transaction_receipt(deposit_hash)
    print("   ✅ Deposit confirmed")
    
    # Step 2: Get current ETH price
    eth_price = oracle.functions.getLatestPrice().call()
    print(f"\n2. Current ETH price: ${eth_price / 10**8:.2f}")
    
    # Step 3: Borrow near max (66% LTV)
    collateral_usd = (0.1 * eth_price) / 10**8
    max_borrow = int(collateral_usd * 0.66)
    borrow_amount = int(max_borrow * 10**8)  # Convert to 8 decimals
    
    print(f"\n3. Borrowing ${max_borrow:.2f} (max LTV)...")
    
    borrow_tx = lending_pool.functions.borrow(borrow_amount).build_transaction({
        'from': account.address,
        'gas': 300000,
        'gasPrice': w3.eth.gas_price,
        'nonce': w3.eth.get_transaction_count(account.address),
        'chainId': 11155111
    })
    
    signed_borrow = account.sign_transaction(borrow_tx)
    borrow_hash = w3.eth.send_raw_transaction(signed_borrow.raw_transaction)
    print(f"   Tx sent: {borrow_hash.hex()}")
    
    w3.eth.wait_for_transaction_receipt(borrow_hash)
    print("   ✅ Borrow confirmed")
    
    # Step 4: Check health factor
    hf = lending_pool.functions.getHealthFactor(account.address).call()
    print(f"\n4. Initial Health Factor: {hf / 100:.2f}")
    
    # Step 5: Simulate price drop (admin only)
    print("\n5. To make position liquidatable:")
    print(f"   Run on Etherscan (owner only):")
    print(f"   Oracle.setPrice({int(eth_price * 0.7)})  # -30% drop")
    print(f"\n   Or use cast:")
    print(f"   cast send {Config.ORACLE_ADDRESS} \\")
    print(f"     'setPrice(int256)' {int(eth_price * 0.7)} \\")
    print(f"     --rpc-url $SEPOLIA_RPC_URL \\")
    print(f"     --private-key $PRIVATE_KEY")
    
    print("\n" + "=" * 60)
    print("Position created successfully!")
    print(f"User: {account.address}")
    print(f"Collateral: 0.1 ETH")
    print(f"Borrowed: ${max_borrow:.2f}")
    print(f"Health Factor: {hf / 100:.2f}")
    print("=" * 60)

if __name__ == "__main__":
    main()