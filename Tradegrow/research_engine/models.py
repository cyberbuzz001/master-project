from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class Bar(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    timestamp: AwareDatetime
    open: Decimal = Field(gt=0)
    high: Decimal = Field(gt=0)
    low: Decimal = Field(gt=0)
    close: Decimal = Field(gt=0)
    volume: Decimal = Field(ge=0)

    @model_validator(mode="after")
    def valid_ohlc(self):
        if not self.low <= min(self.open, self.close) <= max(self.open, self.close) <= self.high:
            raise ValueError("Invalid OHLC ordering")
        return self


class Snapshot(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    symbol: str = Field(pattern=r"^[A-Z0-9&_. -]{1,64}$")
    token: str = Field(min_length=1, max_length=100)
    source: Literal["dhan"]
    asset_type: Literal["stock", "option"]
    as_of: AwareDatetime
    last_price: Decimal = Field(gt=0)
    tick_size: Decimal = Field(gt=0, le=100)
    lot_size: int = Field(ge=1, le=100000)
    risk_budget: Decimal = Field(gt=0, le=1000000)
    bars: list[Bar] = Field(min_length=30, max_length=500)
    expires_at: AwareDatetime | None = None
    underlying: str | None = Field(default=None, pattern=r"^[A-Z0-9&_. -]{1,64}$")
    research_ticker: str | None = Field(default=None, pattern=r"^[A-Z0-9&_.^-]{1,64}$")
    include_ai: bool = False

    @model_validator(mode="after")
    def option_metadata(self):
        if self.asset_type == "option" and (not self.expires_at or not self.underlying):
            raise ValueError("Options require exact expiry timestamp and underlying")
        if self.include_ai and not self.research_ticker:
            raise ValueError("AI research requires an explicit provider ticker (e.g. RELIANCE.NS)")
        return self
