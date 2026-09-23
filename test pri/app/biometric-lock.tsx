import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticateWithBiometrics } from '@/lib/biometricLock';

export default function BiometricLockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [checking, setChecking] = useState(true);

  async function tryUnlock() {
    setChecking(true);
    const success = await authenticateWithBiometrics();
    setChecking(false);
    if (success) onUnlocked();
  }

  useEffect(() => { tryUnlock(); }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed" size={48} color="#D4AF37" />
        <Text style={styles.title}>PriVidya Locked</Text>
        {checking ? (
          <ActivityIndicator color="#D4AF37" style={{ marginTop: 20 }} />
        ) : (
          <Pressable style={styles.button} onPress={tryUnlock}>
            <Text style={styles.buttonText}>Unlock with Fingerprint / Face</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: 'white', fontSize: 20, fontWeight: '700' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 12 },
  buttonText: { color: '#0A0E1A', fontWeight: '700' },
});