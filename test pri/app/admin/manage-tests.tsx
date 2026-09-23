import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ManageTestsScreen() {
  const router = useRouter();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('tests').select('*, batches(name)').order('created_at', { ascending: false });
    setTests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function togglePublish(test: any) {
    await supabase.from('tests').update({ is_published: !test.is_published }).eq('id', test.id);
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Tests</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/admin/create-test' as any)}>
          <Text style={styles.addBtnText}>+ New Test</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No tests created yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.meta}>{item.batches?.name ?? 'Free Test'} · Negative: {item.negative_marking}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Published</Text>
                <Switch value={item.is_published} onValueChange={() => togglePublish(item)} />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: '#D4AF37', fontSize: 20, fontWeight: '700' },
  addBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 12 },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 6 },
  name: { color: 'white', fontWeight: '700', fontSize: 15 },
  meta: { color: '#8A8FA3', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  label: { color: '#B8C0D8', fontSize: 12 },
});