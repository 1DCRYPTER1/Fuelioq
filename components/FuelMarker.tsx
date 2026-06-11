import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { FUEL_BRANDS } from "../constants/brands";

interface FuelMarkerProps {
  brandKey: string;
  price: number;
  isSelected: boolean;
}

export default function FuelMarker({
  brandKey,
  price,
  isSelected,
}: FuelMarkerProps) {
  const brand = FUEL_BRANDS[brandKey] || {
    logoBg: "#BDC3C7",
    textColor: "#2C3E50",
    brandText: "Fuel",
    logoColor: "#FFFFFF",
  };

  return (
    <View style={styles.markerContainer}>
      {/* 1. Base Layer: Scaled down from 110x120 to a tight 76x82 footprint */}
      <ImageBackground
        source={require("../assets/images/marker.png")}
        style={[styles.pinBackground, isSelected && styles.activePin]}
        resizeMode="contain"
      >
        {/* 2. Top Layer Pill: Micro Brand Logo Container */}
        <View style={[styles.brandCapsule, { backgroundColor: brand.logoBg }]}>
          {brandKey === "reddy" ? (
            <View style={styles.reddyRow}>
              <Ionicons
                name="flame"
                size={11}
                color="#FFCC00"
                style={styles.flameIcon}
              />
              <Text style={styles.reddyText}>Reddy</Text>
            </View>
          ) : (
            <Text style={[styles.brandText, { color: brand.logoColor }]}>
              {brand.brandText}
            </Text>
          )}
        </View>

        {/* 3. Middle Layer Pill: Micro Price Capsule Overlay */}
        <View style={styles.priceCapsule}>
          <Text style={[styles.priceText, { color: brand.textColor }]}>
            {typeof price === "number" && !isNaN(price)
              ? price.toFixed(1)
              : "000.0"}
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinBackground: {
    width: 76,
    height: 82,
    alignItems: "center",
  },
  activePin: {
    transform: [{ scale: 1.08 }], // Subtle enlargement when tapped
  },
  brandCapsule: {
    position: "absolute",
    top: 7, // Tucked cleanly into the circular top section of the pin
    flexDirection: "row",
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  reddyRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  flameIcon: {
    marginRight: 1,
  },
  reddyText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#D32F2F",
    fontStyle: "italic",
  },
  brandText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  priceCapsule: {
    position: "absolute",
    top: 28, // Moved up to close the gap and sit perfectly aligned with your design
    backgroundColor: "#C5EDF5",
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  priceText: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
