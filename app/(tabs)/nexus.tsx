import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function NexusScreen() {
  const [status, setStatus] = useState<'none' | 'pending' | 'active' | 'expired'>('none');
  const [endDate, setEndDate] = useState<string | null>(null);
  const [utr, setUtr] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nexusPrice, setNexusPrice] = useState(299);
  const [nexusQr, setNexusQr] = useState<string | null>(null);

  async function load() {
    const { data: config } = await supabase.from('nexus_config').select('*').eq('id', 1).single();
    if (config) { setNexusPrice(config.price); setNexusQr(config.qr_url); }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('nexus_passes')
      .select('*')
      .eq('student_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      setStatus('none');
    } else if (data.status === 'pending') {
      setStatus('pending');
    } else if (data.status === 'approved') {
      const isExpired = data.end_date && new Date(data.end_date) < new Date();
      setStatus(isExpired ? 'expired' : 'active');
      setEndDate(data.end_date);
    } else {
      setStatus('none');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submitRequest() {
    if (!utr.trim()) {
      Alert.alert('Missing info', 'Please enter your UTR / transaction ID.');
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('nexus_passes').insert({
      student_id: user?.id,
      utr: utr.trim(),
      amount: nexusPrice,
      status: 'pending',
    });

    setSubmitting(false);
    if (error) { Alert.alert('Error', error.message); return; }

    Alert.alert('Submitted!', 'Your Nexus Pass request is pending admin approval.');
    setUtr('');
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Nexus Pass</Text>
        <Text style={styles.subtitle}>Unlock access to all eligible batches</Text>

        <View style={styles.card}>
          <Text style={styles.price}>₹{nexusPrice}</Text>
          <Text style={styles.desc}>All-batch access · Bypasses capacity limits</Text>
        </View>

        {status === 'active' && (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>✓ Nexus Pass Active</Text>
            {endDate && <Text style={styles.expiryText}>Valid till {new Date(endDate).toLocaleDateString()}</Text>}
          </View>
        )}

        {status === 'expired' && (
          <View style={styles.expiredBox}>
            <Text style={styles.expiredText}>Your Nexus Pass has expired. Renew below.</Text>
          </View>
        )}

        {status === 'pending' && (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingText}>Your request is pending admin approval.</Text>
          </View>
        )}

        {(status === 'none' || status === 'expired') && (
          <View style={styles.buyFlow}>
            {nexusQr && <Image source={{ uri: nexusQr }} style={styles.qrImage} />}
            <Text style={styles.instructionText}>Pay ₹{nexusPrice} via UPI to admin, then submit your UTR below.</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter UTR / Transaction ID"
              placeholderTextColor="#8A8FA3"
              value={utr}
              onChangeText={setUtr}
            />
            <Pressable style={styles.submitButton} onPress={submitRequest} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.submitButtonText}>Submit Request</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 14 },
  title: { color: '#D4AF37', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#8A8FA3', fontSize: 14 },
  card: { backgroundColor: '#151A2C', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2A3150', gap: 6 },
  price: { color: '#D4AF37', fontSize: 28, fontWeight: '700' },
  desc: { color: '#8A8FA3', fontSize: 13 },
  activeBox: { backgroundColor: '#152A1E', borderRadius: 12, padding: 16 },
  activeText: { color: '#4ADE80', fontWeight: '700', textAlign: 'center' },
  expiryText: { color: '#8A8FA3', fontSize: 12, textAlign: 'center', marginTop: 4 },
  expiredBox: { backgroundColor: '#3A2020', borderRadius: 12, padding: 16 },
  expiredText: { color: '#FF6B6B', textAlign: 'center' },
  pendingBox: { backgroundColor: '#1A2036', borderRadius: 12, padding: 16 },
  pendingText: { color: '#D4AF37', textAlign: 'center' },
  buyFlow: { gap: 12 },
  qrImage: { width: 220, height: 220, alignSelf: 'center', borderRadius: 12 },
  instructionText: { color: 'white', fontSize: 13, textAlign: 'center' },
  input: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16,
  },
  submitButton: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
});