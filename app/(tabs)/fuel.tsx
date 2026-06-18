import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LineChart } from "react-native-gifted-charts";
import { getStateAverages } from "../../lib/supabase";

const { width } = Dimensions.get("window");

const CITIES = [
  { name: "Sydney", state: "NSW" },
  { name: "Melbourne", state: "VIC" },
  { name: "Brisbane", state: "QLD" },
  { name: "Perth", state: "WA" },
  { name: "Adelaide", state: "SA" },
  { name: "Canberra", state: "ACT" },
  { name: "Hobart", state: "TAS" },
  { name: "Darwin", state: "NT" },
];

const FUEL_TYPES = ["U91", "U95", "U98", "Diesel", "Premium Diesel", "LPG"];

// Default baseline prices for fallback when database lacks entries
const BASE_PRICES: Record<string, number> = {
  U91: 174.9,
  U95: 189.9,
  U98: 201.9,
  Diesel: 191.9,
  "Premium Diesel": 203.9,
  LPG: 101.9,
};

export default function FuelScreen() {
  const insets = useSafeAreaInsets();

  const [selectedCity, setSelectedCity] = useState("Perth");
  const [selectedFuel, setSelectedFuel] = useState("U91");
  const [isCityModalVisible, setIsCityModalVisible] = useState(false);
  const [dbAverages, setDbAverages] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Map city to state
  const activeCityConfig = useMemo(() => {
    return CITIES.find((c) => c.name === selectedCity) || CITIES[3];
  }, [selectedCity]);

  const isUnavailable = useMemo(() => {
    return activeCityConfig.state !== "NSW" && activeCityConfig.state !== "WA" && activeCityConfig.state !== "SA" && activeCityConfig.state !== "QLD" && activeCityConfig.state !== "ACT";
  }, [activeCityConfig.state]);

  // Fetch real-time averages from our database when selected state changes
  useEffect(() => {
    (async () => {
      if (isUnavailable) {
        setDbAverages(null);
        return;
      }
      setIsLoading(true);
      try {
        const data = await getStateAverages(activeCityConfig.state);
        setDbAverages(data);
      } catch (err) {
        console.warn("Failed fetching live state averages:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeCityConfig.state, isUnavailable]);

  // Extract stats: average, min, max
  const stats = useMemo(() => {
    const defaultBase = BASE_PRICES[selectedFuel] || 175.0;
    
    if (dbAverages && dbAverages[selectedFuel]) {
      return {
        average: dbAverages[selectedFuel].average,
        min: dbAverages[selectedFuel].min,
        max: dbAverages[selectedFuel].max,
        isLive: true,
      };
    }

    // Fallback: Generate mock stats based on seed
    return {
      average: defaultBase,
      min: parseFloat((defaultBase - 8.4).toFixed(1)),
      max: parseFloat((defaultBase + 12.9).toFixed(1)),
      isLive: false,
    };
  }, [dbAverages, selectedFuel]);

  // Generate ACCC Price Cycle historical data
  const chartPoints = useMemo(() => {
    const basePrice = stats.average;
    const pointsCount = 30;
    const data = [];
    const now = new Date();

    if (selectedCity === "Perth") {
      // WA follows a highly structured weekly cycle (Peak is Wednesday, Bottom is Monday)
      for (let i = 0; i < pointsCount; i++) {
        const date = new Date(now.getTime() - (pointsCount - 1 - i) * 24 * 60 * 60 * 1000);
        const dayOfWeek = date.getDay(); // 0-6

        // Cycle amplitude factor based on weekday
        let cycleFactor = 0;
        if (dayOfWeek === 2) cycleFactor = 0.95; // Tuesday rising
        else if (dayOfWeek === 3) cycleFactor = 1.0; // Peak on Wednesday
        else if (dayOfWeek === 4) cycleFactor = 0.8;
        else if (dayOfWeek === 5) cycleFactor = 0.6;
        else if (dayOfWeek === 6) cycleFactor = 0.4;
        else if (dayOfWeek === 0) cycleFactor = 0.2; // Low Sunday
        else if (dayOfWeek === 1) cycleFactor = 0.05; // Lowest Monday

        const price = basePrice + (cycleFactor - 0.4) * 28 + Math.sin(i / 1.5) * 1.5;
        data.push({
          value: parseFloat(price.toFixed(1)),
          label: `${date.getDate()}/${date.getMonth() + 1}`,
        });
      }
    } else if (["Sydney", "Melbourne", "Brisbane", "Adelaide"].includes(selectedCity)) {
      // East Coast follows a ~30 day cyclical wave (sudden rise, slow decay)
      const cycleLength = 30;
      for (let i = 0; i < pointsCount; i++) {
        const date = new Date(now.getTime() - (pointsCount - 1 - i) * 24 * 60 * 60 * 1000);
        const phase = i % cycleLength;

        let cycleFactor = 0;
        if (phase < 3) {
          // Rapid rise (3 days)
          cycleFactor = 0.15 + (phase / 3) * 0.85;
        } else {
          // Slow decay (27 days)
          const decayPhase = phase - 3;
          cycleFactor = 1.0 - (decayPhase / (cycleLength - 3)) * 0.85;
        }

        const price = basePrice + (cycleFactor - 0.45) * 35 + Math.sin(i / 2) * 1.2;
        data.push({
          value: parseFloat(price.toFixed(1)),
          label: `${date.getDate()}/${date.getMonth() + 1}`,
        });
      }
    } else {
      // Canberra, Hobart, Darwin have stable non-cyclical drift
      let currentPrice = basePrice;
      for (let i = 0; i < pointsCount; i++) {
        const date = new Date(now.getTime() - (pointsCount - 1 - i) * 24 * 60 * 60 * 1000);
        const randomDrift = Math.sin(i / 2.5) * 1.8 + Math.cos(i / 4) * 0.8;
        const price = currentPrice + randomDrift;
        data.push({
          value: parseFloat(price.toFixed(1)),
          label: `${date.getDate()}/${date.getMonth() + 1}`,
        });
      }
    }

    // Adjust the last point to exactly match the current average for continuity
    if (data.length > 0) {
      data[data.length - 1].value = basePrice;
    }

    return data;
  }, [selectedCity, stats.average]);

  // Determine recommendations based on cycle phase
  const recommendation = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();

    if (selectedCity === "Perth") {
      // Perth cycle advice
      if (dayOfWeek === 1 || dayOfWeek === 0) {
        return {
          status: "Buy Now",
          advice: "Prices are at the bottom of the weekly cycle. Fill up today before the Tuesday/Wednesday spike!",
          color: "#2ECC71",
          icon: "checkmark-circle",
        };
      } else if (dayOfWeek === 2 || dayOfWeek === 3) {
        return {
          status: "Hold Off",
          advice: "Prices are currently peaking. Wait a few days for prices to drift down if possible.",
          color: "#E74C3C",
          icon: "warning",
        };
      } else {
        return {
          status: "Fair Time to Buy",
          advice: "Prices are slowly declining from the midweek peak. Shop around for cheap local stations.",
          color: "#F39C12",
          icon: "information-circle",
        };
      }
    } else if (["Sydney", "Melbourne", "Brisbane", "Adelaide"].includes(selectedCity)) {
      // East Coast cycle advice: simulate a declining phase
      return {
        status: "Good Time to Buy",
        advice: "The price cycle is currently in the decline phase. Fill up at your convenience.",
        color: "#2ECC71",
        icon: "checkmark-circle",
      };
    } else {
      // Non-cyclical cities
      return {
        status: "Stable Prices",
        advice: "Prices are stable in this region. Look for local independent retailers for the best deals.",
        color: "#3498DB",
        icon: "information-circle",
      };
    }
  }, [selectedCity]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 1. Header with custom City Selector dropdown */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fuel Analytics</Text>
          <TouchableOpacity
            style={styles.cityPicker}
            activeOpacity={0.8}
            onPress={() => setIsCityModalVisible(true)}
          >
            <Text style={styles.cityName}>{selectedCity}</Text>
            <Ionicons name="chevron-down" size={18} color="#45B2D3" />
          </TouchableOpacity>
        </View>

        {isLoading && (
          <ActivityIndicator size="small" color="#45B2D3" style={{ marginRight: 8 }} />
        )}
      </View>

      {/* 2. Fuel Type Selector Chips */}
      <View style={{ height: 60, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fuelScroll}
        >
          {FUEL_TYPES.map((fuel) => (
            <TouchableOpacity
              key={fuel}
              style={[
                styles.fuelChip,
                selectedFuel === fuel && styles.fuelChipActive,
              ]}
              onPress={() => setSelectedFuel(fuel)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.fuelText,
                  selectedFuel === fuel && styles.fuelTextActive,
                ]}
              >
                {fuel}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isUnavailable ? (
        <View style={styles.unavailableContainer}>
          <View style={styles.unavailableCard}>
            <MaterialCommunityIcons name="gas-station-off" size={64} color="#45B2D3" style={{ marginBottom: 16 }} />
            <Text style={styles.unavailableTitle}>{selectedCity} Analytics Unavailable</Text>
            <Text style={styles.unavailableSubtitle}>
              Fuel price cycle insights and averages for {activeCityConfig.state} are currently unavailable. We are actively working on integrating live rates for this region.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.mainScroll}>
          {/* 3. Infographics Price Chart Panel */}
          <View style={styles.glassCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>
                {selectedCity} {selectedFuel} Cycle
              </Text>
              {stats.isLive && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>

            <View style={styles.chartWrapper}>
              <LineChart
                data={chartPoints}
                height={140}
                width={width - 72}
                thickness={3}
                color="#45B2D3"
                hideDataPoints
                hideRules
                hideYAxisText
                curved
                isAnimated
                animationDuration={1000}
                startFillColor="#45B2D3"
                endFillColor="#131b26"
                startOpacity={0.25}
                endOpacity={0.0}
                yAxisColor="rgba(255,255,255,0.1)"
                xAxisColor="rgba(255,255,255,0.1)"
                xAxisLabelTextStyle={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 9,
                }}
                rulesColor="rgba(255,255,255,0.05)"
              />
            </View>

            <View style={styles.chartFooter}>
              <Text style={styles.averagePriceLabel}>
                Current average:{" "}
                <Text style={styles.averagePriceValue}>{stats.average.toFixed(1)}</Text>
              </Text>
            </View>
          </View>

          {/* 4. Statistics Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.glassCard, { flex: 1, marginRight: 8, padding: 16 }]}>
              <Text style={styles.statsLabel}>Lowest Price</Text>
              <Text style={[styles.statsValue, { color: "#2ECC71" }]}>
                {stats.min.toFixed(1)}
              </Text>
              <Text style={styles.statsSubtext}>Today</Text>
            </View>

            <View style={[styles.glassCard, { flex: 1, marginLeft: 8, padding: 16 }]}>
              <Text style={styles.statsLabel}>Highest Price</Text>
              <Text style={[styles.statsValue, { color: "#E74C3C" }]}>
                {stats.max.toFixed(1)}
              </Text>
              <Text style={styles.statsSubtext}>Today</Text>
            </View>
          </View>

          {/* 5. Buying Advisory Recommendation */}
          <View style={[styles.glassCard, { borderLeftWidth: 4, borderLeftColor: recommendation.color }]}>
            <View style={styles.recommendationHeader}>
              <Ionicons name={recommendation.icon as any} size={24} color={recommendation.color} />
              <Text style={[styles.recommendationTitle, { color: recommendation.color }]}>
                {recommendation.status}
              </Text>
            </View>
            <Text style={styles.recommendationText}>{recommendation.advice}</Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* 6. City Selector Popup Modal */}
      <Modal
        visible={isCityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCityModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsCityModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setIsCityModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={CITIES}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.cityItem,
                    selectedCity === item.name && styles.cityItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCity(item.name);
                    setIsCityModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.cityItemText,
                      selectedCity === item.name && styles.cityItemTextActive,
                    ]}
                  >
                    {item.name} ({item.state})
                  </Text>
                  {selectedCity === item.name && (
                    <Ionicons name="checkmark-circle" size={20} color="#45B2D3" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#131b26",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cityPicker: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  cityName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#45B2D3",
    marginRight: 6,
  },
  fuelScroll: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  fuelChip: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  fuelChipActive: {
    backgroundColor: "#45B2D3",
    borderColor: "#45B2D3",
  },
  fuelText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "600",
    fontSize: 14,
  },
  fuelTextActive: {
    color: "#131b26",
    fontWeight: "800",
  },
  mainScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  glassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  liveBadge: {
    backgroundColor: "#2ECC71",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  chartWrapper: {
    alignItems: "center",
    marginBottom: 8,
  },
  chartFooter: {
    alignItems: "center",
    marginTop: 8,
  },
  averagePriceLabel: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
  },
  averagePriceValue: {
    color: "#45B2D3",
    fontWeight: "800",
    fontSize: 18,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statsValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  centsText: {
    fontSize: 18,
  },
  statsSubtext: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.3)",
    marginTop: 2,
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 10,
  },
  recommendationText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 20,
    fontWeight: "500",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1b2636",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: "60%",
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  cityItemActive: {
    borderBottomColor: "#45B2D3",
  },
  cityItemText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
  },
  cityItemTextActive: {
    color: "#45B2D3",
    fontWeight: "700",
  },
  unavailableContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 80,
  },
  unavailableCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    width: "100%",
  },
  unavailableTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  unavailableSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },
});
