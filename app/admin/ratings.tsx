import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminRatingsScreen() {
  const [ratings, setRatings] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from('ratings')
      .select('*, profiles(full_name), batches(name)')
      .order('created_at', { ascending: false });
    setRatings(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function deleteRating(item: any) {
    Alert.alert('Delete review', 'Remove this review permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('ratings').delete().eq('id', item.id);
          load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={ratings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No ratings yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{item.profiles?.full_name}</Text>
              <Pressable onPress={() => deleteRating(item)}>
                <Ionicons name="trash" size={18} color="#FF6B6B" />
              </Pressable>
            </View>
            <Text style={styles.batchName}>{item.batches?.name}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name={s <= item.rating ? 'star' : 'star-outline'} size={16} color="#D4AF37" />
              ))}
            </View>
            {item.review ? <Text style={styles.review}>{item.review}</Text> : null}
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
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: 'white', fontWeight: '700', fontSize: 14 },
  batchName: { color: '#8A8FA3', fontSize: 12 },
  starsRow: { flexDirection: 'row', gap: 2 },
  review: { color: '#B8C0D8', fontSize: 13, marginTop: 4 },
});