import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ywemmerqendhkujkoigk.supabase.co';
const supabaseAnonKey = 'sb_publishable_w_VnjvXPXUy49W50wFBO3Q_vmPx3fWl';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function normalizeFuelType(type: string): string {
  if (!type) return "";
  const t = type.toUpperCase().trim();
  if (t === "U91" || t === "ULP" || t === "E10" || t === "UNLEADED 91" || t === "UNLEADED") return "U91";
  if (t === "U95" || t === "P95" || t === "PULP95" || t === "PREMIUM 95" || t === "PREMIUM UNLEADED 95") return "U95";
  if (t === "U98" || t === "P98" || t === "PULP98" || t === "PREMIUM 98" || t === "PREMIUM UNLEADED 98") return "U98";
  if (t === "DIESEL" || t === "DL" || t === "DSL") return "Diesel";
  if (t === "PREMIUM DIESEL" || t === "PDL" || t === "PDSL") return "Premium Diesel";
  if (t === "LPG") return "LPG";
  return type;
}

export function normalizeStationPrices(station: any): any {
  if (!station || !Array.isArray(station.prices)) return station;
  
  const uniquePrices = new Map<string, any>();
  
  for (const p of station.prices) {
    const normType = normalizeFuelType(p.type);
    if (!normType) continue;
    
    if (uniquePrices.has(normType)) {
      const existing = uniquePrices.get(normType);
      if (typeof p.value === 'number' && p.value < existing.value) {
        uniquePrices.set(normType, { ...p, type: normType });
      }
    } else {
      uniquePrices.set(normType, { ...p, type: normType });
    }
  }

  return {
    ...station,
    prices: Array.from(uniquePrices.values())
  };
}

// Helper to efficiently fetch stations in the visible map bounding box
export async function getStationsInBounds(minLat: number, minLng: number, maxLat: number, maxLng: number) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_stations_in_bounds`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        min_lat: minLat,
        min_lng: minLng,
        max_lat: maxLat,
        max_lng: maxLng
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching stations in bounds:", response.status, errorText);
      return [];
    }
    
    const stations = await response.json();
    return Array.isArray(stations) ? stations.map(normalizeStationPrices) : [];
  } catch (error) {
    console.error("Error fetching stations in bounds:", error);
    return [];
  }
}

async function diagnoseNetwork() {
  console.log("[Diagnostic] Checking network connectivity from the device/simulator...");
  const targets = [
    'https://1.1.1.1',
    'https://google.com',
    'https://ywemmerqendhkujkoigk.supabase.co'
  ];
  for (const url of targets) {
    try {
      const start = Date.now();
      const res = await fetch(url, { method: 'GET' });
      console.log(`[Diagnostic] CONNECTED to ${url} in ${Date.now() - start}ms. Status: ${res.status}`);
    } catch (err: any) {
      console.warn(`[Diagnostic] FAILED connecting to ${url}. Error: ${err?.message || err}`);
    }
  }
}

function parseEWKBPoint(hex: string) {
  if (!hex || hex.length < 50) return { latitude: 0, longitude: 0 };
  const littleEndian = hex.substring(0, 2) === '01';
  const lonHex = hex.substring(18, 34);
  const latHex = hex.substring(34, 50);

  const hexToDouble = (h: string) => {
    let bytes = [];
    for (let i = 0; i < 16; i += 2) {
      bytes.push(parseInt(h.substring(i, i + 2), 16));
    }
    if (littleEndian) {
      bytes.reverse();
    }
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    bytes.forEach((b, i) => view.setUint8(i, b));
    return view.getFloat64(0);
  };

  return {
    longitude: hexToDouble(lonHex),
    latitude: hexToDouble(latHex)
  };
}

// Fetch all stations for a specific state instantly to allow the clustering engine to process them locally
export async function getStationsByState(state: string) {
  try {
    let allStations: any[] = [];
    let from = 0;
    let limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${supabaseUrl}/rest/v1/fuel_stations?state=eq.${state}`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
          'Range': `${from}-${from + limit - 1}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error fetching stations by state:", response.status, errorText);
        break;
      }
      
      const stations = await response.json();
      if (Array.isArray(stations) && stations.length > 0) {
        allStations = allStations.concat(stations);
        if (stations.length < limit) {
          hasMore = false;
        } else {
          from += limit;
        }
      } else {
        hasMore = false;
      }
    }
    
    const mapped = allStations.map(st => {
      const coords = parseEWKBPoint(st.location);
      return {
        ...st,
        latitude: coords.latitude,
        longitude: coords.longitude
      };
    });

    return mapped.map(normalizeStationPrices);
  } catch (error) {
    console.error("Error fetching stations by state:", error);
    diagnoseNetwork();
    return [];
  }
}

// Fetch and calculate average, min, and max prices for all fuel types in a state from the database
export async function getStateAverages(state: string) {
  try {
    let allData: any[] = [];
    let from = 0;
    let limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${supabaseUrl}/rest/v1/fuel_stations?select=prices&state=eq.${state}`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
          'Range': `${from}-${from + limit - 1}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error fetching state averages:", response.status, errorText);
        break;
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < limit) {
          hasMore = false;
        } else {
          from += limit;
        }
      } else {
        hasMore = false;
      }
    }

    if (allData.length === 0) return null;
    const data = allData;
    if (!data || !Array.isArray(data)) return null;

    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const mins: Record<string, number> = {};
    const maxs: Record<string, number> = {};

    for (const station of data) {
      const prices = station.prices;
      if (Array.isArray(prices)) {
        for (const p of prices) {
          if (p.type && typeof p.value === 'number' && p.value > 0) {
            const normType = normalizeFuelType(p.type);
            sums[normType] = (sums[normType] || 0) + p.value;
            counts[normType] = (counts[normType] || 0) + 1;
            
            if (mins[normType] === undefined || p.value < mins[normType]) {
              mins[normType] = p.value;
            }
            if (maxs[normType] === undefined || p.value > maxs[normType]) {
              maxs[normType] = p.value;
            }
          }
        }
      }
    }

    const results: Record<string, { average: number; min: number; max: number }> = {};
    for (const type in sums) {
      results[type] = {
        average: parseFloat((sums[type] / counts[type]).toFixed(1)),
        min: mins[type],
        max: maxs[type]
      };
    }
    return results;
  } catch (error) {
    console.error("Error calculating state averages:", error);
    return null;
  }
}

export function getStateFuelTypeCode(state: string, fuelType: string): string {
  const s = state.toUpperCase().trim();
  const f = fuelType; // "U91", "U95", "U98", "Diesel", "Premium Diesel", "LPG"

  if (s === "NSW" || s === "ACT" || s === "VIC") {
    if (f === "U91") return "U91";
    if (f === "U95") return "P95";
    if (f === "U98") return "P98";
    if (f === "Diesel") return s === "VIC" ? "DSL" : "DL";
    if (f === "Premium Diesel") return s === "VIC" ? "PDSL" : "PDL";
    if (f === "LPG") return "LPG";
  }
  
  if (s === "QLD" || s === "SA") {
    if (f === "U91") return "Unleaded";
    if (f === "U95") return "Premium Unleaded 95";
    if (f === "U98") return "Premium Unleaded 98";
    if (f === "Diesel") return "Diesel";
    if (f === "Premium Diesel") return "Premium Diesel";
    if (f === "LPG") return "LPG";
  }

  if (s === "WA") {
    if (f === "U91") return "U91";
    if (f === "U95") return "U95";
    if (f === "U98") return "U98";
    if (f === "Diesel") return "Diesel";
    if (f === "Premium Diesel") return "Premium Diesel";
    if (f === "LPG") return "LPG";
  }

  return fuelType;
}

// Fetch the last 14 price history records for a station and fuel type
export async function getStationPriceHistory(stationId: string, fuelType: string) {
  try {
    const state = stationId.split('_')[0] || "NSW";
    const dbFuelType = getStateFuelTypeCode(state, fuelType);
    const response = await fetch(
      `${supabaseUrl}/rest/v1/fuel_price_history?station_id=eq.${stationId}&fuel_type=eq.${dbFuelType}&order=recorded_at.desc&limit=14`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching station price history:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    // Return sorted oldest to newest for the graph plotting
    return Array.isArray(data) ? data.reverse() : [];
  } catch (error) {
    console.error("Error fetching station price history:", error);
    return [];
  }
}

// Fetch the last 30 daily price averages for a state and fuel type via RPC
export async function getStateHistoryAverages(state: string, fuelType: string) {
  try {
    const dbFuelType = getStateFuelTypeCode(state, fuelType);
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_state_history_averages`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state_code: state,
        fuel_type_code: dbFuelType
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching state history averages:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching state history averages:", error);
    return [];
  }
}


