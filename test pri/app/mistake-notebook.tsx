import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function MistakeNotebookScreen() {
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Wrong test answers
    const { data: testWrong } = await supabase
      .from('test_answers')
      .select('question_id, test_questions(question_text, correct_option, option_a, option_b, option_c, option_d, solution_text)')
      .in('attempt_id', (
        await supabase.from('test_attempts').select('id').eq('student_id', user.id)
      ).data?.map((a) => a.id) ?? []);

    const wrongTest = (testWrong ?? []).filter((a: any) => a.selected_option !== a.test_questions?.correct_option);

    // Wrong practice attempts
    const { data: practiceWrong } = await supabase
      .from('practice_attempts')
      .select('question_id, practice_questions(question_text, correct_option, option_a, option_b, option_c, option_d, solution_text)')
      .eq('student_id', user.id)
      .eq('is_correct', false);

    // Already-mastered items
    const { data: mastered } = await supabase.from('mistake_reviews').select('question_id').eq('student_id', user.id).eq('mastered', true);
    const masteredIds = new Set((mastered ?? []).map((m) => m.question_id));

    const combined = [
      ...wrongTest.map((w: any) => ({ type: 'test', id: w.question_id, q: w.test_questions })),
      ...(practiceWrong ?? []).map((w: any) => ({ type: 'practice', id: w.question_id, q: w.practice_questions })),
    ].filter((item) => item.q && !masteredIds.has(item.id));

    // Dedupe by question id
    const uniqueMap = new Map(combined.map((item) => [`${item.type}-${item.id}`, item]));
    setMistakes(Array.from(uniqueMap.values()));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markMastered() {
    const item = mistakes[index];
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('mistake_reviews').upsert(
      { student_id: user?.id, question_type: item.type, question_id: item.id, mastered: true },
      { onConflict: 'student_id,question_type,question_id' }
    );
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function next() {
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (index >= mistakes.length) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Mistake Notebook', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
        <View style={styles.doneBox}>
          <Text style={styles.doneText}>{mistakes.length === 0 ? 'No mistakes to review — great job!' : 'All caught up!'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const item = mistakes[index];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Mistake Notebook', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.counter}>{index + 1} of {mistakes.length}</Text>

        <Pressable style={styles.flashcard} onPress={() => setFlipped(!flipped)}>
          {!flipped ? (
            <Text style={styles.qText}>{item.q.question_text}</Text>
          ) : (
            <>
              <Text style={styles.answerLabel}>Correct Answer:</Text>
              <Text style={styles.answerText}>{item.q[`option_${item.q.correct_option}`]}</Text>
              {item.q.solution_text && <Text style={styles.solutionText}>💡 {item.q.solution_text}</Text>}
            </>
          )}
          <Text style={styles.tapHint}>{flipped ? 'Tap to see question' : 'Tap to see answer'}</Text>
        </Pressable>

        <View style={styles.actionRow}>
          <Pressable style={styles.skipBtn} onPress={next}><Text style={styles.actionText}>Review Later</Text></Pressable>
          <Pressable style={styles.masteredBtn} onPress={markMastered}><Text style={styles.actionText}>✓ I've Got This</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 16, alignItems: 'center' },
  counter: { color: '#8A8FA3', fontSize: 12, fontWeight: '600' },
  flashcard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 16, padding: 24, width: '100%', minHeight: 200, justifyContent: 'center', gap: 10 },
  qText: { color: 'white', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  answerLabel: { color: '#D4AF37', fontSize: 12, fontWeight: '700' },
  answerText: { color: '#4ADE80', fontSize: 16, fontWeight: '700' },
  solutionText: { color: '#B8C0D8', fontSize: 13, marginTop: 6 },
  tapHint: { color: '#8A8FA3', fontSize: 11, textAlign: 'center', marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  skipBtn: { flex: 1, backgroundColor: '#2A3150', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  masteredBtn: { flex: 1, backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actionText: { color: 'white', fontWeight: '700', fontSize: 13 },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#4ADE80', fontSize: 16, fontWeight: '700' },
});