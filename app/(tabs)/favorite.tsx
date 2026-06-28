import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FavoriteScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.canvas, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Ionicons name="star" size={54} color="#45B2D3" style={styles.icon} />
        <Text style={styles.title}>Favorites Screen</Text>
        <Text style={styles.subtitle}>We are actively working on it. Stay tuned!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: "#131b26",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 16,
    opacity: 0.85,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
});
