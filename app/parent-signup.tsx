import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ParentSignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!fullName.trim() || !email.trim() || !password || !linkCode.trim()) {
      Alert.alert('Missing info', 'All fields including the link code are required.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });

    if (error || !data.user) {
      Alert.alert('Signup failed', error?.message ?? 'Unknown error');
      setLoading(false);
      return;
    }

    await supabase.from('profiles').insert({
      id: data.user.id, full_name: fullName.trim(), email: email.trim(), role: 'parent',
    });

    const { error: linkError } = await supabase.rpc('link_parent_to_student', { p_code: linkCode.trim().toUpperCase() });

    setLoading(false);

    if (linkError) {
      Alert.alert('Account created, but linking failed', linkError.message + ' You can try linking again from the dashboard.');
    } else {
      Alert.alert('Success', 'Your account is linked to your child\'s progress.');
    }

    router.replace('/parent-dashboard' as any);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Parent Sign Up', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <View style={styles.content}>
        <Text style={styles.title}>Create Parent Account</Text>
        <Text style={styles.subtitle}>Ask your child for their Link Code (Profile → Family Link) to connect.</Text>
        <TextInput style={styles.input} placeholder="Your Full Name" placeholderTextColor="#8A8FA3" value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8A8FA3" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8A8FA3" value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="Child's Link Code" placeholderTextColor="#8A8FA3" value={linkCode} onChangeText={setLinkCode} autoCapitalize="characters" />
        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#8A8FA3', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0A0E1A', fontWeight: '700', fontSize: 16 },
});