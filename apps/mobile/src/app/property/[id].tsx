import { useRef, useState } from "react";
import { Linking, ScrollView, Share, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ApiError, type PublicListing } from "@pbs/api-client";
import { formatINR } from "@pbs/domain";
import { api, mediaSource, newKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { headlinePrice, categoryLabel, advertiserLabel, areaLabel, statusLabel } from "@/lib/format";
import { useLoad } from "@/components/useLoad";
import { Badge, Button, ErrorBox, Field, Loading, s } from "@/components/ui";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000";

export default function Property() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { data: l, error, loading, reload } = useLoad<PublicListing>(() => api.property.get(id), [id]);
  const [msg, setMsg] = useState("Hi, I am interested in this property. Is it still available?");
  const [share, setShare] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reported, setReported] = useState(false);
  const key = useRef(newKey());

  const needLogin = () => router.push("/login");
  async function enquire() {
    if (!me) return needLogin();
    setSending(true); setErr(null);
    try { const r = await api.property.enquire(id, msg, share, key.current); setSent(r.conversationId); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not send. Check your connection and try again."); } finally { setSending(false); }
  }
  async function save() {
    if (!me) return needLogin();
    try { const r = saved ? await api.me.removeFavourite(id) : await api.me.addFavourite(id); setSaved(r.saved); } catch { /* ignore */ }
  }
  async function report() {
    if (!me) return needLogin();
    try { await api.property.report(id, "OTHER", "Reported from the mobile app"); setReported(true); } catch { setErr("Could not send the report."); }
  }

  if (loading) return <Loading />;
  if (error || !l) return <ErrorBox message={error ?? "Not found"} retry={reload} />;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: categoryLabel(l.category) }} />
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} accessibilityLabel={`${l.media.length} photos`}>
        {l.media.map((m, i) => <Image key={m.id} source={mediaSource(m.url)} style={{ width: 400, aspectRatio: 3 / 2 }} accessibilityLabel={`Photo ${i + 1}`} contentFit="cover" />)}
      </ScrollView>
      <View style={s.pad}>
        <View style={s.row}>{l.isSponsored && <Badge text="Sponsored" tone="warn" />}{l.isDemo && <Badge text="Demo listing" tone="demo" />}{l.verifications.map((v) => <Badge key={v} text={`✓ ${v}`} tone="ok" />)}</View>
        <Text style={[s.h1, { marginTop: 8 }]}>{l.title}</Text>
        <Text style={s.muted}>{[l.landmark, l.locality?.name, l.city?.name, l.postcode].filter(Boolean).join(", ")}</Text>
        <Text style={[s.price, { fontSize: 22, marginVertical: 8 }]}>{headlinePrice(l)}{l.negotiable ? "  · Negotiable" : ""}</Text>
        <View style={s.section}>
          {l.bedrooms !== null && <Text>{l.bedrooms} BHK</Text>}
          {areaLabel(l) && <Text>Area: {areaLabel(l)}</Text>}
          {l.furnishing && <Text>{statusLabel(l.furnishing)}</Text>}
          <Text>Posted by: {advertiserLabel(l.advertiserType)}</Text>
          {l.depositPaise ? <Text>Deposit: {formatINR(l.depositPaise)}</Text> : null}
          {l.maintenancePaise ? <Text>Maintenance: {formatINR(l.maintenancePaise)}/month</Text> : null}
          <Text>Brokerage: {l.brokerageDisclosure ?? (l.advertiserType === "OWNER" ? "None stated (owner)" : "Ask the advertiser")}</Text>
        </View>
        <View style={s.section}><Text style={s.h2}>About</Text><Text>{l.description}</Text></View>
        {l.amenities.length > 0 && <View style={s.section}><Text style={s.h2}>Amenities</Text><View style={s.row}>{l.amenities.map((a) => <Badge key={a} text={statusLabel(a)} />)}</View></View>}
        <View style={s.section}><Text style={s.h2}>Location</Text><Text style={s.muted}>Approximate area only. The advertiser shares the exact address when you arrange a visit.</Text>
          {l.approxLat ? <Button title="Open approximate area in maps" variant="ghost" style={{ marginTop: 8 }} onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${l.approxLat}&mlon=${l.approxLng}#map=14/${l.approxLat}/${l.approxLng}`)} /> : null}</View>

        <View style={s.section}>
          <Text style={s.h2}>Contact {l.advertiserName ?? "advertiser"}</Text>
          {sent ? <>
            <Text style={{ color: C.emerald700 }} accessibilityLiveRegion="polite">Enquiry sent.</Text>
            <Button title="Open conversation" onPress={() => router.push(`/conversation/${sent}`)} style={{ marginTop: 8 }} />
            {l.canShowPhone && <Button title={phone ?? "Show phone number"} variant="ghost" style={{ marginTop: 8 }} onPress={async () => { const r = await api.property.contact(id).catch(() => null); setPhone(r?.available ? `${r.name ?? ""} ${r.phone}` : r?.reason ?? "Not available"); }} />}
          </> : <>
            <Field label="Message" multiline value={msg} onChangeText={setMsg} maxLength={1000} error={err ?? undefined} />
            <View style={[s.row, { flexWrap: "nowrap", marginBottom: 10 }]}><Switch value={share} onValueChange={setShare} accessibilityLabel="Share my phone number with this advertiser" trackColor={{ true: C.emerald500 }} /><Text style={{ flex: 1 }}>Share my phone number</Text></View>
            <Button title={me ? "Send enquiry" : "Log in to send enquiry"} onPress={enquire} loading={sending} disabled={msg.trim().length < 5} />
          </>}
        </View>
        <View style={s.row}>
          <Button title={saved ? "★ Saved" : "☆ Save"} variant="ghost" onPress={save} />
          <Button title="Share" variant="ghost" onPress={() => Share.share({ message: `${l.title} – ${WEB_URL}${l.path}` })} />
          <Button title={reported ? "Reported" : "Report"} variant="ghost" onPress={report} disabled={reported} />
        </View>
        <Text style={[s.muted, { marginTop: 12 }]}>Never pay a token advance before visiting and checking documents.</Text>
      </View>
    </ScrollView>
  );
}
