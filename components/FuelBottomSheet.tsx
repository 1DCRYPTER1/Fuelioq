import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface FuelBottomSheetProps {
  station: any;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.48; // Snaps to exactly 48% height

export default function FuelBottomSheet({
  station,
  onClose,
}: FuelBottomSheetProps) {
  // Slide animation tracker variable
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (station) {
      // Smoothly slide the panel up into view
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Smoothly slide the panel back down off-screen
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [station]);

  if (!station) return null;

  return (
    <Animated.View
      style={[
        styles.sheetContainer,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Visual Drag Handle Element */}
      <View style={styles.dragIndicatorContainer}>
        <View style={styles.dragIndicator} />
      </View>

      <View style={styles.contentContainer}>
        {/* Header Block: Name and Close Utility */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.stationName} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={styles.stationAddress} numberOfLines={1}>
              {station.address}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#7F8C8D" />
          </TouchableOpacity>
        </View>

        {/* Info Strip: Phone, Distance, Status */}
        <View style={styles.metaStrip}>
          <View style={styles.metaItem}>
            <Ionicons name="call-outline" size={14} color="#7F8C8D" />
            <Text style={styles.metaText}>{station.phone}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="navigate-outline" size={14} color="#7F8C8D" />
            <Text style={styles.metaText}>{station.distance}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: "#E8F8F5" }]}>
            <Text style={styles.statusText}>{station.status}</Text>
          </View>
        </View>

        {/* Pricing Matrix Sub-Grid */}
        <Text style={styles.sectionTitle}>
          Available Fuel Types ({station.updatedAt})
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.priceScrollGrid}
        >
          {station.prices?.map((fuel: any, idx: number) => (
            <View
              key={idx}
              style={[styles.priceCard, fuel.active && styles.activePriceCard]}
            >
              <Text
                style={[
                  styles.fuelTypeLabel,
                  fuel.active && styles.activeFuelTypeLabel,
                ]}
              >
                {fuel.type}
              </Text>
              <Text
                style={[
                  styles.fuelPriceText,
                  fuel.active && styles.activeFuelPriceText,
                ]}
              >
                {fuel.value.toFixed(1)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Bottom Action Sheet Trigger Rows */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryActionButton}
            activeOpacity={0.8}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color="#3BCAB7"
              style={styles.btnIcon}
            />
            <Text style={styles.secondaryActionText}>Submit Prices</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryActionButton}
            activeOpacity={0.8}
          >
            <Ionicons
              name="paper-plane"
              size={18}
              color="#FFFFFF"
              style={styles.btnIcon}
            />
            <Text style={styles.primaryActionText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24, // Premium top curved styling framework edges
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 999, // Guarantees it slides on top of the map layer
  },
  dragIndicatorContainer: {
    width: "100%",
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dragIndicator: {
    backgroundColor: "#E2E8F0",
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: 15,
  },
  stationName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A202C",
    letterSpacing: -0.3,
  },
  stationAddress: {
    fontSize: 13,
    color: "#718096",
    marginTop: 2,
    fontWeight: "500",
  },
  closeButton: {
    backgroundColor: "#F7FAFC",
    padding: 6,
    borderRadius: 20,
  },
  metaStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
    paddingBottom: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metaText: {
    fontSize: 13,
    color: "#4A5568",
    marginLeft: 4,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: "auto",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#11A694",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A0AEC0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  priceScrollGrid: {
    paddingBottom: 10,
    height: 70,
  },
  priceCard: {
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    minWidth: 80,
    alignItems: "center",
    marginRight: 10,
    height: 56,
    justifyContent: "center",
  },
  activePriceCard: {
    backgroundColor: "#E8F8F5",
    borderColor: "#3BCAB7",
  },
  fuelTypeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#718096",
  },
  activeFuelTypeLabel: {
    color: "#11A694",
  },
  fuelPriceText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2D3748",
    marginTop: 2,
  },
  activeFuelPriceText: {
    color: "#11A694",
    fontSize: 17,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: "auto",
    marginBottom: 34, // Structural spacing clearance for home indicator
    justifyContent: "space-between",
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: "row",
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#3BCAB7",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  secondaryActionText: {
    color: "#3BCAB7",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: "row",
    height: 48,
    backgroundColor: "#3BCAB7",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  btnIcon: {
    marginRight: 6,
  },
});
