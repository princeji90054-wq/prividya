import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, ActivityIndicator, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';

export default function CoursesScreen() {
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('batches')
      .select('*')
      .eq('is_published', true)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBatches(data ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = batches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Courses</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#8A8FA3" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search batches..."
          placeholderTextColor="#8A8FA3"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No batches found.</Text>}
        renderItem={({ item }) => {
          const seatsLeft = item.capacity ? item.capacity - (item.enrolled_count ?? 0) : null;
          return (
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
                {seatsLeft !== null && seatsLeft > 0 && seatsLeft <= 10 && (
                  <Text style={styles.urgencyText}>🔥 Only {seatsLeft} seats left!</Text>
                )}
                {seatsLeft !== null && seatsLeft <= 0 && (
                  <Text style={styles.fullText}>Batch Full</Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  title: { color: '#D4AF37', fontSize: 24, fontWeight: '700', paddingHorizontal: 20, paddingTop: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: 'white', fontSize: 14 },
  listContent: { padding: 16, gap: 14 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 60 },
  card: { backgroundColor: '#151A2C', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A3150' },
  cover: { width: '100%', height: 140 },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A2036' },
  coverPlaceholderText: { color: '#8A8FA3', fontSize: 13 },
  cardBody: { padding: 14, gap: 4 },
  batchName: { color: 'white', fontSize: 17, fontWeight: '700' },
  batchPrice: { color: '#D4AF37', fontSize: 15, fontWeight: '700' },
  urgencyText: { color: '#FF6B6B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  fullText: { color: '#8A8FA3', fontSize: 11, fontWeight: '700', marginTop: 2 },
});