import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminExamCalendarScreen() {
  const [exams, setExams] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('exam_calendar').select('*').order('exam_date');
    setExams(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addExam() {
    if (!name.trim() || !date.trim()) {
      Alert.alert('Missing info', 'Exam name and date (YYYY-MM-DD) required.');
      return;
    }
    const { error } = await supabase.from('exam_calendar').insert({ exam_name: name.trim(), exam_date: date.trim(), notes: notes.trim() || null });
    if (error) { Alert.alert('Error', error.message); return; }

    // Notify all students immediately.
    const { data: students } = await supabase.from('profiles').select('id').eq('role', 'student');
    if (students) {
      await supabase.from('notifications').insert(
        students.map((s) => ({ student_id: s.id, title: 'New Exam Date Added', message: `${name.trim()} — ${date.trim()}` }))
      );
    }

    setName(''); setDate(''); setNotes('');
    load();
  }

  async function deleteExam(id: string) {
    await supabase.from('exam_calendar').delete().eq('id', id);
    load();
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
      <FlatList
        data={exams}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Exam Date</Text>
            <TextInput style={styles.input} placeholder="Exam name" placeholderTextColor="#8A8FA3" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" placeholderTextColor="#8A8FA3" value={date} onChangeText={setDate} />
            <TextInput style={styles.input} placeholder="Notes (optional)" placeholderTextColor="#8A8FA3" value={notes} onChangeText={setNotes} />
            <Pressable style={styles.addBtn} onPress={addExam}><Text style={styles.addBtnText}>Add & Notify Students</Text></Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.examName}>{item.exam_name}</Text>
            <Text style={styles.examDate}>{item.exam_date}</Text>
            {item.notes && <Text style={styles.examNotes}>{item.notes}</Text>}
            <Pressable onPress={() => deleteExam(item.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  formCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 8, marginBottom: 10 },
  formTitle: { color: '#D4AF37', fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: '#1A2036', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white' },
  addBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#0A0E1A', fontWeight: '700' },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  examName: { color: 'white', fontWeight: '700', fontSize: 14 },
  examDate: { color: '#D4AF37', fontSize: 12, fontWeight: '600' },
  examNotes: { color: '#8A8FA3', fontSize: 12 },
  deleteText: { color: '#FF6B6B', fontSize: 11, fontWeight: '600' },
});