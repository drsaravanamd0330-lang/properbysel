import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { fmtDateTime, statusLabel, headlinePrice } from "@/lib/format";
import { useLoad } from "@/components/useLoad";
import { Badge, Chip, Empty, ErrorBox, Loading, s } from "@/components/ui";

export default function Inbox() {
  const { me } = useAuth();
  const [tab, setTab] = useState<"leads" | "sent">("leads");
  const leads = useLoad(() => (me ? api.me.inbox() : Promise.resolve({ items: [] })), [me?.id]);
  const sent = useLoad(() => (me ? api.me.enquiries() : Promise.resolve({ items: [] })), [me?.id]);
  useFocusEffect(useCallback(() => { if (me) { leads.reload(); sent.reload(); } }, [me])); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return <Empty title="Messages" body="Log in to see enquiries and conversations." action={{ title: "Log in", onPress: () => router.push("/login") }} />;
  const cur = tab === "leads" ? leads : sent;
  return (
    <View style={s.screen}>
      <View style={[s.row, { padding: 12 }]}><Chip label="Leads on my listings" selected={tab === "leads"} onPress={() => setTab("leads")} /><Chip label="My enquiries" selected={tab === "sent"} onPress={() => setTab("sent")} /></View>
      {cur.loading && !cur.data ? <Loading /> : cur.error ? <ErrorBox message={cur.error} retry={cur.reload} /> : tab === "leads" ? (
        <FlatList contentContainerStyle={s.pad} data={leads.data?.items ?? []} keyExtractor={(e) => e.id} ListEmptyComponent={<Empty title="No leads yet" />}
          renderItem={({ item: e }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/conversation/${e.conversationId}`)} style={s.section}>
              <View style={s.row}>{e.unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.emerald600 }} accessibilityLabel="Unread" />}<Text style={{ fontWeight: "700" }}>{e.buyer.name}</Text><Badge text={statusLabel(e.stage)} /></View>
              <Text style={s.muted}>{e.listing.title}</Text>
              {e.lastMessage && <Text numberOfLines={2}>{e.lastMessage.fromMe ? "You: " : ""}{e.lastMessage.body}</Text>}
              {e.lastMessage && <Text style={s.muted}>{fmtDateTime(e.lastMessage.at)}</Text>}
            </Pressable>)} />
      ) : (
        <FlatList contentContainerStyle={s.pad} data={sent.data?.items ?? []} keyExtractor={(e) => e.id} ListEmptyComponent={<Empty title="No enquiries sent" />}
          renderItem={({ item: e }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/conversation/${e.conversationId}`)} style={s.section}>
              <Text style={{ fontWeight: "700" }}>{e.listing.title}</Text><Text style={s.muted}>{headlinePrice(e.listing)}</Text>
            </Pressable>)} />
      )}
    </View>
  );
}
