import { useFocusEffect, router } from "expo-router";
import { useCallback } from "react";
import { FlatList } from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/components/useLoad";
import { Empty, ErrorBox, ListingCard, Loading, s } from "@/components/ui";

export default function Saved() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useLoad(() => (me ? api.me.favourites() : Promise.resolve({ items: [] })), [me?.id]);
  useFocusEffect(useCallback(() => { if (me) reload(); }, [me, reload]));
  if (!me) return <Empty title="Save properties you like" body="Log in to keep a shortlist across web and mobile." action={{ title: "Log in", onPress: () => router.push("/login") }} />;
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  return <FlatList style={s.screen} contentContainerStyle={s.pad} data={data?.items ?? []} keyExtractor={(l) => l.id} renderItem={({ item }) => <ListingCard l={item} />} ListEmptyComponent={<Empty title="Nothing saved yet" body="Tap Save on any property." />} />;
}
