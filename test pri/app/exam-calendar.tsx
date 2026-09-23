import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ExamCalendarScreen() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('exam_calendar').select('*').gte('exam_date', new Date().toISOString().slice(0, 10)).order('exam_date').then(({ data }) => {
      setExams(data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Exam Calendar', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={exams}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No upcoming exams listed.</Text>}
        renderItem={({ item }) => {
          const daysLeft = Math.ceil((new Date(item.exam_date).getTime() - Date.now()) / 86400000);
          return (
            <View style={styles.card}>
              <Text style={styles.examName}>{item.exam_name}</Text>
              <Text style={styles.examDate}>{new Date(item.exam_date).toLocaleDateString()}</Text>
              <Text style={styles.daysLeft}>{daysLeft} day(s) left</Text>
              {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  examName: { color: 'white', fontWeight: '700', fontSize: 15 },
  examDate: { color: '#D4AF37', fontSize: 13, fontWeight: '600' },
  daysLeft: { color: '#4ADE80', fontSize: 12, fontWeight: '600' },
  notes: { color: '#8A8FA3', fontSize: 12 },
});