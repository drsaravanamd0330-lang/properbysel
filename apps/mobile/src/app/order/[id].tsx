import { useEffect } from "react";
import { ScrollView, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { inrExact, statusLabel } from "@/lib/format";
import { useLoad } from "@/components/useLoad";
import { Badge, Button, ErrorBox, Loading, s } from "@/components/ui";

/** Status comes from the server only; returning from checkout does not by itself mark anything paid. */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const o = useLoad(() => api.billing.order(id), [id]);
  useEffect(() => {
    if (o.data && (o.data.status === "PENDING" || o.data.status === "CREATED")) { const t = setTimeout(o.reload, 3000); return () => clearTimeout(t); }
  }, [o.data, o.reload]);
  if (o.loading && !o.data) return <Loading />;
  if (o.error) return <ErrorBox message={o.error} retry={o.reload} />;
  const d = o.data!;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>{d.plan.name}</Text>
      <Badge text={statusLabel(d.status)} tone={d.status === "PAID" ? "ok" : d.status === "FAILED" ? "warn" : "plain"} />
      <Text style={{ marginTop: 12 }}>
        {d.status === "PAID" ? `Payment confirmed.${d.entitlement && !d.entitlement.revoked ? ` Placement ends ${new Date(d.entitlement.endsAt).toLocaleDateString("en-IN")}.` : ""}`
          : d.status === "FAILED" ? "The payment did not go through. No placement was added."
          : d.status === "REFUNDED" ? "Refunded. The placement was removed."
          : "Waiting for the payment provider to confirm. This screen updates automatically."}
      </Text>
      <Text style={[s.muted, { marginTop: 12 }]}>Price {inrExact(d.amountPaise)} · GST {inrExact(d.taxPaise)} · Total {inrExact(d.totalPaise)}</Text>
      {d.invoiceNumber && <Text style={s.muted}>Receipt no. {d.invoiceNumber}</Text>}
      <Button title="Refresh" variant="ghost" onPress={o.reload} style={{ marginTop: 16 }} />
    </ScrollView>
  );
}
