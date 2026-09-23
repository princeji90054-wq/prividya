import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminMessagesListScreen() {
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);

  async function load() {
    const { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student');
    const { data: allMessages } = await supabase.from('messages').select('student_id, message, created_at, sender, is_read').order('created_at', { ascending: false });

    const grouped = (students ?? []).map((s) => {
      const studentMessages = (allMessages ?? []).filter((m) => m.student_id === s.id);
      const lastMessage = studentMessages[0];
      const unreadCount = studentMessages.filter((m) => m.sender === 'student' && !m.is_read).length;
      return { ...s, lastMessage: lastMessage?.message, unreadCount };
    }).filter((t) => t.lastMessage);

    grouped.sort((a, b) => b.unreadCount - a.unreadCount);
    setThreads(grouped);
  }

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No conversations yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/admin/messages/${item.id}` as any)}>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
            {item.unreadCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount}</Text></View>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: 'white', fontWeight: '700', fontSize: 14, width: 100 },
  preview: { color: '#8A8FA3', fontSize: 12, flex: 1 },
  badge: { backgroundColor: '#D4AF37', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#0A0E1A', fontSize: 11, fontWeight: '700' },
});