/**
 * Vehicle type classification logic
 * Maps body types to vehicle categories for catalog filtering
 */

export type VehicleType =
  | 'auto'          // Cars, SUVs, Vans
  | 'moto'          // Motorcycles
  | 'atv'           // ATVs, UTVs
  | 'dirt_bikes'    // Dirt bikes, off-road motorcycles
  | 'bus'           // Buses
  | 'pickup'        // Pickup trucks
  | 'rv'            // RVs, motorhomes
  | 'trailer'       // Trailers
  | 'boat'          // Boats
  | 'jet_ski'       // Jet skis, watercraft
  | 'snowmobile'    // Snowmobiles

const BODY_TYPE_MAP: Record<string, VehicleType> = {
  // Auto (default category)
  'SEDAN 4D': 'auto',
  '4DR SPOR': 'auto',
  'HATCHBAC': 'auto',
  'COUPE': 'auto',
  'COUPE 3D': 'auto',
  '2DR SPOR': 'auto',
  'CONVERTI': 'auto',
  'ROADSTER': 'auto',
  'SPORTS V': 'auto',
  'STATION': 'auto',
  'CARGO VA': 'auto',
  '4DR EXT': 'auto',
  '3DR EXT': 'auto',
  'LIMOUSIN': 'auto',
  'SEDAN 2': 'auto',
  'UTILITY': 'auto',
  'STEP VAN': 'auto',

  // Motorcycles
  'ROAD/STR': 'moto',
  'RACER': 'moto',
  'MOTOR SC': 'moto',
  'GLIDERS': 'moto',

  // Dirt Bikes
  'ENDURO': 'dirt_bikes',
  'MOTO CRO': 'dirt_bikes',

  // ATV
  'ALL TERR': 'atv',

  // Pickup Trucks
  'CREW PIC': 'pickup',
  'CLUB CAB': 'pickup',
  'EXTENDED': 'pickup',
  'PICKUP': 'pickup',
  'SPORT PI': 'pickup',
  'CREW CHA': 'pickup',

  // Buses
  'BUS': 'bus',
  'FIRE TRU': 'bus',

  // RVs
  'MOTORIZE': 'rv',

  // Trailers/Trucks
  'TRACTOR': 'trailer',
  'CONVENTI': 'trailer',
  'CHASSIS': 'trailer',
  'CUTAWAY': 'trailer',
  'TILT CAB': 'trailer',
  'INCOMPLE': 'trailer',
  'INCOMP P': 'trailer',
}

/**
 * Get vehicle type from body type
 */
export function getVehicleType(body: string | null): VehicleType {
  if (!body) return 'auto'
  return BODY_TYPE_MAP[body.toUpperCase()] || 'auto'
}

/**
 * Get SQL WHERE clause for filtering by vehicle type
 */
export function getVehicleTypeFilter(type: VehicleType): string | null {
  const bodyTypes: Record<VehicleType, string[]> = {
    auto: [
      'SEDAN 4D', '4DR SPOR', 'HATCHBAC', 'COUPE', 'COUPE 3D', '2DR SPOR',
      'CONVERTI', 'ROADSTER', 'SPORTS V', 'STATION', 'CARGO VA', '4DR EXT',
      '3DR EXT', 'LIMOUSIN', 'SEDAN 2', 'UTILITY', 'STEP VAN'
    ],
    moto: ['ROAD/STR', 'RACER', 'MOTOR SC', 'GLIDERS'],
    dirt_bikes: ['ENDURO', 'MOTO CRO'],
    atv: ['ALL TERR'],
    pickup: ['CREW PIC', 'CLUB CAB', 'EXTENDED', 'PICKUP', 'SPORT PI', 'CREW CHA'],
    bus: ['BUS', 'FIRE TRU'],
    rv: ['MOTORIZE'],
    trailer: ['TRACTOR', 'CONVENTI', 'CHASSIS', 'CUTAWAY', 'TILT CAB', 'INCOMPLE', 'INCOMP P'],
    boat: [], // Not in current dataset
    jet_ski: [], // Not in current dataset
    snowmobile: [], // Not in current dataset
  }

  const types = bodyTypes[type]
  if (!types || types.length === 0) return null

  // Return SQL IN clause values
  return types.map(t => `'${t}'`).join(', ')
}

/**
 * Get display label for vehicle type
 */
export function getVehicleTypeLabel(type: VehicleType, lang: 'en' | 'ru'): string {
  const labels: Record<VehicleType, { en: string; ru: string }> = {
    auto: { en: 'Auto', ru: 'Авто' },
    moto: { en: 'Moto', ru: 'Мото' },
    atv: { en: 'ATV', ru: 'ATV' },
    dirt_bikes: { en: 'Dirt Bikes', ru: 'Эндуро' },
    bus: { en: 'Bus', ru: 'Автобусы' },
    pickup: { en: 'Pickup Trucks', ru: 'Пикапы' },
    rv: { en: 'RVs', ru: 'Дома на колесах' },
    trailer: { en: 'Trailers', ru: 'Трейлеры' },
    boat: { en: 'Boats', ru: 'Лодки' },
    jet_ski: { en: 'Jet Skis', ru: 'Гидроциклы' },
    snowmobile: { en: 'Snowmobile', ru: 'Снегоходы' },
  }

  return labels[type][lang]
}
