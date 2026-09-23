import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function BatchesScreen() {
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data } = await supabase.from('batches').select('*').order('created_at', { ascending: false });
    setBatches(data ?? []);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function togglePublish(item: any) {
    await supabase.from('batches').update({ is_published: !item.is_published }).eq('id', item.id);
    load();
  }

  async function toggleArchive(item: any) {
    await supabase.from('batches').update({ is_archived: !item.is_archived }).eq('id', item.id);
    load();
  }

  async function notifyWaitlist(item: any) {
    const { data: waiters } = await supabase.from('waitlist').select('student_id').eq('batch_id', item.id);
    if (!waiters || waiters.length === 0) {
      Alert.alert('No one waiting', 'No students on the waitlist for this batch.');
      return;
    }
    const notifications = waiters.map((w) => ({
      student_id: w.student_id,
      title: 'Seat Available!',
      message: `A seat opened up in "${item.name}". Buy now before it fills up again.`,
    }));
    await supabase.from('notifications').insert(notifications);
    await supabase.from('waitlist').delete().eq('batch_id', item.id);
    Alert.alert('Notified', `${waiters.length} student(s) notified.`);
  }

  async function deleteBatch(item: any) {
    if ((item.enrolled_count ?? 0) > 0) {
      Alert.alert('Cannot delete', 'This batch has enrolled students. Archive it instead.');
      return;
    }
    Alert.alert('Delete batch', `Permanently delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('batches').delete().eq('id', item.id);
          if (error) Alert.alert('Error', error.message);
          else load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>₹{item.price} · {item.enrolled_count ?? 0} enrolled{item.is_archived ? ' · ARCHIVED' : ''}{!item.is_published ? ' · DRAFT' : ''}</Text>

            <View style={styles.buttonRow}>
              <Pressable style={styles.actionBtn} onPress={() => router.push(`/admin/manage-content/${item.id}` as any)}>
                <Text style={styles.actionText}>Manage Content</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => togglePublish(item)}>
                <Text style={styles.actionText}>{item.is_published ? 'Unpublish' : 'Publish'}</Text>
              </Pressable>
            </View>
            <View style={styles.buttonRow}>
              <Pressable style={styles.actionBtn} onPress={() => toggleArchive(item)}>
                <Text style={styles.actionText}>{item.is_archived ? 'Unarchive' : 'Archive'}</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => notifyWaitlist(item)}>
                <Text style={styles.actionText}>Notify Waitlist</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => deleteBatch(item)}>
                <Text style={styles.actionText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 14, padding: 14, gap: 10 },
  name: { color: 'white', fontSize: 16, fontWeight: '700' },
  meta: { color: '#8A8FA3', fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: '#2A3150', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  deleteBtn: { backgroundColor: '#3A2020' },
  actionText: { color: 'white', fontSize: 12, fontWeight: '600' },
});