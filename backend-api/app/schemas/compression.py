from typing import Optional

from pydantic import BaseModel


class CompressionInputs(BaseModel):
    chamber_volume: float
    gasket_thickness: float
    gasket_bore: float
    deck_height: float
    piston_volume: float
    exhaust_port_height: Optional[float] = None
    transfer_port_height: Optional[float] = None
    crankcase_volume: Optional[float] = None


class CompressionNormalizedInputs(BaseModel):
    chamber_volume: float
    gasket_thickness: float
    gasket_bore: float
    deck_height: float
    piston_volume: float
    exhaust_port_height: Optional[float] = None
    transfer_port_height: Optional[float] = None
    crankcase_volume: Optional[float] = None


class CompressionResults(BaseModel):
    compression_ratio: float
    clearance_volume: float
    swept_volume: float
    trapped_volume: Optional[float] = None
    crankcase_compression_ratio: Optional[float] = None
    compression_mode: str
