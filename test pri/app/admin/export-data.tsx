import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

function toCsv(rows: any[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map((row) =>
    columns.map((col) => {
      const val = row[col] ?? '';
      const escaped = String(val).replace(/"/g, '""');
      return escaped.includes(',') ? `"${escaped}"` : escaped;
    }).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

export default function ExportDataScreen() {
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportStudents() {
    setExporting('students');
    const { data } = await supabase.from('profiles').select('student_id, full_name, email, mobile, is_blocked, coins, created_at').eq('role', 'student');
    const csv = toCsv(data ?? [], ['student_id', 'full_name', 'email', 'mobile', 'is_blocked', 'coins', 'created_at']);
    await saveAndShare(csv, 'students.csv');
    setExporting(null);
  }

  async function exportPayments() {
    setExporting('payments');
    const { data } = await supabase.from('payments').select('utr, amount, status, submitted_at, student_id, batch_id');
    const csv = toCsv(data ?? [], ['utr', 'amount', 'status', 'submitted_at', 'student_id', 'batch_id']);
    await saveAndShare(csv, 'payments.csv');
    setExporting(null);
  }

  async function saveAndShare(csvContent: string, filename: string) {
    const path = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, csvContent);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Data Export</Text>
      <View style={styles.content}>
        <Pressable style={styles.card} onPress={exportStudents} disabled={!!exporting}>
          {exporting === 'students' ? <ActivityIndicator color="#D4AF37" /> : <Text style={styles.cardText}>Export Students (CSV)</Text>}
        </Pressable>
        <Pressable style={styles.card} onPress={exportPayments} disabled={!!exporting}>
          {exporting === 'payments' ? <ActivityIndicator color="#D4AF37" /> : <Text style={styles.cardText}>Export Payments (CSV)</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  title: { color: '#D4AF37', fontSize: 20, fontWeight: '700', padding: 16 },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 18, alignItems: 'center' },
  cardText: { color: 'white', fontWeight: '600', fontSize: 14 },
});