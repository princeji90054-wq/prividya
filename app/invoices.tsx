import * as Print from 'expo-print';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getInvoiceHTML } from '@/lib/invoiceGenerator';
import { supabase } from '@/lib/supabase';

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      setInvoices(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function downloadInvoice(item: any) {
    try {
      setDownloadingId(item.id);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, mobile, student_id, id')
        .eq('id', user?.id)
        .single();

      // 1. Fetch official logo & circular seal
      const { data: branding } = await supabase
        .from('app_branding')
        .select('logo_url, seal_url')
        .eq('id', 1)
        .maybeSingle();

      // 2. Fetch approving admin signature
      let approvingAdmin: any = null;
      if (item.approved_by) {
        const { data: adminData } = await supabase
          .from('profiles')
          .select('full_name, signature_url')
          .eq('id', item.approved_by)
          .maybeSingle();
        approvingAdmin = adminData;
      }

      // Fallback: Agar invoice record me approved_by blank tha toh jis admin ka signature profile me hai wo layein
      if (!approvingAdmin?.signature_url) {
        const { data: fallbackAdmin } = await supabase
          .from('profiles')
          .select('full_name, signature_url')
          .not('signature_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallbackAdmin) approvingAdmin = fallbackAdmin;
      }

      // 3. Batch Validity Exact Calculation
      let finalValidFrom =
        item.valid_from ||
        (item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
      let finalValidUntil = item.valid_until;

      if (!finalValidUntil && item.batch_id) {
        const { data: batchData } = await supabase
          .from('batches')
          .select('validity_days')
          .eq('id', item.batch_id)
          .maybeSingle();

        const days = batchData?.validity_days || 365;
        const startDate = new Date(finalValidFrom);
        startDate.setDate(startDate.getDate() + days);
        finalValidUntil = startDate.toISOString().split('T')[0];
      }

      // GST Calculation
      const { data: gstSettings } = await supabase.from('gst_settings').select('*').eq('id', 1).single();
      const gstEnabled = gstSettings?.enabled ?? false;
      const gstAmount = gstEnabled ? Math.round((item.amount * (gstSettings?.rate_percent ?? 18)) / 100) : 0;
      const grandTotal = item.amount + gstAmount;

      const invoiceWithRealData = {
        ...item,
        valid_from: finalValidFrom,
        valid_until: finalValidUntil,
        admin_signature_url: approvingAdmin?.signature_url || item.admin_signature_url,
        admin_name: approvingAdmin?.full_name || item.admin_name,
        gstSettings,
        gstEnabled,
        gstAmount,
        grandTotal,
      };

      // Generate invoice HTML with real branding, circular seal & signatures
      const html = getInvoiceHTML(
        invoiceWithRealData,
        profile,
        branding || undefined,
        approvingAdmin || undefined
      );

      await Print.printAsync({ html });
    } catch (err: any) {
      console.error('Download error:', err.message);
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Invoices',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No invoices yet.</Text>}
        renderItem={({ item }) => {
          const isDownloading = downloadingId === item.id;
          return (
            <View style={styles.card}>
              <Text style={styles.batchName}>
                {item.product_name ?? (item.product_type === 'nexus' ? 'Nexus Pass' : 'Batch')}
              </Text>
              <Text style={styles.meta}>
                {item.invoice_number} · ₹{item.amount}
              </Text>
              <Pressable
                style={[styles.downloadBtn, isDownloading && { opacity: 0.7 }]}
                onPress={() => downloadInvoice(item)}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#0A0E1A" size="small" />
                ) : (
                  <Text style={styles.downloadText}>Download / Share PDF</Text>
                )}
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  batchName: { color: 'white', fontWeight: '700' },
  meta: { color: '#8A8FA3', fontSize: 12 },
  downloadBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  downloadText: { color: '#0A0E1A', fontWeight: '700', fontSize: 13 },
});