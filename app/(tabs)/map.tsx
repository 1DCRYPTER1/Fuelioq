import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Dimensions,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps"; // Ensure UrlTile is imported
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Component Imports
import FuelBottomSheet from "../../components/FuelBottomSheet";
import FuelMarker from "../../components/FuelMarker";

const { width } = Dimensions.get("window");

// Geofence bounding box to keep the user focused purely on Australia
const AUSTRALIA_BOUNDS = {
  latitude: -25.2744,
  longitude: 133.7751,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

// Mock station coordinates in Melbourne matching our advanced schema profiles
const MOCK_STATIONS = [
  {
    id: "1",
    latitude: -37.8136,
    longitude: 144.9631,
    brand: "reddy",
    name: "Reddy Express Bundoora",
    address: "127-132 Plenty Rd & Greenwood Dr, Bundoora VIC 3083",
    phone: "03 9075 1452",
    distance: "1.1 km",
    updatedAt: "1h ago",
    status: "Open 24/7",
    prices: [
      { type: "U91", value: 144.5, active: true },
      { type: "U95", value: 170.9, active: false },
      { type: "U98", value: 178.9, active: false },
      { type: "DIESEL", value: 196.9, active: false },
      { type: "PremDSL", value: 199.9, active: false },
      { type: "LPG", value: 98.4, active: false },
    ],
  },
  {
    id: "2",
    latitude: -37.815,
    longitude: 144.97,
    brand: "bp",
    name: "BP Central Melbourne",
    address: "456 Lonsdale St, Melbourne VIC 3000",
    phone: "03 9600 1234",
    distance: "2.4 km",
    updatedAt: "34m ago",
    status: "Open 24/7",
    prices: [
      { type: "U91", value: 162.9, active: true },
      { type: "U95", value: 174.9, active: false },
      { type: "U98", value: 182.9, active: false },
      { type: "DIESEL", value: 194.9, active: false },
    ],
  },
  {
    id: "3",
    latitude: -37.81,
    longitude: 144.955,
    brand: "ampol",
    name: "Ampol Carlton",
    address: "200 Lygon St, Carlton VIC 3053",
    phone: "03 9347 5566",
    distance: "1.8 km",
    updatedAt: "4h ago",
    status: "Open 6am - Midnight",
    prices: [
      { type: "U91", value: 159.9, active: true },
      { type: "U95", value: 169.9, active: false },
      { type: "U98", value: 179.9, active: false },
      { type: "DIESEL", value: 189.9, active: false },
    ],
  },
];

export default function FuelMapScreen() {
  const insets = useSafeAreaInsets();

  // Track the full station object instead of just an ID string to feed the details panel fluidly
  const [selectedStation, setSelectedStation] = useState<any>(null);

  return (
    <View style={styles.container}>
      {/* 1. Map Canvas View */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: -37.8136, // Centered locally on Melbourne for layout validation
          longitude: 144.9631,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        mapType="none" // Wipes the underlying native map data to block bleed-through text
        onPress={() => setSelectedStation(null)} // Closes the bottom detail card if user taps empty map space
      >
        {/* FIX 1: Un-commented and activated clean minimalist tile mapping layer */}
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
          maximumZ={19}
          flipY={false}
        />

        {/* 2. Custom Station Markers Rendering Loop */}
        {MOCK_STATIONS.map((station) => {
          const isSelected = selectedStation?.id === station.id;

          // Pull out the primary active price (usually U91) to show on the map pin badge
          const primaryPriceNode =
            station.prices.find((p) => p.active) || station.prices[0];

          return (
            <Marker
              key={station.id}
              coordinate={{
                latitude: station.latitude,
                longitude: station.longitude,
              }}
              // FIX 2: Intercept gesture tap here and block background map reset event chain
              onPress={(e) => {
                e.stopPropagation();
                setSelectedStation(station);
              }}
              // FIX 3: Force view updates to true so custom UI elements intercept tap targets cleanly
              tracksViewChanges={true}
            >
              {/* FIX 4: Block internal custom view sub-components from capturing parent clicks */}
              <View pointerEvents="none">
                <FuelMarker
                  brandKey={station.brand}
                  price={primaryPriceNode.value}
                  isSelected={isSelected}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* 3. Floating Modern Header Row Controls Overlay */}
      <View style={[styles.headerOverlay, { top: insets.top + 10 }]}>
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color="#7F8C8D"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search fuel stations..."
            placeholderTextColor="#95A5A6"
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.9}>
          <Ionicons name="options-outline" size={22} color="#2C3E50" />
        </TouchableOpacity>
      </View>

      {/* 4. Advanced Sliding Info Details Drawer Overlay */}
      <FuelBottomSheet
        station={selectedStation}
        onClose={() => setSelectedStation(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F5F8",
  },
  headerOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 99, // Ensure headers float high over map elements
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 15,
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#2C3E50",
    fontWeight: "500",
  },
  filterButton: {
    width: 50,
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 5,
  },
});
