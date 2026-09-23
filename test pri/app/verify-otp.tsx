import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function VerifyOtpScreen() {
  const [mobile, setMobile] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [changingNumber, setChangingNumber] = useState(false);
  const [newMobile, setNewMobile] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('mobile').eq('id', user.id).single();
    setMobile(data?.mobile ?? '');
    setLoading(false);
  }

  useEffect(() => {
    load();

    let channel: any;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel(`profile-lock-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload: any) => {
            if (!payload.new.verification_locked) {
              // Admin unlocked or user got verified elsewhere — app will auto-redirect via root layout
            }
          }
        )
        .subscribe();
    });

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  async function submitOtp() {
    if (!otpInput.trim()) {
      setError('Please enter the OTP.');
      return;
    }
    setSubmitting(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('verification_otp').eq('id', user?.id).single();

    if (profile?.verification_otp === otpInput.trim()) {
      await supabase.from('profiles').update({
        verification_locked: false,
        is_mobile_verified: true,
        verification_otp: null,
      }).eq('id', user?.id);
      setSubmitting(false);
      // Root layout will detect the change and redirect automatically
    } else {
      setError('Incorrect OTP. Please try again.');
      setSubmitting(false);
    }
  }

  async function saveNewNumber() {
    if (!newMobile.trim()) {
      Alert.alert('Missing info', 'Please enter a valid mobile number.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.from('profiles').update({ mobile: newMobile.trim() }).eq('id', user?.id);
    if (updateError) {
      Alert.alert('Error', updateError.message);
      return;
    }
    setMobile(newMobile.trim());
    setChangingNumber(false);
    setNewMobile('');
    Alert.alert('Number updated', 'Your number has been updated. Please contact admin to resend the verification code.');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Verify Your Number</Text>
          <Text style={styles.mobileText}>{mobile || 'No number on file'}</Text>
          <Text style={styles.subtitle}>Admin will contact you with a verification code. Enter it below to unlock the app.</Text>

          {!changingNumber ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Enter OTP"
                placeholderTextColor="#8A8FA3"
                value={otpInput}
                onChangeText={setOtpInput}
                keyboardType="number-pad"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable style={styles.button} onPress={submitOtp} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.buttonText}>Verify</Text>}
              </Pressable>

              <Pressable onPress={() => setChangingNumber(true)}>
                <Text style={styles.changeText}>Change Number</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Enter new mobile number"
                placeholderTextColor="#8A8FA3"
                value={newMobile}
                onChangeText={setNewMobile}
                keyboardType="phone-pad"
              />
              <Pressable style={styles.button} onPress={saveNewNumber}>
                <Text style={styles.buttonText}>Save New Number</Text>
              </Pressable>
              <Pressable onPress={() => setChangingNumber(false)}>
                <Text style={styles.changeText}>Cancel</Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  mobileText: { color: 'white', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  subtitle: { color: '#8A8FA3', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  input: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16, textAlign: 'center',
  },
  errorText: { color: '#FF6B6B', fontSize: 13, textAlign: 'center' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
  changeText: { color: '#3C9FFE', textAlign: 'center', fontSize: 14 },
  logoutButton: { marginTop: 30, alignItems: 'center' },
  logoutText: { color: '#8A8FA3', fontSize: 13 },
});