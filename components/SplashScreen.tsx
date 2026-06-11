import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <Text style={styles.logoText}>Fuelioq</Text>
      </View>

      <ActivityIndicator size="small" color="#FFFFFF" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3BCAB7",
    alignItems: "center",
    justifyContent: "center",
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoText: {
    fontSize: 56,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  loader: {
    position: "absolute",
    bottom: 60,
  },
});
