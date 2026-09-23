import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminSharedNotesScreen() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('personal_notes')
      .select('*, profiles(full_name), classes(title)')
      .eq('shared_with_admin', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setNotes(data ?? []); setLoading(false); });
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
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        ListEmptyComponent={<Text style={styles.emptyText}>No notes shared yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.image_url }} style={styles.image} />
            <Text style={styles.name}>{item.profiles?.full_name}</Text>
            <Text style={styles.className}>{item.classes?.title}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 8 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40, width: '100%' },
  card: { flex: 1, margin: 8, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 8, gap: 4 },
  image: { width: '100%', height: 140, borderRadius: 8 },
  name: { color: 'white', fontSize: 12, fontWeight: '700' },
  className: { color: '#8A8FA3', fontSize: 11 },
});