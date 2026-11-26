import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LEAD_STAGES } from "@pbs/domain";
import { ApiError, type ConversationView } from "@pbs/api-client";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";
import { fmtDateTime, statusLabel } from "@/lib/format";
import { useLoad } from "@/components/useLoad";
import { Button, Chip, ErrorBox, Loading, s } from "@/components/ui";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload, setData } = useLoad<ConversationView>(() => api.conversations.get(id), [id]);
  const [body, setBody] = useState(""); const [sending, setSending] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function send() {
    if (!data || !body.trim()) return;
    setSending(true); setErr(null);
    try { const m = await api.conversations.send(id, body.trim()); setData({ ...data, messages: [...data.messages, m] }); setBody(""); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Not sent. Check your connection and try again."); } finally { setSending(false); }
  }
  async function requestVisit() {
    if (!data?.enquiryId) return;
    const when = new Date(Date.now() + 2 * 86400_000); when.setHours(11, 0, 0, 0);
    try { await api.leads.requestVisit(data.enquiryId, when.toISOString(), "Proposed from the app"); reload(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not request a visit"); }
  }
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Not found"} retry={reload} />;
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={{ padding: 12, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.sand200 }}>
        <Text style={{ fontWeight: "700" }}>{data.participants.find((p) => !p.isMe)?.name}</Text>
        {data.listing && <Text style={s.muted}>{data.listing.title}</Text>}
        {data.myRole === "ADVERTISER" && data.enquiryId && <View style={[s.row, { marginTop: 8 }]}>{LEAD_STAGES.map((st) => <Chip key={st} label={statusLabel(st)} onPress={() => api.leads.update(data.enquiryId!, { stage: st }).catch(() => undefined)} />)}</View>}
        {data.visits.map((v) => <View key={v.id} style={[s.row, { marginTop: 6 }]}><Text>Visit {fmtDateTime(v.proposedAt)}: {statusLabel(v.status)}</Text>
          {["REQUESTED", "RESCHEDULE_PROPOSED"].includes(v.status) && <><Chip label="Accept" onPress={() => api.leads.visitAction(v.id, "ACCEPT").then(reload).catch((e) => setErr(e.message))} /><Chip label="Decline" onPress={() => api.leads.visitAction(v.id, "DECLINE").then(reload).catch((e) => setErr(e.message))} /></>}</View>)}
        {data.listing?.status === "PUBLISHED" && <Button title="Propose a visit (day after tomorrow, 11 AM)" variant="ghost" onPress={requestVisit} style={{ marginTop: 8 }} />}
      </View>
      <FlatList contentContainerStyle={{ padding: 12, gap: 8 }} data={data.messages} keyExtractor={(m) => m.id}
        renderItem={({ item: m }) => <View style={{ alignSelf: m.fromMe ? "flex-end" : "flex-start", maxWidth: "80%", backgroundColor: m.fromMe ? C.emerald100 : C.white, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.sand200 }}><Text>{m.body}</Text><Text style={[s.muted, { fontSize: 11 }]}>{fmtDateTime(m.at)}</Text></View>} />
      {err && <Text style={[s.error, { paddingHorizontal: 12 }]}>{err}</Text>}
      {data.blocked ? <Text style={[s.muted, { padding: 12 }]}>This conversation is blocked.</Text> : (
        <View style={{ flexDirection: "row", gap: 8, padding: 12, backgroundColor: C.white }}>
          <TextInput accessibilityLabel="Message" value={body} onChangeText={setBody} placeholder="Write a message" placeholderTextColor={C.sand400} style={[s.input, { flex: 1 }]} maxLength={2000} />
          <Button title="Send" onPress={send} loading={sending} disabled={!body.trim()} />
        </View>)}
    </KeyboardAvoidingView>
  );
}
