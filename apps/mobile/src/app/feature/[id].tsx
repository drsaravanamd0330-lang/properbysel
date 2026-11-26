import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@pbs/api-client";
import { api } from "@/lib/api";
import { inrExact } from "@/lib/format";
import { useLoad } from "@/components/useLoad";
import { Button, ErrorBox, Loading, s } from "@/components/ui";
import { C } from "@/lib/theme";

/** Pick a featured plan, then hand off to the provider's checkout. Benefits start only after the server confirms payment. */
export default function FeatureListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plans = useLoad(() => api.billing.plans());
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (plans.loading) return <Loading />;
  if (plans.error) return <ErrorBox message={plans.error} retry={plans.reload} />;
  const featured = (plans.data?.items ?? []).filter((p) => p.kind === "FEATURED_LISTING");
  async function pay() {
    if (!choice) return;
    setBusy(true);
    try {
      const r = await api.billing.createOrder(choice, id);
      if (!r.checkoutUrl) { Alert.alert("Checkout unavailable", "Online checkout is not set up for this payment provider yet."); return; }
      await Linking.openURL(`${r.checkoutUrl}?return=${encodeURIComponent(`properbysel://order/${r.order.id}`)}`);
      router.replace(`/order/${r.order.id}`);
    } catch (e) { Alert.alert("Could not start checkout", e instanceof ApiError ? e.message : "Try again"); }
    finally { setBusy(false); }
  }
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>Feature this listing</Text>
      <Text style={[s.muted, { marginBottom: 12 }]}>Featured listings appear in up to three “Sponsored” slots at the top of matching searches, clearly labelled.</Text>
      {featured.map((p) => (
        <Pressable key={p.code} accessibilityRole="radio" accessibilityState={{ selected: choice === p.code }} onPress={() => setChoice(p.code)}
          style={[s.section, { borderWidth: 2, borderColor: choice === p.code ? C.emerald600 : "transparent" }]}>
          <Text style={{ fontWeight: "700" }}>{p.name}</Text>
          <Text style={s.muted}>{inrExact(p.pricePaise)} + GST {inrExact(p.taxPaise)} = {inrExact(p.totalPaise)}</Text>
        </Pressable>
      ))}
      <Button title="Continue to payment" onPress={pay} disabled={!choice} loading={busy} />
      <View style={{ height: 8 }} />
      <Text style={s.muted}>Your placement starts only after the payment provider confirms the payment.</Text>
    </ScrollView>
  );
}
