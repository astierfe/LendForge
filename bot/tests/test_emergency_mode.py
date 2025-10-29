#!/usr/bin/env python3
"""
Emergency Mode Testing Script for LendForge v4.0.0
Tests emergency mode activation and bot detection
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from clients.web3_client import Web3Client
from config import Config

def main():
    print("=" * 60)
    print("LendForge v4.0.0 - Emergency Mode Test")
    print("=" * 60)

    # Validate config
    Config.validate()

    # Initialize Web3 client
    print("\n[1/3] Initializing Web3 client...")
    client = Web3Client()
    print(f"✓ Connected to Sepolia")
    print(f"✓ Wallet: {client.account.address}")

    # Check current emergency mode status
    print("\n[2/3] Checking current emergency mode status...")
    emergency_before = client.get_oracle_emergency_mode()
    print(f"  Emergency Mode (before): {emergency_before}")

    if emergency_before:
        print("\n⚠️  Emergency mode is already ACTIVE")
        print("    To deactivate, run this command:")
        print(f"\n    cast send {Config.ORACLE_AGGREGATOR_ADDRESS} \"setEmergencyMode(bool)\" false \\")
        print(f"      --rpc-url {Config.SEPOLIA_RPC_URL} \\")
        print(f"      --private-key {Config.PRIVATE_KEY[:10]}...\\n")
    else:
        print("\n✓ Emergency mode is currently INACTIVE")
        print("\n[3/3] To activate emergency mode, run this command:")
        print(f"\n    cast send {Config.ORACLE_AGGREGATOR_ADDRESS} \"setEmergencyMode(bool)\" true \\")
        print(f"      --rpc-url {Config.SEPOLIA_RPC_URL} \\")
        print(f"      --private-key {Config.PRIVATE_KEY[:10]}...\\n")
        print("Then re-run this script to verify activation.")

    print("\n" + "=" * 60)
    print("Emergency mode detection test completed!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
