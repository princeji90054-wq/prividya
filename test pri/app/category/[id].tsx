import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function CategoryBatchesScreen() {
  const { id, name } = useLocalSearchParams();
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('batches')
      .select('*')
      .eq('category_id', id)
      .eq('is_published', true)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBatches(data ?? []);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: String(name ?? 'Batches'), headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No batches in this category yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/batch/${item.id}` as any)}>
            {item.cover_image_url ? (
              <Image source={{ uri: item.cover_image_url }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <Text style={styles.coverPlaceholderText}>No Image</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.batchName}>{item.name}</Text>
              <Text style={styles.batchPrice}>₹{item.price}</Text>
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
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 60 },
  card: { backgroundColor: '#151A2C', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A3150' },
  cover: { width: '100%', height: 140 },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A2036' },
  coverPlaceholderText: { color: '#8A8FA3', fontSize: 13 },
  cardBody: { padding: 14, gap: 4 },
  batchName: { color: 'white', fontSize: 17, fontWeight: '700' },
  batchPrice: { color: '#D4AF37', fontSize: 15, fontWeight: '700' },
});