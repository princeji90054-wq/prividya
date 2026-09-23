import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function SharedClassScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [classInfo, setClassInfo] = useState<any>(null);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login' as any); return; }

      const { data: cls } = await supabase
        .from('classes')
        .select('id, is_free_demo, chapters(subjects(batch_id))')
        .eq('share_token', token)
        .single();

      if (!cls) { setLoading(false); return; }
      setClassInfo(cls);

      const batchId = (cls as any).chapters?.subjects?.batch_id;

      if (cls.is_free_demo) {
        setHasAccess(true);
      } else {
        const { data: payment } = await supabase
          .from('payments').select('id').eq('student_id', user.id).eq('batch_id', batchId).eq('status', 'approved').maybeSingle();
        const { data: nexus } = await supabase
          .from('nexus_passes').select('id').eq('student_id', user.id).eq('status', 'approved').maybeSingle();
        setHasAccess(!!payment || !!nexus);
      }
      setLoading(false);
    }
    check();
  }, [token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!classInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>This link is invalid or has expired.</Text>
      </SafeAreaView>
    );
  }

  if (hasAccess) {
    router.replace(`/watch/${classInfo.id}` as any);
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.buyBox}>
        <Text style={styles.buyTitle}>You need to purchase this batch to watch this video.</Text>
        <Pressable style={styles.buyBtn} onPress={() => router.replace('/(tabs)/courses' as any)}>
          <Text style={styles.buyBtnText}>Browse Batches</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', padding: 24 },
  notFound: { color: '#8A8FA3', textAlign: 'center' },
  buyBox: { alignItems: 'center', gap: 16 },
  buyTitle: { color: 'white', fontSize: 16, textAlign: 'center' },
  buyBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  buyBtnText: { color: '#0A0E1A', fontWeight: '700' },
});