import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';

export default function AdminDoubtsScreen() {
  const router = useRouter();
  const [doubts, setDoubts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'solved'>('open');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('doubts')
      .select('*, profiles(full_name, student_id), doubt_solutions(id)')
      .eq('status', filter)
      .order('created_at', { ascending: false });
    setDoubts(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterRow}>
        {(['open', 'solved'] as const).map((f) => (
          <Pressable key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={doubts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No {filter} doubts.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/doubts/${item.id}` as any)}>
              <Text style={styles.name}>{item.profiles?.full_name} ({item.profiles?.student_id})</Text>
              <Text style={styles.question} numberOfLines={2}>{item.question_text || '📷 Image doubt'}</Text>
              <Text style={styles.meta}>{item.coin_amount} coins · {item.doubt_solutions?.length ?? 0} answer(s)</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  filterRow: { flexDirection: 'row', gap: 8, padding: 16 },
  filterChip: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  filterChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  filterText: { color: '#8A8FA3', fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: '#0A0E1A' },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  name: { color: 'white', fontWeight: '700', fontSize: 13 },
  question: { color: '#B8C0D8', fontSize: 13 },
  meta: { color: '#D4AF37', fontSize: 11, fontWeight: '600' },
});