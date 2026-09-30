import pytest
from services.greeks_service import GreeksService


def test_option_price_call():
    spot = 24500.0
    strike = 24500.0
    time_to_expiry = 0.08
    iv = 0.15

    price = GreeksService.calculate_option_price(spot, strike, time_to_expiry, is_call=True, iv=iv)
    assert price > 0.0
    assert isinstance(price, float)


def test_option_price_put():
    spot = 24500.0
    strike = 24500.0
    time_to_expiry = 0.08
    iv = 0.15

    price = GreeksService.calculate_option_price(spot, strike, time_to_expiry, is_call=False, iv=iv)
    assert price > 0.0
    assert isinstance(price, float)


def test_greeks_calculation():
    spot = 24500.0
    strike = 24500.0
    time_to_expiry = 0.08
    iv = 0.15

    greeks = GreeksService.calculate_greeks(spot, strike, time_to_expiry, is_call=True, iv=iv)
    assert "iv" in greeks
    assert "delta" in greeks
    assert "gamma" in greeks
    assert "theta" in greeks
    assert "vega" in greeks
    assert 0.0 <= greeks["delta"] <= 1.0


def test_implied_volatility_solver():
    spot = 24500.0
    strike = 24500.0
    time_to_expiry = 0.08
    target_price = 450.0

    iv = GreeksService.calculate_implied_volatility(
        target_ltp=target_price,
        spot=spot,
        strike=strike,
        time_to_expiry_years=time_to_expiry,
        is_call=True
    )
    assert iv > 0.01
    assert iv < 2.0
