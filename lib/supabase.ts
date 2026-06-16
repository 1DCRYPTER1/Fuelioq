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

// Helper to efficiently fetch stations in the visible map bounding box
export async function getStationsInBounds(minLat: number, minLng: number, maxLat: number, maxLng: number) {
  const { data, error } = await supabase.rpc('get_stations_in_bounds', {
    min_lat: minLat,
    min_lng: minLng,
    max_lat: maxLat,
    max_lng: maxLng
  });
  
  if (error) {
    console.error("Error fetching stations in bounds:", error);
    return [];
  }
  return data || [];
}

// Fetch all stations for a specific state instantly to allow the clustering engine to process them locally
export async function getStationsByState(state: string) {
  const { data, error } = await supabase.rpc('get_stations_by_state', {
    state_name: state
  });
  
  if (error) {
    console.error("Error fetching stations by state:", error);
    return [];
  }
  
  return data || [];
}
