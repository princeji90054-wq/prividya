import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function BatchRestrictionsScreen() {
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: r } = await supabase.from('batch_restrictions').select('*, profiles(full_name), batches(name)').order('created_at', { ascending: false });
    setRestrictions(r ?? []);
    const { data: s } = await supabase.from('profiles').select('id, full_name, student_id').eq('role', 'student');
    setStudents(s ?? []);
    const { data: b } = await supabase.from('batches').select('id, name');
    setBatches(b ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addRestriction() {
    if (!selectedStudent || !selectedBatch || !reason.trim()) {
      Alert.alert('Missing info', 'Select a student, a batch, and enter a reason.');
      return;
    }
    const { error } = await supabase.from('batch_restrictions').insert({
      student_id: selectedStudent.id, batch_id: selectedBatch.id, reason: reason.trim(),
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setReason(''); setSelectedStudent(null); setSelectedBatch(null);
    load();
  }

  async function removeRestriction(id: string) {
    await supabase.from('batch_restrictions').delete().eq('id', id);
    load();
  }

  const filteredStudents = students.filter((s) =>
    !studentSearch.trim() || s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) || s.student_id?.toLowerCase().includes(studentSearch.toLowerCase())
  );

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
        data={restrictions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Restriction</Text>
            <TextInput style={styles.input} placeholder="Search student" placeholderTextColor="#8A8FA3" value={studentSearch} onChangeText={setStudentSearch} />
            <View style={styles.chipRow}>
              {filteredStudents.slice(0, 5).map((s) => (
                <Pressable key={s.id} style={[styles.chip, selectedStudent?.id === s.id && styles.chipActive]} onPress={() => setSelectedStudent(s)}>
                  <Text style={styles.chipText}>{s.full_name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.chipRow}>
              {batches.map((b) => (
                <Pressable key={b.id} style={[styles.chip, selectedBatch?.id === b.id && styles.chipActive]} onPress={() => setSelectedBatch(b)}>
                  <Text style={styles.chipText}>{b.name}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="Reason (shown to student)" placeholderTextColor="#8A8FA3" value={reason} onChangeText={setReason} />
            <Pressable style={styles.addBtn} onPress={addRestriction}>
              <Text style={styles.addBtnText}>Add Restriction</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No active restrictions.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.profiles?.full_name} → {item.batches?.name}</Text>
            <Text style={styles.reason}>Reason: {item.reason}</Text>
            <Pressable onPress={() => removeRestriction(item.id)}>
              <Text style={styles.removeText}>Remove Restriction</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  formCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 8, marginBottom: 12 },
  formTitle: { color: '#D4AF37', fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: '#1A2036', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#1A2036', borderWidth: 1, borderColor: '#2A3150', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: 'white', fontSize: 11 },
  addBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#0A0E1A', fontWeight: '700' },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 6 },
  name: { color: 'white', fontWeight: '700', fontSize: 13 },
  reason: { color: '#8A8FA3', fontSize: 12 },
  removeText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
});