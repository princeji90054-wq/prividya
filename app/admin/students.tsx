import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAdminPermissions } from '@/lib/adminPermissions';
import { createInvoice } from '@/lib/invoiceGenerator';
import { supabase } from '@/lib/supabase';

export default function StudentsScreen() {
  const { can } = useAdminPermissions();
  const [students, setStudents] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [studentBatches, setStudentBatches] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [blockReason, setBlockReason] = useState('');

  async function loadStudents() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name');
      setStudents(data ?? []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const filtered = students.filter((s) => {
    if (!s) return false;
    if (!searchId.trim()) return true;
    const query = searchId.toLowerCase();
    return (
      s.student_id?.toLowerCase().includes(query) ||
      s.mobile?.includes(searchId) ||
      s.full_name?.toLowerCase().includes(query)
    );
  });

  async function openStudent(student: any) {
    if (!student?.id) return;
    setSelected(student);
    setBlockReason('');

    try {
      const { data: payments } = await supabase
        .from('payments')
        .select('batch_id, status, batches(name)')
        .eq('student_id', student.id)
        .eq('status', 'approved');
      setStudentBatches(payments ?? []);

      const { data: batches } = await supabase
        .from('batches')
        .select('id, name, price')
        .eq('is_published', true);
      setAllBatches(batches ?? []);

      setModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function resetDevice() {
    if (!can('students', 'reset_device')) {
      Alert.alert('Not allowed', 'You do not have permission to reset devices.');
      return;
    }
    if (!selected?.id) return;

    const { data, error } = await supabase.functions.invoke('admin-reset-device', {
      body: { studentId: selected.id },
    });

    if (error || data?.error) {
      Alert.alert('Reset failed', data?.error || error?.message || 'Unknown error. Make sure the admin-reset-device Edge Function is deployed.');
      return;
    }

    Alert.alert('Done', 'Device binding reset. Student can now log in from a new device.');
  }

  async function toggleBlock() {
    if (!can('students', 'block')) {
      Alert.alert('Not allowed', 'You do not have permission to block/unblock students.');
      return;
    }
    if (!selected?.id) return;
    const newBlockedState = !selected.is_blocked;
    await applyBlock(newBlockedState, newBlockedState ? (blockReason.trim() || 'Blocked by admin') : '');
  }

  async function applyBlock(blockedState: boolean, reason: string) {
    if (!selected?.id) return;

    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: blockedState, lock_reason: blockedState ? reason : null })
      .eq('id', selected.id);

    if (error) {
      Alert.alert('Action failed', error.message);
      return;
    }

    if (blockedState) {
      const { data: device } = await supabase
        .from('device_bindings')
        .select('device_id')
        .eq('student_id', selected.id)
        .maybeSingle();

      await supabase.from('blocked_identities').insert({
        device_id: device?.device_id ?? null,
        mobile: selected.mobile ?? null,
        email: selected.email ?? null,
        reason,
      });
    }

    setSelected((prev: any) => (prev ? { ...prev, is_blocked: blockedState } : null));
    setBlockReason('');
    Alert.alert('Done', blockedState ? 'Student has been blocked.' : 'Student has been unblocked.');
    loadStudents();
  }

  async function grantBatch(batchId: string) {
    if (!can('students', 'grant_batch')) {
      Alert.alert('Not allowed', 'You do not have permission to grant batch access.');
      return;
    }
    if (!selected?.id) return;

    const { error } = await supabase.from('payments').insert({
      student_id: selected.id,
      batch_id: batchId,
      utr: 'ADMIN-GRANTED',
      amount: 0,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // Restored: admin-granted access also generates an invoice
    // (shows "Admin granted" style ₹0 record, matching the original spec).
    const invoiceNumber = await createInvoice({
      studentId: selected.id,
      batchId,
      amount: 0,
      mobile: selected.mobile,
      productType: 'batch',
      note: 'Admin Granted',   // NAYI line
    });
    if (!invoiceNumber) {
      console.log('Invoice generation failed for admin-granted batch');
    }

    openStudent(selected);
  }

  async function revokeBatch(batchId: string) {
    if (!selected?.id) return;

    await supabase
      .from('payments')
      .delete()
      .eq('student_id', selected.id)
      .eq('batch_id', batchId);

    openStudent(selected);
  }

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by Student ID, mobile, or name"
        placeholderTextColor="#8A8FA3"
        value={searchId}
        onChangeText={setSearchId}
      />

      {loading ? (
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item?.id ?? index.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (!item) return null;
            return (
              <Pressable style={styles.studentCard} onPress={() => openStudent(item)}>
                <Text style={styles.studentName}>{item.full_name || 'No Name'}</Text>
                <Text style={styles.studentId}>{item.student_id || 'ID Pending'}</Text>
                <Text style={styles.studentEmail}>
                  {item.email || 'No Email'} · {item.mobile || 'No Mobile'}
                </Text>
                {item.is_blocked && <Text style={styles.blockedTag}>BLOCKED</Text>}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Pressable
              onPress={() => {
                setModalVisible(false);
                setSelected(null);
              }}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>

            {selected && (
              <>
                <Text style={styles.modalName}>{selected.full_name}</Text>
                <Text style={styles.modalMeta}>
                  {selected.student_id} · {selected.mobile}
                </Text>
                {selected.is_blocked && (
                  <Text style={styles.blockedTag}>BLOCKED: {selected.lock_reason}</Text>
                )}

                {!selected.is_blocked && (
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Reason for blocking (optional)"
                    placeholderTextColor="#8A8FA3"
                    value={blockReason}
                    onChangeText={setBlockReason}
                  />
                )}

                <View style={styles.actionRow}>
                  <Pressable style={styles.actionButton} onPress={resetDevice}>
                    <Text style={styles.actionText}>Reset Device</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionButton,
                      selected.is_blocked ? styles.unblockButton : styles.blockButton,
                    ]}
                    onPress={toggleBlock}
                  >
                    <Text style={styles.actionText}>
                      {selected.is_blocked ? 'Unblock' : 'Block'}
                    </Text>
                  </Pressable>
                  {selected.is_locked && (
                    <Pressable
                      style={styles.actionButton}
                      onPress={async () => {
                        const { error } = await supabase
                          .from('profiles')
                          .update({ is_locked: false, lock_reason: null })
                          .eq('id', selected.id);
                        if (error) {
                          Alert.alert('Error', error.message);
                          return;
                        }
                        setSelected({ ...selected, is_locked: false });
                      }}
                    >
                      <Text style={styles.actionText}>Unlock Account (Security)</Text>
                    </Pressable>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Batch Access</Text>
                {studentBatches.length === 0 ? (
                  <Text style={styles.emptyText}>No batches assigned yet.</Text>
                ) : (
                  studentBatches.map((b: any) => (
                    <View key={b.batch_id} style={styles.batchRow}>
                      <Text style={styles.batchName}>{b.batches?.name || 'Batch'}</Text>
                      <Pressable onPress={() => revokeBatch(b.batch_id)}>
                        <Text style={styles.revokeText}>Revoke</Text>
                      </Pressable>
                    </View>
                  ))
                )}

                <Text style={styles.sectionTitle}>Grant New Batch</Text>
                {allBatches
                  .filter((b) => !studentBatches.some((sb: any) => sb.batch_id === b.id))
                  .map((b) => (
                    <Pressable key={b.id} style={styles.batchRow} onPress={() => grantBatch(b.id)}>
                      <Text style={styles.batchName}>{b.name}</Text>
                      <Text style={styles.grantText}>Grant</Text>
                    </Pressable>
                  ))}

                <Text style={styles.sectionTitle}>Adjust Coins</Text>
                <CoinAdjuster student={selected} onDone={() => openStudent(selected)} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function CoinAdjuster({ student, onDone }: any) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  async function apply(sign: 1 | -1) {
    if (!student?.id) return;
    const val = parseInt(amount, 10);
    if (!val || isNaN(val)) {
      Alert.alert('Invalid amount', 'Please enter a valid coin amount.');
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('coins')
        .eq('id', student.id)
        .single();

      const newCoins = Math.max(0, (profile?.coins ?? 0) + sign * val);
      await supabase.from('profiles').update({ coins: newCoins }).eq('id', student.id);
      await supabase.from('coin_transactions').insert({
        student_id: student.id,
        amount: sign * val,
        reason: reason || 'Adjusted by admin',
      });

      setAmount('');
      setReason('');
      onDone();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        style={styles.searchInput}
        placeholder="Amount"
        placeholderTextColor="#8A8FA3"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.searchInput}
        placeholder="Reason"
        placeholderTextColor="#8A8FA3"
        value={reason}
        onChangeText={setReason}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={styles.actionButton} onPress={() => apply(1)}>
          <Text style={styles.actionText}>Add Coins</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.blockButton]} onPress={() => apply(-1)}>
          <Text style={styles.actionText}>Minus Coins</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  searchInput: {
    margin: 16,
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'white',
  },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  studentCard: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  studentName: { color: 'white', fontWeight: '700', fontSize: 14 },
  studentId: { color: '#D4AF37', fontSize: 12, fontWeight: '600' },
  studentEmail: { color: '#8A8FA3', fontSize: 12 },
  blockedTag: { color: '#FF6B6B', fontSize: 11, fontWeight: '700', marginTop: 4 },
  modalContent: { padding: 20, gap: 12 },
  closeText: { color: '#3C9FFE', fontSize: 15, marginBottom: 12 },
  modalName: { color: 'white', fontSize: 20, fontWeight: '700' },
  modalMeta: { color: '#8A8FA3', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionButton: {
    flex: 1,
    backgroundColor: '#2A3150',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  blockButton: { backgroundColor: '#3A2020' },
  unblockButton: { backgroundColor: '#203A20' },
  actionText: { color: 'white', fontWeight: '600', fontSize: 13 },
  sectionTitle: { color: '#D4AF37', fontSize: 15, fontWeight: '700', marginTop: 16 },
  batchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#151A2C',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A3150',
  },
  batchName: { color: 'white', fontSize: 13 },
  revokeText: { color: '#FF6B6B', fontWeight: '600' },
  grantText: { color: '#4ADE80', fontWeight: '600' },
  emptyText: { color: '#8A8FA3', fontSize: 12, fontStyle: 'italic' },
});