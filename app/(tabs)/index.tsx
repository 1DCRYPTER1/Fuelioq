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
  TextInput,
} from "react-native";
import MapView from "react-native-map-clustering";
import { PROVIDER_GOOGLE, Region, Marker, Polygon } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as Location from "expo-location";
import { useIsFocused } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Database & Components
import { getStationsByState } from "../../lib/supabase";
import FuelMarker from "../../components/FuelMarker";
import FuelPopupCard from "../../components/FuelPopupCard";
import { useAlert } from "../../context/AlertContext";

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
  const { showAlert } = useAlert();

  const [stations, setStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [selectedFuel, setSelectedFuel] = useState("All fuels");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  
  const [debouncedFuel, setDebouncedFuel] = useState("All fuels");
  const [debouncedState, setDebouncedState] = useState<string | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownHeight = useSharedValue(0);

  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const stateDropdownHeight = useSharedValue(0);

  const [searchPreference, setSearchPreference] = useState<"state" | "suburb">("state");
  const [isSearchBarOpen, setIsSearchBarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState<any | null>(null);
  const [polygonCoords, setPolygonCoords] = useState<any[]>([]);
  
  const [mapRegion, setMapRegion] = useState<Region>(AUSTRALIA_BOUNDS);
  const searchBarWidth = useSharedValue(60);
  const isFocused = useIsFocused();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isFocused) {
      (async () => {
        try {
          const pref = await AsyncStorage.getItem("search_preference");
          if (pref === "suburb" || pref === "state") {
            setSearchPreference(pref);
            if (pref === "state") {
              setSelectedSuburb(null);
              setPolygonCoords([]);
            }
          }
        } catch (err) {
          console.warn("Failed to load search preference:", err);
        }
      })();
    }
  }, [isFocused]);

  const animatedSearchContainerStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(searchBarWidth.value, { duration: 350 }),
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
      height: 60,
      position: "absolute",
      right: 0,
      top: 0,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
      zIndex: 99,
    };
  });

  const toggleSearch = () => {
    if (isSearchBarOpen) {
      searchBarWidth.value = 60;
      setIsSearchBarOpen(false);
      setSearchSuggestions([]);
      inputRef.current?.blur();
    } else {
      searchBarWidth.value = width - 32;
      setIsSearchBarOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 350);
    }
  };

  const handleSearchBtnPress = () => {
    if (selectedSuburb) {
      setSelectedSuburb(null);
      setPolygonCoords([]);
      const stateToUse = selectedState || "NSW";
      if (mapRef.current && STATE_COORDINATES[stateToUse]) {
        mapRef.current.animateToRegion(STATE_COORDINATES[stateToUse], 1000);
      }
    } else {
      toggleSearch();
    }
  };

  const handleSelectSuburb = async (suburb: any) => {
    setSelectedSuburb(suburb);
    setSearchQuery("");
    setSearchSuggestions([]);
    searchBarWidth.value = 60;
    setIsSearchBarOpen(false);
    inputRef.current?.blur();

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: parseFloat(suburb.lat),
        longitude: parseFloat(suburb.lon),
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 1000);
    }

    try {
      const queryStr = `${suburb.suburb} ${suburb.postcode}, Australia`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&polygon_geojson=1&format=json&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data && data[0] && data[0].geojson) {
          const geojson = data[0].geojson;
          let coords: any[] = [];
          if (geojson.type === "Polygon" && Array.isArray(geojson.coordinates) && Array.isArray(geojson.coordinates[0])) {
            coords = geojson.coordinates[0].map((c: any) => ({
              longitude: Number(c[0]),
              latitude: Number(c[1])
            })).filter((c: any) => !isNaN(c.longitude) && !isNaN(c.latitude));
          } else if (geojson.type === "MultiPolygon" && Array.isArray(geojson.coordinates) && Array.isArray(geojson.coordinates[0]) && Array.isArray(geojson.coordinates[0][0])) {
            coords = geojson.coordinates[0][0].map((c: any) => ({
              longitude: Number(c[0]),
              latitude: Number(c[1])
            })).filter((c: any) => !isNaN(c.longitude) && !isNaN(c.latitude));
          }
          setPolygonCoords(coords);
        }
      }
    } catch (err) {
      console.warn("Failed fetching boundary geojson:", err);
    }
  };

  // Autocomplete fetch effect
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}+Australia&format=json&addressdetails=1&limit=5`);
        if (response.ok) {
          const data = await response.json();
          const formatted = data.map((item: any) => {
            const addr = item.address || {};
            const suburb = addr.suburb || addr.town || addr.city || addr.village || addr.suburb_district || "Unknown";
            const postcode = addr.postcode || "";
            return {
              display_name: item.display_name,
              suburb,
              postcode,
              lat: item.lat,
              lon: item.lon
            };
          });
          setSearchSuggestions(formatted);
        }
      } catch (err) {
        console.warn("Autocomplete fetch failed:", err);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const isUnavailableState = selectedState !== null && selectedState !== "NSW" && selectedState !== "WA" && selectedState !== "SA" && selectedState !== "QLD" && selectedState !== "ACT" && selectedState !== "VIC";

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFuel(selectedFuel);
    }, 250);
    return () => clearTimeout(handler);
  }, [selectedFuel]);

  useEffect(() => {
    if (!selectedState) return;
    const handler = setTimeout(() => {
      setDebouncedState(selectedState);
    }, 200);
    return () => clearTimeout(handler);
  }, [selectedState]);

  useEffect(() => {
    (async () => {
      let finalState = "NSW";
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          
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
                finalState = detectedState;
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed reverse geocoding location:", err);
        showAlert({
          type: 'warning',
          title: 'Location Notice',
          message: 'Could not determine your local state. Falling back to default.',
          duration: 4000
        });
      } finally {
        setSelectedState(finalState);
      }
    })();
  }, []);

  const logPerformanceStats = (phase: string) => {
    const stats: any = {};
    if (typeof global !== 'undefined' && (global as any).HermesInternal) {
      const hermesStats = (global as any).HermesInternal.getInstrumentedStats();
      // Log all keys to see what this specific engine version returns
      console.log(`[Hermes Keys - ${phase}]`, Object.keys(hermesStats));
      
      const heapUsed = hermesStats['jsHeapUsedBytes'] || hermesStats['Hermes_AllocatedBytes'] || hermesStats['allocatedBytes'];
      const heapSize = hermesStats['jsHeapSizeTotalBytes'] || hermesStats['Hermes_HeapSize'] || hermesStats['heapSize'];
      if (heapUsed) stats.jsHeapUsedMB = (heapUsed / 1024 / 1024).toFixed(2) + ' MB';
      if (heapSize) stats.jsHeapSizeMB = (heapSize / 1024 / 1024).toFixed(2) + ' MB';
    } else {
      stats.jsHeapUsedMB = 'N/A (Hermes disabled)';
    }
    console.log(`[Performance Log - ${phase}]`, JSON.stringify(stats));
  };

  // Automatically fetch the entire state's data when the user switches states.
  // Uses active-flag cleanup to ensure out-of-order rapid responses don't corrupt state.
  useEffect(() => {
    if (!debouncedState) return;
    let active = true;
    (async () => {
      const startTime = Date.now();
      logPerformanceStats(`Start Fetching ${debouncedState}`);
      try {
        const data = await getStationsByState(debouncedState);
        const fetchEndTime = Date.now();
        if (active) {
          console.log(`Fetched ${data?.length || 0} stations for ${debouncedState} in ${fetchEndTime - startTime}ms`);
          
          const beforeSetTime = Date.now();
          setStations(data || []);
          const afterSetTime = Date.now();
          
          logPerformanceStats(`After Syncing ${debouncedState}`);
          console.log(`[Performance Log - ${debouncedState}] State update took ${afterSetTime - beforeSetTime}ms. Total sync took ${afterSetTime - startTime}ms.`);
          
          if (data && data.length > 0) {
            showAlert({
              type: 'success',
              title: 'Live Data Synced',
              message: `Fetched ${data.length} stations for ${debouncedState}`,
              duration: 4000
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch state data:", err);
        if (active) {
          showAlert({
            type: 'error',
            title: 'Network Error',
            message: `Failed to fetch live rates for ${debouncedState}. Please check your connection.`,
          });
        }
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
    top: 0,
  }));

  const mapMarkers = useMemo(() => {
    try {
      const isZoomedOut = mapRegion.longitudeDelta > 0.15;
      
      let filteredStations = stations.filter((station) => {
        if (!station || !station.latitude || !station.longitude) return false;
        if (debouncedFuel === "All fuels") return true;
        if (!Array.isArray(station.prices)) return false;
        return station.prices.some((p: any) => p && p.type === debouncedFuel && typeof p.value === 'number' && p.value > 0);
      });

      if (isZoomedOut) {
        // Sort by cheapest of selected fuel or U91 fallback and limit to top 250 to prevent OOM crashes
        filteredStations = filteredStations
          .map(st => {
            const prices = Array.isArray(st.prices) ? st.prices : [];
            let priceVal = 9999;
            if (debouncedFuel === "All fuels") {
              const u91 = prices.find((p: any) => p && p.type === "U91" && typeof p.value === 'number' && p.value > 0);
              priceVal = u91 ? u91.value : (prices[0] ? prices[0].value : 9999);
            } else {
              const matched = prices.find((p: any) => p && p.type === debouncedFuel && typeof p.value === 'number' && p.value > 0);
              priceVal = matched ? matched.value : 9999;
            }
            return { st, priceVal };
          })
          .sort((a, b) => a.priceVal - b.priceVal)
          .slice(0, 250)
          .map(x => x.st);
      }

      return filteredStations.map((station) => (
        <Marker
          key={station.id}
          coordinate={{ latitude: parseFloat(station.latitude), longitude: parseFloat(station.longitude) }}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedStation(station);
          }}
          tracksViewChanges={false}
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
  }, [stations, debouncedFuel, mapRegion.longitudeDelta]);

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
        onRegionChangeComplete={(r) => setMapRegion(r)}
        onPress={() => {
          setSelectedStation(null);
          if (isDropdownOpen) toggleDropdown();
          if (isStateDropdownOpen) toggleStateDropdown();
        }}
      >
        {mapMarkers}
        {polygonCoords.length > 0 && selectedSuburb && (
          <Polygon
            key={selectedSuburb.display_name}
            coordinates={polygonCoords}
            fillColor="rgba(69, 178, 211, 0.2)"
            strokeColor="#45B2D3"
            strokeWidth={2}
            lineDashPattern={[4, 4]}
          />
        )}
      </MapView>

      {/* 2. Floating Modern Header Row */}
      <View style={[styles.headerOverlay, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={[styles.headerRow, { position: "relative" }]}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            style={[
              styles.fuelInfoPill, 
              searchPreference === "suburb" && { marginRight: 72 }
            ]} 
            onPress={toggleDropdown}
          >
            <View style={styles.fuelIconContainer}>
              <MaterialCommunityIcons name="gas-station" size={20} color="#000" />
            </View>
            <View style={styles.fuelTextContainer}>
              <Text style={styles.fuelTitle}>{selectedFuel}</Text>
              <Text style={styles.fuelSubtitle}>Get petrol diesel gas and more with ease.</Text>
            </View>
            <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          {searchPreference === "suburb" ? (
            <Animated.View style={animatedSearchContainerStyle}>
              <View style={{ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 60 }}>
                <TextInput
                  ref={inputRef}
                  style={styles.slidingSearchInput}
                  placeholder="Enter suburb or PIN code"
                  placeholderTextColor="rgba(19,27,38,0.4)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <TouchableOpacity 
                style={{ 
                  width: 60, 
                  height: 60, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  position: 'absolute',
                  right: 0,
                  top: 0
                }} 
                activeOpacity={0.9} 
                onPress={handleSearchBtnPress}
              >
                <Ionicons 
                  name={selectedSuburb ? "close-circle" : (isSearchBarOpen ? "close" : "search")} 
                  size={22} 
                  color="#131b26" 
                />
                {selectedSuburb && !isSearchBarOpen && (
                  <View style={styles.blueBadgeDot} />
                )}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.statePickerButton} activeOpacity={0.9} onPress={toggleStateDropdown}>
              <Text style={styles.statePickerText}>{selectedState || "..."}</Text>
              <Ionicons name={isStateDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#131b26" />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete Suggestions Dropdown */}
        {searchPreference === "suburb" && isSearchBarOpen && searchSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
              {searchSuggestions.map((item, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.suggestionItem} 
                  onPress={() => handleSelectSuburb(item)}
                >
                  <Ionicons name="location-outline" size={16} color="#45B2D3" style={{ marginRight: 10 }} />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {item.suburb}{item.postcode ? `, ${item.postcode}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

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

      {selectedState === "VIC" && (
        <TouchableOpacity
          style={styles.warningFloatingButton}
          onPress={() =>
            showAlert({
              type: "warning",
              title: "VIC Price Info",
              message: "Prices are updated with a 24-hour delay as per Victoria government API regulations.",
            })
          }
          activeOpacity={0.8}
        >
          <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  warningFloatingButton: {
    position: "absolute",
    right: 20,
    bottom: 110,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F39C12",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F39C12",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 98,
  },
  blueBadgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#45B2D3",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  slidingSearchContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#1B2636",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 99,
  },
  slidingSearchInput: {
    flex: 1,
    color: "#131b26",
    fontSize: 14,
    fontWeight: "700",
    height: "100%",
  },
  searchCloseBtn: {
    padding: 4,
  },
  suggestionsContainer: {
    backgroundColor: "#1B2636",
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  suggestionText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
