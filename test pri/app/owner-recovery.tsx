import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function OwnerRecoveryScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !code.trim()) {
      Alert.alert('Missing info', 'Enter both email and recovery code.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('owner-recover-with-code', {
      body: { email: email.trim(), code: code.trim() },
    });
    setLoading(false);

    if (error || data?.error) {
      Alert.alert('Failed', data?.error || error?.message);
      return;
    }

    Alert.alert('Sent', data.message, [{ text: 'OK', onPress: () => router.replace('/login' as any) }]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Owner Recovery', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <View style={styles.content}>
        <Text style={styles.title}>Owner Account Recovery</Text>
        <TextInput style={styles.input} placeholder="Owner Email" placeholderTextColor="#8A8FA3" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Recovery Code" placeholderTextColor="#8A8FA3" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.buttonText}>Recover Account</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 24, gap: 12, justifyContent: 'center', flex: 1 },
  title: { color: '#D4AF37', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0A0E1A', fontWeight: '700', fontSize: 16 },
});