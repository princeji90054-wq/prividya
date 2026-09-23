import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logStudyMinutes } from '@/lib/studyTracking';
import { supabase } from '@/lib/supabase';

const DURATIONS = [15, 30, 45, 60];

export default function FocusScreen() {
  const router = useRouter();
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        if (running) backgroundedAt.current = Date.now();
      } else if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (running && backgroundedAt.current) {
          const awayMs = Date.now() - backgroundedAt.current;
          const awayMin = awayMs / 60000;
          if (awayMin > 10) {
            // Too long away — session fails
            Alert.alert('Session ended', 'You were away too long. Session has been reset.');
            endSession(false);
          } else if (awayMin > 0.3) {
            Alert.alert(
              'Welcome back',
              `You were away for ~${Math.round(awayMin)} min. Session paused and resumed.`
            );
          }
        }
        backgroundedAt.current = null;
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [running]);

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            endSession(true);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, secondsLeft === 0]);

  function startSession(minutes: number) {
    setSelectedMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setRunning(true);
  }

  async function endSession(completed: boolean) {
    clearInterval(intervalRef.current);
    setRunning(false);
    if (!selectedMinutes) return;

    const elapsedMinutes = completed
      ? selectedMinutes
      : Math.round((selectedMinutes * 60 - secondsLeft) / 60);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('focus_sessions').insert({
      student_id: user?.id,
      planned_minutes: selectedMinutes,
      completed_minutes: elapsedMinutes,
      status: completed ? 'completed' : 'interrupted',
    });

    if (elapsedMinutes > 0) await logStudyMinutes(elapsedMinutes);

    if (completed) {
      Alert.alert('Great job!', `You completed a ${selectedMinutes}-minute focus session.`);
    }
    setSelectedMinutes(null);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Focus Study Mode', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />

      {!running ? (
        <View style={styles.selectSection}>
          <Text style={styles.prompt}>Choose a focus session length</Text>
          <View style={styles.durationGrid}>
            {DURATIONS.map((d) => (
              <Pressable key={d} style={styles.durationBtn} onPress={() => startSession(d)}>
                <Text style={styles.durationText}>{d} min</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>
            Note: PriVidya tracks your focus time within the app. It doesn't block other apps on your phone —
            that would require special device permissions we don't request.
          </Text>
        </View>
      ) : (
        <View style={styles.timerSection}>
          <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
          <Text style={styles.timerLabel}>Stay focused!</Text>
          <Pressable style={styles.endBtn} onPress={() => Alert.alert('End session?', 'This will reset your current session.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'End', style: 'destructive', onPress: () => endSession(false) },
          ])}>
            <Text style={styles.endBtnText}>End Session</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  selectSection: { flex: 1, padding: 24, justifyContent: 'center', gap: 20 },
  prompt: { color: 'white', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  durationBtn: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 14, paddingVertical: 20, paddingHorizontal: 28 },
  durationText: { color: '#D4AF37', fontSize: 18, fontWeight: '700' },
  note: { color: '#8A8FA3', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },
  timerSection: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  timerText: { color: '#D4AF37', fontSize: 56, fontWeight: '700' },
  timerLabel: { color: '#8A8FA3', fontSize: 14 },
  endBtn: { backgroundColor: '#3A2020', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 20 },
  endBtnText: { color: '#FF6B6B', fontWeight: '600' },
});