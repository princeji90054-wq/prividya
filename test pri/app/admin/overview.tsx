import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function OverviewScreen() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { count: studentCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student');
      const { count: pendingPayments } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      const { count: pendingNexus } = await supabase.from('nexus_passes').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      const { count: openDoubts } = await supabase.from('doubts').select('id', { count: 'exact', head: true }).eq('status', 'open');
      const { data: approvedPayments } = await supabase.from('payments').select('amount').eq('status', 'approved');
      const revenue = (approvedPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

      setStats({
        studentCount: studentCount ?? 0,
        pendingPayments: pendingPayments ?? 0,
        pendingNexus: pendingNexus ?? 0,
        openDoubts: openDoubts ?? 0,
        revenue,
      });
    }
    load();
  }, []);

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  const CARDS = [
    { label: 'Total Students', value: stats.studentCount },
    { label: 'Total Revenue', value: `₹${stats.revenue}` },
    { label: 'Pending Payments', value: stats.pendingPayments },
    { label: 'Pending Nexus', value: stats.pendingNexus },
    { label: 'Open Doubts', value: stats.openDoubts },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Overview</Text>
        <View style={styles.grid}>
          {CARDS.map((c) => (
            <View key={c.label} style={styles.card}>
              <Text style={styles.value}>{c.value}</Text>
              <Text style={styles.label}>{c.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 16 },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 14, padding: 18, gap: 6 },
  value: { color: '#D4AF37', fontSize: 22, fontWeight: '700' },
  label: { color: '#8A8FA3', fontSize: 12 },
});