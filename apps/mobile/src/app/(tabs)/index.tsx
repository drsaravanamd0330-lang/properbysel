import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { CATEGORY_LABEL, PROPERTY_CATEGORIES } from "@pbs/domain";
import { ApiError, type City, type PublicListing } from "@pbs/api-client";
import { api } from "@/lib/api";
import { BRAND, C } from "@/lib/theme";
import { Button, Chip, Empty, ErrorBox, ListingCard, Loading, s } from "@/components/ui";

const SORTS = [["relevance", "Relevance"], ["newest", "Newest"], ["price_asc", "Price ↑"], ["price_desc", "Price ↓"]] as const;

export default function Search() {
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState("chennai");
  const [tx, setTx] = useState<"RENT" | "SALE" | "">("RENT");
  const [category, setCategory] = useState<string>("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<string>("relevance");
  const [items, setItems] = useState<PublicListing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.geo.cities().then((r) => setCities(r.items)).catch(() => undefined); }, []);
  const load = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const r = await api.search({ city, transaction: tx || undefined, category: category || undefined, q: q.trim() || undefined, sort, page: p, pageSize: 10 });
      setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items])); setPage(p); setTotalPages(r.totalPages); setTotal(r.total);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Search failed"); } finally { setLoading(false); }
  }, [city, tx, category, q, sort]);
  useEffect(() => { load(1); }, [city, tx, category, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <View style={{ gap: 10, paddingBottom: 8 }}>
      <Text style={{ color: C.emerald600, fontWeight: "700", letterSpacing: 2, fontSize: 12 }}>{BRAND.secondary}</Text>
      <View style={s.row}>{([["RENT", "Rent"], ["SALE", "Buy"], ["", "All"]] as const).map(([v, l]) => <Chip key={l} label={l} selected={tx === v} onPress={() => setTx(v)} />)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{cities.map((c) => <Chip key={c.slug} label={c.name} selected={city === c.slug} onPress={() => setCity(c.slug)} />)}</ScrollView>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput accessibilityLabel="Locality, landmark or PIN code" placeholder="Locality, landmark or PIN" placeholderTextColor={C.sand400} value={q} onChangeText={setQ} onSubmitEditing={() => load(1)} returnKeyType="search" style={[s.input, { flex: 1 }]} />
        <Button title="Search" onPress={() => load(1)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label="All types" selected={!category} onPress={() => setCategory("")} />
        {PROPERTY_CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{SORTS.map(([v, l]) => <Chip key={v} label={l} selected={sort === v} onPress={() => setSort(v)} />)}</ScrollView>
      <Text style={s.muted} accessibilityLiveRegion="polite">{loading && page === 1 ? "Searching…" : `${total} properties`}</Text>
      {error && <ErrorBox message={error} retry={() => load(1)} />}
    </View>
  );

  return (
    <FlatList style={s.screen} contentContainerStyle={s.pad} data={items} keyExtractor={(l) => l.id} renderItem={({ item }) => <ListingCard l={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={loading ? <Loading /> : !error ? <Empty title="No properties found" body="Try another locality or remove a filter." /> : undefined}
      ListFooterComponent={page < totalPages ? <Button title="Load more" variant="ghost" loading={loading && page > 0} onPress={() => load(page + 1)} /> : undefined}
      refreshControl={<RefreshControl refreshing={loading && page === 1 && items.length > 0} onRefresh={() => load(1)} />} />
  );
}
