import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password should be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Success', 'Password updated! Please log in again.', [
      { text: 'OK', onPress: () => { supabase.auth.signOut(); router.replace('/login' as any); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Set New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor="#8A8FA3"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Pressable style={styles.button} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.buttonText}>Update Password</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  input: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16,
  },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
});