import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function PracticeIndexScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('subjects').select('*').then(({ data }) => { setSubjects(data ?? []); setLoading(false); });
  }, []);

  async function selectSubject(subject: any) {
    setSelectedSubject(subject);
    const { data } = await supabase.from('chapters').select('*').eq('subject_id', subject.id);
    setChapters(data ?? []);

    const counts: Record<string, number> = {};
    for (const ch of data ?? []) {
      const { count } = await supabase.from('practice_questions').select('id', { count: 'exact', head: true }).eq('chapter_id', ch.id);
      counts[ch.id] = count ?? 0;
    }
    setChapterCounts(counts);
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
      <Stack.Screen options={{ title: 'Practice', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />

      <Text style={styles.sectionTitle}>Subjects</Text>
      <View style={styles.chipRow}>
        {subjects.map((s) => (
          <Pressable key={s.id} style={[styles.chip, selectedSubject?.id === s.id && styles.chipActive]} onPress={() => selectSubject(s)}>
            <Text style={styles.chipText}>{s.name}</Text>
          </Pressable>
        ))}
      </View>

      {selectedSubject && (
        <FlatList
          data={chapters}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No chapters yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => chapterCounts[item.id] > 0 && router.push(`/practice/${item.id}` as any)}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{chapterCounts[item.id] ?? 0} practice questions</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  sectionTitle: { color: '#D4AF37', fontSize: 16, fontWeight: '700', padding: 16, paddingBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: 'white', fontSize: 12, fontWeight: '600' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14 },
  cardTitle: { color: 'white', fontWeight: '700', fontSize: 15 },
  cardMeta: { color: '#8A8FA3', fontSize: 12, marginTop: 2 },
});