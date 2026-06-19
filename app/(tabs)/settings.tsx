import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlert } from "../../context/AlertContext";
import { getStationsByState } from "../../lib/supabase";

const ALL_STATES = ["NSW", "WA", "VIC", "QLD", "SA", "TAS", "ACT", "NT"];

const getBrandColor = (brand: string) => {
  const lower = brand?.toLowerCase() || "";
  if (lower.includes('7-eleven')) return '#007A53'; // 7-Eleven Green
  if (lower.includes('bp')) return '#009900'; // BP Green
  if (lower.includes('shell') || lower.includes('coles') || lower.includes('reddy')) return '#E31837'; // Shell/Reddy Red
  if (lower.includes('woolworths') || lower.includes('caltex') || lower.includes('ampol') || lower.includes('eg')) return '#0054A4'; // Ampol Blue
  if (lower.includes('puma')) return '#1E1E1E';
  if (lower.includes('united')) return '#0047AB';
  if (lower.includes('vibe')) return '#FF4500';
  if (lower.includes('costco')) return '#E31837';
  return '#45B2D3'; // Default App Blue
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [activeState, setActiveState] = useState("NSW");
  const [stations, setStations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);

  const isLiveState = activeState === "NSW" || activeState === "WA" || activeState === "SA" || activeState === "QLD" || activeState === "ACT";

  useEffect(() => {
    setVisibleCount(6);
  }, [activeState, searchQuery]);

  useEffect(() => {
    if (!isLiveState) {
      setStations([]);
      return;
    }

    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getStationsByState(activeState);
        if (active) {
          setStations(data || []);
        }
      } catch (err) {
        console.warn("Failed fetching stations for settings:", err);
        if (active) {
          showAlert({
            type: 'error',
            title: 'Data Sync Failed',
            message: 'Failed to load brand statistics. Please check your connection.',
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [activeState]);

  // Extract unique brands sorted alphabetically
  const uniqueBrands = useMemo(() => {
    const brandSet = new Set<string>();
    stations.forEach((st) => {
      if (st.brand) {
        const formatted = st.brand.trim();
        if (formatted) brandSet.add(formatted);
      }
    });
    return Array.from(brandSet).sort();
  }, [stations]);

  // Filter brands based on search query
  const filteredBrands = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return uniqueBrands;
    return uniqueBrands.filter(brand => brand.toLowerCase().includes(query));
  }, [uniqueBrands, searchQuery]);

  // Slice brands for paginated rendering
  const slicedBrands = useMemo(() => {
    return filteredBrands.slice(0, visibleCount);
  }, [filteredBrands, visibleCount]);

  const getBrandStationCount = (brand: string) => {
    return stations.filter(st => st.brand === brand).length;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        {/* Available Brands Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isLiveState ? `Available Brands (${uniqueBrands.length})` : "Supported Regions"}
          </Text>

          {/* Horizontal scroll of all states */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stateScroll}
            contentContainerStyle={styles.stateScrollContent}
          >
            {ALL_STATES.map((state) => {
              const isActive = activeState === state;
              const isLive = state === "NSW" || state === "WA" || state === "SA" || state === "QLD" || state === "ACT";
              return (
                <TouchableOpacity
                  key={state}
                  activeOpacity={0.8}
                  onPress={() => {
                    setActiveState(state);
                    setSearchQuery("");
                  }}
                  style={[
                    styles.stateChip,
                    isActive && styles.stateChipActive,
                    !isLive && !isActive && styles.stateChipDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.stateChipText,
                      isActive && styles.stateChipTextActive,
                      !isLive && !isActive && styles.stateChipTextDisabled,
                    ]}
                  >
                    {state}
                  </Text>
                  {isLive && (
                    <View style={[styles.liveDot, isActive && styles.liveDotActive]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {isLiveState ? (
            <>
              {/* Search bar */}
              <View style={styles.searchBar}>
                <Ionicons
                  name="search"
                  size={18}
                  color="rgba(255, 255, 255, 0.4)"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search brands (e.g., Ampol, BP)..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.4)" />
                  </TouchableOpacity>
                )}
              </View>

              {isLoading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="small" color="#45B2D3" />
                  <Text style={styles.loadingText}>Loading brands...</Text>
                </View>
              ) : (
                <View style={styles.brandsContainer}>
                  {filteredBrands.length === 0 ? (
                    <Text style={styles.emptyText}>No matching brands found.</Text>
                  ) : (
                    <>
                      <View style={styles.brandGrid}>
                        {slicedBrands.map((brand) => {
                          const count = getBrandStationCount(brand);
                          const color = getBrandColor(brand);
                          return (
                            <View key={brand} style={styles.brandCard}>
                              <View style={[styles.brandColorBar, { backgroundColor: color }]} />
                              <View style={styles.brandCardContent}>
                                <Text style={styles.brandNameText} numberOfLines={1}>
                                  {brand}
                                </Text>
                                <Text style={styles.brandCountText}>
                                  {count} station{count !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      {filteredBrands.length > visibleCount && (
                        <TouchableOpacity
                          style={styles.viewMoreButton}
                          activeOpacity={0.8}
                          onPress={() => setVisibleCount((prev) => prev + 6)}
                        >
                          <Text style={styles.viewMoreText}>View More Brands</Text>
                          <Ionicons name="chevron-down" size={16} color="#45B2D3" />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.unavailableCard}>
              <MaterialCommunityIcons name="gas-station-off" size={48} color="#45B2D3" style={{ marginBottom: 12 }} />
              <Text style={styles.unavailableTitle}>No Stations Available</Text>
              <Text style={styles.unavailableSubtitle}>
                We are actively working on adding live fuel pricing datasets for {activeState}. Check back soon!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Preferences</Text>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Country</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledInputText}>Australia</Text>
                <Ionicons name="lock-closed" size={16} color="rgba(255, 255, 255, 0.4)" />
              </View>
            </View>
          </View>
        </View>



        {/* Footer Area */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 100 }]}>
          <Text style={styles.footerText}>
            Made with <MaterialCommunityIcons name="cards-heart" size={14} color="#E74C3C" /> for Australia
          </Text>
          <Text style={styles.versionText}>v1.0</Text>
        </View>
      </ScrollView>
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
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#45B2D3",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  inputGroup: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  disabledInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  disabledInputText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
  },
  stateScroll: {
    marginBottom: 16,
  },
  stateScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  stateChipActive: {
    backgroundColor: "#45B2D3",
    borderColor: "#45B2D3",
  },
  stateChipDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderColor: "rgba(255, 255, 255, 0.04)",
    opacity: 0.5,
  },
  stateChipText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
    fontSize: 13,
  },
  stateChipTextActive: {
    color: "#131b26",
    fontWeight: "700",
  },
  stateChipTextDisabled: {
    color: "rgba(255, 255, 255, 0.3)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2ECC71",
  },
  liveDotActive: {
    backgroundColor: "#131b26",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 8,
  },
  loadingWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  brandsContainer: {
    marginBottom: 16,
  },
  brandGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  brandCard: {
    flexDirection: "row",
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    height: 56,
  },
  brandColorBar: {
    width: 5,
    height: "100%",
  },
  brandCardContent: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  brandNameText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  brandCountText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    fontWeight: "600",
  },
  unavailableCard: {
    backgroundColor: "rgba(27, 38, 54, 0.6)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 12,
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  unavailableSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 30,
    fontWeight: "500",
  },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
    gap: 6,
  },
  viewMoreText: {
    color: "#45B2D3",
    fontSize: 14,
    fontWeight: "700",
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "500",
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.3)",
    fontWeight: "600",
  }
});
