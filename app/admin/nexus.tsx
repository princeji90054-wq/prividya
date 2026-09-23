import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createInvoice } from '@/lib/invoiceGenerator';
import { supabase } from '@/lib/supabase';

export default function AdminNexusScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [durationDays, setDurationDays] = useState('180');

  async function load() {
    const { data } = await supabase
      .from('nexus_passes')
      .select('*, profiles(full_name, mobile, email)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(item: any) {
    const days = parseInt(durationDays) || 180;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { error } = await supabase
      .from('nexus_passes')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .eq('id', item.id);

    if (error) { Alert.alert('Error', error.message); return; }

    // FIX (Bug #1): this is the call that used to fail silently — batch_id
    // was required by the old SQL function, and a Nexus Pass has no batch.
    // Now passes productType: 'nexus' + nexusPassId + validity dates, which
    // the updated generate_invoice() SQL function knows how to handle.
    const invoiceNumber = await createInvoice({
      studentId: item.student_id,
      nexusPassId: item.id,
      amount: item.amount,
      mobile: item.profiles?.mobile,
      productType: 'nexus',
      validFrom: startDate.toISOString(),
      validUntil: endDate.toISOString(),
    });
    if (!invoiceNumber) {
      Alert.alert('Note', 'Nexus Pass approved, but invoice generation failed. Check Supabase logs — make sure the SQL migration was run.');
    }

    await supabase.from('notifications').insert({
      student_id: item.student_id,
      title: 'Nexus Pass Approved',
      message: `Your Nexus Pass is active till ${endDate.toLocaleDateString()}.`,
    });

    Alert.alert('Approved', `Nexus Pass active for ${days} days.`);
    load();
  }

  async function reject(item: any) {
    const { error } = await supabase.from('nexus_passes').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', item.id);
    if (error) { Alert.alert('Error', error.message); return; }
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
      <View style={styles.durationRow}>
        <Text style={styles.durationLabel}>Approve with duration (days):</Text>
        <TextInput style={styles.durationInput} value={durationDays} onChangeText={setDurationDays} keyboardType="numeric" />
      </View>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No pending Nexus requests.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.profiles?.full_name}</Text>
            <Text style={styles.meta}>{item.profiles?.email}</Text>
            <Text style={styles.utr}>UTR: {item.utr} · ₹{item.amount}</Text>
            <View style={styles.buttonRow}>
              <Pressable style={styles.approveBtn} onPress={() => approve(item)}>
                <Text style={styles.btnText}>Approve</Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => reject(item)}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  durationRow: { padding: 16, gap: 8 },
  durationLabel: { color: '#8A8FA3', fontSize: 12 },
  durationInput: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white', width: 100 },
  listContent: { padding: 16, gap: 12 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 14, padding: 14, gap: 4 },
  name: { color: 'white', fontWeight: '700' },
  meta: { color: '#8A8FA3', fontSize: 12 },
  utr: { color: '#B8C0D8', fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: { flex: 1, backgroundColor: '#203A20', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#3A2020', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700', fontSize: 13 },
});