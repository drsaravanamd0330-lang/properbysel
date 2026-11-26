import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { C } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: C.navy900 }, headerTintColor: C.white, headerTitleStyle: { fontWeight: "700" }, contentStyle: { backgroundColor: C.sand50 } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="property/[id]" options={{ title: "Property" }} />
          <Stack.Screen name="listing/[id]" options={{ title: "Your listing" }} />
          <Stack.Screen name="conversation/[id]" options={{ title: "Conversation" }} />
          <Stack.Screen name="login" options={{ title: "Log in", presentation: "modal" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
