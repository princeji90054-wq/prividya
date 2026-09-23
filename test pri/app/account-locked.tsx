import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AccountLockedScreen() {
  const [reason, setReason] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('lock_reason').eq('id', user.id).single();
      setReason(data?.lock_reason ?? '');
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Account Locked</Text>
      <Text style={styles.reason}>{reason}</Text>
      <Text style={styles.note}>Contact admin support to review this lock.</Text>
      <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>Log Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  title: { color: '#FF6B6B', fontSize: 24, fontWeight: '700' },
  reason: { color: 'white', fontSize: 14, textAlign: 'center' },
  note: { color: '#8A8FA3', fontSize: 12, textAlign: 'center' },
  button: { backgroundColor: '#2A3150', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 20 },
  buttonText: { color: '#FF6B6B', fontWeight: '600' },
});