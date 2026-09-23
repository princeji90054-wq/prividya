import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { supabase } from '@/lib/supabase';

export default function TestAttemptScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  const submittedRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const markedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    markedRef.current = marked;
  }, [marked]);

  useEffect(() => {
    async function init() {
      const { data: testData } = await supabase.from('tests').select('*').eq('id', id).single();
      setTest(testData);

      const { data: questionData } = await supabase
        .from('test_questions_safe')
        .select('*')
        .eq('test_id', id)
        .order('order_index');
      setQuestions(questionData ?? []);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let attempt = null;
      const { data: existing } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('test_id', id)
        .eq('student_id', user?.id)
        .maybeSingle();

      if (existing && existing.status === 'submitted') {
        router.replace(`/tests/${id}/result` as any);
        return;
      }

      if (existing) {
        attempt = existing;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('test_attempts')
          .insert({ test_id: id, student_id: user?.id })
          .select()
          .single();

        if (createErr) {
          console.error('Error creating attempt:', createErr);
        }
        attempt = created;
      }

      if (!attempt) {
        setLoading(false);
        return;
      }

      setAttemptId(attempt.id);
      attemptIdRef.current = attempt.id;

      // Previously saved answers fetch karein (resume support)
      const { data: savedAnswers } = await supabase
        .from('test_answers')
        .select('*')
        .eq('attempt_id', attempt.id);

      const answerMap: Record<string, string> = {};
      const markedMap: Record<string, boolean> = {};
      (savedAnswers ?? []).forEach((a) => {
        if (a.selected_option) answerMap[a.question_id] = String(a.selected_option).toLowerCase();
        if (a.is_marked_for_review) markedMap[a.question_id] = true;
      });
      setAnswers(answerMap);
      setMarked(markedMap);

      if (testData?.timer_type === 'overall' && testData?.duration_minutes) {
        const elapsedSec = Math.floor(
          (Date.now() - new Date(attempt.started_at).getTime()) / 1000
        );
        const totalSec = testData.duration_minutes * 60;
        setSecondsLeft(Math.max(0, totalSec - elapsedSec));
      }

      setLoading(false);
    }
    init();
  }, [id]);

  // Current question ka bookmark status fetch karein ('test' type ke sath)
  useEffect(() => {
    const q = questions[currentIndex];
    if (q) {
      isBookmarked('test', q.id)
        .then(setBookmarked)
        .catch(() => setBookmarked(false));
    }
  }, [currentIndex, questions]);

  // Timer Countdown
  useEffect(() => {
    if (!test || test.timer_type !== 'overall' || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [test, secondsLeft > 0]);

  // App background hone par auto-submit
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' && attemptIdRef.current && !submittedRef.current) {
        handleSubmit(true);
      }
    });
    return () => sub.remove();
  }, []);

  // Bookmark Toggle logic ('test' type ensure kiya gaya hai)
  async function handleBookmark() {
    const q = questions[currentIndex];
    if (!q) return;
    try {
      const newState = await toggleBookmark('test', q.id);
      setBookmarked(newState);
    } catch (err) {
      console.error('Bookmark toggle failed:', err);
    }
  }

  // Answer save logic (instant state aur safe upsert)
  async function saveAnswer(questionId: string, option: string) {
    const opt = option.toLowerCase();
    setAnswers((prev) => ({ ...prev, [questionId]: opt }));
    answersRef.current[questionId] = opt;

    const currentAttempt = attemptIdRef.current || attemptId;
    if (!currentAttempt) return;

    try {
      await supabase.from('test_answers').upsert(
        {
          attempt_id: currentAttempt,
          question_id: questionId,
          selected_option: opt,
          is_marked_for_review: markedRef.current[questionId] ?? false,
        },
        { onConflict: 'attempt_id,question_id' }
      );
    } catch (e) {
      console.error('Save answer error:', e);
    }
  }

  async function toggleMark(questionId: string) {
    const newVal = !marked[questionId];
    setMarked((prev) => ({ ...prev, [questionId]: newVal }));
    markedRef.current[questionId] = newVal;

    const currentAttempt = attemptIdRef.current || attemptId;
    if (!currentAttempt) return;

    try {
      await supabase.from('test_answers').upsert(
        {
          attempt_id: currentAttempt,
          question_id: questionId,
          selected_option: answersRef.current[questionId] ?? null,
          is_marked_for_review: newVal,
        },
        { onConflict: 'attempt_id,question_id' }
      );
    } catch (e) {
      console.error('Toggle mark error:', e);
    }
  }

  async function handleSubmit(silent = false) {
    const activeAttemptId = attemptIdRef.current || attemptId;
    if (!activeAttemptId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    try {
      // Pending answers submit karne se pehle flush karein
      const pendingAnswers = Object.entries(answersRef.current).map(([qId, val]) => ({
        attempt_id: activeAttemptId,
        question_id: qId,
        selected_option: val,
        is_marked_for_review: markedRef.current[qId] ?? false,
      }));

      if (pendingAnswers.length > 0) {
        await supabase
          .from('test_answers')
          .upsert(pendingAnswers, { onConflict: 'attempt_id,question_id' });
      }

      const { error } = await supabase.rpc('submit_test_attempt', {
        p_attempt_id: activeAttemptId,
      });

      if (error) {
        submittedRef.current = false;
        if (!silent) Alert.alert('Error', error.message);
        return;
      }

      if (!silent) {
        router.replace(`/tests/${id}/result` as any);
      }
    } catch (err: any) {
      submittedRef.current = false;
      if (!silent) Alert.alert('Error', err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    const answeredCount = Object.keys(answers).length;
    const unanswered = questions.length - answeredCount;
    Alert.alert(
      'Submit Test',
      unanswered > 0
        ? `You have ${unanswered} unanswered question(s). Submit anyway?`
        : 'Submit your test now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => handleSubmit(false) },
      ]
    );
  }

  if (loading || !test) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const q = questions[currentIndex];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: test.title,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      {test.timer_type === 'overall' && (
        <View style={styles.timerBar}>
          <Text style={styles.timerText}>
            ⏱ {mins}:{secs.toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      <View style={styles.langRow}>
        <Pressable onPress={() => setLanguage(language === 'en' ? 'hi' : 'en')}>
          <Text style={styles.langText}>
            {language === 'en' ? 'हिंदी में देखें' : 'View in English'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topMeta}>
          <Text style={styles.qCounter}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <Pressable onPress={handleBookmark} hitSlop={10}>
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color="#D4AF37"
            />
          </Pressable>
        </View>

        {q && (
          <Text style={styles.qText}>
            {language === 'hi' && q.question_text_hi ? q.question_text_hi : q.question_text}
          </Text>
        )}

        {q &&
          (['a', 'b', 'c', 'd'] as const).map((opt) => {
            const isSelected = answers[q.id]?.toLowerCase() === opt;
            const optionText =
              language === 'hi' && q[`option_${opt}_hi`]
                ? q[`option_${opt}_hi`]
                : q[`option_${opt}`];

            return (
              <Pressable
                key={opt}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => saveAnswer(q.id, opt)}
              >
                <View style={[styles.optionCircle, isSelected && styles.optionCircleSelected]}>
                  <Text style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                    {opt.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.optionText}>{optionText}</Text>
              </Pressable>
            );
          })}

        {q && (
          <Pressable style={styles.markBtn} onPress={() => toggleMark(q.id)}>
            <Text style={styles.markBtnText}>
              {marked[q.id] ? '★ Marked for Review' : '☆ Mark for Review'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.navBar}>
        <Pressable
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex((i) => i - 1)}
        >
          <Text style={styles.navBtnText}>Previous</Text>
        </Pressable>

        {currentIndex < questions.length - 1 ? (
          <Pressable style={styles.navBtn} onPress={() => setCurrentIndex((i) => i + 1)}>
            <Text style={styles.navBtnText}>Save & Next</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.submitBtn} onPress={confirmSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#0A0E1A" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Test</Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  timerBar: {
    backgroundColor: '#151A2C',
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3150',
  },
  timerText: { color: '#D4AF37', fontSize: 16, fontWeight: '700' },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  langText: { color: '#3C9FFE', fontSize: 12, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  topMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qCounter: { color: '#8A8FA3', fontSize: 13, fontWeight: '600' },
  qText: { color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 24, marginVertical: 6 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151A2C',
    borderWidth: 1.5,
    borderColor: '#2A3150',
    borderRadius: 12,
    padding: 14,
  },
  optionCardSelected: { borderColor: '#D4AF37', backgroundColor: '#2A2410' },
  optionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2538',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCircleSelected: { backgroundColor: '#D4AF37' },
  optionLetter: { color: '#D4AF37', fontWeight: '700', fontSize: 13 },
  optionLetterSelected: { color: '#0A0E1A' },
  optionText: { color: 'white', fontSize: 14, flex: 1, lineHeight: 20 },
  markBtn: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6 },
  markBtnText: { color: '#3C9FFE', fontSize: 13, fontWeight: '600' },
  navBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A3150',
    backgroundColor: '#0A0E1A',
  },
  navBtn: { flex: 1, backgroundColor: '#2A3150', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { color: 'white', fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#4ADE80', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 15 },
});