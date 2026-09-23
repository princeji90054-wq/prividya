import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function VerifyUsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [otpCode, setOtpCode] = useState('');

  async function load() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    setUsers(data ?? []);
  }

  useEffect(() => { load(); }, []);

  function generateOtp() {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setOtpCode(code);
  }

  function selectUser(user: any) {
    setSelected(user);
    setOtpCode('');
  }

  async function sendVerificationRequest() {
    if (!otpCode.trim()) {
      Alert.alert('Missing OTP', 'Generate or type an OTP first.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        verification_locked: true,
        verification_otp: otpCode.trim(),
        verification_requested_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert(
      'Locked & Sent',
      `${selected.full_name}'s app is now locked. Tell them this code via call/SMS/WhatsApp: ${otpCode}`
    );
    setSelected(null);
    setOtpCode('');
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Today's New Users ({users.length})</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No new signups today.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => selectUser(item)}>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.meta}>{item.mobile || 'No number'} · {item.email}</Text>
            <Text style={styles.status}>
              {item.verification_locked ? '🔒 Locked — waiting for OTP' : item.is_mobile_verified ? '✓ Verified' : 'Not verified'}
            </Text>
          </Pressable>
        )}
      />

      {selected && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Verify: {selected.full_name}</Text>
          <Text style={styles.panelMobile}>{selected.mobile || 'No number on file'}</Text>

          <View style={styles.otpRow}>
            <TextInput
              style={styles.otpInput}
              placeholder="OTP code"
              placeholderTextColor="#8A8FA3"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
            />
            <Pressable style={styles.genBtn} onPress={generateOtp}>
              <Text style={styles.genBtnText}>Generate</Text>
            </Pressable>
          </View>

          <Pressable style={styles.sendBtn} onPress={sendVerificationRequest}>
            <Text style={styles.sendBtnText}>Send Verification Request (Locks App)</Text>
          </Pressable>
          <Pressable onPress={() => setSelected(null)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  title: { color: '#D4AF37', fontSize: 18, fontWeight: '700', padding: 16, paddingBottom: 8 },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  name: { color: 'white', fontWeight: '700', fontSize: 14 },
  meta: { color: '#8A8FA3', fontSize: 12 },
  status: { color: '#D4AF37', fontSize: 11, fontWeight: '600', marginTop: 4 },
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#151A2C', borderTopWidth: 1, borderTopColor: '#D4AF37', padding: 20, gap: 10 },
  panelTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  panelMobile: { color: '#8A8FA3', fontSize: 13, marginBottom: 4 },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpInput: { flex: 1, backgroundColor: '#0A0E1A', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white', fontSize: 16, textAlign: 'center' },
  genBtn: { backgroundColor: '#2A3150', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  genBtnText: { color: 'white', fontWeight: '600', fontSize: 12 },
  sendBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  sendBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 13 },
  cancelText: { color: '#8A8FA3', textAlign: 'center', fontSize: 13 },
});