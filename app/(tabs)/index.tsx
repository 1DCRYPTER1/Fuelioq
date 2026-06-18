import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
  ScrollView,
} from "react-native";
import MapView from "react-native-map-clustering";
import { PROVIDER_GOOGLE, Region, Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as Location from "expo-location";

// Database & Components
import { getStationsByState } from "../../lib/supabase";
import FuelMarker from "../../components/FuelMarker";
import FuelPopupCard from "../../components/FuelPopupCard";

const { width } = Dimensions.get("window");

// Geofence bounding box
const AUSTRALIA_BOUNDS = {
  latitude: -25.2744,
  longitude: 133.7751,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

const STATE_COORDINATES: Record<string, Region> = {
  NSW: { latitude: -33.8688, longitude: 151.2093, latitudeDelta: 0.1, longitudeDelta: 0.1 },
  VIC: { latitude: -37.8136, longitude: 144.9631, latitudeDelta: 0.1, longitudeDelta: 0.1 },
  QLD: { latitude: -27.4705, longitude: 153.0260, latitudeDelta: 0.1, longitudeDelta: 0.1 },
  WA: { latitude: -31.9505, longitude: 115.8605, latitudeDelta: 0.1, longitudeDelta: 0.1 },
  SA: { latitude: -34.9285, longitude: 138.6007, latitudeDelta: 0.1, longitudeDelta: 0.1 },
  TAS: { latitude: -42.8821, longitude: 147.3272, latitudeDelta: 0.1, longitudeDelta: 0.1 },
  ACT: { latitude: -35.2809, longitude: 149.1300, latitudeDelta: 0.1, longitudeDelta: 0.1 },
  NT: { latitude: -12.4634, longitude: 130.8456, latitudeDelta: 0.1, longitudeDelta: 0.1 },
};
const STATES = Object.keys(STATE_COORDINATES);

function mapRegionToStateCode(region: string): string | null {
  const clean = region.trim().toUpperCase();
  const states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
  if (states.includes(clean)) return clean;
  
  const mapping: Record<string, string> = {
    "NEW SOUTH WALES": "NSW",
    "VICTORIA": "VIC",
    "QUEENSLAND": "QLD",
    "WESTERN AUSTRALIA": "WA",
    "SOUTH AUSTRALIA": "SA",
    "TASMANIA": "TAS",
    "AUSTRALIAN CAPITAL TERRITORY": "ACT",
    "NORTHERN TERRITORY": "NT",
  };
  return mapping[clean] || null;
}

// Custom dark mode theme mapped exactly to the provided Google Maps Dark Color Palette and All Fuels blue
const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#131b26" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#45B2D3" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#131b26" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#45B2D3" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#153434" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#1e3b3c" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#1e3b3c" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#3a4f63" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0d1117" }] }
];

const FUEL_TYPES = ["All fuels", "U91", "U95", "U98", "Diesel", "Premium Diesel", "LPG"];

export default function FuelMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);

  const [stations, setStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [selectedFuel, setSelectedFuel] = useState("All fuels");
  const [selectedState, setSelectedState] = useState("NSW");
  
  const [debouncedFuel, setDebouncedFuel] = useState("All fuels");
  const [debouncedState, setDebouncedState] = useState("NSW");

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownHeight = useSharedValue(0);

  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const stateDropdownHeight = useSharedValue(0);

  const isUnavailableState = selectedState !== "NSW" && selectedState !== "WA" && selectedState !== "SA" && selectedState !== "QLD" && selectedState !== "ACT";

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFuel(selectedFuel);
    }, 250);
    return () => clearTimeout(handler);
  }, [selectedFuel]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedState(selectedState);
    }, 200);
    return () => clearTimeout(handler);
  }, [selectedState]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync({});
      
      // Ensure mapRef exists before calling animateToRegion
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }, 1000);
        }
      }, 500);

      // Reverse geocode to detect user's local Australian state on startup
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (geocode && geocode.length > 0) {
          const region = geocode[0].region;
          if (region) {
            const detectedState = mapRegionToStateCode(region);
            if (detectedState) {
              console.log(`Detected local state: ${detectedState}`);
              setSelectedState(detectedState);
            }
          }
        }
      } catch (err) {
        console.warn("Failed reverse geocoding location:", err);
      }
    })();
  }, []);

  // Automatically fetch the entire state's data when the user switches states.
  // Uses active-flag cleanup to ensure out-of-order rapid responses don't corrupt state.
  useEffect(() => {
    let active = true;
    (async () => {
      const data = await getStationsByState(debouncedState);
      if (active) {
        console.log(`Fetched ${data?.length || 0} stations for ${debouncedState}`);
        setStations(data || []);
      }
    })();
    return () => {
      active = false;
    };
  }, [debouncedState]);

  const toggleDropdown = () => {
    if (isStateDropdownOpen) toggleStateDropdown();
    const nextState = !isDropdownOpen;
    setIsDropdownOpen(nextState);
    dropdownHeight.value = withTiming(nextState ? 280 : 0, { duration: 300 });
  };

  const toggleStateDropdown = () => {
    if (isDropdownOpen) toggleDropdown();
    const nextState = !isStateDropdownOpen;
    setIsStateDropdownOpen(nextState);
    stateDropdownHeight.value = withTiming(nextState ? 280 : 0, { duration: 300 });
  };

  const selectFuel = (fuel: string) => {
    setSelectedFuel(fuel);
    toggleDropdown();
  };

  const selectState = (state: string) => {
    setSelectedState(state);
    toggleStateDropdown();
    
    // Animate map to the new state
    if (mapRef.current) {
      mapRef.current.animateToRegion(STATE_COORDINATES[state], 1000);
    }
  };

  const animatedDropdownStyle = useAnimatedStyle(() => ({
    height: dropdownHeight.value,
    opacity: dropdownHeight.value > 0 ? withTiming(1) : withTiming(0),
    overflow: "hidden",
  }));

  const animatedStateDropdownStyle = useAnimatedStyle(() => ({
    height: stateDropdownHeight.value,
    opacity: stateDropdownHeight.value > 0 ? withTiming(1) : withTiming(0),
    overflow: "hidden",
    position: 'absolute',
    right: 0,
    top: 70,
  }));

  const mapMarkers = useMemo(() => {
    try {
      return stations
        .filter((station) => {
          if (!station || !station.latitude || !station.longitude) return false;
          if (debouncedFuel === "All fuels") return true;
          if (!Array.isArray(station.prices)) return false;
          return station.prices.some((p: any) => p && p.type === debouncedFuel && typeof p.value === 'number' && p.value > 0);
        })
        .map((station) => (
          <Marker
            key={station.id}
            coordinate={{ latitude: parseFloat(station.latitude), longitude: parseFloat(station.longitude) }}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedStation(station);
            }}
          >
            <FuelMarker
              station={station}
              selectedFuel={debouncedFuel}
            />
          </Marker>
        ));
    } catch (err) {
      console.error("[Map Screen Crash Logger] Failed generating map markers:", err);
      return [];
    }
  }, [stations, debouncedFuel]);

  return (
    <View style={styles.container}>
      {/* 1. Clustered Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP_STYLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={AUSTRALIA_BOUNDS}
        minZoomLevel={3.5}
        radius={80}
        clusterColor="#45B2D3"
        clusterTextColor="#131b26"
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        mapPadding={{ top: 0, right: 0, bottom: 85, left: 0 }}
        onPress={() => {
          setSelectedStation(null);
          if (isDropdownOpen) toggleDropdown();
          if (isStateDropdownOpen) toggleStateDropdown();
        }}
      >
        {mapMarkers}
      </MapView>

      {/* 2. Floating Modern Header Row */}
      <View style={[styles.headerOverlay, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity activeOpacity={0.9} style={styles.fuelInfoPill} onPress={toggleDropdown}>
            <View style={styles.fuelIconContainer}>
              <MaterialCommunityIcons name="gas-station" size={20} color="#000" />
            </View>
            <View style={styles.fuelTextContainer}>
              <Text style={styles.fuelTitle}>{selectedFuel}</Text>
              <Text style={styles.fuelSubtitle}>Get petrol diesel gas and more with ease.</Text>
            </View>
            <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.statePickerButton} activeOpacity={0.9} onPress={toggleStateDropdown}>
            <Text style={styles.statePickerText}>{selectedState}</Text>
            <Ionicons name={isStateDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#131b26" />
          </TouchableOpacity>
        </View>

        {/* 3. Animated Dropdown Menus */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', zIndex: 99 }}>
          {/* Fuel Dropdown */}
          <Animated.View style={[styles.dropdownContainer, animatedDropdownStyle]}>
            <ScrollView style={{ flex: 1, width: '100%' }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
              {FUEL_TYPES.map((fuel) => (
                <TouchableOpacity key={fuel} style={styles.dropdownItem} onPress={() => selectFuel(fuel)}>
                  <Text style={[styles.dropdownText, selectedFuel === fuel && styles.dropdownTextSelected]}>
                    {fuel}
                  </Text>
                  {selectedFuel === fuel && <Ionicons name="checkmark-circle" size={20} color="#45B2D3" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* State Dropdown */}
          <Animated.View style={[styles.dropdownContainer, animatedStateDropdownStyle, { width: '30%' }]}>
            <ScrollView style={{ flex: 1, width: '100%' }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
              {STATES.map((state) => (
                <TouchableOpacity key={state} style={styles.dropdownItem} onPress={() => selectState(state)}>
                  <Text style={[styles.dropdownText, selectedState === state && styles.dropdownTextSelected]}>
                    {state}
                  </Text>
                  {selectedState === state && <Ionicons name="checkmark-circle" size={16} color="#45B2D3" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </View>

      {/* 2.5 Unavailable State Overlay */}
      {isUnavailableState && (
        <View style={styles.unavailableOverlay}>
          <View style={styles.unavailableCard}>
            <MaterialCommunityIcons name="gas-station-off" size={48} color="#45B2D3" />
            <Text style={styles.unavailableTitle}>{selectedState} Fuel Prices Unavailable</Text>
            <Text style={styles.unavailableSubtitle}>
              We are working on getting the live rates for this state. Stay tuned!
            </Text>
          </View>
        </View>
      )}

      {/* 4. Premium Rounded Top Popup Card */}
      <FuelPopupCard
        station={selectedStation}
        onClose={() => setSelectedStation(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131b26" },
  headerOverlay: { position: "absolute", left: 16, right: 16, zIndex: 99 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fuelInfoPill: {
    flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#45B2D3",
    height: 60, borderRadius: 16, paddingHorizontal: 10, marginRight: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  fuelIconContainer: {
    width: 40, height: 40, backgroundColor: "#FFFFFF", borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  fuelTextContainer: { flex: 1, justifyContent: "center" },
  fuelTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 2 },
  fuelSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
  statePickerButton: {
    paddingHorizontal: 16, height: 50, backgroundColor: "#FFFFFF", borderRadius: 25,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  statePickerText: { fontSize: 16, fontWeight: "700", color: "#131b26" },
  unavailableOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 150,
    bottom: 120,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  unavailableCard: {
    backgroundColor: "rgba(27, 38, 54, 0.95)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    width: "100%",
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  unavailableSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
  dropdownContainer: {
    backgroundColor: "#FFFFFF", borderRadius: 16, marginTop: 10, width: "75%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  dropdownText: { fontSize: 15, color: "#2C3E50", fontWeight: "500" },
  dropdownTextSelected: { color: "#45B2D3", fontWeight: "700" },
});
