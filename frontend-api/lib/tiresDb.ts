export type WidthEntry = {
  aspects?: number[];
  flotation?: string[];
};

export type RimData = {
  widths: string[];
  [width: string]: WidthEntry | string[];
};

export type VehicleData = {
  rims: number[];
  [rim: string]: RimData | number[];
};

export type VehicleType =
  | "Car"
  | "Motorcycle"
  | "LightTruck"
  | "TruckCommercial"
  | "Kart"
  | "Kartcross";

export const TIRES_DB: Record<VehicleType, VehicleData> = {
  Car: {
    rims: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    "12": {
      widths: ["135", "145", "155", "165"],
      "135": { aspects: [70, 80] },
      "145": { aspects: [70, 80] },
      "155": { aspects: [70, 80] },
      "165": { aspects: [70] },
    },
    "13": {
      widths: ["145", "155", "165", "175"],
      "145": { aspects: [65, 70, 80] },
      "155": { aspects: [65, 70, 80] },
      "165": { aspects: [65, 70, 80] },
      "175": { aspects: [65, 70] },
    },
    "14": {
      widths: ["165", "175", "185", "195"],
      "165": { aspects: [60, 65, 70] },
      "175": { aspects: [60, 65, 70] },
      "185": { aspects: [60, 65, 70] },
      "195": { aspects: [60, 65] },
    },
    "15": {
      widths: ["175", "185", "195", "205", "215"],
      "175": { aspects: [55, 60, 65] },
      "185": { aspects: [55, 60, 65] },
      "195": { aspects: [55, 60, 65] },
      "205": { aspects: [55, 60] },
      "215": { aspects: [55, 60] },
    },
    "16": {
      widths: ["195", "205", "215", "225", "235"],
      "195": { aspects: [50, 55, 60] },
      "205": { aspects: [50, 55, 60] },
      "215": { aspects: [50, 55, 60] },
      "225": { aspects: [50, 55] },
      "235": { aspects: [50, 55] },
    },
    "17": {
      widths: ["205", "215", "225", "235", "245"],
      "205": { aspects: [45, 50, 55] },
      "215": { aspects: [45, 50, 55] },
      "225": { aspects: [45, 50, 55] },
      "235": { aspects: [45, 50] },
      "245": { aspects: [45, 50] },
    },
    "18": {
      widths: ["215", "225", "235", "245", "255", "265"],
      "215": { aspects: [40, 45, 50] },
      "225": { aspects: [40, 45, 50] },
      "235": { aspects: [40, 45, 50] },
      "245": { aspects: [40, 45] },
      "255": { aspects: [40, 45] },
      "265": { aspects: [40, 45] },
    },
    "19": {
      widths: ["225", "235", "245", "255", "265", "275"],
      "225": { aspects: [35, 40, 45] },
      "235": { aspects: [35, 40, 45] },
      "245": { aspects: [35, 40] },
      "255": { aspects: [35, 40] },
      "265": { aspects: [35, 40] },
      "275": { aspects: [35, 40] },
    },
    "20": {
      widths: ["235", "245", "255", "265", "275", "285"],
      "235": { aspects: [30, 35, 40] },
      "245": { aspects: [30, 35, 40] },
      "255": { aspects: [30, 35] },
      "265": { aspects: [30, 35] },
      "275": { aspects: [30, 35] },
      "285": { aspects: [30, 35] },
    },
    "21": {
      widths: ["245", "255", "265", "275", "285"],
      "245": { aspects: [30, 35] },
      "255": { aspects: [30, 35] },
      "265": { aspects: [30, 35] },
      "275": { aspects: [30, 35] },
      "285": { aspects: [30] },
    },
    "22": {
      widths: ["255", "265", "275", "285", "295"],
      "255": { aspects: [30, 35] },
      "265": { aspects: [30, 35] },
      "275": { aspects: [30, 35] },
      "285": { aspects: [30, 35] },
      "295": { aspects: [30] },
    },
    "23": {
      widths: ["265", "275", "285", "295"],
      "265": { aspects: [30] },
      "275": { aspects: [30] },
      "285": { aspects: [30] },
      "295": { aspects: [30] },
    },
    "24": {
      widths: ["275", "285", "295", "305"],
      "275": { aspects: [30] },
      "285": { aspects: [30] },
      "295": { aspects: [25, 30] },
      "305": { aspects: [25, 30] },
    },
  },
  Motorcycle: {
    rims: [16, 17, 18, 19, 21],
    "16": {
      widths: ["100", "110", "120", "130"],
      "100": { aspects: [70, 90] },
      "110": { aspects: [70, 80, 90] },
      "120": { aspects: [60, 70] },
      "130": { aspects: [60, 70] },
    },
    "17": {
      widths: ["90", "100", "110", "120", "130", "140", "150", "160", "180", "190", "200"],
      "90": { aspects: [90] },
      "100": { aspects: [80, 90] },
      "110": { aspects: [70, 80] },
      "120": { aspects: [60, 70] },
      "130": { aspects: [60, 70] },
      "140": { aspects: [60, 70] },
      "150": { aspects: [60, 70] },
      "160": { aspects: [60] },
      "180": { aspects: [55, 60] },
      "190": { aspects: [50, 55] },
      "200": { aspects: [50, 55] },
    },
    "18": {
      widths: ["100", "110", "120", "130", "140", "150", "160", "180"],
      "100": { aspects: [90], flotation: ["2.75-18", "3.00-18", "4.10-18"] },
      "110": { aspects: [80, 90] },
      "120": { aspects: [70, 80] },
      "130": { aspects: [70] },
      "140": { aspects: [70] },
      "150": { aspects: [70], flotation: ["4.60-18", "5.10-18"] },
      "160": { aspects: [60] },
      "180": { aspects: [55] },
    },
    "19": {
      widths: ["90", "100", "110", "120", "130"],
      "90": { aspects: [90] },
      "100": { aspects: [80, 90] },
      "110": { aspects: [80] },
      "120": { aspects: [70] },
      "130": { aspects: [70], flotation: ["5.10-19"] },
    },
    "21": {
      widths: ["80", "90", "100"],
      "80": { aspects: [100], flotation: ["3.00-21"] },
      "90": { aspects: [90] },
      "100": { aspects: [90] },
    },
  },
  LightTruck: {
    rims: [15, 16, 17, 18, 19, 20, 21, 22],
    "15": {
      widths: ["215", "225", "235", "245", "265"],
      "215": { aspects: [70, 75] },
      "225": { aspects: [70, 75] },
      "235": { aspects: [70, 75], flotation: ["30x9.5R15", "31x10.5R15"] },
      "245": { aspects: [75] },
      "265": { aspects: [70], flotation: ["32x11.5R15", "33x12.5R15"] },
    },
    "16": {
      widths: ["215", "225", "235", "245", "265", "285"],
      "215": { aspects: [70, 75] },
      "225": { aspects: [70, 75] },
      "235": { aspects: [70, 75], flotation: ["31x10.5R16", "33x12.5R16"] },
      "245": { aspects: [70, 75] },
      "265": { aspects: [70], flotation: ["33x12.5R16", "35x12.5R16"] },
      "285": { aspects: [70] },
    },
    "17": {
      widths: ["235", "245", "265", "275", "285", "305"],
      "235": { aspects: [70, 75] },
      "245": { aspects: [70, 75] },
      "265": { aspects: [70] },
      "275": { aspects: [70] },
      "285": { aspects: [70], flotation: ["33x12.5R17", "35x12.5R17"] },
      "305": { aspects: [65], flotation: ["35x12.5R17"] },
    },
    "18": {
      widths: ["255", "265", "275", "285", "305"],
      "255": { aspects: [65, 70] },
      "265": { aspects: [65, 70] },
      "275": { aspects: [65] },
      "285": { aspects: [65], flotation: ["33x12.5R18", "35x12.5R18"] },
      "305": { aspects: [60], flotation: ["35x12.5R18"] },
    },
    "19": {
      widths: ["255", "265", "275", "285", "305", "325"],
      "255": { aspects: [65, 70] },
      "265": { aspects: [65, 70] },
      "275": { aspects: [65] },
      "285": { aspects: [65] },
      "305": { aspects: [60] },
      "325": { aspects: [60] },
    },
    "20": {
      widths: ["265", "275", "285", "305", "325"],
      "265": { aspects: [60, 65] },
      "275": { aspects: [60, 65] },
      "285": { aspects: [60] },
      "305": { aspects: [55] },
      "325": { aspects: [55], flotation: ["35x12.5R20", "37x13.5R20"] },
    },
    "21": {
      widths: ["275", "285", "305", "325"],
      "275": { aspects: [55, 60] },
      "285": { aspects: [55, 60] },
      "305": { aspects: [55] },
      "325": { aspects: [50] },
    },
    "22": {
      widths: ["285", "305", "325"],
      "285": { aspects: [45, 50] },
      "305": { aspects: [45, 50], flotation: ["35x12.5R22", "37x12.5R22"] },
      "325": { aspects: [50] },
    },
  },
  TruckCommercial: {
    rims: [17.5, 19.5, 22.5],
    "17.5": {
      widths: ["205", "215", "225", "235", "245"],
      "205": { aspects: [70, 75] },
      "215": { aspects: [70, 75] },
      "225": { aspects: [70, 75] },
      "235": { aspects: [70] },
      "245": { aspects: [70] },
    },
    "19.5": {
      widths: ["225", "245", "265", "285"],
      "225": { aspects: [70, 75] },
      "245": { aspects: [70, 75] },
      "265": { aspects: [70] },
      "285": { aspects: [70] },
    },
    "22.5": {
      widths: ["245", "265", "275", "295", "315"],
      "245": { aspects: [70, 75] },
      "265": { aspects: [70, 75] },
      "275": { aspects: [70] },
      "295": { aspects: [75] },
      "315": { aspects: [80] },
    },
  },
  Kart: {
    rims: [5, 6],
    "5": {
      widths: ["100", "110", "120"],
      "100": { aspects: [60], flotation: ["10x3.50-5", "10x4.50-5"] },
      "110": { aspects: [60], flotation: ["10x4.50-5"] },
      "120": { aspects: [60], flotation: ["11x6.00-5", "11x7.10-5"] },
    },
    "6": {
      widths: ["110", "120", "130"],
      "110": { aspects: [60] },
      "120": { aspects: [60], flotation: ["11x6.00-5", "11x7.10-5"] },
      "130": { aspects: [60] },
    },
  },
  Kartcross: {
    rims: [7, 8, 10],
    "7": {
      widths: ["185", "195", "205"],
      "185": { aspects: [70], flotation: ["16x8-7"] },
      "195": { aspects: [70] },
      "205": { aspects: [70] },
    },
    "8": {
      widths: ["175", "195", "215"],
      "175": { aspects: [70], flotation: ["19x7-8"] },
      "195": { aspects: [70], flotation: ["18x9.5-8"] },
      "215": { aspects: [70] },
    },
    "10": {
      widths: ["255", "275"],
      "255": { aspects: [70], flotation: ["22x11-10"] },
      "275": { aspects: [70] },
    },
  },
};

export const VEHICLE_TYPES: VehicleType[] = [
  "Car",
  "Motorcycle",
  "LightTruck",
  "TruckCommercial",
  "Kart",
  "Kartcross",
];

export function getRimData(vehicleType: VehicleType, rim: string): RimData | undefined {
  const vehicle = TIRES_DB[vehicleType];
  const data = vehicle[rim];
  if (!data || Array.isArray(data)) return undefined;
  if ("widths" in data) return data as RimData;
  return undefined;
}

export function getWidthEntry(rimData: RimData | undefined, width: string): WidthEntry | undefined {
  if (!rimData) return undefined;
  const entry = rimData[width];
  if (!entry || Array.isArray(entry)) return undefined;
  return entry as WidthEntry;
}
