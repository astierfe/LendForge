#!/bin/bash

# transfer_liquidated_collateral.sh v2.0 - Proportional Collateral Transfer
#
# RUSTINE - Transfert manuel du collateral après liquidation
# Ce script doit être exécuté MANUELLEMENT après chaque liquidation
# En attendant de fixer le bug dans LendingPool.liquidate()
#
# v2.0 Features:
# - Reads collateralToSeizeUSD from Liquidated event
# - Calculates proportional amounts per asset based on oracle prices
# - Transfers only the calculated amount (not 100% of collateral)
# - Dry-run mode for testing calculations
# - Backward compatible (fallback to v1.0 behavior with warning)
#
# Usage:
#   TX_HASH=0x... ./transfer_liquidated_collateral.sh          # Proportional transfer (v2.0)
#   DRY_RUN=1 TX_HASH=0x... ./transfer_liquidated_collateral.sh # Test calculations only
#   ./transfer_liquidated_collateral.sh                         # Legacy v1.0 (NOT RECOMMENDED)

set -e

echo "=== RUSTINE v2.0: Transfert proportionnel du collateral liquidé ==="
echo ""

# Load environment variables
source .env

# Addresses
USER=$USER_ADDRESS
LIQUIDATOR=$LIQUIDATOR_WALLET
LENDING_POOL=$LENDING_POOL_ADDRESS
COLLATERAL_MANAGER=$COLLATERAL_MANAGER_ADDRESS
ORACLE_AGGREGATOR=$ORACLE_AGGREGATOR_ADDRESS
USDC_TOKEN=$USDC_TOKEN_ADDRESS
DAI_TOKEN=$DAI_TOKEN_ADDRESS
ETH_ADDRESS="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

# User's private key (needed to withdraw their collateral)
USER_KEY=$USER_PRIVATE_KEY

echo "Liquidated User: $USER"
echo "Liquidator: $LIQUIDATOR"
echo "Lending Pool: $LENDING_POOL"
echo ""

# ===== NEW: EVENT READING LOGIC =====

# Function to read collateralToSeizeUSD from Liquidated event
get_collateral_to_seize() {
    local tx_hash=$1

    local receipt=$(cast receipt $tx_hash --json --rpc-url $SEPOLIA_RPC_URL)

    # Event topic: keccak256("Liquidated(address,address,uint256,uint256)")
    local liquidated_topic="0x1f0c6615429d1cdae0dfa233abf91d3b31cdbdd82c8081389832a61e1072f1ea"

    echo "  Looking for Liquidated event from LendingPool: $LENDING_POOL" >&2

    # Use Python to parse JSON correctly and find the right log
    local data=$(echo "$receipt" | python -c "
import sys, json
receipt = json.load(sys.stdin)
lending_pool = '$LENDING_POOL'.lower()
liquidated_topic = '$liquidated_topic'

for log in receipt.get('logs', []):
    # Check if this log is from LendingPool AND has Liquidated topic
    if log.get('address', '').lower() == lending_pool:
        topics = log.get('topics', [])
        if len(topics) > 0 and topics[0] == liquidated_topic:
            print(log.get('data', ''))
            break
" 2>&1)

    if [ -z "$data" ] || [ "$data" == "None" ]; then
        echo "❌ ERROR: Liquidated event not found in transaction" >&2
        echo "   Make sure the transaction is a successful liquidation from LendingPool" >&2
        exit 1
    fi

    # Remove 0x prefix
    data=${data#0x}

    # Liquidated event has ONLY 2 uint256: debtRepaid and collateralSeized
    # If data is longer than 128 chars, we extracted the wrong event
    if [ ${#data} -gt 128 ]; then
        echo "  ⚠️  Warning: Data too long (${#data} chars), expected 128 for Liquidated event" >&2
        echo "  This might be a different event (e.g., PriceFeedUpdated from Oracle)" >&2
        echo "  Full data: $data" >&2
        echo "" >&2
        echo "❌ ERROR: Wrong event extracted - not a Liquidated event" >&2
        exit 1
    fi

    # Extract debtRepaid (first uint256, bytes 0-64)
    local debt_repaid_hex="0x${data:0:64}"

    # Extract collateralSeized (second uint256, bytes 64-128)
    local collateral_seized_hex="0x${data:64:64}"

    echo "  Debug: debtRepaid = $debt_repaid_hex" >&2
    echo "  Debug: collateralSeized = $collateral_seized_hex" >&2
    echo "" >&2

    # Convert to decimal (remove scientific notation if any)
    local collateral_seized_dec=$(cast --to-dec $collateral_seized_hex | awk '{print $1}')
    local debt_repaid_dec=$(cast --to-dec $debt_repaid_hex | awk '{print $1}')

    # IMPORTANT: The contract emits collateralSeized in ETH (18 decimals), NOT USD!
    # We need to convert it to USD for the proportional calculation
    # collateralSeized = 0.495 ETH (debt + bonus)
    # collateralSeizedUSD = 0.495 ETH × $3450/ETH = $1707.75 USD

    local eth_price=$(get_oracle_price $ETH_ADDRESS)
    eth_price=${eth_price#-}  # Remove negative sign if any

    # Convert ETH to USD: (collateral_eth_18dec * eth_price_8dec) / 10^8 = USD_18dec
    # Result should maintain 18 decimal places
    local collateral_seized_usd=$(python -c "print(int(($collateral_seized_dec * $eth_price) // 10**8))")

    local eth_display=$(divide_by_decimals $collateral_seized_dec 18)
    local usd_display=$(divide_by_decimals $collateral_seized_usd 18)

    echo "  Debt repaid: $debt_repaid_dec wei (~$(divide_by_decimals $debt_repaid_dec 18) ETH)" >&2
    echo "  collateralSeized (from event): $collateral_seized_dec wei ETH (~$eth_display ETH)" >&2
    echo "  collateralSeized in USD: $collateral_seized_usd wei (~$usd_display USD with 18 decimals)" >&2
    echo "" >&2

    # Return USD value with 18 decimals
    echo "$collateral_seized_usd"
}

# Helper function to divide by 10^decimals (no bc dependency)
divide_by_decimals() {
    local amount=$1
    local decimals=$2
    local divisor=1

    case $decimals in
        6) divisor=1000000 ;;
        8) divisor=100000000 ;;
        18) divisor=1000000000000000000 ;;
        *) divisor=1 ;;
    esac

    echo $((amount / divisor))
}

# Function to get oracle price for asset (returns price in 8 decimals Chainlink format)
get_oracle_price() {
    local asset=$1
    local price=$(cast call $ORACLE_AGGREGATOR \
        "getPrice(address)(int256)" \
        $asset \
        --rpc-url $SEPOLIA_RPC_URL)

    # Remove scientific notation and brackets [2e7] -> extract just the number
    # cast sometimes returns: 20000000 [2e7]
    price=$(echo "$price" | awk '{print $1}')

    echo "$price"
}

# Function to get user's collateral balance
get_balance() {
    local asset=$1
    local balance=$(cast call $COLLATERAL_MANAGER \
        "getUserCollateralBalance(address,address)(uint256)" \
        $USER $asset \
        --rpc-url $SEPOLIA_RPC_URL)

    # Remove scientific notation [6e20] -> extract just the number
    balance=$(echo "$balance" | awk '{print $1}')

    echo "$balance"
}

# ===== PROPORTIONAL CALCULATION LOGIC =====

# Function to calculate how much of each asset to seize
calculate_seize_amount() {
    local asset=$1
    local symbol=$2
    local decimals=$3
    local balance=$4
    local collateral_to_seize_usd=$5

    if [ "$balance" == "0" ]; then
        echo "0"
        return
    fi

    # Get oracle price (8 decimals)
    local price=$(get_oracle_price $asset)

    # Convert price to absolute value (in case it's negative due to int256)
    price=${price#-}

    local price_display=$(divide_by_decimals $price 8)
    local balance_display=$(divide_by_decimals $balance $decimals)
    echo "  $symbol price: $price (8 decimals = ~$price_display USD)" >&2
    echo "  $symbol balance: $balance (~$balance_display tokens with $decimals decimals)" >&2

    # Calculate asset value in USD (18 decimals) using Python
    # assetValueUSD = balance × price × 10^(18 - decimals - 8)
    local scale_factor=$((18 - decimals - 8))
    local asset_value_usd=$(python -c "print(int($balance * $price * 10**$scale_factor))")

    echo "  $symbol value: $asset_value_usd wei USD (18 decimals)" >&2

    # Get total collateral value using Python
    local eth_balance=$(get_balance $ETH_ADDRESS)
    local eth_price=$(get_oracle_price $ETH_ADDRESS)
    eth_price=${eth_price#-}

    local usdc_balance=$(get_balance $USDC_TOKEN)
    local usdc_price=$(get_oracle_price $USDC_TOKEN)
    usdc_price=${usdc_price#-}

    local dai_balance=$(get_balance $DAI_TOKEN)
    local dai_price=$(get_oracle_price $DAI_TOKEN)
    dai_price=${dai_price#-}

    # Calculate total collateral in Python (handles large numbers)
    local total_collateral_usd=$(python -c "
eth_val = $eth_balance * $eth_price // 10**8 if $eth_balance > 0 else 0
usdc_val = $usdc_balance * $usdc_price * 10**12 if $usdc_balance > 0 else 0
dai_val = $dai_balance * $dai_price // 10**8 if $dai_balance > 0 else 0
print(int(eth_val + usdc_val + dai_val))
")

    echo "  Total collateral: $total_collateral_usd wei USD" >&2

    # Calculate proportion in USD: seizeUSD = (collateral_to_seize_usd × asset_value_usd) / total_collateral_usd
    if [ "$total_collateral_usd" == "0" ] || [ "$total_collateral_usd" == "" ]; then
        local seize_amount_usd=0
    else
        local seize_amount_usd=$(python -c "
collateral_to_seize = $collateral_to_seize_usd
asset_value = $asset_value_usd
total_collateral = $total_collateral_usd
result = (collateral_to_seize * asset_value) // total_collateral
print(int(result))
")
    fi

    # Convert USD value to token amount: seizeTokens = seizeUSD / price
    # seize_usd (18 dec) / price (8 dec) = tokens (18 - 8 + decimals)
    # For ETH/DAI (18 dec): (usd_18 / price_8) * 10^8 = tokens_18
    # For USDC (6 dec): (usd_18 / price_8) * 10^8 / 10^12 = tokens_6
    local seize_amount=0
    if [ "$price" != "0" ] && [ "$seize_amount_usd" != "0" ]; then
        if [ "$decimals" == "6" ]; then
            # USDC: divide by 10^12 to get 6 decimals
            seize_amount=$(python -c "print(int(($seize_amount_usd * 10**8) // ($price * 10**12)))")
        else
            # ETH/DAI: 18 decimals
            seize_amount=$(python -c "print(int(($seize_amount_usd * 10**8) // $price))")
        fi
    fi

    local seize_display=$(divide_by_decimals $seize_amount $decimals)
    local usd_display=$(divide_by_decimals $seize_amount_usd 18)
    echo "  Calculated seize: \$$usd_display USD = $seize_amount wei (~$seize_display tokens)" >&2
    echo ""

    echo "$seize_amount"
}

# ===== TRANSFER LOGIC =====

# Function to withdraw and transfer collateral (v2.0 with amount parameter)
transfer_collateral() {
    local asset=$1
    local symbol=$2
    local decimals=$3
    local amount=$4
    local is_dry_run=$5

    echo "Checking $symbol..."

    if [ "$amount" == "0" ]; then
        echo "  No $symbol to transfer (amount=0)"
        echo ""
        return
    fi

    # Calculate human-readable amount (avoid 10**x in bash arithmetic)
    local divisor=1
    case $decimals in
        6) divisor=1000000 ;;
        18) divisor=1000000000000000000 ;;
        *) divisor=1 ;;
    esac
    local tokens_display=$((amount / divisor))
    echo "  Amount to transfer: $amount wei (~$tokens_display tokens with $decimals decimals)"

    if [ "$is_dry_run" == "1" ]; then
        echo "  🔍 DRY RUN - Skipping actual transfer"
        echo ""
        return
    fi

    # Step 1: Withdraw from CollateralManager (as USER)
    echo "  Withdrawing $symbol from CollateralManager..."

    if [ "$asset" == "$ETH_ADDRESS" ]; then
        # Withdraw ETH
        cast send $COLLATERAL_MANAGER \
            "withdrawETH(uint256)" \
            $amount \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 200000
    else
        # Withdraw ERC20
        cast send $COLLATERAL_MANAGER \
            "withdrawERC20(address,uint256)" \
            $asset $amount \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 200000
    fi

    echo "  ✅ Withdrawn to USER wallet"

    # Step 2: Transfer from USER to LIQUIDATOR
    echo "  Transferring $symbol to liquidator..."

    if [ "$asset" == "$ETH_ADDRESS" ]; then
        # Transfer ETH (to EOA, no function signature)
        cast send $LIQUIDATOR \
            --value $amount \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 100000
    else
        # Transfer ERC20
        cast send $asset \
            "transfer(address,uint256)" \
            $LIQUIDATOR $amount \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 100000
    fi

    echo "  ✅ Transferred to liquidator"
    echo ""
}

# ===== MAIN EXECUTION =====

# Check if TX_HASH is provided (v2.0 mode)
if [ -n "$TX_HASH" ]; then
    echo "🎯 MODE: Proportional Transfer (v2.0)"
    echo ""

    # Read collateralToSeizeUSD from event
    COLLATERAL_TO_SEIZE_USD=$(get_collateral_to_seize $TX_HASH)

    # Calculate amounts per asset
    echo "Calculating proportional amounts..."
    echo ""

    USDC_AMOUNT=$(calculate_seize_amount $USDC_TOKEN "USDC" 6 $(get_balance $USDC_TOKEN) $COLLATERAL_TO_SEIZE_USD)
    DAI_AMOUNT=$(calculate_seize_amount $DAI_TOKEN "DAI" 18 $(get_balance $DAI_TOKEN) $COLLATERAL_TO_SEIZE_USD)
    ETH_AMOUNT=$(calculate_seize_amount $ETH_ADDRESS "ETH" 18 $(get_balance $ETH_ADDRESS) $COLLATERAL_TO_SEIZE_USD)

    # Check for dry-run mode
    if [ "$DRY_RUN" == "1" ]; then
        echo "🔍 DRY RUN MODE - Calculations only (no transactions)"
        echo ""
        echo "Summary:"
        echo "  collateralToSeizeUSD: $COLLATERAL_TO_SEIZE_USD wei ($((COLLATERAL_TO_SEIZE_USD / 10**18)) USD)"
        echo "  USDC to seize: $USDC_AMOUNT ($((USDC_AMOUNT / 10**6)) USDC)"
        echo "  DAI to seize: $DAI_AMOUNT ($((DAI_AMOUNT / 10**18)) DAI)"
        echo "  ETH to seize: $ETH_AMOUNT ($((ETH_AMOUNT / 10**18)) ETH)"
        echo ""
        exit 0
    fi

    # Execute transfers
    echo "Transferring proportional collateral to liquidator..."
    echo ""

    transfer_collateral $USDC_TOKEN "USDC" 6 $USDC_AMOUNT 0
    transfer_collateral $DAI_TOKEN "DAI" 18 $DAI_AMOUNT 0
    transfer_collateral $ETH_ADDRESS "ETH" 18 $ETH_AMOUNT 0

    echo "=== Transfer Complete (v2.0) ==="
    echo ""
    echo "✅ Proportional liquidation completed"
    usd_seized=$(divide_by_decimals $COLLATERAL_TO_SEIZE_USD 18)
    echo "   Only seized: $COLLATERAL_TO_SEIZE_USD wei (~$usd_seized USD)"
    echo "   User retains remaining collateral"
    echo ""

else
    # LEGACY v1.0 MODE (NOT RECOMMENDED)
    echo "⚠️  WARNING: Running in LEGACY v1.0 mode (transfers 100% collateral)"
    echo "⚠️  This will OVER-LIQUIDATE the user!"
    echo "⚠️  Use: TX_HASH=0x... ./transfer_liquidated_collateral.sh"
    echo ""
    echo "Transferring ALL collateral to liquidator..."
    echo ""

    # Get full balances
    USDC_BALANCE=$(get_balance $USDC_TOKEN)
    DAI_BALANCE=$(get_balance $DAI_TOKEN)
    ETH_BALANCE=$(get_balance $ETH_ADDRESS)

    # Transfer full amounts
    transfer_collateral $USDC_TOKEN "USDC" 6 $USDC_BALANCE 0
    transfer_collateral $DAI_TOKEN "DAI" 18 $DAI_BALANCE 0
    transfer_collateral $ETH_ADDRESS "ETH" 18 $ETH_BALANCE 0

    echo "=== Transfer Complete (v1.0 LEGACY) ==="
    echo ""
fi

echo "⚠️  REMINDER: This is a TEMPORARY WORKAROUND"
echo "    Fix LendingPool.liquidate() to automatically transfer proportional collateral"
echo ""
