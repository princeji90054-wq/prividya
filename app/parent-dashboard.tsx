import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ParentDashboardScreen() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: links } = await supabase.from('parent_links').select('student_id').eq('parent_id', user.id);
    if (!links || links.length === 0) { setLoading(false); return; }

    const results = await Promise.all(
      links.map(async (l) => {
        const { data } = await supabase.rpc('get_child_progress', { p_student_id: l.student_id });
        return data;
      })
    );
    setChildren(results.flat());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function logout() {
    await supabase.auth.signOut();
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
      <View style={styles.header}>
        <Text style={styles.title}>Parent Dashboard</Text>
        <Pressable onPress={logout}><Text style={styles.logout}>Log Out</Text></Pressable>
      </View>
      <FlatList
        data={children}
        keyExtractor={(item, i) => `${item.full_name}-${i}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No linked child accounts yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.childName}>{item.full_name}</Text>
            <Text style={styles.batchName}>{item.batch_name ?? 'No batch purchased'}</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${item.completion ?? 0}%` }]} />
            </View>
            <Text style={styles.meta}>{item.completion ?? 0}% course complete · {item.test_attempts ?? 0} tests attempted</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: '#D4AF37', fontSize: 20, fontWeight: '700' },
  logout: { color: '#FF6B6B', fontWeight: '600' },
  listContent: { padding: 16, paddingTop: 0, gap: 12 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 14, padding: 16, gap: 8 },
  childName: { color: 'white', fontSize: 17, fontWeight: '700' },
  batchName: { color: '#D4AF37', fontSize: 13 },
  barBg: { height: 6, backgroundColor: '#2A3150', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#D4AF37' },
  meta: { color: '#8A8FA3', fontSize: 12 },
});