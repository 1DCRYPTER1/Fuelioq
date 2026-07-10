import * as Sentry from '@sentry/react-native';
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import SplashScreen from "../components/SplashScreen";
import { AlertProvider } from "../context/AlertContext";
import GlobalAlert from "../components/GlobalAlert";

// Initialize Sentry for crash reporting and performance analytics
Sentry.init({
  dsn: 'https://b60f42f41d2abede8716ad33ee2edb17@o4511590613909504.ingest.us.sentry.io/4511590626754560',
  debug: __DEV__, // Only enable debug mode in development
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
});

function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    "Rondira-Medium": require("../assets/fonts/Rondira-Medium.otf"),
    "SpaceMono": require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Only transition off the splash screen when the animation is finished AND fonts have resolved
  if (!isReady || (!fontsLoaded && !fontError)) {
    return <SplashScreen onFinish={() => setIsReady(true)} duration={4000} />;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AlertProvider>
          <BottomSheetModalProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Station Details" }}
              />
            </Stack>
            <GlobalAlert />
          </BottomSheetModalProvider>
        </AlertProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
