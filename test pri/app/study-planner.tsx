import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generateStudyPlan } from '@/lib/studyPlanner';
import { supabase } from '@/lib/supabase';

export default function StudyPlannerScreen() {
  const router = useRouter();
  const [myBatches, setMyBatches] = useState<any[]>([]);
  const [plan, setPlan] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: payments } = await supabase
        .from('payments')
        .select('batch_id, batches(id, name)')
        .eq('student_id', user.id)
        .eq('status', 'approved');

      let uniqueBatches = Array.from(
        new Map(
          (payments ?? [])
            .map((p: any) => [p.batches?.id, p.batches])
            .filter(([id, b]) => !!id && !!b)
        ).values()
      );

      if (uniqueBatches.length === 0) {
        const { data: allBatches } = await supabase.from('batches').select('id, name').limit(10);
        uniqueBatches = allBatches ?? [];
      }

      setMyBatches(uniqueBatches);
      if (uniqueBatches.length > 0) {
        loadPlan(uniqueBatches[0]);
      }
    } catch (e) {
      console.error('Error loading batches:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadPlan(batch: any) {
    if (!batch) return;
    setSelectedBatch(batch);
    setPlanLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('study_plans')
        .select('*, classes(id, title, thumbnail_url, youtube_video_id), chapters(name, subjects(name))')
        .eq('student_id', user.id)
        .eq('batch_id', batch.id)
        .order('plan_date', { ascending: true });

      if (error) {
        const { data: fallbackData } = await supabase
          .from('study_plans')
          .select('*')
          .eq('student_id', user.id)
          .eq('batch_id', batch.id)
          .order('plan_date', { ascending: true });
        setPlan(fallbackData ?? []);
      } else {
        setPlan(data ?? []);
      }
    } catch (e) {
      console.error('Error loading study plan:', e);
    } finally {
      setPlanLoading(false);
    }
  }

  async function generate() {
    if (!selectedBatch) return;
    setGenerating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const result = await generateStudyPlan(user.id, selectedBatch.id);

      if (!result?.success) {
        Alert.alert('Study Plan', result?.error ?? 'Plan generate nahi ho saka.');
        return;
      }

      await loadPlan(selectedBatch);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Study plan create nahi ho saka.');
    } finally {
      setGenerating(false);
    }
  }

  async function toggleDone(item: any) {
    try {
      const updatedStatus = !item.is_done;
      setPlan((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, is_done: updatedStatus } : p))
      );

      await supabase.from('study_plans').update({ is_done: updatedStatus }).eq('id', item.id);
    } catch (e) {
      console.error('Toggle done error:', e);
      loadPlan(selectedBatch);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Study Planner',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      {myBatches.length > 0 && (
        <View style={styles.chipRow}>
          {myBatches.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.chip, selectedBatch?.id === b.id && styles.chipActive]}
              onPress={() => loadPlan(b)}
            >
              <Text style={[styles.chipText, selectedBatch?.id === b.id && styles.chipTextActive]}>
                {b.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {selectedBatch && (
        <View style={{ flex: 1 }}>
          <Pressable style={styles.generateBtn} onPress={generate} disabled={generating}>
            {generating ? (
              <ActivityIndicator color="#0A0E1A" />
            ) : (
              <Text style={styles.generateBtnText}>
                {plan.length > 0 ? '🔄 Regenerate Plan' : '⚡ Generate My Study Plan'}
              </Text>
            )}
          </Pressable>

          {planLoading ? (
            <ActivityIndicator color="#D4AF37" size="small" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={plan}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyPlanBox}>
                  <Ionicons name="videocam-outline" size={40} color="#8A8FA3" />
                  <Text style={styles.emptyText}>No plan generated yet.</Text>
                  <Text style={styles.emptySubtext}>
                    "Generate My Study Plan" par tap karein taaki uploaded videos ka timetable ban sake.
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const videoTitle =
                  item.classes?.title || item.title || `Lecture ${index + 1}`;
                const thumb =
                  item.classes?.thumbnail_url ||
                  (item.classes?.youtube_video_id
                    ? `https://img.youtube.com/vi/${item.classes.youtube_video_id}/hqdefault.jpg`
                    : null);

                return (
                  <Pressable
                    style={styles.card}
                    onPress={() => {
                      if (item.class_id || item.classes?.id) {
                        router.push(`/watch/${item.class_id || item.classes?.id}` as any);
                      } else {
                        toggleDone(item);
                      }
                    }}
                  >
                    <Pressable
                      hitSlop={10}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleDone(item);
                      }}
                    >
                      <Text style={[styles.checkbox, item.is_done && styles.checkboxDone]}>
                        {item.is_done ? '✓' : '○'}
                      </Text>
                    </Pressable>

                    {thumb && (
                      <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.date}>
                        📅 {item.plan_date ? new Date(item.plan_date).toLocaleDateString() : 'Target'}
                      </Text>
                      <Text
                        style={[styles.lectureTitle, item.is_done && styles.doneText]}
                        numberOfLines={2}
                      >
                        {videoTitle}
                      </Text>
                      {item.chapters?.name && (
                        <Text style={styles.metaSub}>
                          {item.chapters?.subjects?.name ? `${item.chapters.subjects.name} • ` : ''}
                          {item.chapters.name}
                        </Text>
                      )}
                    </View>

                    <Ionicons name="play-circle" size={24} color="#D4AF37" />
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  chip: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: '#B8C0D8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0A0E1A', fontWeight: '700' },
  generateBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  generateBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 14 },
  listContent: { padding: 16, paddingTop: 0, gap: 10, paddingBottom: 40 },
  emptyPlanBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20, gap: 6 },
  emptyText: { color: 'white', textAlign: 'center', fontSize: 15, fontWeight: '600' },
  emptySubtext: { color: '#8A8FA3', textAlign: 'center', fontSize: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    padding: 12,
  },
  thumb: { width: 50, height: 38, borderRadius: 6, backgroundColor: '#0A0E1A' },
  checkbox: { color: '#8A8FA3', fontSize: 20, fontWeight: '700', marginRight: 4 },
  checkboxDone: { color: '#4ADE80' },
  date: { color: '#D4AF37', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  lectureTitle: { color: 'white', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  metaSub: { color: '#8A8FA3', fontSize: 11, marginTop: 2 },
  doneText: { textDecorationLine: 'line-through', color: '#8A8FA3' },
});