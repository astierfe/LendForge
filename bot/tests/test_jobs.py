import pytest
from unittest.mock import Mock, MagicMock
from jobs import health_monitor
from jobs import price_sync

def test_health_monitor_with_no_positions():
    mock_monitor = Mock()
    mock_monitor.monitor_cycle.return_value = {
        "risky_count": 0,
        "profitable_count": 0,
        "liquidated_count": 0
    }

    health_monitor.set_monitor(mock_monitor)
    result = health_monitor.run_health_monitor()

    assert result["risky_count"] == 0
    mock_monitor.monitor_cycle.assert_called_once()

def test_health_monitor_with_risky_positions():
    mock_monitor = Mock()
    mock_monitor.monitor_cycle.return_value = {
        "risky_count": 2,
        "profitable_count": 1,
        "liquidated_count": 0
    }

    health_monitor.set_monitor(mock_monitor)
    result = health_monitor.run_health_monitor()

    assert result["risky_count"] == 2
    assert result["profitable_count"] == 1

def test_price_sync_fetch_coingecko():
    prices = price_sync.fetch_coingecko_prices()

    assert prices is not None
    assert "ETH" in prices
    assert "USDC" in prices
    assert "DAI" in prices
    assert prices["ETH"]["price_usd"] > 0
    assert 0.99 <= prices["USDC"]["price_usd"] <= 1.01
    assert 0.99 <= prices["DAI"]["price_usd"] <= 1.01
