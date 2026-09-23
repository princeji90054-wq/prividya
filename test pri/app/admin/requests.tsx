import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createInvoice } from '@/lib/invoiceGenerator';
import { supabase } from '@/lib/supabase';

export default function RequestsScreen() {
  const [tab, setTab] = useState<'coins' | 'batch' | 'deletion'>('coins');
  const [coinRequests, setCoinRequests] = useState<any[]>([]);
  const [batchRequests, setBatchRequests] = useState<any[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);

  async function load() {
    const { data: coins } = await supabase.from('coin_unlock_requests').select('*, profiles(full_name, mobile), batches(name)').eq('status', 'pending');
    setCoinRequests(coins ?? []);
    const { data: batch } = await supabase.from('batch_change_requests').select('*, profiles(full_name)').eq('status', 'pending');
    setBatchRequests(batch ?? []);
    const { data: deletion } = await supabase.from('account_deletion_requests').select('*, profiles(full_name, is_blocked)').eq('status', 'pending');
    setDeletionRequests(deletion ?? []);
  }

  useEffect(() => { load(); }, []);

  async function approveCoinRequest(item: any) {
    const { data: profile } = await supabase.from('profiles').select('coins').eq('id', item.student_id).single();
    if ((profile?.coins ?? 0) < item.coins_used) {
      Alert.alert('Insufficient coins', 'Student no longer has enough coins.');
      return;
    }

    await supabase.from('profiles').update({ coins: profile!.coins - item.coins_used }).eq('id', item.student_id);
    await supabase.from('payments').insert({
      student_id: item.student_id, batch_id: item.batch_id, utr: 'COIN-REDEEM',
      amount: 0, status: 'approved', reviewed_at: new Date().toISOString(),
    });

    const invoiceNumber = await createInvoice({
      studentId: item.student_id,
      batchId: item.batch_id,
      amount: 0,
      mobile: item.profiles?.mobile,
      productType: 'batch',
      note: 'Coin Redeem',
    });
    if (!invoiceNumber) console.log('Invoice generation failed for coin redeem');

    await supabase.from('coin_unlock_requests').update({ status: 'approved' }).eq('id', item.id);
    await supabase.from('notifications').insert({ student_id: item.student_id, title: 'Batch Unlocked', message: `Your batch "${item.batches?.name}" was unlocked using coins.` });

    Alert.alert('Approved', 'Batch unlocked with coins.');
    load();
  }

  async function rejectCoinRequest(item: any) {
    await supabase.from('coin_unlock_requests').update({ status: 'rejected' }).eq('id', item.id);
    load();
  }

  async function resolveBatchChange(item: any) {
    await supabase.from('batch_change_requests').update({ status: 'resolved' }).eq('id', item.id);
    load();
  }

  async function approveDeletion(item: any) {
    if (item.profiles?.is_blocked) {
      Alert.alert('Not allowed', 'Blocked accounts cannot be deleted until unblocked.');
      return;
    }
    Alert.alert(
      'Confirm deletion',
      'This will permanently remove the student profile, their LOGIN CREDENTIALS, and all related personal data (payment/invoice history is anonymized, not deleted, for accounting). This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // FIX (Bug #3 root cause): the old code only ran
            // `profiles.delete()` from the client. That can never remove the
            // actual Supabase Auth login (the client SDK has no permission
            // to do that), so the account was never truly gone. This now
            // calls a service-role Edge Function that: wipes personal data,
            // anonymizes financial records, deletes the profile, AND
            // deletes the real Auth user.
            const { data, error } = await supabase.functions.invoke('admin-delete-account', {
              body: { studentId: item.student_id, requestId: item.id },
            });

            if (error || data?.error) {
              Alert.alert('Deletion failed', data?.error || error?.message || 'Unknown error. Make sure the admin-delete-account Edge Function is deployed.');
              return;
            }

            Alert.alert('Deleted', 'Student profile, login credentials, and related data have been permanently removed.');
            load();
          },
        },
      ]
    );
  }

  async function rejectDeletion(item: any) {
    await supabase.from('account_deletion_requests').update({ status: 'rejected' }).eq('id', item.id);
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabRow}>
        {(['coins', 'batch', 'deletion'] as const).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'coins' && (
        <FlatList
          data={coinRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No coin requests.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name} → {item.batches?.name}</Text>
              <Text style={styles.meta}>{item.coins_used} coins</Text>
              <View style={styles.buttonRow}>
                <Pressable style={styles.approveBtn} onPress={() => approveCoinRequest(item)}><Text style={styles.btnText}>Approve</Text></Pressable>
                <Pressable style={styles.rejectBtn} onPress={() => rejectCoinRequest(item)}><Text style={styles.btnText}>Reject</Text></Pressable>
              </View>
            </View>
          )}
        />
      )}

      {tab === 'batch' && (
        <FlatList
          data={batchRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No batch-change requests.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name}</Text>
              <Text style={styles.meta}>Wants: {item.requested_batch_name}</Text>
              <Text style={styles.meta}>Reason: {item.reason}</Text>
              <Pressable style={styles.approveBtn} onPress={() => resolveBatchChange(item)}><Text style={styles.btnText}>Mark Resolved</Text></Pressable>
            </View>
          )}
        />
      )}

      {tab === 'deletion' && (
        <FlatList
          data={deletionRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No deletion requests.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name} {item.profiles?.is_blocked ? '(BLOCKED)' : ''}</Text>
              <Text style={styles.meta}>Reason: {item.reason}</Text>
              <View style={styles.buttonRow}>
                <Pressable style={styles.approveBtn} onPress={() => approveDeletion(item)}><Text style={styles.btnText}>Approve & Delete</Text></Pressable>
                <Pressable style={styles.rejectBtn} onPress={() => rejectDeletion(item)}><Text style={styles.btnText}>Reject</Text></Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  tabRow: { flexDirection: 'row', gap: 8, padding: 16 },
  tab: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  tabText: { color: '#8A8FA3', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#0A0E1A' },
  listContent: { padding: 16, gap: 12 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 6 },
  name: { color: 'white', fontWeight: '700' },
  meta: { color: '#8A8FA3', fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  approveBtn: { flex: 1, backgroundColor: '#203A20', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#3A2020', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700', fontSize: 13 },
});