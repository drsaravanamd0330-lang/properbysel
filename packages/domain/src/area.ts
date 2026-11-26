/**
 * Area units and conversions. The original value and unit are always stored;
 * a normalized square-feet value is stored alongside for search and sorting.
 * Regional assumptions: ground = 2,400 sq ft (Tamil Nadu), cent = 1/100 acre.
 */
export const AREA_UNITS = ["SQFT", "SQM", "ACRE", "HECTARE", "CENT", "GROUND"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const SQFT_PER_UNIT: Record<AreaUnit, number> = {
  SQFT: 1,
  SQM: 10.763910417,
  ACRE: 43560,
  HECTARE: 107639.10417,
  CENT: 435.6,
  GROUND: 2400,
};

export const AREA_UNIT_LABEL: Record<AreaUnit, string> = {
  SQFT: "sq ft", SQM: "sq m", ACRE: "acres", HECTARE: "hectares", CENT: "cents", GROUND: "grounds",
};

export function toSqft(value: number, unit: AreaUnit): number {
  return Math.round(value * SQFT_PER_UNIT[unit] * 10000) / 10000;
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return Math.round(((value * SQFT_PER_UNIT[from]) / SQFT_PER_UNIT[to]) * 10000) / 10000;
}

/** Residential area kinds keep distinct meanings and must never be merged. */
export const AREA_KINDS = ["CARPET", "BUILT_UP", "SUPER_BUILT_UP", "PLOT"] as const;
export type AreaKind = (typeof AREA_KINDS)[number];
