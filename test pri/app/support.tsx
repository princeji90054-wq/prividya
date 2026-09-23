import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

const FAQ = [
  { q: 'How do I unlock a batch?', a: 'Go to the batch, tap Buy Now, scan the QR, pay, then submit your UTR. Admin will approve within a short time.' },
  { q: 'My payment was rejected, why?', a: 'This usually happens if the UTR doesn\'t match or the amount is incorrect. Contact support below.' },
  { q: 'Can I use the app on two devices?', a: 'No, each account is locked to one device. You can self-reset once for free.' },
];

export default function SupportScreen() {
  const [batchChangeReason, setBatchChangeReason] = useState('');
  const [requestedBatch, setRequestedBatch] = useState('');
  const [deletionReason, setDeletionReason] = useState('');

  async function submitBatchChange() {
    if (!requestedBatch.trim() || !batchChangeReason.trim()) {
      Alert.alert('Missing info', 'Please fill both fields.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('batch_change_requests').insert({
      student_id: user?.id, requested_batch_name: requestedBatch.trim(), reason: batchChangeReason.trim(),
    });
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Submitted', 'Your batch change request has been sent to admin.');
    setBatchChangeReason(''); setRequestedBatch('');
  }

  async function submitDeletionRequest() {
    if (!deletionReason.trim()) {
      Alert.alert('Missing info', 'Please tell us why you want to delete your account.');
      return;
    }
    Alert.alert('Confirm', 'This will request permanent deletion of your account. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', style: 'destructive',
        onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.from('account_deletion_requests').insert({
            student_id: user?.id, reason: deletionReason.trim(),
          });
          if (error) { Alert.alert('Error', error.message); return; }
          Alert.alert('Submitted', 'Your account deletion request has been sent to admin for review.');
          setDeletionReason('');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Help & Support', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>FAQ</Text>
        {FAQ.map((item, i) => (
          <View key={i} style={styles.faqCard}>
            <Text style={styles.faqQ}>{item.q}</Text>
            <Text style={styles.faqA}>{item.a}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Request Batch Change</Text>
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Which batch do you want instead?" placeholderTextColor="#8A8FA3" value={requestedBatch} onChangeText={setRequestedBatch} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Reason" placeholderTextColor="#8A8FA3" value={batchChangeReason} onChangeText={setBatchChangeReason} multiline />
          <Pressable style={styles.button} onPress={submitBatchChange}>
            <Text style={styles.buttonText}>Submit Request</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Delete My Account</Text>
        <View style={styles.formCard}>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Why do you want to delete your account?" placeholderTextColor="#8A8FA3" value={deletionReason} onChangeText={setDeletionReason} multiline />
          <Pressable style={[styles.button, styles.dangerButton]} onPress={submitDeletionRequest}>
            <Text style={styles.buttonText}>Request Deletion</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 12 },
  sectionTitle: { color: '#D4AF37', fontSize: 16, fontWeight: '700', marginTop: 12 },
  faqCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  faqQ: { color: 'white', fontWeight: '600', fontSize: 14 },
  faqA: { color: '#8A8FA3', fontSize: 13 },
  formCard: { gap: 10 },
  input: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: 'white', fontSize: 14,
  },
  textArea: { height: 70, textAlignVertical: 'top' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  dangerButton: { backgroundColor: '#3A2020' },
  buttonText: { color: 'white', fontWeight: '700' },
});