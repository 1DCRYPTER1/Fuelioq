import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [selectedState, setSelectedState] = useState("NSW");

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Preferences</Text>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Country</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledInputText}>Australia</Text>
                <Ionicons name="lock-closed" size={16} color="#A0AAB5" />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred State</Text>
              <Text style={styles.subLabel}>
                Prices will be prioritized for this region.
              </Text>
              <View style={styles.chipsContainer}>
                {STATES.map((state) => (
                  <TouchableOpacity
                    key={state}
                    activeOpacity={0.8}
                    onPress={() => setSelectedState(state)}
                    style={[
                      styles.chip,
                      selectedState === state && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedState === state && styles.chipTextActive,
                      ]}
                    >
                      {state}
                    </Text>
                  </TouchableOpacity>
                ))}
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
    backgroundColor: "#F2F5F8",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#2C3E50",
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
    color: "#7F8C8D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGroup: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    color: "#7F8C8D",
    marginBottom: 12,
    marginTop: -4,
  },
  disabledInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  disabledInputText: {
    fontSize: 16,
    color: "#A0AAB5",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 16,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: "#F2F5F8",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: "#45B2D3",
    borderColor: "#45B2D3",
    shadowColor: "#45B2D3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  chipText: {
    color: "#7F8C8D",
    fontWeight: "600",
    fontSize: 14,
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#7F8C8D",
    fontWeight: "500",
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: "#BDC3C7",
    fontWeight: "600",
  },
});
