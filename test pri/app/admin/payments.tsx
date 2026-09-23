import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createInvoice } from '@/lib/invoiceGenerator';
import { supabase } from '@/lib/supabase';

export default function AdminPaymentsScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  async function loadPayments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          profiles:fk_payments_student (id, full_name, email, mobile, student_id),
          batches:fk_payments_batch (id, name, price, validity_days, validity_text)
        `)
        .eq('status', filter)
        .order('submitted_at', { ascending: false });

      if (error) {
        // Fallback without strict foreign keys if custom schema
        const { data: fallbackData } = await supabase
          .from('payments')
          .select('*')
          .eq('status', filter)
          .order('submitted_at', { ascending: false });

        setPayments(fallbackData ?? []);
      } else {
        setPayments(data ?? []);
      }
    } catch (err: any) {
      console.error('Load payments error:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, [filter]);

  // Payment Approve Function
  async function handleApprove(payment: any) {
    Alert.alert('Approve Payment', `₹${payment.amount} ka payment approve karein?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve & Issue Invoice',
        onPress: async () => {
          setProcessingId(payment.id);
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            // 1. Current Approving Admin ka profile aur signature fetch karein
            const { data: adminProfile } = await supabase
              .from('profiles')
              .select('full_name, signature_url')
              .eq('id', user?.id)
              .single();

            // 2. Batch ke validity days calculate karein
            const validityDays = payment.batches?.validity_days || 365;
            const validFrom = new Date().toISOString();
            const validUntil = new Date(Date.now() + validityDays * 86400000).toISOString();

            // 3. Update payment status with approving admin details
            const { error: payUpdateErr } = await supabase
              .from('payments')
              .update({
                status: 'approved',
                approved_by: user?.id,
                valid_from: validFrom,
                valid_until: validUntil,
                reviewed_at: new Date().toISOString(),
              })
              .eq('id', payment.id);

            if (payUpdateErr) throw payUpdateErr;

            // 4. Batch count increment
            if (payment.batch_id) {
              await supabase.rpc('increment_enrolled_count', { p_batch_id: payment.batch_id });
            }

            // 5. Generate Official Invoice with Real Validity & Approving Admin Sign
            await createInvoice({
              studentId: payment.student_id,
              batchId: payment.batch_id,
              amount: payment.amount,
              mobile: payment.profiles?.mobile,
              productType: payment.product_type || 'batch',
              validFrom: validFrom.split('T')[0],
              validUntil: validUntil.split('T')[0],
            });

            // 6. Invoices table me approving admin ka name & sign sync karein
            await supabase
              .from('invoices')
              .update({
                approved_by: user?.id,
                admin_name: adminProfile?.full_name || 'Admin',
                admin_signature_url: adminProfile?.signature_url,
              })
              .eq('student_id', payment.student_id)
              .eq('transaction_id', payment.utr);

            // 7. Referral reward trigger (100 coins)
            await supabase.rpc('reward_referral', {
              p_buyer_id: payment.student_id,
              p_reward_coins: 100,
            });

            Alert.alert('Approved', 'Payment approve ho gaya aur official invoice generate ho gayi!');
            loadPayments();
          } catch (err: any) {
            Alert.alert('Approval Failed', err.message);
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  }

  // Payment Reject Function
  async function handleReject(payment: any) {
    Alert.alert('Reject Payment', 'Kya aap is payment ko reject karna chahte hain?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessingId(payment.id);
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            await supabase
              .from('payments')
              .update({
                status: 'rejected',
                approved_by: user?.id,
                reviewed_at: new Date().toISOString(),
              })
              .eq('id', payment.id);

            Alert.alert('Rejected', 'Payment reject kar diya gaya.');
            loadPayments();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  }

  const filteredPayments = payments.filter((p) => {
    const studentName = p.profiles?.full_name?.toLowerCase() || '';
    const utrNo = p.utr?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return studentName.includes(q) || utrNo.includes(q);
  });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Payment Approvals',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['pending', 'approved', 'rejected'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabBtn, filter === tab && styles.tabBtnActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search Filter */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#8A8FA3" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student name or UTR..."
          placeholderTextColor="#8A8FA3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredPayments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No {filter} payments found.</Text>
          }
          renderItem={({ item }) => {
            const isWorking = processingId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>
                      {item.profiles?.full_name || 'Student'}
                    </Text>
                    <Text style={styles.metaSub}>
                      {item.profiles?.mobile || item.profiles?.email || 'No Contact'}
                    </Text>
                  </View>
                  <Text style={styles.amountText}>₹{item.amount}</Text>
                </View>

                <View style={styles.infoGrid}>
                  <Text style={styles.infoRow}>
                    Batch:{' '}
                    <Text style={styles.boldWhite}>
                      {item.batches?.name || 'Selected Course'}
                    </Text>
                  </Text>
                  <Text style={styles.infoRow}>
                    UTR / TXN:{' '}
                    <Text style={styles.boldGold}>{item.utr}</Text>
                  </Text>
                  <Text style={styles.infoRow}>
                    Date:{' '}
                    <Text style={styles.boldWhite}>
                      {new Date(item.submitted_at).toLocaleString()}
                    </Text>
                  </Text>
                  {item.batches?.validity_days && (
                    <Text style={styles.infoRow}>
                      Batch Validity:{' '}
                      <Text style={{ color: '#60A5FA', fontWeight: '700' }}>
                        {item.batches?.validity_text || `${item.batches?.validity_days} Days`}
                      </Text>
                    </Text>
                  )}
                </View>

                {item.screenshot_url && (
                  <Pressable
                    style={styles.screenshotBtn}
                    onPress={() => setSelectedImage(item.screenshot_url)}
                  >
                    <Ionicons name="image-outline" size={16} color="#D4AF37" />
                    <Text style={styles.screenshotText}>View Payment Screenshot</Text>
                  </Pressable>
                )}

                {filter === 'pending' && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionBtn, styles.approveBtn, isWorking && { opacity: 0.6 }]}
                      onPress={() => handleApprove(item)}
                      disabled={isWorking}
                    >
                      {isWorking ? (
                        <ActivityIndicator color="#0A0E1A" size="small" />
                      ) : (
                        <Text style={styles.approveBtnText}>✓ Approve & Generate Invoice</Text>
                      )}
                    </Pressable>

                    <Pressable
                      style={[styles.actionBtn, styles.rejectBtn, isWorking && { opacity: 0.6 }]}
                      onPress={() => handleReject(item)}
                      disabled={isWorking}
                    >
                      <Text style={styles.rejectBtnText}>✕ Reject</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Screenshot Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.modalBg}>
          <Pressable style={styles.closeModalBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.modalImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  tabBar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#151A2C' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#D4AF37' },
  tabText: { color: '#8A8FA3', fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#0A0E1A' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#151A2C',
    margin: 14,
    marginBottom: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3150',
  },
  searchInput: { flex: 1, color: 'white', paddingVertical: 10, fontSize: 13 },
  listContent: { padding: 14, gap: 12 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: '#151A2C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A3150',
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studentName: { color: 'white', fontSize: 16, fontWeight: '700' },
  metaSub: { color: '#8A8FA3', fontSize: 12, marginTop: 2 },
  amountText: { color: '#D4AF37', fontSize: 20, fontWeight: '800' },
  infoGrid: { gap: 4, backgroundColor: '#0E1322', padding: 10, borderRadius: 8 },
  infoRow: { color: '#8A8FA3', fontSize: 12 },
  boldWhite: { color: 'white', fontWeight: '600' },
  boldGold: { color: '#D4AF37', fontWeight: '700', fontFamily: 'monospace' },
  screenshotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  screenshotText: { color: '#D4AF37', fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  approveBtn: { backgroundColor: '#D4AF37' },
  approveBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 12.5 },
  rejectBtn: { backgroundColor: '#3A1515', borderWidth: 1, borderColor: '#EF4444' },
  rejectBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 12.5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModalBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  modalImg: { width: '92%', height: '80%' },
});