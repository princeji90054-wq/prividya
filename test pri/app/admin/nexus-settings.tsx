import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function NexusSettingsScreen() {
  const [price, setPrice] = useState('299');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [newQrUri, setNewQrUri] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('nexus_config').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        setPrice(String(data.price));
        setQrUrl(data.qr_url);
      }
    });
  }, []);

  async function pickQr() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) setNewQrUri(result.assets[0].uri);
  }

  async function save() {
    let finalQrUrl = qrUrl;
    if (newQrUri) {
      finalQrUrl = await uploadImage(newQrUri, 'qr-codes', `nexus-qr-${Date.now()}`);
    }
    const { error } = await supabase.from('nexus_config').update({ price: parseFloat(price), qr_url: finalQrUrl }).eq('id', 1);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Saved', 'Nexus Pass settings updated.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Nexus Pass Settings</Text>
        <TextInput style={styles.input} placeholder="Price (₹)" placeholderTextColor="#8A8FA3" value={price} onChangeText={setPrice} keyboardType="numeric" />

        <Text style={styles.sectionTitle}>Payment QR</Text>
        <Pressable style={styles.imagePicker} onPress={pickQr}>
          {(newQrUri || qrUrl) ? <Image source={{ uri: newQrUri ?? qrUrl! }} style={styles.qrPreview} /> : <Text style={styles.imagePickerText}>+ Upload QR</Text>}
        </Pressable>

        <Pressable style={styles.button} onPress={save}>
          <Text style={styles.buttonText}>Save Settings</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 12 },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '700' },
  sectionTitle: { color: 'white', fontSize: 15, fontWeight: '600', marginTop: 8 },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16 },
  imagePicker: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderStyle: 'dashed', borderRadius: 12, height: 160, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imagePickerText: { color: '#8A8FA3', fontSize: 13 },
  qrPreview: { width: '100%', height: '100%' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0A0E1A', fontWeight: '700', fontSize: 16 },
});