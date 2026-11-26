import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ApiError, type OwnerListing } from "@pbs/api-client";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { headlinePrice, statusLabel } from "@/lib/format";
import { useLoad } from "@/components/useLoad";
import { Badge, Button, Empty, ErrorBox, Loading, s } from "@/components/ui";

export default function MyListings() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useLoad(() => (me ? api.me.listings() : Promise.resolve({ items: [] as OwnerListing[] })), [me?.id]);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => { if (me) reload(); }, [me, reload]));
  if (!me) return <Empty title="Post your property" body="Log in with your mobile number to list a home, land or commercial space. First listing is free." action={{ title: "Log in", onPress: () => router.push("/login") }} />;

  async function start() {
    setBusy(true);
    try { const l = await api.listings.create({ wizardStep: 1 }); router.push(`/listing/${l.id}`); }
    catch (e) { Alert.alert("Could not start", e instanceof ApiError ? e.message : "Try again"); } finally { setBusy(false); }
  }
  async function act(l: OwnerListing, a: "PAUSE" | "RESUME" | "MARK_SOLD" | "MARK_RENTED" | "RENEW" | "ARCHIVE") {
    try { await api.listings.action(l.id, a); reload(); } catch (e) { Alert.alert("Not updated", e instanceof ApiError ? e.message : "Try again"); }
  }
  const actions = (l: OwnerListing) => l.status === "PUBLISHED" ? [["PAUSE", "Pause"], [l.transaction === "SALE" ? "MARK_SOLD" : "MARK_RENTED", l.transaction === "SALE" ? "Mark sold" : "Mark rented"]] as const
    : l.status === "PAUSED" ? [["RESUME", "Resume"]] as const : l.status === "EXPIRED" ? [["RENEW", "Renew"]] as const : [];

  return (
    <FlatList style={s.screen} contentContainerStyle={s.pad} data={data?.items ?? []} keyExtractor={(l) => l.id}
      ListHeaderComponent={<View style={{ marginBottom: 12 }}><Button title="Post a new property" onPress={start} loading={busy} />{error && <ErrorBox message={error} retry={reload} />}</View>}
      ListEmptyComponent={loading ? <Loading /> : <Empty title="No listings yet" body="Your listings appear here." />}
      renderItem={({ item: l }) => (
        <View style={s.section}>
          <Pressable accessibilityRole="button" onPress={() => ["DRAFT", "CHANGES_REQUESTED", "REJECTED", "PUBLISHED", "PAUSED"].includes(l.status) ? router.push(`/listing/${l.id}`) : undefined}>
            <Text style={{ fontWeight: "700", color: "#0B2545" }}>{l.title || "Untitled draft"}</Text>
            <Text style={s.muted}>{headlinePrice(l)} · {l.locality?.name ?? "No location"} · {l.enquiryCount ?? 0} enquiries</Text>
          </Pressable>
          <View style={[s.row, { marginTop: 8 }]}>
            <Badge text={statusLabel(l.status)} tone={l.status === "PUBLISHED" ? "ok" : ["PENDING_REVIEW", "CHANGES_REQUESTED"].includes(l.status) ? "warn" : "plain"} />
            {actions(l).map(([a, label]) => <Button key={a} title={label} variant="ghost" onPress={() => act(l, a)} style={{ minHeight: 36 }} />)}
          </View>
        </View>
      )} />
  );
}
