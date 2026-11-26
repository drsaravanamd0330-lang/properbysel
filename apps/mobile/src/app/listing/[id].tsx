import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  ADVERTISER_TYPES, ADVERTISER_LABEL, TRANSACTION_TYPES, PROPERTY_CATEGORIES, CATEGORY_LABEL, CATEGORY_GROUP, AREA_UNITS, AREA_UNIT_LABEL, type PropertyCategory,
} from "@pbs/domain";
import type { ListingDraftInput } from "@pbs/validation";
import { ApiError, type City, type Locality, type OwnerListing } from "@pbs/api-client";
import { api, mediaSource } from "@/lib/api";
import { C } from "@/lib/theme";
import { statusLabel } from "@/lib/format";
import { Button, Chip, ErrorBox, Field, Loading, s } from "@/components/ui";

type Draft = ListingDraftInput & { attributes: Record<string, unknown> };
const STEPS = ["Who & what", "Type", "Location", "Details", "Price", "Photos", "Contact", "Review"];

export default function ListingEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<OwnerListing | null>(null);
  const [d, setD] = useState<Draft>({ attributes: {} });
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<City[]>([]);
  const [locs, setLocs] = useState<Locality[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pending = useRef<Partial<Draft>>({});

  useEffect(() => {
    Promise.all([api.listings.get(id), api.geo.cities()]).then(([x, c]) => {
      setL(x); setCities(c.items); setStep(Math.min(x.wizardStep || 1, 8));
      setD({ advertiserType: x.advertiserType ?? undefined, transaction: x.transaction ?? undefined, category: x.category ?? undefined, title: x.title ?? "", description: x.description ?? "",
        cityId: x.cityId ?? undefined, localityId: x.localityId ?? undefined, address: x.address ?? "", landmark: x.landmark ?? "", attributes: (x.attributes ?? {}) as Record<string, unknown>,
        pricePaise: x.pricePaise ?? undefined, rentPaise: x.rentPaise ?? undefined, leasePaise: x.leasePaise ?? undefined, depositPaise: x.depositPaise ?? undefined,
        brokerageDisclosure: x.brokerageDisclosure ?? "", showPhone: x.showPhone, contactConsent: x.contactConsent, negotiable: x.negotiable });
    }).catch((e) => setLoadErr(e instanceof ApiError ? e.message : "Could not load listing"));
  }, [id]);
  const citySlug = cities.find((c) => c.id === d.cityId)?.slug;
  useEffect(() => { if (citySlug) api.geo.localities(citySlug).then((r) => setLocs(r.items)).catch(() => setLocs([])); }, [citySlug]);

  const update = (p: Partial<Draft>) => { setD((x) => ({ ...x, ...p })); pending.current = { ...pending.current, ...p }; setSaving("idle"); };
  const setAttr = (k: string, v: unknown) => update({ attributes: { ...d.attributes, [k]: v === "" || Number.isNaN(v) ? undefined : v } });
  async function flush(extra: Partial<Draft> = {}) {
    const body = { ...pending.current, ...extra }; pending.current = {};
    if (!Object.keys(body).length) return true;
    setSaving("saving");
    try { setL(await api.listings.save(id, body)); setSaving("saved"); return true; }
    catch (e) { pending.current = { ...body, ...pending.current }; setSaving("error"); if (e instanceof ApiError) setIssues(e.fieldErrors); return false; }
  }
  async function go(n: number) { await flush({ wizardStep: Math.max(n, l?.wizardStep ?? 1) }); setStep(n); }
  async function submit() {
    await flush(); setIssues({});
    try { await api.listings.submit(id); Alert.alert("Submitted for review", "You will get a notification when it is live or if changes are needed."); router.back(); }
    catch (e) { if (e instanceof ApiError && e.status === 422) setIssues(e.fieldErrors); else Alert.alert("Not submitted", e instanceof ApiError ? e.message : "Try again"); }
  }
  async function addPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Photo access needed", "ProperBySel needs access to your photos only so you can choose pictures of your property. You can change this in Settings."); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.8, exif: false, selectionLimit: 10 });
    if (r.canceled) return;
    setUploading(true);
    for (const a of r.assets) {
      const fd = new FormData();
      fd.append("file", { uri: a.uri, name: a.fileName ?? "photo.jpg", type: a.mimeType ?? "image/jpeg" } as unknown as Blob);
      try { await api.listings.uploadPhoto(id, fd); } catch (e) { Alert.alert("Upload failed", `${e instanceof ApiError ? e.message : "Check your connection"}. You can retry.`); }
    }
    setL(await api.listings.get(id)); setUploading(false);
  }

  if (loadErr) return <ErrorBox message={loadErr} />;
  if (!l) return <Loading />;
  const group = d.category ? CATEGORY_GROUP[d.category as PropertyCategory] : null;
  const num = (t: string) => (t === "" ? undefined : Number(t.replace(/[^\d.]/g, "")));
  const rupee = (k: "pricePaise" | "rentPaise" | "leasePaise" | "depositPaise", label: string) =>
    <Field label={label} keyboardType="number-pad" value={d[k] ? String(d[k]! / 100) : ""} onChangeText={(t) => update({ [k]: t ? Number(t.replace(/\D/g, "")) * 100 : undefined })} error={issues[k]} hint="In rupees" />;
  const attrField = (k: string, label: string, numeric = true) =>
    <Field key={k} label={label} keyboardType={numeric ? "decimal-pad" : "default"} value={d.attributes[k] !== undefined ? String(d.attributes[k]) : ""} onChangeText={(t) => setAttr(k, numeric ? num(t) : t)} error={issues[`attributes.${k}`]} />;

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: C.white }} contentContainerStyle={{ padding: 10, gap: 6 }}>
        {STEPS.map((t, i) => <Chip key={t} label={`${i + 1}. ${t}`} selected={step === i + 1} onPress={() => go(i + 1)} />)}
      </ScrollView>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        {l.status !== "DRAFT" && <Text style={[s.muted, { marginBottom: 8 }]}>Status: {statusLabel(l.status)}{l.lastReview?.note ? `. Moderator note: ${l.lastReview.note}` : ""}</Text>}
        <Text style={s.h1}>{STEPS[step - 1]}</Text>
        {step === 1 && <>
          <Text style={s.label}>I am the</Text><View style={[s.row, { marginBottom: 12 }]}>{ADVERTISER_TYPES.map((a) => <Chip key={a} label={ADVERTISER_LABEL[a]} selected={d.advertiserType === a} onPress={() => update({ advertiserType: a })} />)}</View>
          <Text style={s.label}>I want to</Text><View style={[s.row, { marginBottom: 12 }]}>{TRANSACTION_TYPES.map((t) => <Chip key={t} label={t === "SALE" ? "Sell" : t === "RENT" ? "Rent out" : "Lease out"} selected={d.transaction === t} onPress={() => update({ transaction: t })} />)}</View>
          {d.advertiserType === "AGENT" && <Field label="Brokerage terms" value={d.brokerageDisclosure ?? ""} onChangeText={(t) => update({ brokerageDisclosure: t })} error={issues.brokerageDisclosure} />}
        </>}
        {step === 2 && <View style={s.row}>{PROPERTY_CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_LABEL[c]} selected={d.category === c} onPress={() => update({ category: c, attributes: d.category && CATEGORY_GROUP[d.category as PropertyCategory] === CATEGORY_GROUP[c] ? d.attributes : {} })} />)}</View>}
        {step === 3 && <>
          <Text style={s.label}>City</Text><View style={[s.row, { marginBottom: 12 }]}>{cities.map((c) => <Chip key={c.id} label={c.name} selected={d.cityId === c.id} onPress={() => update({ cityId: c.id, localityId: undefined })} />)}</View>
          {issues.cityId && <Text style={s.error}>{issues.cityId}</Text>}
          {locs.length > 0 && <><Text style={s.label}>Locality</Text><View style={[s.row, { marginBottom: 12 }]}>{locs.map((x) => <Chip key={x.id} label={x.name} selected={d.localityId === x.id} onPress={() => update({ localityId: x.id, postcode: x.postcodes[0] })} />)}</View></>}
          {issues.localityId && <Text style={s.error}>{issues.localityId}</Text>}
          <Field label="Full address (private)" value={d.address ?? ""} onChangeText={(t) => update({ address: t })} hint="Never shown publicly" />
          <Field label="Nearby landmark" value={d.landmark ?? ""} onChangeText={(t) => update({ landmark: t })} />
        </>}
        {step === 4 && <>
          <Field label="Title" value={d.title ?? ""} onChangeText={(t) => update({ title: t })} maxLength={120} error={issues.title} />
          <Field label="Description" multiline value={d.description ?? ""} onChangeText={(t) => update({ description: t })} maxLength={5000} error={issues.description} />
          {!group && <Text style={s.muted}>Choose a property type in step 2 to see more fields.</Text>}
          {group === "RESIDENTIAL" && <>
            {attrField("bedrooms", "Bedrooms")}{attrField("bathrooms", "Bathrooms")}{attrField("floor", "Floor")}{attrField("totalFloors", "Total floors")}
            <Text style={s.label}>Furnishing</Text><View style={[s.row, { marginBottom: 12 }]}>{["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"].map((f) => <Chip key={f} label={statusLabel(f)} selected={d.attributes.furnishing === f} onPress={() => setAttr("furnishing", f)} />)}</View>
            {issues["attributes.furnishing"] && <Text style={s.error}>{issues["attributes.furnishing"]}</Text>}
            {attrField("carpetAreaSqft", "Carpet area (sq ft)")}{attrField("builtUpAreaSqft", "Built-up area (sq ft)")}{attrField("superBuiltUpAreaSqft", "Super built-up area (sq ft)")}
          </>}
          {group === "LAND" && <>
            {attrField("plotArea", "Plot area")}
            <Text style={s.label}>Unit</Text><View style={[s.row, { marginBottom: 12 }]}>{AREA_UNITS.map((u) => <Chip key={u} label={AREA_UNIT_LABEL[u]} selected={d.attributes.plotAreaUnit === u} onPress={() => setAttr("plotAreaUnit", u)} />)}</View>
            {attrField("frontageFt", "Frontage (ft)")}{attrField("permittedUseClaim", "Permitted use (your statement)", false)}{attrField("water", "Water", false)}{attrField("electricity", "Electricity", false)}
          </>}
          {group === "COMMERCIAL" && <>{attrField("builtUpAreaSqft", "Built-up area (sq ft)")}{attrField("suitableFor", "Suitable for", false)}{attrField("powerKva", "Power (kVA)")}{attrField("washrooms", "Washrooms")}{attrField("parkingSlots", "Parking slots")}</>}
        </>}
        {step === 5 && <>
          {d.transaction === "SALE" && rupee("pricePaise", "Sale price")}
          {d.transaction === "RENT" && <>{rupee("rentPaise", "Monthly rent")}{rupee("depositPaise", "Security deposit")}</>}
          {d.transaction === "LEASE" && <>{rupee("leasePaise", "Lease amount")}{rupee("depositPaise", "Deposit")}</>}
          {!d.transaction && <Text style={s.muted}>Choose sale, rent or lease in step 1 first.</Text>}
          <View style={[s.row, { flexWrap: "nowrap" }]}><Switch value={!!d.negotiable} onValueChange={(v) => update({ negotiable: v })} accessibilityLabel="Price is negotiable" trackColor={{ true: C.emerald500 }} /><Text>Price is negotiable</Text></View>
        </>}
        {step === 6 && <>
          <Text style={[s.muted, { marginBottom: 10 }]}>Add at least 3 clear photos. Location data is removed from photos automatically.</Text>
          <Button title={uploading ? "Uploading…" : "Choose photos"} onPress={addPhotos} loading={uploading} variant="navy" />
          <View style={[s.row, { marginTop: 12 }]}>{l.media.map((m, i) => (
            <View key={m.id}><Image source={mediaSource(m.url)} style={{ width: 104, height: 70, borderRadius: 8 }} accessibilityLabel={`Photo ${i + 1}`} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={async () => { await api.listings.deletePhoto(id, m.id); setL(await api.listings.get(id)); }}><Text style={{ color: C.danger, textAlign: "center" }}>Remove</Text></Pressable></View>))}</View>
        </>}
        {step === 7 && <>
          <View style={[s.row, { flexWrap: "nowrap", marginBottom: 12 }]}><Switch value={!!d.showPhone} onValueChange={(v) => update({ showPhone: v })} accessibilityLabel="Show my phone number to people who enquire" trackColor={{ true: C.emerald500 }} /><Text style={{ flex: 1 }}>Show my phone number to people who have sent an enquiry</Text></View>
          <View style={[s.row, { flexWrap: "nowrap" }]}><Switch value={!!d.contactConsent} onValueChange={(v) => update({ contactConsent: v })} accessibilityLabel="Confirm details are accurate and agree to be contacted" trackColor={{ true: C.emerald500 }} /><Text style={{ flex: 1 }}>I confirm the details are accurate, I may advertise this property, and I agree to be contacted about it.</Text></View>
          {issues.contactConsent && <Text style={s.error}>{issues.contactConsent}</Text>}
        </>}
        {step === 8 && <>
          <Text style={s.h2}>{d.title || "Untitled"}</Text>
          <Text style={s.muted}>{d.category ? CATEGORY_LABEL[d.category as PropertyCategory] : "No type"} · {l.media.length} photos</Text>
          {Object.keys(issues).length > 0 && <View style={{ backgroundColor: C.dangerBg, padding: 12, borderRadius: 10, marginVertical: 10 }} accessibilityRole="alert">{Object.values(issues).map((v, i) => <Text key={i} style={{ color: C.danger }}>• {v}</Text>)}</View>}
          <Button title="Submit for review" onPress={submit} style={{ marginTop: 12 }} />
        </>}
        <Text style={[s.muted, { marginTop: 12 }]} accessibilityLiveRegion="polite">{saving === "saving" ? "Saving…" : saving === "saved" ? "All changes saved" : saving === "error" ? "Not saved. Check your connection and tap Save again." : ""}</Text>
        <View style={[s.row, { marginTop: 8 }]}>
          {step > 1 && <Button title="Back" variant="ghost" onPress={() => go(step - 1)} />}
          {step < 8 && <Button title="Save and continue" onPress={() => go(step + 1)} style={{ flex: 1 }} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
