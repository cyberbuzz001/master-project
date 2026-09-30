import math
from typing import Dict, Any, Optional

try:
    from py_vollib.black_scholes import black_scholes
    from py_vollib.black_scholes.greeks.analytical import delta, gamma, theta, vega
    from py_vollib.black_scholes.implied_volatility import implied_volatility
    PY_VOLLIB_AVAILABLE = True
except ImportError:
    PY_VOLLIB_AVAILABLE = False


class GreeksService:
    RISK_FREE_RATE = 0.07  # 7.0% RBI MIBOR Benchmark Rate

    @staticmethod
    def calculate_option_price(
        spot: float,
        strike: float,
        time_to_expiry_years: float,
        is_call: bool,
        iv: float = 0.15,
        rate: float = 0.07
    ) -> float:
        if spot <= 0 or strike <= 0 or time_to_expiry_years <= 0 or iv <= 0:
            intrinsic = max(0.0, spot - strike) if is_call else max(0.0, strike - spot)
            return max(0.05, round(intrinsic, 2))

        flag = 'c' if is_call else 'p'
        if PY_VOLLIB_AVAILABLE:
            try:
                price = black_scholes(flag, spot, strike, time_to_expiry_years, rate, iv)
                return max(0.05, round(float(price), 2))
            except Exception:
                pass

        # Native analytical fallback
        sqrt_t = math.sqrt(time_to_expiry_years)
        d1 = (math.log(spot / strike) + (rate + 0.5 * iv * iv) * time_to_expiry_years) / (iv * sqrt_t)
        d2 = d1 - (iv * sqrt_t)
        cnd = lambda x: 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

        if is_call:
            price = spot * cnd(d1) - strike * math.exp(-rate * time_to_expiry_years) * cnd(d2)
        else:
            price = strike * math.exp(-rate * time_to_expiry_years) * cnd(-d2) - spot * cnd(-d1)

        return max(0.05, round(price, 2))

    @staticmethod
    def calculate_greeks(
        spot: float,
        strike: float,
        time_to_expiry_years: float = 0.08,
        is_call: bool = True,
        iv: float = 0.15,
        rate: float = 0.07
    ) -> Dict[str, float]:
        if spot <= 0 or strike <= 0 or time_to_expiry_years <= 0 or iv <= 0:
            return {
                "iv": round(iv * 100.0, 2),
                "delta": 0.5 if is_call else -0.5,
                "gamma": 0.002,
                "theta": -10.0,
                "vega": 15.0
            }

        flag = 'c' if is_call else 'p'
        if PY_VOLLIB_AVAILABLE:
            try:
                d = delta(flag, spot, strike, time_to_expiry_years, rate, iv)
                g = gamma(flag, spot, strike, time_to_expiry_years, rate, iv)
                t = theta(flag, spot, strike, time_to_expiry_years, rate, iv) / 365.0
                v = vega(flag, spot, strike, time_to_expiry_years, rate, iv)
                return {
                    "iv": round(iv * 100.0, 2),
                    "delta": round(float(d), 3),
                    "gamma": round(float(g), 5),
                    "theta": round(float(t), 2),
                    "vega": round(float(v), 2)
                }
            except Exception:
                pass

        # Native analytical calculation
        sqrt_t = math.sqrt(time_to_expiry_years)
        d1 = (math.log(spot / strike) + (rate + 0.5 * iv * iv) * time_to_expiry_years) / (iv * sqrt_t)
        d2 = d1 - (iv * sqrt_t)
        cnd = lambda x: 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))
        nd1 = math.exp(-0.5 * d1 * d1) / math.sqrt(2.0 * math.pi)

        del_val = cnd(d1) if is_call else cnd(d1) - 1.0
        gam_val = nd1 / (spot * iv * sqrt_t)
        term1 = -(spot * nd1 * iv) / (2.0 * sqrt_t)
        term2 = rate * strike * math.exp(-rate * time_to_expiry_years) * (cnd(d2) if is_call else cnd(-d2))
        theta_val = (term1 - term2 if is_call else term1 + term2) / 365.0
        vega_val = (spot * sqrt_t * nd1) / 100.0

        return {
            "iv": round(iv * 100.0, 2),
            "delta": round(del_val, 3),
            "gamma": round(gam_val, 5),
            "theta": round(theta_val, 2),
            "vega": round(vega_val, 2)
        }

    @staticmethod
    def calculate_implied_volatility(
        target_ltp: float,
        spot: float,
        strike: float,
        time_to_expiry_years: float,
        is_call: bool,
        fallback_iv: float = 0.15,
        rate: float = 0.07
    ) -> float:
        intrinsic = max(0.0, spot - strike) if is_call else max(0.0, strike - spot)
        if target_ltp <= intrinsic:
            return max(0.01, fallback_iv)

        flag = 'c' if is_call else 'p'
        if PY_VOLLIB_AVAILABLE:
            try:
                iv_val = implied_volatility(target_ltp, spot, strike, time_to_expiry_years, rate, flag)
                return max(0.01, round(float(iv_val), 4))
            except Exception:
                pass

        # Newton-Raphson solver fallback
        sigma = fallback_iv if fallback_iv > 0 else 0.20
        for _ in range(25):
            price = GreeksService.calculate_option_price(spot, strike, time_to_expiry_years, is_call, sigma, rate)
            diff = price - target_ltp
            if abs(diff) < 1e-4:
                return max(0.01, round(sigma, 4))
            greeks = GreeksService.calculate_greeks(spot, strike, time_to_expiry_years, is_call, sigma, rate)
            raw_vega = greeks["vega"] * 100.0
            if abs(raw_vega) < 1e-5:
                break
            sigma = sigma - (diff / raw_vega)
            if sigma <= 0.001 or sigma > 5.0:
                break

        return max(0.01, round(sigma, 4))
