import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function SubjectChaptersScreen() {
  const { batchId, subjectId, subjectName } = useLocalSearchParams();
  const router = useRouter();
  const [chapters, setChapters] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data: chaptersData } = await supabase.from('chapters').select('*').eq('subject_id', subjectId).order('order_index');
      const withClasses = await Promise.all(
        (chaptersData ?? []).map(async (ch) => {
          const { data: classes } = await supabase.from('classes').select('*').eq('chapter_id', ch.id).order('order_index');
          return { ...ch, classes: classes ?? [] };
        })
      );
      setChapters(withClasses);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: payment } = await supabase.from('payments').select('id').eq('student_id', user.id).eq('batch_id', batchId).eq('status', 'approved').maybeSingle();
        const { data: nexus } = await supabase.from('nexus_passes').select('end_date').eq('student_id', user.id).eq('status', 'approved').maybeSingle();
        const hasActiveNexus = nexus && (!nexus.end_date || new Date(nexus.end_date) > new Date());
        setHasAccess(!!payment || !!hasActiveNexus);
      }
      setLoading(false);
    }
    load();
  }, [subjectId]);

  function toggle(id: string) {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  }

  function openClass(cls: any) {
    if (cls.is_free_demo || hasAccess) {
      router.push(`/watch/${cls.id}` as any);
    } else {
      Alert.alert('Locked', 'Buy this batch to unlock this class.');
    }
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
      <Stack.Screen options={{ title: String(subjectName ?? 'Chapters'), headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No chapters yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.chapterCard}>
            <Pressable style={styles.chapterHeader} onPress={() => toggle(item.id)}>
              <Ionicons name={expanded.has(item.id) ? 'chevron-down' : 'chevron-forward'} size={18} color="#D4AF37" />
              <Text style={styles.chapterName}>{item.name}</Text>
            </Pressable>
            {expanded.has(item.id) && item.classes.map((cls: any) => {
              const unlocked = cls.is_free_demo || hasAccess;
              return (
                <Pressable key={cls.id} style={styles.classCard} onPress={() => openClass(cls)}>
                  {cls.thumbnail_url ? (
                    <Image source={{ uri: cls.thumbnail_url }} style={styles.thumbnail} />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                      <Ionicons name={unlocked ? 'play' : 'lock-closed'} size={20} color="#8A8FA3" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.classTitle}>{cls.title} {cls.is_live ? '🔴' : ''}</Text>
                    {cls.is_free_demo && <Text style={styles.freeTag}>FREE</Text>}
                  </View>
                  <Ionicons name={unlocked ? 'play-circle' : 'lock-closed'} size={22} color={unlocked ? '#D4AF37' : '#8A8FA3'} />
                </Pressable>
              );
            })}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 12 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  chapterCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 12, gap: 8 },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterName: { color: 'white', fontWeight: '700', fontSize: 15 },
  classCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A2036', borderRadius: 10, padding: 8, marginLeft: 12 },
  thumbnail: { width: 60, height: 40, borderRadius: 6 },
  thumbnailPlaceholder: { backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  classTitle: { color: 'white', fontSize: 13 },
  freeTag: { color: '#4ADE80', fontSize: 10, fontWeight: '700' },
});