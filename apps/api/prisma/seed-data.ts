// Synthetic development data. Every listing and user here is fictional and flagged isDemo.
export const CITIES = [
  { name: "Chennai", slug: "chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707, localities: [
    ["Adyar", "600020", 13.0012, 80.2565], ["Anna Nagar", "600040", 13.0850, 80.2101], ["T. Nagar", "600017", 13.0418, 80.2341],
    ["Velachery", "600042", 12.9815, 80.2180], ["OMR Sholinganallur", "600119", 12.9010, 80.2279], ["Porur", "600116", 13.0382, 80.1565],
    ["Tambaram", "600045", 12.9249, 80.1000], ["Guindy", "600032", 13.0067, 80.2206], ["Ambattur", "600053", 13.1143, 80.1548],
    ["Mylapore", "600004", 13.0368, 80.2676], ["Perungudi", "600096", 12.9654, 80.2461], ["Sriperumbudur", "602105", 12.9675, 79.9419],
  ] },
  { name: "Coimbatore", slug: "coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558, localities: [
    ["RS Puram", "641002", 11.0089, 76.9502], ["Saibaba Colony", "641011", 11.0255, 76.9426], ["Peelamedu", "641004", 11.0300, 77.0200],
  ] },
  { name: "Madurai", slug: "madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198, localities: [
    ["Anna Nagar Madurai", "625020", 9.9312, 78.1440], ["KK Nagar Madurai", "625020", 9.9380, 78.1360],
  ] },
] as const;

type L = {
  title: string; locality: string; city?: string; category: string; transaction: "SALE" | "RENT" | "LEASE"; advertiserType: "OWNER" | "AGENT" | "BUILDER";
  rupees: number; deposit?: number; maintenance?: number; attributes: Record<string, unknown>; amenities?: string[]; description: string; landmark?: string; featured?: boolean; investment?: boolean;
};

export const LISTINGS: L[] = [
  { title: "Bright 2 BHK apartment near Adyar bus depot", locality: "Adyar", category: "APARTMENT", transaction: "RENT", advertiserType: "OWNER", rupees: 32000, deposit: 200000, maintenance: 2500,
    attributes: { bedrooms: 2, bathrooms: 2, balconies: 1, floor: 3, totalFloors: 5, furnishing: "SEMI_FURNISHED", parking: "CAR", ageYears: 8, carpetAreaSqft: 980, builtUpAreaSqft: 1150 },
    amenities: ["LIFT", "POWER_BACKUP", "SECURITY", "CAR_PARKING", "METRO_WATER"], landmark: "Near Adyar depot", featured: true,
    description: "Demo listing. East-facing 2 BHK on the third floor with good cross ventilation, covered car parking and lift. Walking distance to schools and the Adyar bus depot." },
  { title: "3 BHK family apartment in Anna Nagar West", locality: "Anna Nagar", category: "APARTMENT", transaction: "SALE", advertiserType: "AGENT", rupees: 14500000, maintenance: 4000,
    attributes: { bedrooms: 3, bathrooms: 3, balconies: 2, floor: 6, totalFloors: 12, furnishing: "UNFURNISHED", parking: "CAR", ageYears: 4, carpetAreaSqft: 1380, builtUpAreaSqft: 1620, superBuiltUpAreaSqft: 1850 },
    amenities: ["LIFT", "GYM", "SWIMMING_POOL", "CLUBHOUSE", "SECURITY", "CCTV", "POWER_BACKUP", "CAR_PARKING"],
    description: "Demo listing. Spacious 3 BHK in a gated community with pool, gym and clubhouse. Close to Anna Nagar tower park and the metro station. Brokerage applies." },
  { title: "Independent house with garden in Velachery", locality: "Velachery", category: "INDEPENDENT_HOUSE", transaction: "SALE", advertiserType: "OWNER", rupees: 21000000,
    attributes: { bedrooms: 4, bathrooms: 3, floor: 0, totalFloors: 2, furnishing: "SEMI_FURNISHED", parking: "BOTH", ageYears: 12, builtUpAreaSqft: 2400 },
    amenities: ["BOREWELL", "RAINWATER_HARVESTING", "CAR_PARKING"],
    description: "Demo listing. Two-storey independent house on a 2,400 sq ft plot with a small garden, borewell and rainwater harvesting. Quiet residential street near Velachery MRTS." },
  { title: "Modern 4 BHK villa in a gated community on OMR", locality: "OMR Sholinganallur", category: "VILLA", transaction: "SALE", advertiserType: "BUILDER", rupees: 32500000,
    attributes: { bedrooms: 4, bathrooms: 4, balconies: 2, totalFloors: 2, furnishing: "UNFURNISHED", parking: "CAR", ageYears: 0, builtUpAreaSqft: 2900, superBuiltUpAreaSqft: 3300 },
    amenities: ["GATED_COMMUNITY", "CLUBHOUSE", "SWIMMING_POOL", "SECURITY", "CCTV", "PLAY_AREA", "POWER_BACKUP"], investment: true,
    description: "Demo listing. Ready-to-move villa in a gated community close to IT parks on OMR. Private terrace, two covered parking slots and community amenities." },
  { title: "Fully furnished 1 BHK for working professionals", locality: "Guindy", category: "APARTMENT", transaction: "RENT", advertiserType: "OWNER", rupees: 18000, deposit: 100000,
    attributes: { bedrooms: 1, bathrooms: 1, floor: 2, totalFloors: 4, furnishing: "FURNISHED", parking: "BIKE", ageYears: 6, carpetAreaSqft: 520 },
    amenities: ["LIFT", "SECURITY", "POWER_BACKUP"],
    description: "Demo listing. Compact furnished 1 BHK with bed, wardrobe, fridge and washing machine. Five minutes from Guindy station and the Olympia tech park." },
  { title: "DTCP approved residential plot in Tambaram", locality: "Tambaram", category: "RESIDENTIAL_PLOT", transaction: "SALE", advertiserType: "OWNER", rupees: 4800000,
    attributes: { plotArea: 2, plotAreaUnit: "GROUND", frontageFt: 40, roadAccess: "TAR", roadWidthFt: 30, permittedUseClaim: "Residential (as stated by owner; approval not verified by ProperBySel)", water: "Corporation line nearby", electricity: "Available" },
    description: "Demo listing. Two-ground corner plot on a 30 ft tar road in a developing residential layout. Owner states DTCP approval; buyers should verify documents independently." },
  { title: "Agricultural land with borewell near Sriperumbudur", locality: "Sriperumbudur", category: "AGRICULTURAL_LAND", transaction: "SALE", advertiserType: "AGENT", rupees: 9500000,
    attributes: { plotArea: 3.5, plotAreaUnit: "ACRE", roadAccess: "MUD", permittedUseClaim: "Agricultural", water: "Borewell", electricity: "Three-phase connection" },
    investment: true,
    description: "Demo listing. Three and a half acres of farmland with a working borewell and three-phase power. Mud road access from the main road. Brokerage applies." },
  { title: "Ground floor shop on a busy T. Nagar street", locality: "T. Nagar", category: "SHOP", transaction: "RENT", advertiserType: "OWNER", rupees: 85000, deposit: 1000000,
    attributes: { suitableFor: "Retail, showroom", builtUpAreaSqft: 600, floor: 0, powerKva: 10, washrooms: 1 },
    description: "Demo listing. Street-facing ground floor shop with a glass front in a high-footfall shopping area. Suitable for apparel, jewellery or a showroom." },
  { title: "Plug-and-play office space in Perungudi", locality: "Perungudi", category: "COMMERCIAL_OFFICE", transaction: "LEASE", advertiserType: "AGENT", rupees: 2500000, deposit: 1500000,
    attributes: { suitableFor: "IT / ITES office", builtUpAreaSqft: 4200, floor: 4, powerKva: 120, parkingSlots: 12, washrooms: 4 },
    description: "Demo listing. Furnished office with 60 workstations, two meeting rooms and a pantry. 100% power backup. Lease amount shown is per year. Brokerage applies." },
  { title: "Warehouse with loading dock near Porur", locality: "Porur", category: "WAREHOUSE", transaction: "RENT", advertiserType: "OWNER", rupees: 240000, deposit: 1440000,
    attributes: { suitableFor: "Storage, distribution", builtUpAreaSqft: 12000, powerKva: 60, loadingAccess: true, ceilingHeightFt: 28, parkingSlots: 6, washrooms: 2 },
    description: "Demo listing. Covered warehouse with 28 ft clear height, a loading dock for trucks and good access to the Bangalore highway." },
  { title: "Industrial shed in Ambattur industrial estate", locality: "Ambattur", category: "INDUSTRIAL", transaction: "SALE", advertiserType: "OWNER", rupees: 38000000,
    attributes: { suitableFor: "Light manufacturing", builtUpAreaSqft: 9000, powerKva: 150, loadingAccess: true, ceilingHeightFt: 22, washrooms: 3 },
    description: "Demo listing. Industrial shed with office block, 150 kVA power and truck access inside the industrial estate." },
  { title: "Heritage-style 2 BHK independent house in Mylapore", locality: "Mylapore", category: "INDEPENDENT_HOUSE", transaction: "RENT", advertiserType: "OWNER", rupees: 45000, deposit: 300000,
    attributes: { bedrooms: 2, bathrooms: 2, floor: 0, totalFloors: 1, furnishing: "UNFURNISHED", parking: "BIKE", ageYears: 40, builtUpAreaSqft: 1300 },
    description: "Demo listing. Renovated older home with a courtyard and red-oxide floors, a short walk from the temple tank and markets." },
  { title: "3 BHK apartment in RS Puram, Coimbatore", locality: "RS Puram", city: "coimbatore", category: "APARTMENT", transaction: "SALE", advertiserType: "BUILDER", rupees: 9800000,
    attributes: { bedrooms: 3, bathrooms: 2, balconies: 2, floor: 2, totalFloors: 6, furnishing: "UNFURNISHED", parking: "CAR", ageYears: 1, carpetAreaSqft: 1250, superBuiltUpAreaSqft: 1600 },
    amenities: ["LIFT", "SECURITY", "POWER_BACKUP", "CAR_PARKING"],
    description: "Demo listing. New 3 BHK in a well-connected residential area. Builder states RERA registration; check the RERA portal before booking." },
  { title: "Residential plot in Anna Nagar, Madurai", locality: "Anna Nagar Madurai", city: "madurai", category: "RESIDENTIAL_PLOT", transaction: "SALE", advertiserType: "OWNER", rupees: 3600000,
    attributes: { plotArea: 6, plotAreaUnit: "CENT", frontageFt: 30, roadAccess: "TAR" },
    description: "Demo listing. Six-cent plot in an established neighbourhood, close to schools and hospitals." },
];
