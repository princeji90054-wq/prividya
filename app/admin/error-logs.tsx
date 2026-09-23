import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminErrorLogsScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('error_logs').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setLogs(data ?? []);
      setLoading(false);
    });
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
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No errors logged. 🎉</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.errorMsg}>{item.error_message}</Text>
            <Text style={styles.screen}>Screen: {item.screen ?? 'Unknown'}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  errorMsg: { color: '#FF9B9B', fontSize: 13, fontWeight: '600' },
  screen: { color: '#8A8FA3', fontSize: 11 },
  date: { color: '#8A8FA3', fontSize: 10 },
});