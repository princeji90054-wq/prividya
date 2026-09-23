import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function TestsListScreen() {
  const router = useRouter();
  const [freeTests, setFreeTests] = useState<any[]>([]);
  const [batchTests, setBatchTests] = useState<any[]>([]);
  const [myAttempts, setMyAttempts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: free } = await supabase.from('tests').select('*').is('batch_id', null).eq('is_published', true);
      setFreeTests(free ?? []);

      if (user) {
        const { data: purchasedBatches } = await supabase
          .from('payments').select('batch_id').eq('student_id', user.id).eq('status', 'approved');
        const batchIds = [...new Set((purchasedBatches ?? []).map((p) => p.batch_id))];

        if (batchIds.length > 0) {
          const { data: paidTests } = await supabase.from('tests').select('*').in('batch_id', batchIds).eq('is_published', true);
          setBatchTests(paidTests ?? []);
        }

        const { data: attempts } = await supabase.from('test_attempts').select('*').eq('student_id', user.id);
        const map: Record<string, any> = {};
        (attempts ?? []).forEach((a) => { map[a.test_id] = a; });
        setMyAttempts(map);
      }

      setLoading(false);
    }
    load();
  }, []);

  function renderTestCard(item: any) {
    const attempt = myAttempts[item.id];
    return (
      <Pressable
        key={item.id}
        style={styles.card}
        onPress={() => {
          if (attempt?.status === 'submitted') {
            router.push(`/tests/${item.id}/result` as any);
          } else {
            router.push(`/tests/${item.id}/attempt` as any);
          }
        }}
      >
        <Text style={styles.testTitle}>{item.title}</Text>
        {item.description && <Text style={styles.testDesc}>{item.description}</Text>}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.timer_type === 'overall' ? `${item.duration_minutes} min` : 'Section-wise'}</Text>
          <Text style={styles.metaText}>Negative: {item.negative_marking}</Text>
        </View>
        {attempt?.status === 'submitted' && <Text style={styles.doneTag}>✓ Attempted — View Result</Text>}
        {attempt?.status === 'in_progress' && <Text style={styles.resumeTag}>⏸ Resume Test</Text>}
      </Pressable>
    );
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
      <Stack.Screen options={{ title: 'Tests', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={[{ type: 'header', title: 'Free Tests' }, ...freeTests, { type: 'header', title: 'Your Batch Tests' }, ...batchTests]}
        keyExtractor={(item, i) => item.id ?? `header-${i}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: any) =>
          item.type === 'header' ? <Text style={styles.sectionHeader}>{item.title}</Text> : renderTestCard(item)
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No tests available yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  sectionHeader: { color: '#D4AF37', fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 14, padding: 14, gap: 6 },
  testTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  testDesc: { color: '#8A8FA3', fontSize: 12 },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { color: '#B8C0D8', fontSize: 11 },
  doneTag: { color: '#4ADE80', fontSize: 12, fontWeight: '600' },
  resumeTag: { color: '#D4AF37', fontSize: 12, fontWeight: '600' },
});