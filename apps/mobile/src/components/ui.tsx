import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { PublicListing } from "@pbs/api-client";
import { C } from "@/lib/theme";
import { mediaSource } from "@/lib/api";
import { headlinePrice, categoryLabel, advertiserLabel, areaLabel } from "@/lib/format";

export function Button({ title, onPress, variant = "primary", disabled, loading, style, accessibilityHint }: { title: string; onPress: () => void; variant?: "primary" | "ghost" | "navy" | "danger"; disabled?: boolean; loading?: boolean; style?: ViewStyle; accessibilityHint?: string }) {
  const bg = { primary: C.emerald600, ghost: "transparent", navy: C.navy900, danger: C.danger }[variant];
  const fg = variant === "ghost" ? C.navy900 : C.white;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!loading }} accessibilityHint={accessibilityHint} onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: variant === "ghost" ? C.sand200 : bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={C.sand400} style={[s.input, error ? { borderColor: C.danger } : null, props.multiline ? { minHeight: 100, textAlignVertical: "top" } : null]} {...props} />
      {hint && !error ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={[s.chip, selected && { backgroundColor: C.navy900, borderColor: C.navy900 }]}><Text style={{ color: selected ? C.white : C.navy900, fontWeight: "600" }}>{label}</Text></Pressable>;
}

export const Loading = () => <View style={s.center}><ActivityIndicator size="large" color={C.emerald600} accessibilityLabel="Loading" /></View>;
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <View style={s.errorBox} accessibilityRole="alert"><Text style={{ color: C.danger }}>{message}</Text>{retry && <Button title="Try again" variant="ghost" onPress={retry} style={{ marginTop: 8 }} />}</View>;
}
export function Empty({ title, body, action }: { title: string; body?: string; action?: { title: string; onPress: () => void } }) {
  return <View style={[s.center, { padding: 24 }]}><Text style={s.h2}>{title}</Text>{body && <Text style={[s.muted, { textAlign: "center", marginTop: 6 }]}>{body}</Text>}{action && <Button title={action.title} onPress={action.onPress} style={{ marginTop: 12 }} />}</View>;
}
export function Badge({ text, tone = "plain" }: { text: string; tone?: "plain" | "ok" | "warn" | "demo" }) {
  const map = { plain: [C.sand100, C.navy700], ok: [C.emerald100, C.emerald700], warn: [C.warnBg, C.warn], demo: [C.navy100, C.navy700] } as const;
  return <View style={[s.badge, { backgroundColor: map[tone][0] }]}><Text style={{ color: map[tone][1], fontSize: 12, fontWeight: "700" }}>{text}</Text></View>;
}

export function ListingCard({ l }: { l: PublicListing }) {
  const img = l.media[0];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${l.title}, ${headlinePrice(l)}`} onPress={() => router.push(`/property/${l.id}`)} style={s.card}>
      {img ? <Image source={mediaSource(img.url)} style={s.thumb} contentFit="cover" transition={150} /> : <View style={[s.thumb, { backgroundColor: C.sand100 }]} />}
      <View style={{ padding: 12, gap: 3 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>{l.isSponsored && <Badge text="Sponsored" tone="warn" />}{l.isDemo && <Badge text="Demo" tone="demo" />}</View>
        <Text style={s.price}>{headlinePrice(l)}</Text>
        <Text style={{ fontWeight: "600", color: C.ink }} numberOfLines={2}>{l.title}</Text>
        <Text style={s.muted}>{l.bedrooms ? `${l.bedrooms} BHK · ` : ""}{categoryLabel(l.category)}{areaLabel(l) ? ` · ${areaLabel(l)}` : ""}</Text>
        <Text style={s.muted}>{[l.locality?.name, l.city?.name].filter(Boolean).join(", ")} · {advertiserLabel(l.advertiserType)}</Text>
      </View>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.sand50 },
  pad: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  h1: { fontSize: 24, fontWeight: "800", color: C.navy900, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: "700", color: C.navy900, marginBottom: 6 },
  muted: { color: C.muted, fontSize: 13 },
  label: { fontWeight: "600", color: C.navy900, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: C.sand400, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.white, fontSize: 16, color: C.ink, minHeight: 46 },
  hint: { color: C.muted, fontSize: 12, marginTop: 4 },
  error: { color: C.danger, fontSize: 13, marginTop: 4 },
  btn: { minHeight: 46, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  btnText: { fontWeight: "700", fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.sand200, backgroundColor: C.white, minHeight: 40, justifyContent: "center" },
  card: { backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.sand200, overflow: "hidden", marginBottom: 14 },
  thumb: { width: "100%", aspectRatio: 3 / 2 },
  price: { fontSize: 18, fontWeight: "800", color: C.navy900 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  errorBox: { backgroundColor: C.dangerBg, borderRadius: 10, padding: 12, margin: 16 },
  section: { backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.sand200, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});
