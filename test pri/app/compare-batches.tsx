import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function CompareBatchesScreen() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [details, setDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('batches').select('*').eq('is_published', true).then(({ data }) => { setBatches(data ?? []); setLoading(false); });
  }, []);

  async function toggleSelect(batch: any) {
    if (selected.some((b) => b.id === batch.id)) {
      setSelected(selected.filter((b) => b.id !== batch.id));
      return;
    }
    if (selected.length >= 2) {
      Alert.alert('Max 2', 'You can compare up to 2 batches at a time.');
      return;
    }
    const newSelected = [...selected, batch];
    setSelected(newSelected);

    const { data: subjects } = await supabase.from('subjects').select('id, name').eq('batch_id', batch.id);
    const { count: classCount } = await supabase
      .from('classes').select('id', { count: 'exact', head: true })
      .in('chapter_id', (await supabase.from('chapters').select('id').in('subject_id', (subjects ?? []).map((s) => s.id))).data?.map((c) => c.id) ?? []);

    setDetails((prev) => ({ ...prev, [batch.id]: { subjectCount: subjects?.length ?? 0, classCount: classCount ?? 0 } }));
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
      <Stack.Screen options={{ title: 'Compare Batches', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.hint}>Select up to 2 batches to compare</Text>
        <View style={styles.chipRow}>
          {batches.map((b) => (
            <Pressable key={b.id} style={[styles.chip, selected.some((s) => s.id === b.id) && styles.chipActive]} onPress={() => toggleSelect(b)}>
              <Text style={styles.chipText}>{b.name}</Text>
            </Pressable>
          ))}
        </View>

        {selected.length > 0 && (
          <View style={styles.compareRow}>
            {selected.map((b) => (
              <View key={b.id} style={styles.compareCol}>
                <Text style={styles.batchName}>{b.name}</Text>
                <Text style={styles.price}>₹{b.price}</Text>
                <View style={styles.row}><Text style={styles.label}>Subjects</Text><Text style={styles.value}>{details[b.id]?.subjectCount ?? '-'}</Text></View>
                <View style={styles.row}><Text style={styles.label}>Classes</Text><Text style={styles.value}>{details[b.id]?.classCount ?? '-'}</Text></View>
                <View style={styles.row}><Text style={styles.label}>Seats Left</Text><Text style={styles.value}>{b.capacity ? Math.max(0, b.capacity - (b.enrolled_count ?? 0)) : 'Unlimited'}</Text></View>
                <View style={styles.row}><Text style={styles.label}>Description</Text></View>
                <Text style={styles.desc}>{b.description}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 12 },
  hint: { color: '#8A8FA3', fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: 'white', fontSize: 12, fontWeight: '600' },
  compareRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  compareCol: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 6 },
  batchName: { color: 'white', fontWeight: '700', fontSize: 15 },
  price: { color: '#D4AF37', fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { color: '#8A8FA3', fontSize: 12 },
  value: { color: 'white', fontSize: 12, fontWeight: '600' },
  desc: { color: '#B8C0D8', fontSize: 11 },
});