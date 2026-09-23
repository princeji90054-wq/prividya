import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ReferralStatusScreen() {
  const [referred, setReferred] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: students } = await supabase.from('profiles').select('id, full_name, trial_claimed, created_at').eq('referred_by', user.id);

      const withStatus = await Promise.all(
        (students ?? []).map(async (s) => {
          const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('student_id', s.id).eq('status', 'approved').gt('amount', 0);
          const { data: coinTx } = await supabase.from('coin_transactions').select('created_at').eq('student_id', user.id).ilike('reason', `%${s.full_name}%`).maybeSingle();
          return {
            ...s,
            stage: !s.trial_claimed ? 'Signed up (trial not used)' : count && count > 0 ? 'Purchased — coins credited' : 'Trial claimed, no purchase yet',
          };
        })
      );

      setReferred(withStatus);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'My Referrals', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={referred}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>You haven't referred anyone yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.stage}>{item.stage}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  name: { color: 'white', fontWeight: '700' },
  stage: { color: '#D4AF37', fontSize: 12 },
});