import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { supabase } from '@/lib/supabase';

export default function PracticeSessionScreen() {
  const { chapterId } = useLocalSearchParams();
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('practice_questions').select('*').eq('chapter_id', chapterId).then(({ data }) => {
      setQuestions(data ?? []);
      setLoading(false);
    });
  }, [chapterId]);

  useEffect(() => {
    if (questions[index]) {
      isBookmarked('practice', questions[index].id).then(setBookmarked);
    }
  }, [index, questions]);

  async function selectOption(opt: string) {
    if (showResult) return;
    setSelected(opt);
    setShowResult(true);

    const q = questions[index];
    const isCorrect = opt === q.correct_option;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('practice_attempts').insert({
      student_id: user?.id, question_id: q.id, selected_option: opt, is_correct: isCorrect,
    });

    setStats((prev) => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
  }

  function next() {
    setSelected(null);
    setShowResult(false);
    setIndex((i) => i + 1);
  }

  async function handleBookmark() {
    const q = questions[index];
    const newState = await toggleBookmark('practice', q.id);
    setBookmarked(newState);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (index >= questions.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.doneBox}>
          <Text style={styles.doneTitle}>Practice Complete!</Text>
          <Text style={styles.doneStats}>{stats.correct} / {stats.total} correct</Text>
        </View>
      </SafeAreaView>
    );
  }

  const q = questions[index];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Practice', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topRow}>
          <Text style={styles.qCounter}>Question {index + 1} of {questions.length}</Text>
          <Pressable onPress={handleBookmark}>
            <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color="#D4AF37" />
          </Pressable>
        </View>

        <Text style={styles.qText}>{q.question_text}</Text>

        {(['a', 'b', 'c', 'd'] as const).map((opt) => {
          const isSelectedOpt = selected === opt;
          const isCorrectOpt = q.correct_option === opt;
          let style = styles.optionCard;
          if (showResult && isCorrectOpt) style = { ...styles.optionCard, ...styles.correctOpt } as any;
          else if (showResult && isSelectedOpt && !isCorrectOpt) style = { ...styles.optionCard, ...styles.wrongOpt } as any;

          return (
            <Pressable key={opt} style={style} onPress={() => selectOption(opt)}>
              <Text style={styles.optionLetter}>{opt.toUpperCase()}</Text>
              <Text style={styles.optionText}>{q[`option_${opt}`]}</Text>
            </Pressable>
          );
        })}

        {showResult && q.solution_text && (
          <View style={styles.solutionBox}>
            <Text style={styles.solutionText}>💡 {q.solution_text}</Text>
          </View>
        )}

        {showResult && (
          <Pressable style={styles.nextBtn} onPress={next}>
            <Text style={styles.nextBtnText}>{index === questions.length - 1 ? 'Finish' : 'Next Question'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qCounter: { color: '#8A8FA3', fontSize: 12, fontWeight: '600' },
  qText: { color: 'white', fontSize: 17, fontWeight: '600' },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14 },
  correctOpt: { borderColor: '#4ADE80', backgroundColor: '#152A1E' },
  wrongOpt: { borderColor: '#FF6B6B', backgroundColor: '#2A1515' },
  optionLetter: { color: '#D4AF37', fontWeight: '700', width: 20 },
  optionText: { color: 'white', fontSize: 14, flex: 1 },
  solutionBox: { backgroundColor: '#1A2036', borderRadius: 10, padding: 12 },
  solutionText: { color: '#B8C0D8', fontSize: 13 },
  nextBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextBtnText: { color: '#0A0E1A', fontWeight: '700' },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  doneTitle: { color: '#4ADE80', fontSize: 20, fontWeight: '700' },
  doneStats: { color: 'white', fontSize: 16 },
});