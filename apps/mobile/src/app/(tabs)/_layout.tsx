import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { C } from "@/lib/theme";

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 18 }} accessibilityElementsHidden>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerStyle: { backgroundColor: C.navy900 }, headerTintColor: C.white, tabBarActiveTintColor: C.emerald600, tabBarInactiveTintColor: C.muted, tabBarLabelStyle: { fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: "Search", headerTitle: "ProperBySel", tabBarIcon: icon("⌕") }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: icon("☆") }} />
      <Tabs.Screen name="post" options={{ title: "Post", headerTitle: "My listings", tabBarIcon: icon("＋") }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox", tabBarIcon: icon("✉") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("◉") }} />
    </Tabs>
  );
}
