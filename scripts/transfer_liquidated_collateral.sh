#!/bin/bash

# RUSTINE - Transfert manuel du collateral après liquidation
# Ce script doit être exécuté MANUELLEMENT après chaque liquidation
# En attendant de fixer le bug dans LendingPool.liquidate()

set -e

echo "=== RUSTINE: Transfert du collateral liquidé ==="
echo ""

# Load environment variables
source .env

# Addresses
USER=$USER_ADDRESS
LIQUIDATOR=$LIQUIDATOR_WALLET
COLLATERAL_MANAGER=$COLLATERAL_MANAGER_ADDRESS
USDC_TOKEN=$USDC_TOKEN_ADDRESS
DAI_TOKEN=$DAI_TOKEN_ADDRESS
ETH_ADDRESS="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

# User's private key (needed to withdraw their collateral)
USER_KEY=$USER_PRIVATE_KEY

echo "Liquidated User: $USER"
echo "Liquidator: $LIQUIDATOR"
echo ""

# Function to get user's collateral balance
get_balance() {
    local asset=$1
    cast call $COLLATERAL_MANAGER \
        "getUserCollateralBalance(address,address)(uint256)" \
        $USER $asset \
        --rpc-url $SEPOLIA_RPC_URL
}

# Function to withdraw and transfer collateral
transfer_collateral() {
    local asset=$1
    local symbol=$2
    local decimals=$3

    echo "Checking $symbol balance..."

    balance=$(get_balance $asset)

    if [ "$balance" == "0" ]; then
        echo "  No $symbol to transfer"
        return
    fi

    echo "  Balance (raw): $balance wei"

    # Step 1: Withdraw from CollateralManager (as USER)
    echo "  Withdrawing $symbol from CollateralManager..."

    if [ "$asset" == "$ETH_ADDRESS" ]; then
        # Withdraw ETH
        cast send $COLLATERAL_MANAGER \
            "withdrawETH(uint256)" \
            $balance \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 200000
    else
        # Withdraw ERC20
        cast send $COLLATERAL_MANAGER \
            "withdrawERC20(address,uint256)" \
            $asset $balance \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 200000
    fi

    echo "  ✅ Withdrawn to USER wallet"

    # Step 2: Transfer from USER to LIQUIDATOR
    echo "  Transferring $symbol to liquidator..."

    if [ "$asset" == "$ETH_ADDRESS" ]; then
        # Transfer ETH (to EOA, needs empty calldata)
        cast send --value $balance $LIQUIDATOR "" \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 100000
    else
        # Transfer ERC20
        cast send $asset \
            "transfer(address,uint256)" \
            $LIQUIDATOR $balance \
            --private-key $USER_KEY \
            --rpc-url $SEPOLIA_RPC_URL \
            --gas-limit 100000
    fi

    echo "  ✅ Transferred to liquidator"
    echo ""
}

# Transfer all collateral assets
echo "Transferring collateral to liquidator..."
echo ""

transfer_collateral $USDC_TOKEN "USDC" 6
transfer_collateral $DAI_TOKEN "DAI" 18
transfer_collateral $ETH_ADDRESS "ETH" 18

echo "=== Transfer Complete ==="
echo ""
echo "⚠️  REMINDER: This is a TEMPORARY WORKAROUND"
echo "    Fix LendingPool.liquidate() to automatically transfer collateral"
echo ""
