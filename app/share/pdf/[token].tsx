import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function SharedPdfScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pdf, setPdf] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login' as any); return; }

      const { data: pdfData } = await supabase.from('pdfs').select('*').eq('share_token', token).single();
      if (!pdfData) { setLoading(false); return; }
      setPdf(pdfData);

      const { data: payment } = await supabase
        .from('payments').select('id').eq('student_id', user.id).eq('batch_id', pdfData.batch_id).eq('status', 'approved').maybeSingle();
      const { data: nexus } = await supabase
        .from('nexus_passes').select('id').eq('student_id', user.id).eq('status', 'approved').maybeSingle();
      setHasAccess(!!payment || !!nexus);
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

  if (!pdf) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>This link is invalid or has expired.</Text>
      </SafeAreaView>
    );
  }

  if (hasAccess) {
    WebBrowser.openBrowserAsync(pdf.file_url);
    router.replace('/(tabs)' as any);
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.buyBox}>
        <Text style={styles.buyTitle}>You need to purchase this batch to view this PDF.</Text>
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