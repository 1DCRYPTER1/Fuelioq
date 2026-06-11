import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const { width } = Dimensions.get("window");
const BASE_HEIGHT = 65; // Height of the flat bar portion
const WAVE_APEX = 25; // The clearance height allowed for the upward wave peak

const TABS = [
  {
    name: "index",
    label: "Station",
    iconOutline: "list-outline",
    iconFilled: "list",
  },
  { name: "map", label: "Map", iconOutline: "map-outline", iconFilled: "map" },
  {
    name: "fuel",
    label: "Fuel",
    iconOutline: "color-fill-outline",
    iconFilled: "color-fill",
  },
  {
    name: "favorite",
    label: "Favorite",
    iconOutline: "star-outline",
    iconFilled: "star",
  },
  {
    name: "settings",
    label: "Settings",
    iconOutline: "settings-outline",
    iconFilled: "settings",
  },
];

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const numTabs = state.routes.length;
  const TAB_WIDTH = width / numTabs;

  // The total structural canvas height includes the bar, the wave apex space, and the device notch padding
  const totalContainerHeight =
    BASE_HEIGHT + WAVE_APEX + (insets.bottom > 0 ? insets.bottom - 10 : 15);

  const animationValue = useSharedValue(0);

  useEffect(() => {
    animationValue.value = withSpring(state.index, {
      damping: 20,
      stiffness: 120,
    });
  }, [state.index]);

  const animatedPathProps = useAnimatedStyle(() => {
    const currentCenter = animationValue.value * TAB_WIDTH + TAB_WIDTH / 2;

    const waveWidth = 50;
    // The wave peak now curves beautifully within our newly padded vertical canvas window
    const waveTopY = WAVE_APEX - 22;

    const d = `
      M 0 ${WAVE_APEX} 
      L ${currentCenter - waveWidth} ${WAVE_APEX}
      C ${currentCenter - waveWidth / 1.6} ${WAVE_APEX}, ${currentCenter - waveWidth / 2} ${waveTopY}, ${currentCenter} ${waveTopY}
      C ${currentCenter + waveWidth / 2} ${waveTopY}, ${currentCenter + waveWidth / 1.6} ${WAVE_APEX}, ${currentCenter + waveWidth} ${WAVE_APEX}
      L ${width} ${WAVE_APEX}
      L ${width} ${totalContainerHeight}
      L 0 ${totalContainerHeight}
      Z
    `;

    return { d } as any;
  });

  return (
    <View style={[styles.container, { height: totalContainerHeight }]}>
      {/* Structural SVG Track Layer */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={totalContainerHeight}>
          <AnimatedPath animatedProps={animatedPathProps} fill="#FFFFFF" />
        </Svg>
      </View>

      {/* Button Interactions Track */}
      <View
        style={[
          styles.buttonsContainer,
          { top: WAVE_APEX, height: BASE_HEIGHT },
        ]}
      >
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const tabInfo = TABS[index];

          if (!tabInfo) return null;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const animatedIconStyle = useAnimatedStyle(() => {
            const activeDistance = Math.abs(animationValue.value - index);
            let translateY = 0;

            if (activeDistance < 1) {
              // Elevate the active selection smoothly right onto the peak of the wave
              translateY = (1 - activeDistance) * -18;
            }

            return {
              transform: [{ translateY }],
            };
          });

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={1}
              onPress={onPress}
              style={styles.tabButton}
            >
              <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
                <Ionicons
                  name={
                    (isFocused
                      ? tabInfo.iconFilled
                      : tabInfo.iconOutline) as any
                  }
                  size={22}
                  color={isFocused ? "#3BCAB7" : "#7F8C8D"}
                />
                <Text style={[styles.label, isFocused && styles.activeLabel]}>
                  {tabInfo.label}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    width: width,
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 20,
  },
  buttonsContainer: {
    flexDirection: "row",
    width: width,
    position: "absolute",
    left: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 45,
  },
  label: {
    fontSize: 9,
    color: "#7F8C8D",
    fontWeight: "600",
    marginTop: 3,
  },
  activeLabel: {
    color: "#3BCAB7",
    fontWeight: "700",
  },
});
