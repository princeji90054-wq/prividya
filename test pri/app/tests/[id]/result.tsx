import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import { supabase } from '@/lib/supabase';

export default function TestResultScreen() {
  const { id } = useLocalSearchParams();
  const [test, setTest] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [rankInfo, setRankInfo] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [myAnswers, setMyAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const scoreCardRef = useRef<ViewShot>(null);

  async function shareResultCard() {
    try {
      const uri = await scoreCardRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: testData } = await supabase.from('tests').select('*').eq('id', id).single();
      setTest(testData);

      const { data: attemptData } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('test_id', id)
        .eq('student_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setAttempt(attemptData);

      const resultsAreOut =
        testData?.result_release === 'instant' ||
        (testData?.result_release_at && new Date(testData.result_release_at) <= new Date());

      if (resultsAreOut && attemptData?.status === 'submitted') {
        const { data: rank } = await supabase
          .rpc('get_test_rank', { p_test_id: id, p_student_id: user?.id })
          .maybeSingle();
        setRankInfo(rank);

        const { data: questionData } = await supabase
          .from('test_questions')
          .select('*')
          .eq('test_id', id)
          .order('order_index');
        setQuestions(questionData ?? []);

        const { data: answerData } = await supabase
          .from('test_answers')
          .select('*')
          .eq('attempt_id', attemptData.id);

        const map: Record<string, string> = {};
        (answerData ?? []).forEach((a) => {
          if (a.selected_option) {
            map[a.question_id] = String(a.selected_option).trim().toLowerCase();
          }
        });
        setMyAnswers(map);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading || !test || !attempt) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const resultsAreOut =
    test.result_release === 'instant' ||
    (test.result_release_at && new Date(test.result_release_at) <= new Date());

  if (!resultsAreOut) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Result',
            headerShown: true,
            headerStyle: { backgroundColor: '#0A0E1A' },
            headerTintColor: 'white',
          }}
        />
        <View style={styles.pendingBox}>
          <Text style={styles.pendingText}>Your test has been submitted!</Text>
          <Text style={styles.pendingSubtext}>
            Results will be released on{' '}
            {test.result_release_at
              ? new Date(test.result_release_at).toLocaleString()
              : 'a date set by admin'}
            .
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Result',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ViewShot ref={scoreCardRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.scoreCard}>
            <Text style={{ color: '#D4AF37', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
              PriVidya
            </Text>
            <Text style={styles.scoreLabel}>Your Score</Text>
            <Text style={styles.scoreValue}>{attempt.score ?? 0}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.statText}>✓ {attempt.correct_count ?? 0} Correct</Text>
              <Text style={styles.statText}>✗ {attempt.wrong_count ?? 0} Wrong</Text>
              <Text style={styles.statText}>– {attempt.unattempted_count ?? 0} Skipped</Text>
            </View>
            {rankInfo && (
              <Text style={styles.rankText}>
                Rank {rankInfo.rank} of {rankInfo.total} · {rankInfo.percentile}th percentile
              </Text>
            )}
          </View>
        </ViewShot>

        <Pressable style={styles.shareResultBtn} onPress={shareResultCard}>
          <Text style={styles.shareResultBtnText}>📤 Share Result</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Answer Review</Text>
        {questions.map((q, i) => {
          const myAns = myAnswers[q.id]?.toLowerCase();
          const correctAns = String(q.correct_option ?? '').trim().toLowerCase();
          const isAttempted = !!myAns;
          const isCorrect = isAttempted && myAns === correctAns;

          return (
            <View key={q.id} style={styles.qCard}>
              <Text style={styles.qText}>
                {i + 1}. {q.question_text}
              </Text>
              {q.question_image_url && (
                <Image source={{ uri: q.question_image_url }} style={styles.qImage} />
              )}

              {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                const isThisCorrect = opt === correctAns;
                const isThisMyPick = opt === myAns;

                return (
                  <View
                    key={opt}
                    style={[
                      styles.optionRow,
                      isThisCorrect && styles.correctOption,
                      isThisMyPick && !isThisCorrect && styles.wrongOption,
                    ]}
                  >
                    <Text style={styles.optionLetter}>{opt.toUpperCase()}</Text>
                    <Text style={styles.optionText}>{q[`option_${opt}`]}</Text>
                    {isThisMyPick && (
                      <Text style={styles.myChoiceBadge}>
                        {isThisCorrect ? '✓ Your Pick' : '✗ Your Pick'}
                      </Text>
                    )}
                  </View>
                );
              })}

              <Text style={[styles.resultTag, isCorrect ? styles.correctTag : styles.wrongTag]}>
                {isAttempted ? (isCorrect ? '✓ Correct' : '✗ Incorrect') : '– Not attempted'}
              </Text>

              {q.solution_text && (
                <Text style={styles.solutionText}>💡 {q.solution_text}</Text>
              )}
              {q.solution_image_url && (
                <Image source={{ uri: q.solution_image_url }} style={styles.qImage} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 60 },
  pendingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  pendingText: { color: '#4ADE80', fontSize: 18, fontWeight: '700' },
  pendingSubtext: { color: '#8A8FA3', fontSize: 13, textAlign: 'center' },
  scoreCard: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: { color: '#8A8FA3', fontSize: 13 },
  scoreValue: { color: '#D4AF37', fontSize: 40, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 16 },
  statText: { color: '#B8C0D8', fontSize: 12 },
  rankText: { color: 'white', fontSize: 13, fontWeight: '600', marginTop: 4 },
  sectionTitle: { color: '#D4AF37', fontSize: 16, fontWeight: '700' },
  qCard: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  qText: { color: 'white', fontSize: 14, fontWeight: '600' },
  qImage: { width: '100%', height: 160, borderRadius: 10 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1A2036',
  },
  correctOption: { backgroundColor: '#203A20', borderWidth: 1, borderColor: '#4ADE80' },
  wrongOption: { backgroundColor: '#3A2020', borderWidth: 1, borderColor: '#FF6B6B' },
  optionLetter: { color: '#D4AF37', fontWeight: '700', width: 18 },
  optionText: { color: 'white', fontSize: 13, flex: 1 },
  myChoiceBadge: { fontSize: 11, fontWeight: '700', color: 'white', paddingHorizontal: 6 },
  resultTag: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  correctTag: { color: '#4ADE80' },
  wrongTag: { color: '#FF6B6B' },
  solutionText: { color: '#B8C0D8', fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  shareResultBtn: {
    backgroundColor: '#3C9FFE',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  shareResultBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
});