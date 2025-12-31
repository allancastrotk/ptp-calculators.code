import math

CHAIN_PITCH_MM = {
    "415": 12.7,
    "420": 12.7,
    "428": 12.7,
    "520": 15.875,
    "525": 15.875,
    "530": 15.875,
    "630": 19.05,
}


def calculate_ratio(crown_teeth: int, sprocket_teeth: int) -> float:
    return crown_teeth / sprocket_teeth


def chain_pitch_to_mm(chain_pitch: str) -> float | None:
    return CHAIN_PITCH_MM.get(chain_pitch)


def calculate_chain_length_mm(chain_links: int, pitch_mm: float) -> float:
    return chain_links * pitch_mm


def calculate_center_distance_mm(
    sprocket_teeth: int,
    crown_teeth: int,
    pitch_mm: float,
    chain_links: int,
    wear_factor: float,
) -> float:
    chain_length_mm = calculate_chain_length_mm(chain_links, pitch_mm)
    z1 = sprocket_teeth
    z2 = crown_teeth
    p = pitch_mm
    l = chain_links

    c = (chain_length_mm - (math.pi * (z1 + z2) * p / 2.0)) / 2.0
    for _ in range(1000):
        l_calc = (
            2 * (c / p)
            + (z1 + z2) / 2.0
            + (z2 - z1) ** 2 / (4 * math.pi * math.pi * (c / p))
        )
        if abs(l_calc - l) < 0.01:
            break
        c += (l - l_calc) * p * wear_factor / 2.0

    return max(620.0, min(680.0, c))
