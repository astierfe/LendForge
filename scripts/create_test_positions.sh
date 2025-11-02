#!/bin/bash

# Script to create test positions with different health factors
# for LendForge frontend dashboard testing

set -e  # Exit on error

# Load environment variables
source .env

# Contract addresses
COLLATERAL_MANAGER="0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758"
LENDING_POOL="0x06AF08708B45968492078A1900124DaA832082cD"
DAI_ADDRESS="0x2FA332E8337642891885453Fd40a7a7Bb010B71a"
USDC_ADDRESS="0xC47095AD18C67FBa7E46D56BDBB014901f3e327b"
ETH_ADDRESS="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

# User wallet
USER_ADDRESS="$DEPLOYER_ADDRESS"
PRIVATE_KEY="$PRIVATE_KEY"
RPC_URL="$SEPOLIA_RPC_URL"

echo "=============================================="
echo "  LendForge - Create Test Positions"
echo "=============================================="
echo "User: $USER_ADDRESS"
echo ""

# Function to approve ERC20 token
approve_token() {
    local token=$1
    local amount=$2
    local token_name=$3

    echo "📝 Approving $token_name..."
    cast send "$token" \
        "approve(address,uint256)" \
        "$COLLATERAL_MANAGER" \
        "$amount" \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --legacy

    echo "✅ $token_name approved"
}

# Function to deposit collateral
deposit_collateral() {
    local asset=$1
    local amount=$2
    local asset_name=$3
    local is_eth=$4

    echo "💰 Depositing $asset_name..."

    if [ "$is_eth" = "true" ]; then
        # Deposit ETH (payable)
        cast send "$COLLATERAL_MANAGER" \
            "depositCollateral(address,uint256)" \
            "$asset" \
            "$amount" \
            --value "$amount" \
            --rpc-url "$RPC_URL" \
            --private-key "$PRIVATE_KEY" \
            --legacy
    else
        # Deposit ERC20
        cast send "$COLLATERAL_MANAGER" \
            "depositCollateral(address,uint256)" \
            "$asset" \
            "$amount" \
            --rpc-url "$RPC_URL" \
            --private-key "$PRIVATE_KEY" \
            --legacy
    fi

    echo "✅ $asset_name deposited"
}

# Function to borrow ETH
borrow_eth() {
    local amount=$1

    echo "🏦 Borrowing ETH..."
    cast send "$LENDING_POOL" \
        "borrow(uint256)" \
        "$amount" \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --legacy

    echo "✅ ETH borrowed"
}

# Function to check position
check_position() {
    echo ""
    echo "📊 Checking position..."

    # Get user position
    cast call "$COLLATERAL_MANAGER" \
        "getUserPosition(address)" \
        "$USER_ADDRESS" \
        --rpc-url "$RPC_URL"

    echo ""
}

echo "Choose a scenario to create:"
echo ""
echo "1. Safe Position (HF ≈ 2.5)"
echo "   - Collateral: 5000 DAI (~$5000)"
echo "   - Borrow: ~0.35 ETH (~$1900 at $5434/ETH)"
echo "   - Expected HF: ~2.5"
echo ""
echo "2. Warning Position (HF ≈ 1.8)"
echo "   - Collateral: 3000 USDC (~$3000)"
echo "   - Borrow: ~0.30 ETH (~$1630)"
echo "   - Expected HF: ~1.75"
echo ""
echo "3. Danger Position (HF ≈ 1.4)"
echo "   - Collateral: 0.15 ETH (~$815)"
echo "   - Borrow: ~0.08 ETH (~$435)"
echo "   - Expected HF: ~1.55"
echo ""
echo "4. Custom Position (Manual input)"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🟢 Creating SAFE position..."
        echo ""

        # Amounts
        DAI_AMOUNT="5000000000000000000000"  # 5000 DAI
        BORROW_AMOUNT="350000000000000000"    # 0.35 ETH

        # Approve and deposit DAI
        approve_token "$DAI_ADDRESS" "$DAI_AMOUNT" "DAI"
        deposit_collateral "$DAI_ADDRESS" "$DAI_AMOUNT" "DAI" "false"

        # Borrow ETH
        borrow_eth "$BORROW_AMOUNT"

        # Check position
        check_position

        echo ""
        echo "✅ Safe position created!"
        echo "   Expected HF: ~2.5 (Safe)"
        ;;

    2)
        echo ""
        echo "🟡 Creating WARNING position..."
        echo ""

        # Amounts
        USDC_AMOUNT="3000000000"              # 3000 USDC (6 decimals)
        BORROW_AMOUNT="300000000000000000"    # 0.30 ETH

        # Approve and deposit USDC
        approve_token "$USDC_ADDRESS" "$USDC_AMOUNT" "USDC"
        deposit_collateral "$USDC_ADDRESS" "$USDC_AMOUNT" "USDC" "false"

        # Borrow ETH
        borrow_eth "$BORROW_AMOUNT"

        # Check position
        check_position

        echo ""
        echo "✅ Warning position created!"
        echo "   Expected HF: ~1.75 (Warning)"
        ;;

    3)
        echo ""
        echo "🟠 Creating DANGER position..."
        echo ""

        # Amounts
        ETH_AMOUNT="150000000000000000"       # 0.15 ETH
        BORROW_AMOUNT="80000000000000000"     # 0.08 ETH

        # Deposit ETH
        deposit_collateral "$ETH_ADDRESS" "$ETH_AMOUNT" "ETH" "true"

        # Borrow ETH
        borrow_eth "$BORROW_AMOUNT"

        # Check position
        check_position

        echo ""
        echo "✅ Danger position created!"
        echo "   Expected HF: ~1.55 (Danger)"
        ;;

    4)
        echo ""
        echo "🔧 Custom Position"
        echo ""

        read -p "Collateral asset (DAI/USDC/ETH): " asset
        read -p "Collateral amount (in token units, e.g., 1000 for DAI): " amount
        read -p "Borrow amount (in ETH, e.g., 0.5): " borrow

        case $asset in
            DAI)
                TOKEN_ADDRESS="$DAI_ADDRESS"
                # Convert to Wei (18 decimals)
                AMOUNT_WEI=$(echo "$amount * 10^18" | bc | cut -d. -f1)
                approve_token "$TOKEN_ADDRESS" "$AMOUNT_WEI" "DAI"
                deposit_collateral "$TOKEN_ADDRESS" "$AMOUNT_WEI" "DAI" "false"
                ;;
            USDC)
                TOKEN_ADDRESS="$USDC_ADDRESS"
                # Convert to smallest unit (6 decimals)
                AMOUNT_WEI=$(echo "$amount * 10^6" | bc | cut -d. -f1)
                approve_token "$TOKEN_ADDRESS" "$AMOUNT_WEI" "USDC"
                deposit_collateral "$TOKEN_ADDRESS" "$AMOUNT_WEI" "USDC" "false"
                ;;
            ETH)
                TOKEN_ADDRESS="$ETH_ADDRESS"
                # Convert to Wei (18 decimals)
                AMOUNT_WEI=$(echo "$amount * 10^18" | bc | cut -d. -f1)
                deposit_collateral "$TOKEN_ADDRESS" "$AMOUNT_WEI" "ETH" "true"
                ;;
            *)
                echo "❌ Invalid asset"
                exit 1
                ;;
        esac

        # Convert borrow to Wei
        BORROW_WEI=$(echo "$borrow * 10^18" | bc | cut -d. -f1)
        borrow_eth "$BORROW_WEI"

        check_position

        echo ""
        echo "✅ Custom position created!"
        ;;

    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "=============================================="
echo "  Position Created Successfully!"
echo "=============================================="
echo ""
echo "🔍 Wait ~30 seconds for subgraph to index..."
echo "🌐 Then refresh your dashboard to see data"
echo ""
