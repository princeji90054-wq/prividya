import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { supabase } from '@/lib/supabase';

export default function LeaderboardScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setMyId(user?.id ?? null);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: logs } = await supabase
        .from('study_logs')
        .select('student_id, minutes')
        .gte('log_date', weekAgo.toISOString().split('T')[0]);

      const totals: Record<string, number> = {};
      (logs ?? []).forEach((l) => {
        totals[l.student_id] = (totals[l.student_id] ?? 0) + l.minutes;
      });

      const studentIds = Object.keys(totals);
      if (studentIds.length === 0) { setLoading(false); return; }

      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);

      const ranked = (profiles ?? [])
        .map((p) => ({ ...p, totalMinutes: totals[p.id] ?? 0 }))
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
        .slice(0, 10);

      setRows(ranked);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Weekly Leaderboard', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No activity this week yet. Be the first!</Text>}
        renderItem={({ item, index }) => (
          <View style={[styles.row, item.id === myId && styles.myRow]}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text style={styles.name}>{item.full_name}{item.id === myId ? ' (You)' : ''}</Text>
            <Text style={styles.hours}>{Math.floor(item.totalMinutes / 60)}h {item.totalMinutes % 60}m</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 8 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14,
  },
  myRow: { borderColor: '#D4AF37' },
  rank: { color: '#D4AF37', fontSize: 15, fontWeight: '700', width: 36 },
  name: { color: 'white', fontSize: 14, fontWeight: '600', flex: 1 },
  hours: { color: '#8A8FA3', fontSize: 13 },
});