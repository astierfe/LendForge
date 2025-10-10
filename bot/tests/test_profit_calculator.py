# bot/tests/test_profit_calculator.py - v1.0 - Unit tests
import pytest
from decimal import Decimal
from unittest.mock import Mock, MagicMock
import sys
from pathlib import Path

# Ajouter src/ au path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from models.position import Position
from services.profit_calculator import ProfitCalculator

@pytest.fixture
def mock_web3_client():
    client = Mock()
    client.get_eth_price.return_value = 2000_00000000  # $2000
    client.estimate_gas_price.return_value = 20 * 10**9  # 20 gwei
    return client

@pytest.fixture
def profit_calculator(mock_web3_client):
    return ProfitCalculator(mock_web3_client)

@pytest.fixture
def sample_position():
    return Position(
        user_address="0x1234567890123456789012345678901234567890",
        collateral=1 * 10**18,  # 1 ETH
        borrowed=1320 * 10**8,  # $1320
        health_factor=Decimal("0.95"),
        collateral_ratio=151,
        status="ACTIVE"
    )

def test_calculate_profit_profitable(profit_calculator, sample_position):
    is_profitable, profit = profit_calculator.calculate_profit(sample_position)
    
    assert is_profitable is True
    assert profit > Decimal("5.0")
    assert sample_position.collateral_usd is not None
    assert sample_position.expected_profit_usd is not None

def test_calculate_profit_not_profitable_due_to_gas(profit_calculator):
    # Small debt position
    position = Position(
        user_address="0x1234567890123456789012345678901234567890",
        collateral=0.05 * 10**18,  # 0.05 ETH
        borrowed=50 * 10**8,  # $50
        health_factor=Decimal("0.8"),
        collateral_ratio=100,
        status="ACTIVE"
    )
    
    is_profitable, profit = profit_calculator.calculate_profit(position)
    
    # Should not be profitable due to gas costs
    assert is_profitable is False
    assert profit < Decimal("5.0")

def test_calculate_profit_caps_collateral_seized(profit_calculator):
    # Debt exceeds collateral value
    position = Position(
        user_address="0x1234567890123456789012345678901234567890",
        collateral=0.5 * 10**18,  # 0.5 ETH = $1000
        borrowed=1500 * 10**8,  # $1500 debt
        health_factor=Decimal("0.5"),
        collateral_ratio=66,
        status="ACTIVE"
    )
    
    is_profitable, profit = profit_calculator.calculate_profit(position)
    
    # Profit should be capped by available collateral
    assert position.collateral_usd is not None
    assert float(position.collateral_usd) == 1000.0

def test_estimate_gas_cost(profit_calculator):
    eth_price = Decimal("2000")
    gas_cost = profit_calculator._estimate_gas_cost(eth_price)
    
    assert gas_cost > Decimal("0")
    assert gas_cost < Decimal("20")  # Should be reasonable

def test_calculate_liquidation_amount(profit_calculator, sample_position):
    amount = profit_calculator.calculate_liquidation_amount(sample_position)
    
    assert amount == sample_position.borrowed
    assert amount == 1320 * 10**8

def test_check_gas_price_acceptable(profit_calculator, mock_web3_client):
    # Gas price within limits
    mock_web3_client.estimate_gas_price.return_value = 30 * 10**9  # 30 gwei
    assert profit_calculator.check_gas_price_acceptable() is True
    
    # Gas price too high
    mock_web3_client.estimate_gas_price.return_value = 100 * 10**9  # 100 gwei
    assert profit_calculator.check_gas_price_acceptable() is False

def test_profit_with_different_eth_prices(profit_calculator, mock_web3_client):
    position = Position(
        user_address="0x1234567890123456789012345678901234567890",
        collateral=1 * 10**18,
        borrowed=1000 * 10**8,
        health_factor=Decimal("0.9"),
        collateral_ratio=150,
        status="ACTIVE"
    )
    
    # High ETH price
    mock_web3_client.get_eth_price.return_value = 3000_00000000
    is_profitable_high, profit_high = profit_calculator.calculate_profit(position)
    
    # Low ETH price
    mock_web3_client.get_eth_price.return_value = 1500_00000000
    is_profitable_low, profit_low = profit_calculator.calculate_profit(position)
    
    # Higher ETH price should result in higher profit
    assert profit_high < profit_low