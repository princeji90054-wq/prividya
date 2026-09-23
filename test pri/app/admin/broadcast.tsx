import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function BroadcastScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [batches, setBatches] = useState<any[]>([]);
  const [targetBatchId, setTargetBatchId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.from('batches').select('id, name').then(({ data }) => setBatches(data ?? []));
  }, []);

  async function send() {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing info', 'Title and message required.');
      return;
    }

    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();

    let studentIds: string[] = [];
    if (targetBatchId) {
      const { data: payments } = await supabase.from('payments').select('student_id').eq('batch_id', targetBatchId).eq('status', 'approved');
      studentIds = [...new Set((payments ?? []).map((p) => p.student_id))];
    } else {
      const { data: allStudents } = await supabase.from('profiles').select('id').eq('role', 'student');
      studentIds = (allStudents ?? []).map((s) => s.id);
    }

    if (studentIds.length === 0) {
      Alert.alert('No recipients', 'No students found for this target.');
      setSending(false);
      return;
    }

    await supabase.from('notifications').insert(
      studentIds.map((id) => ({ student_id: id, title: title.trim(), message: message.trim() }))
    );

    await supabase.from('broadcast_announcements').insert({
      title: title.trim(), message: message.trim(), target_batch_id: targetBatchId, sent_by: user?.id,
    });

    setSending(false);
    Alert.alert('Sent!', `Announcement sent to ${studentIds.length} student(s).`);
    setTitle(''); setMessage(''); setTargetBatchId(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Broadcast Announcement</Text>

        <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#8A8FA3" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input, styles.textArea]} placeholder="Message" placeholderTextColor="#8A8FA3" value={message} onChangeText={setMessage} multiline />

        <Text style={styles.label}>Send to:</Text>
        <View style={styles.chipRow}>
          <Pressable style={[styles.chip, !targetBatchId && styles.chipActive]} onPress={() => setTargetBatchId(null)}>
            <Text style={styles.chipText}>All Students</Text>
          </Pressable>
          {batches.map((b) => (
            <Pressable key={b.id} style={[styles.chip, targetBatchId === b.id && styles.chipActive]} onPress={() => setTargetBatchId(b.id)}>
              <Text style={styles.chipText}>{b.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.sendBtn} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.sendBtnText}>Send Announcement</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 10 },
  title: { color: '#D4AF37', fontSize: 20, fontWeight: '700' },
  label: { color: '#B8C0D8', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white' },
  textArea: { height: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: 'white', fontSize: 12, fontWeight: '600' },
  sendBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  sendBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 15 },
});