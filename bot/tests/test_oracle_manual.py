#!/usr/bin/env python3
"""
Manual Oracle Testing Script for LendForge v4.0.0
Tests oracle prices, cached prices, and emergency mode detection
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from clients.web3_client import Web3Client
from config import Config

def main():
    print("=" * 60)
    print("LendForge v4.0.0 - Oracle Manual Test")
    print("=" * 60)

    # Validate config
    Config.validate()

    # Initialize Web3 client
    print("\n[1/4] Initializing Web3 client...")
    client = Web3Client()
    print(f"✓ Connected to Sepolia")
    print(f"✓ Wallet: {client.account.address}")

    # Test current prices
    print("\n[2/4] Getting current prices from OracleAggregator...")
    eth_price = client.get_asset_price(Config.ETH_ADDRESS)
    usdc_price = client.get_asset_price(Config.USDC_TOKEN_ADDRESS)
    dai_price = client.get_asset_price(Config.DAI_TOKEN_ADDRESS)

    print(f"  ETH:  ${eth_price / 10**8:,.2f}")
    print(f"  USDC: ${usdc_price / 10**8:.2f}")
    print(f"  DAI:  ${dai_price / 10**8:.2f}")

    # Test cached prices
    print("\n[3/4] Checking cached prices...")
    for asset_name, asset_addr in [
        ('ETH', Config.ETH_ADDRESS),
        ('USDC', Config.USDC_TOKEN_ADDRESS),
        ('DAI', Config.DAI_TOKEN_ADDRESS)
    ]:
        try:
            cached = client.get_cached_price(asset_addr)
            if cached:
                print(f"  {asset_name}: ${cached['price']/10**8:,.2f} | Updated: {cached['updated_at']} | Source: {cached['source']}")
            else:
                print(f"  {asset_name}: No cached data")
        except Exception as e:
            print(f"  {asset_name}: Cache miss (contract reverted - cache not initialized)")

    # Test emergency mode
    print("\n[4/4] Checking emergency mode status...")
    emergency_mode = client.get_oracle_emergency_mode()
    if emergency_mode:
        print(f"  🚨 EMERGENCY MODE ACTIVE")
    else:
        print(f"  ✓ Normal mode (emergency mode: false)")

    print("\n" + "=" * 60)
    print("Test completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
