import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AnalyticsScreen() {
  const router = useRouter();
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [chapterData, setChapterData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: subjects } = await supabase.rpc('get_subject_analytics', { p_student_id: user.id });
      setSubjectData(subjects ?? []);

      const { data: chapters } = await supabase.rpc('get_chapter_analytics', { p_student_id: user.id });
      setChapterData(chapters ?? []);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const allData = [...subjectData.map((d) => ({ ...d, label: d.subject_name })), ...chapterData.map((d) => ({ ...d, label: d.chapter_name }))];
  const sorted = [...allData].sort((a, b) => a.accuracy - b.accuracy);
  const weak = sorted.slice(0, 3);
  const strong = sorted.slice(-3).reverse();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'My Analytics', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={allData}
        keyExtractor={(item, i) => `${item.label}-${i}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {weak.length > 0 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>⚠️ Weak Areas</Text>
                {weak.map((w, i) => <Text key={i} style={styles.insightItem}>{w.label} — {w.accuracy}%</Text>)}
              </View>
            )}
            {strong.length > 0 && (
              <View style={[styles.insightCard, styles.strongCard]}>
                <Text style={styles.insightTitle}>✓ Strong Areas</Text>
                {strong.map((s, i) => <Text key={i} style={styles.insightItem}>{s.label} — {s.accuracy}%</Text>)}
              </View>
            )}
            {weak.length > 0 && (
              <Pressable
                style={styles.recommendCard}
                onPress={() => router.push('/practice' as any)}
              >
                <Text style={styles.recommendTitle}>📌 Recommended for You</Text>
                <Text style={styles.recommendText}>
                  You're weakest in "{weak[0].label}" ({weak[0].accuracy}%). Practice this chapter now to improve.
                </Text>
                <Text style={styles.recommendCta}>Go to Practice Mode →</Text>
              </Pressable>
            )}
            <Text style={styles.sectionTitle}>All Topics</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Attempt some tests or practice questions to see analytics.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${item.accuracy}%` }]} />
            </View>
            <Text style={styles.rowAccuracy}>{item.accuracy}%</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  insightCard: { backgroundColor: '#2A1515', borderRadius: 12, padding: 14, gap: 4, marginBottom: 10 },
  strongCard: { backgroundColor: '#152A1E' },
  insightTitle: { color: 'white', fontWeight: '700', fontSize: 14 },
  insightItem: { color: '#B8C0D8', fontSize: 13 },
  sectionTitle: { color: '#D4AF37', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 20 },
  row: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12, gap: 6 },
  rowLabel: { color: 'white', fontSize: 13, fontWeight: '600' },
  barBg: { height: 6, backgroundColor: '#2A3150', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#D4AF37' },
  rowAccuracy: { color: '#8A8FA3', fontSize: 11 },
  recommendCard: { backgroundColor: '#1A2036', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 12, padding: 14, gap: 4, marginBottom: 10 },
  recommendTitle: { color: '#D4AF37', fontWeight: '700', fontSize: 14 },
  recommendText: { color: 'white', fontSize: 13 },
  recommendCta: { color: '#3C9FFE', fontSize: 12, fontWeight: '600', marginTop: 4 },
});