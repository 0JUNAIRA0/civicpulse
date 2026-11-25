/**
 * Reference data shared by the production bootstrap and the demo seed.
 * Areas are real Dhaka neighbourhoods with their approximate centre coordinates.
 */
import type { IssueCategory } from "./schema";

/** [name, zone, ward, latitude, longitude] */
export const AREAS: [string, string, string, number, number][] = [
  ["Gulshan 1", "North", "19", 23.7806, 90.4167],
  ["Gulshan 2", "North", "19", 23.7949, 90.4143],
  ["Banani", "North", "19", 23.7937, 90.4066],
  ["Baridhara", "North", "18", 23.8016, 90.4214],
  ["Uttara Sector 4", "North", "1", 23.8636, 90.4006],
  ["Uttara Sector 10", "North", "1", 23.8759, 90.3795],
  ["Mirpur 1", "West", "9", 23.7957, 90.3537],
  ["Mirpur 10", "West", "14", 23.8069, 90.3687],
  ["Mirpur 12", "West", "6", 23.8285, 90.3640],
  ["Pallabi", "West", "5", 23.8270, 90.3610],
  ["Mohammadpur", "West", "33", 23.7662, 90.3589],
  ["Shyamoli", "West", "29", 23.7740, 90.3657],
  ["Agargaon", "West", "28", 23.7781, 90.3800],
  ["Dhanmondi", "South", "15", 23.7461, 90.3742],
  ["Lalmatia", "South", "30", 23.7562, 90.3673],
  ["Kalabagan", "South", "16", 23.7505, 90.3820],
  ["New Market", "South", "18", 23.7334, 90.3847],
  ["Azimpur", "South", "26", 23.7275, 90.3870],
  ["Lalbagh", "South", "23", 23.7190, 90.3880],
  ["Old Dhaka - Chawkbazar", "South", "30", 23.7163, 90.3965],
  ["Sadarghat", "South", "37", 23.7055, 90.4096],
  ["Motijheel", "Central", "9", 23.7330, 90.4172],
  ["Paltan", "Central", "20", 23.7362, 90.4127],
  ["Shahbagh", "Central", "21", 23.7387, 90.3958],
  ["Kawran Bazar", "Central", "26", 23.7510, 90.3935],
  ["Farmgate", "Central", "27", 23.7586, 90.3897],
  ["Tejgaon", "Central", "24", 23.7642, 90.3930],
  ["Moghbazar", "Central", "35", 23.7487, 90.4061],
  ["Malibagh", "East", "22", 23.7495, 90.4170],
  ["Rampura", "East", "23", 23.7608, 90.4207],
  ["Badda", "East", "21", 23.7806, 90.4265],
  ["Bashundhara R/A", "East", "17", 23.8191, 90.4526],
  ["Khilgaon", "East", "2", 23.7517, 90.4310],
  ["Jatrabari", "East", "48", 23.7104, 90.4347],
  ["Mohakhali", "Central", "20", 23.7778, 90.4050],
  ["Wari", "South", "41", 23.7180, 90.4184],
];

export const DEPARTMENTS: { name: string; code: string; description: string; categories: IssueCategory[]; slug: string }[] = [
  { name: "Roads & Highways", code: "RHD", slug: "roads", description: "Road surfaces, potholes, cracks and road markings.", categories: ["ROAD_DAMAGE"] },
  { name: "Street Lighting", code: "SLD", slug: "lighting", description: "Streetlights, poles and public lighting circuits.", categories: ["STREETLIGHT"] },
  { name: "Drainage & Sewerage", code: "DSD", slug: "drainage", description: "Storm drains, sewers, waterlogging and manholes.", categories: ["DRAINAGE"] },
  { name: "Waste Management", code: "WMD", slug: "waste", description: "Garbage collection, dumping and secondary transfer stations.", categories: ["WASTE_MANAGEMENT"] },
  { name: "Footpaths & Pedestrian Safety", code: "FPD", slug: "footpaths", description: "Footpaths, kerbs, footbridges and crossings.", categories: ["FOOTPATH"] },
  { name: "Public Works & Facilities", code: "PWD", slug: "publicworks", description: "Parks, public toilets, bus shelters, signage and other civic assets.", categories: ["PUBLIC_INFRASTRUCTURE"] },
];

export const DEFAULT_SLA_DAYS = { LOW: 21, MEDIUM: 10, HIGH: 4, CRITICAL: 1 } as const;

export const DEFAULT_PLATFORM_SETTINGS = {
  cityName: "Dhaka",
  mapCenter: { lat: 23.7808, lng: 90.4093, zoom: 12 },
  cityBounds: { north: 23.95, south: 23.66, east: 90.52, west: 90.3 },
  duplicateRadiusMeters: 150,
  allowCitizenRegistration: true,
  autoRouteToDepartment: true,
  reminderIntervalHours: 24,
  slaDays: DEFAULT_SLA_DAYS,
  supportEmail: "support@civicpulse.gov",
};
