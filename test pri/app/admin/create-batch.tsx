import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

const VALIDITY_PRESETS = [
  { label: '1 Month (30d)', days: 30 },
  { label: '3 Months (90d)', days: 90 },
  { label: '6 Months (180d)', days: 180 },
  { label: '1 Year (365d)', days: 365 },
  { label: '2 Years (730d)', days: 730 },
];

export default function CreateBatchScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [validityDays, setValidityDays] = useState('365');
  const [validityText, setValidityText] = useState('1 Year (365d)');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [qrUris, setQrUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  async function pickCoverImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  async function pickQrImage() {
    if (qrUris.length >= 5) {
      Alert.alert('Limit reached', 'Maximum 5 QR codes allowed per batch.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) setQrUris([...qrUris, result.assets[0].uri]);
  }

  function removeQr(index: number) {
    setQrUris(qrUris.filter((_, i) => i !== index));
  }

  function handleSelectPreset(preset: { label: string; days: number }) {
    setValidityDays(String(preset.days));
    setValidityText(preset.label);
  }

  async function handleCreateBatch() {
    if (!name || !price) {
      Alert.alert('Missing info', 'Batch name aur price zaroori hai.');
      return;
    }

    const parsedDays = parseInt(validityDays, 10);
    if (isNaN(parsedDays) || parsedDays <= 0) {
      Alert.alert('Invalid Validity', 'Validity days 1 ya usse adhik hone chahiye.');
      return;
    }

    setLoading(true);

    try {
      const { data: batch, error } = await supabase
        .from('batches')
        .insert({
          name,
          description,
          category_id: categoryId,
          price: parseFloat(price),
          capacity: capacity ? parseInt(capacity, 10) : null,
          validity_days: parsedDays,
          validity_text: validityText || `${parsedDays} Days`,
          is_published: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (coverUri) {
        const coverUrl = await uploadImage(coverUri, 'batch-covers', `batch-${batch.id}`);
        await supabase.from('batches').update({ cover_image_url: coverUrl }).eq('id', batch.id);
      }

      for (let i = 0; i < qrUris.length; i++) {
        const qrUrl = await uploadImage(qrUris[i], 'qr-codes', `batch-${batch.id}-qr-${i}`);
        await supabase.from('qr_codes').insert({
          batch_id: batch.id,
          image_url: qrUrl,
          order_index: i,
        });
      }

      Alert.alert('Success', 'Batch created with exact validity, cover and QR codes!');
      setName('');
      setDescription('');
      setPrice('');
      setCapacity('');
      setValidityDays('365');
      setValidityText('1 Year (365d)');
      setCoverUri(null);
      setQrUris([]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Batch Details</Text>

        <Text style={styles.subTitle}>Category</Text>
        <View style={styles.chipRow}>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.chip, categoryId === cat.id && styles.chipActive]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Batch Name"
          placeholderTextColor="#8A8FA3"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description"
          placeholderTextColor="#8A8FA3"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Price (₹)"
          placeholderTextColor="#8A8FA3"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Capacity (optional)"
          placeholderTextColor="#8A8FA3"
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="numeric"
        />

        {/* Validity Configuration */}
        <Text style={styles.sectionTitle}>Course Validity (Access Duration)</Text>
        <Text style={styles.hintText}>
          Expiry date ke baad batch app se delete nahi hoga, sirf student ke account me lock ho jayega.
        </Text>

        <View style={styles.chipRow}>
          {VALIDITY_PRESETS.map((preset) => {
            const isSelected = validityDays === String(preset.days);
            return (
              <Pressable
                key={preset.days}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => handleSelectPreset(preset)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Custom Validity in Days (e.g. 180)"
          placeholderTextColor="#8A8FA3"
          value={validityDays}
          onChangeText={(val) => {
            setValidityDays(val);
            setValidityText(`${val} Days`);
          }}
          keyboardType="numeric"
        />

        {/* Cover Image */}
        <Text style={styles.sectionTitle}>Cover Image</Text>
        <Pressable style={styles.imagePicker} onPress={pickCoverImage}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverPreview} />
          ) : (
            <Text style={styles.imagePickerText}>+ Choose Cover Image</Text>
          )}
        </Pressable>

        {/* QR Codes */}
        <Text style={styles.sectionTitle}>Payment QR Codes (up to 5)</Text>
        <View style={styles.qrRow}>
          {qrUris.map((uri, i) => (
            <Pressable key={i} onPress={() => removeQr(i)} style={styles.qrThumbWrapper}>
              <Image source={{ uri }} style={styles.qrThumb} />
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          ))}
          {qrUris.length < 5 && (
            <Pressable style={styles.qrAddButton} onPress={pickQrImage}>
              <Text style={styles.imagePickerText}>+ Add QR</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.button} onPress={handleCreateBatch} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0A0E1A" />
          ) : (
            <Text style={styles.buttonText}>Create Batch</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 12 },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginTop: 12 },
  subTitle: { color: '#B8C0D8', fontSize: 13, fontWeight: '600' },
  hintText: { color: '#8A8FA3', fontSize: 12, marginTop: -4, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: '#8A8FA3', fontSize: 13 },
  chipTextActive: { color: '#0A0E1A', fontWeight: '700' },
  input: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: 'white',
    fontSize: 15,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  imagePicker: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePickerText: { color: '#8A8FA3', fontSize: 14 },
  coverPreview: { width: '100%', height: '100%' },
  qrRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qrThumbWrapper: { width: 70, height: 70, position: 'relative' },
  qrThumb: { width: 70, height: 70, borderRadius: 10 },
  removeText: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B6B',
    color: 'white',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 20,
  },
  qrAddButton: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  buttonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
});