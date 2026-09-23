import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function CouponsScreen() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUsage, setMaxUsage] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('coupons').select('*').order('id', { ascending: false });
    setCoupons(data ?? []);
  }

  useEffect(() => {
    load();
    supabase.from('batches').select('id, name').eq('is_published', true).then(({ data }) => setBatches(data ?? []));
  }, []);

  async function createCoupon() {
    if (!code.trim() || !discountValue) {
      Alert.alert('Missing info', 'Code and discount value required.');
      return;
    }
    const { error } = await supabase.from('coupons').insert({
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      max_usage: maxUsage ? parseInt(maxUsage) : null,
      expiry_date: expiryDate.trim() || null,
      batch_id: selectedBatchId,
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setCode(''); setDiscountValue(''); setMaxUsage(''); setExpiryDate(''); setSelectedBatchId(null);
    load();
  }

  async function toggleActive(item: any) {
    await supabase.from('coupons').update({ is_active: !item.is_active }).eq('id', item.id);
    load();
  }

  async function deleteCoupon(item: any) {
    if (item.usage_count > 0) {
      Alert.alert('Cannot delete', 'This coupon has been used. Deactivate it instead.');
      return;
    }
    await supabase.from('coupons').delete().eq('id', item.id);
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <View style={styles.formSection}>
            <TextInput style={styles.input} placeholder="Coupon Code" placeholderTextColor="#8A8FA3" value={code} onChangeText={setCode} autoCapitalize="characters" />

            <View style={styles.typeRow}>
              <Pressable style={[styles.typeChip, discountType === 'percentage' && styles.typeChipActive]} onPress={() => setDiscountType('percentage')}>
                <Text style={styles.typeChipText}>Percentage</Text>
              </Pressable>
              <Pressable style={[styles.typeChip, discountType === 'fixed' && styles.typeChipActive]} onPress={() => setDiscountType('fixed')}>
                <Text style={styles.typeChipText}>Fixed ₹</Text>
              </Pressable>
            </View>

            <TextInput style={styles.input} placeholder={discountType === 'percentage' ? 'Discount %' : 'Discount ₹'} placeholderTextColor="#8A8FA3" value={discountValue} onChangeText={setDiscountValue} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Max usage (optional)" placeholderTextColor="#8A8FA3" value={maxUsage} onChangeText={setMaxUsage} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Expiry date (YYYY-MM-DD, optional)" placeholderTextColor="#8A8FA3" value={expiryDate} onChangeText={setExpiryDate} />

            <Text style={styles.meta}>Applicable batch</Text>
            <View style={styles.batchScroll}>
              <Pressable style={[styles.typeChip, !selectedBatchId && styles.typeChipActive]} onPress={() => setSelectedBatchId(null)}>
                <Text style={styles.typeChipText}>All Batches</Text>
              </Pressable>
              {batches.map((b) => (
                <Pressable key={b.id} style={[styles.typeChip, selectedBatchId === b.id && styles.typeChipActive]} onPress={() => setSelectedBatchId(b.id)}>
                  <Text style={styles.typeChipText} numberOfLines={1}>{b.name}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.createBtn} onPress={createCoupon}>
              <Text style={styles.createBtnText}>Create Coupon</Text>
            </Pressable>

            <Text style={styles.listHeading}>Existing Coupons</Text>
          </View>
        }
        data={coupons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.meta}>
              {item.discount_type === 'percentage' ? `${item.discount_value}% off` : `₹${item.discount_value} off`} · Used {item.usage_count}x
              {item.expiry_date ? ` · Expires ${item.expiry_date}` : ''}
            </Text>
            <View style={styles.rowBetween}>
              <View style={styles.switchRow}>
                <Text style={styles.meta}>Active</Text>
                <Switch value={item.is_active} onValueChange={() => toggleActive(item)} />
              </View>
              <Pressable onPress={() => deleteCoupon(item)}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  formSection: { padding: 16, gap: 10 },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white' },
  typeRow: { flexDirection: 'row', gap: 8 },
  batchScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  typeChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  typeChipText: { color: 'white', fontSize: 12, fontWeight: '600' },
  createBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  createBtnText: { color: '#0A0E1A', fontWeight: '700' },
  listHeading: { color: 'white', fontSize: 15, fontWeight: '700', marginTop: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 6 },
  code: { color: '#D4AF37', fontSize: 16, fontWeight: '700' },
  meta: { color: '#8A8FA3', fontSize: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteText: { color: '#FF6B6B', fontWeight: '600' },
});