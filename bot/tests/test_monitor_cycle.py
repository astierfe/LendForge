#!/usr/bin/env python3
"""
Bot Monitor Cycle Testing for LendForge v4.0.0
Tests a complete monitoring cycle with real Sepolia data
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from clients.web3_client import Web3Client
from clients.graph_client import GraphClient
from services.position_monitor import PositionMonitor
from services.liquidator import Liquidator
from services.profit_calculator import ProfitCalculator
from config import Config

def main():
    print("=" * 80)
    print("LendForge v4.0.0 - Bot Monitor Cycle Test")
    print("=" * 80)

    # Validate config
    Config.validate()

    # Initialize clients
    print("\n[1/4] Initializing bot components...")
    web3_client = Web3Client()
    graph_client = GraphClient()
    profit_calc = ProfitCalculator(web3_client)
    liquidator = Liquidator(web3_client, profit_calc)
    monitor = PositionMonitor(graph_client, web3_client, liquidator)

    print(f"✓ Web3 connected to Sepolia")
    print(f"✓ Graph connected to: {Config.SUBGRAPH_URL[:60]}...")
    print(f"✓ Bot wallet: {web3_client.account.address}")

    # Check wallet balance
    wallet_balance = web3_client.get_wallet_balance()
    print(f"✓ Wallet balance: {wallet_balance:.4f} ETH")

    # Check emergency mode
    print("\n[2/4] Checking oracle status...")
    emergency_mode = web3_client.get_oracle_emergency_mode()
    if emergency_mode:
        print("  🚨 WARNING: Emergency mode is ACTIVE - borrowing may be blocked")
    else:
        print("  ✓ Emergency mode: false (normal operation)")

    # Check protocol status
    print("\n[3/4] Querying protocol status from subgraph...")
    try:
        status = monitor.get_status()
        print(f"  Protocol TVL:         ${status['protocol']['tvl']}")
        print(f"  Total Borrowed:       ${status['protocol']['borrowed']}")
        print(f"  Active Positions:     {status['protocol']['active_positions']}")
        print(f"  Total Liquidations:   {status['protocol']['total_liquidations']}")
    except Exception as e:
        print(f"  ⚠️  Could not fetch protocol status: {e}")

    # Run monitor cycle
    print("\n[4/4] Running monitor cycle...")
    print("=" * 80)

    try:
        result = monitor.monitor_cycle()

        print("\n" + "=" * 80)
        print("MONITOR CYCLE RESULTS")
        print("=" * 80)
        print(f"  Risky Positions Found:    {result['risky_count']}")
        print(f"  Profitable Liquidations:  {result['profitable_count']}")
        print(f"  Successfully Liquidated:  {result['liquidated_count']}")

        if result['risky_count'] == 0:
            print("\n  ✓ No positions at risk - protocol is healthy!")
        elif result['liquidated_count'] > 0:
            print(f"\n  ✅ Successfully liquidated {result['liquidated_count']} position(s)")
        elif result['profitable_count'] == 0:
            print("\n  ⚠️  Found risky positions but none were profitable to liquidate")
        else:
            print(f"\n  ⚠️  Found {result['profitable_count']} profitable opportunities but liquidation failed")

        print("\n" + "=" * 80)
        print("Monitor cycle completed successfully!")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ Monitor cycle failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
