import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from web3 import Web3
from eth_account import Account
from config import Config
import json

w3 = Web3(Web3.HTTPProvider(Config.SEPOLIA_RPC_URL))
account = Account.from_key(Config.PRIVATE_KEY)

# Charger ABI MockChainlinkFeed
with open("../out/MockChainlinkFeed.sol/MockChainlinkFeed.json") as f:
    feed_abi = json.load(f)["abi"]

chainlink_feed = w3.eth.contract(
    address=Web3.to_checksum_address(Config.CHAINLINK_FEED_ADDRESS),
    abi=feed_abi
)

# Crash -75%
new_price = 50000000000

tx = chainlink_feed.functions.setPrice(new_price).build_transaction({
    'from': account.address,
    'gas': 100000,
    'gasPrice': w3.eth.gas_price,
    'nonce': w3.eth.get_transaction_count(account.address),
    'chainId': 11155111
})

signed = account.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
print(f"Price crashed to $500! Tx: {tx_hash.hex()}")

w3.eth.wait_for_transaction_receipt(tx_hash)
print("✅ Confirmed")