#!/usr/bin/env python3
"""
Multi-Collateral Position Testing for LendForge v4.0.0
Tests position analysis with multiple collateral assets
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "tests/"))

from clients.web3_client import Web3Client
from clients.graph_client import GraphClient
from services.position_monitor import PositionMonitor
from services.liquidator import Liquidator
from services.profit_calculator import ProfitCalculator
from config import Config

def main():
    print("=" * 80)
    print("LendForge v4.0.0 - Multi-Collateral Position Test")
    print("=" * 80)

    # Validate config (populates USDC/DAI in COLLATERAL_CONFIGS)
    Config.validate()

    # Initialize clients
    print("\n[1/4] Initializing clients...")
    web3_client = Web3Client()
    graph_client = GraphClient()
    profit_calc = ProfitCalculator(web3_client)
    liquidator = Liquidator(web3_client, profit_calc)
    monitor = PositionMonitor(graph_client, web3_client, liquidator)

    print(f"✓ Web3 connected")
    print(f"✓ Wallet: {web3_client.account.address}")

    # User to analyze
    user_address = "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01"
    print(f"\n[2/4] Analyzing position for: {user_address}")

    # Get raw collateral data
    print("\n[3/4] Fetching collateral data...")
    collaterals = web3_client.get_user_collaterals(user_address)

    if not collaterals:
        print("  ⚠️  No collateral found for this user")
        print("\n  To deposit collateral:")
        print(f"    1. ETH: Send ETH with depositCollateral(address,uint256) where amount is msg.value")
        print(f"    2. USDC: Approve then depositCollateral({Config.USDC_TOKEN_ADDRESS}, amount)")
        print(f"    3. DAI: Approve then depositCollateral({Config.DAI_TOKEN_ADDRESS}, amount)")
        return

    print(f"  ✓ Found {len(collaterals)} collateral asset(s):")
    for coll in collaterals:
        asset_config = Config.COLLATERAL_CONFIGS.get(coll['asset'], {})
        decimals = asset_config.get('decimals', 18)
        amount_human = coll['amount'] / 10**decimals
        print(f"    - {coll['symbol']:5s}: {amount_human:,.6f} (LTV: {asset_config.get('ltv', 0)}%)")

    # Get position details
    collateral_usd = web3_client.get_collateral_value_usd(user_address)
    max_borrow = web3_client.get_max_borrow_value(user_address)
    _, borrowed, last_update = web3_client.get_position_onchain(user_address)
    hf_raw = web3_client.get_health_factor(user_address)

    print(f"\n  Position Summary:")
    print(f"    Collateral Value: ${collateral_usd / 10**8:,.2f}")
    print(f"    Max Borrow:       ${max_borrow / 10**8:,.2f}")
    print(f"    Borrowed:         ${borrowed / 10**8:,.2f}")
    if hf_raw == 2**256 - 1:
        print(f"    Health Factor:    ∞ (no debt)")
    else:
        print(f"    Health Factor:    {hf_raw / 100:.2f}")

    # Analyze with monitor
    print("\n[4/4] Running multi-collateral analysis...")
    result = monitor.analyze_multi_collateral_position(user_address)

    if 'error' in result:
        print(f"  ❌ Analysis failed: {result['error']}")
        return

    print("\n" + "=" * 80)
    print("MULTI-COLLATERAL ANALYSIS RESULTS")
    print("=" * 80)
    print(f"  User:               {result['user_address'][:10]}...{result['user_address'][-8:]}")
    print(f"  Health Factor:      {result['health_factor']:.2f}")
    print(f"  Collateral USD:     ${result['collateral_usd']:,.2f}")
    print(f"  Borrowed USD:       ${result['borrowed_usd']:,.2f}")
    print(f"  Max Borrow USD:     ${result['max_borrow_usd']:,.2f}")
    print(f"  Utilization:        {result['utilization_percent']:.2f}%")
    print(f"  Asset Count:        {result['asset_count']}")
    print(f"  Risk Level:         {result['risk_level']}")
    print(f"  Liquidatable:       {result['is_liquidatable']}")
    print(f"  Liq. Distance:      {result['liquidation_distance_percent']:.2f}%")

    print(f"\n  Asset Breakdown:")
    for asset in result['asset_breakdown']:
        print(f"    - {asset['symbol']:5s}: {asset['amount']:>12,.6f} | "
              f"LTV: {asset['ltv']:>2d}% | "
              f"Threshold: {asset['liquidation_threshold']:>2d}%")

    print("\n" + "=" * 80)
    print("Test completed successfully!")
    print("=" * 80)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
