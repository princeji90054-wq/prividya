import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function PyqScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => { setCategories(data ?? []); setLoading(false); });
  }, []);

  async function selectCategory(cat: any) {
    setSelectedCategory(cat);
    const { data } = await supabase.from('tests').select('*').eq('is_pyq', true).eq('category_id', cat.id).eq('is_published', true).order('exam_year', { ascending: false });
    setPapers(data ?? []);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Previous Year Papers', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />

      <View style={styles.chipRow}>
        {categories.map((c) => (
          <Pressable key={c.id} style={[styles.chip, selectedCategory?.id === c.id && styles.chipActive]} onPress={() => selectCategory(c)}>
            <Text style={styles.chipText}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={papers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>{selectedCategory ? 'No PYQ papers yet.' : 'Select a category above.'}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/tests/${item.id}/attempt` as any)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>Year: {item.exam_year}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 8 },
  chip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: 'white', fontSize: 12, fontWeight: '600' },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14 },
  cardTitle: { color: 'white', fontWeight: '700', fontSize: 15 },
  cardMeta: { color: '#8A8FA3', fontSize: 12 },
});