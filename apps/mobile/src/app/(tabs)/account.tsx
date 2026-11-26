import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/theme";
import { registerForPush } from "@/lib/push";
import { fmtDateTime } from "@/lib/format";
import { useLoad } from "@/components/useLoad";
import { Button, Empty, Field, s } from "@/components/ui";

export default function Account() {
  const { me, signOut, reload } = useAuth();
  const [name, setName] = useState(me?.name ?? "");
  const notes = useLoad(() => (me ? api.me.notifications() : Promise.resolve({ items: [], unread: 0 })), [me?.id]);
  if (!me) return <View style={s.screen}><Empty title={BRAND.name} body={`${BRAND.tagline}\n${BRAND.ownership}`} action={{ title: "Log in", onPress: () => router.push("/login") }} /></View>;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>Account</Text>
      <Text style={s.muted}>{me.phone} · {me.roles.join(", ")}</Text>
      <View style={[s.section, { marginTop: 12 }]}>
        <Field label="Name" value={name} onChangeText={setName} />
        <Button title="Save profile" onPress={async () => { try { await api.me.update({ name }); await reload(); Alert.alert("Saved"); } catch { Alert.alert("Could not save"); } }} />
      </View>
      <View style={s.section}>
        <Text style={s.h2}>Push notifications</Text>
        <Text style={[s.muted, { marginBottom: 8 }]}>Get alerts for new enquiries, messages and listing reviews. We ask your phone for permission only when you tap below.</Text>
        <Button title="Turn on notifications" variant="ghost" onPress={async () => Alert.alert("Notifications", await registerForPush())} />
      </View>
      <View style={s.section}>
        <Text style={s.h2}>Notifications {notes.data?.unread ? `(${notes.data.unread} new)` : ""}</Text>
        {(notes.data?.items ?? []).slice(0, 10).map((n) => <View key={n.id} style={{ marginBottom: 8 }}><Text style={{ fontWeight: "600" }}>{n.title}</Text><Text>{n.body}</Text><Text style={s.muted}>{fmtDateTime(n.createdAt)}</Text></View>)}
        {notes.data?.items.length === 0 && <Text style={s.muted}>No notifications yet.</Text>}
      </View>
      <Button title="Log out" variant="ghost" onPress={signOut} />
      <Text style={[s.muted, { marginTop: 16, textAlign: "center" }]}>{BRAND.ownership}</Text>
    </ScrollView>
  );
}
