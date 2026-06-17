import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface Props {
  onFinish?: () => void;
  duration?: number;
}

export default function SplashScreen({ onFinish, duration = 4000 }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: duration,
      easing: Easing.linear,
    }, (finished) => {
      if (finished && onFinish) {
        runOnJS(onFinish)();
      }
    });
  }, [duration, onFinish]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <Text style={styles.logoText}>Fuelioq</Text>
        <Text style={styles.tagline}>LIVE AUSTRALIAN FUEL CYCLES</Text>
      </View>

      <View style={styles.loaderContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressLine, progressStyle]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#131b26", // Premium dark background for seamless launch transition
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
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 12,
    color: "#45B2D3", // Standard All Fuels accent color
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  loaderContainer: {
    position: "absolute",
    bottom: 80,
    width: "70%",
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressLine: {
    height: "100%",
    backgroundColor: "#45B2D3", // Sleek progress line in accent blue
    borderRadius: 2,
  },
  loaderText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.4)",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
