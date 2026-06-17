import { StyleSheet, View } from "react-native";

export default function BaseScreen() {
  return <View style={styles.canvas} />;
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: "#131b26",
  },
});
