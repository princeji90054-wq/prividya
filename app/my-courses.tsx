import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function MyCoursesScreen() {
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: payments } = await supabase.from('payments').select('batch_id').eq('student_id', user.id).eq('status', 'approved');
      const batchIds = [...new Set((payments ?? []).map((p) => p.batch_id))];

      if (batchIds.length > 0) {
        const { data: batchData } = await supabase.from('batches').select('*').in('id', batchIds);
        
        const batchesWithCompletion = await Promise.all(
          (batchData ?? []).map(async (b: any) => {
            const { data: completion } = await supabase.rpc('get_batch_completion', {
              p_student_id: user.id,
              p_batch_id: b.id,
            });
            return { ...b, completionPercent: completion ?? 0 };
          })
        );
        setBatches(batchesWithCompletion);
      }
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
      <Stack.Screen options={{ title: 'My Courses', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>You haven't purchased any batch yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/batch/${item.id}` as any)}>
            {item.cover_image_url ? <Image source={{ uri: item.cover_image_url }} style={styles.cover} /> : <View style={[styles.cover, styles.coverPlaceholder]} />}
            <View style={styles.infoContainer}>
              <Text style={styles.name}>{item.name}</Text>
              <View style={{ height: 6, backgroundColor: '#2A3150', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${item.completionPercent}%`, backgroundColor: '#D4AF37' }} />
              </View>
              <Text style={{ color: '#8A8FA3', fontSize: 11, marginTop: 2 }}>{item.completionPercent}% complete</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 14 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A3150' },
  cover: { width: '100%', height: 120 },
  coverPlaceholder: { backgroundColor: '#1A2036' },
  infoContainer: { padding: 12 },
  name: { color: 'white', fontSize: 15, fontWeight: '700' },
});