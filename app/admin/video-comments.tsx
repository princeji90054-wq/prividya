import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminVideoCommentsScreen() {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('video_comments')
      .select('*, profiles(full_name, student_id), classes(title)')
      .order('created_at', { ascending: false })
      .limit(200);
    setComments(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel('admin-video-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'video_comments' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Video Comments</Text>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
        ListEmptyComponent={<Text style={styles.emptyText}>No comments yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{item.profiles?.full_name}</Text>
              <Text style={styles.studentId}>{item.profiles?.student_id}</Text>
            </View>
            <Text style={styles.className}>on: {item.classes?.title}</Text>
            <Text style={styles.comment}>{item.comment}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '700', padding: 16, paddingBottom: 8 },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: 'white', fontWeight: '700', fontSize: 13 },
  studentId: { color: '#D4AF37', fontSize: 11 },
  className: { color: '#8A8FA3', fontSize: 12 },
  comment: { color: '#B8C0D8', fontSize: 13, marginTop: 2 },
  date: { color: '#8A8FA3', fontSize: 10, marginTop: 4 },
});