import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function GlobalSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length < 2) { setResults([]); return; }

    setLoading(true);
    const [batches, tests, classes, pdfs] = await Promise.all([
      supabase.from('batches').select('id, name').ilike('name', `%${text}%`).limit(5),
      supabase.from('tests').select('id, title').ilike('title', `%${text}%`).eq('is_published', true).limit(5),
      supabase.from('classes').select('id, title').ilike('title', `%${text}%`).limit(5),
      supabase.from('pdfs').select('id, title, batch_id').ilike('title', `%${text}%`).limit(5),
    ]);

    const combined = [
      ...(batches.data ?? []).map((b) => ({ type: 'Batch', id: b.id, title: b.name, route: `/batch/${b.id}` })),
      ...(tests.data ?? []).map((t) => ({ type: 'Test', id: t.id, title: t.title, route: `/tests/${t.id}/attempt` })),
      ...(classes.data ?? []).map((c) => ({ type: 'Video', id: c.id, title: c.title, route: `/watch/${c.id}` })),
      ...(pdfs.data ?? []).map((p) => ({ type: 'PDF', id: p.id, title: p.title, route: `/library/${p.batch_id}` })),
    ];

    setResults(combined);
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Search', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <TextInput
        style={styles.input}
        placeholder="Search batches, tests, videos, PDFs..."
        placeholderTextColor="#8A8FA3"
        value={query}
        onChangeText={search}
        autoFocus
      />
      {loading && <ActivityIndicator color="#D4AF37" style={{ marginTop: 20 }} />}
      <FlatList
        data={results}
        keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(item.route as any)}>
            <Text style={styles.type}>{item.type}</Text>
            <Text style={styles.title}>{item.title}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  input: { margin: 16, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16 },
  listContent: { paddingHorizontal: 16, gap: 8 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12 },
  type: { color: '#D4AF37', fontSize: 10, fontWeight: '700' },
  title: { color: 'white', fontSize: 14, marginTop: 2 },
});