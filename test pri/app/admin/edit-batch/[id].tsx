import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function EditBatchScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [newCoverUri, setNewCoverUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('batches').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setName(data.name);
        setDescription(data.description ?? '');
        setPrice(String(data.price));
        setCapacity(data.capacity ? String(data.capacity) : '');
        setCoverUrl(data.cover_image_url);
      }
      setLoading(false);
    });
  }, [id]);

  async function pickCoverImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) setNewCoverUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!name || !price) {
      Alert.alert('Missing info', 'Batch name aur price zaroori hai.');
      return;
    }
    setSaving(true);

    try {
      let finalCoverUrl = coverUrl;
      if (newCoverUri) {
        finalCoverUrl = await uploadImage(newCoverUri, 'batch-covers', `batch-${id}-${Date.now()}`);
      }

      const { error } = await supabase
        .from('batches')
        .update({
          name,
          description,
          price: parseFloat(price),
          capacity: capacity ? parseInt(capacity) : null,
          cover_image_url: finalCoverUrl,
        })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Saved', 'Batch updated successfully.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Cover Image</Text>
        <Pressable style={styles.imagePicker} onPress={pickCoverImage}>
          {(newCoverUri || coverUrl) ? (
            <Image source={{ uri: newCoverUri ?? coverUrl! }} style={styles.coverPreview} />
          ) : (
            <Text style={styles.imagePickerText}>+ Choose Cover Image</Text>
          )}
        </Pressable>

        <TextInput style={styles.input} placeholder="Batch Name" placeholderTextColor="#8A8FA3" value={name} onChangeText={setName} />
        <TextInput style={[styles.input, styles.textArea]} placeholder="Description" placeholderTextColor="#8A8FA3" value={description} onChangeText={setDescription} multiline />
        <TextInput style={styles.input} placeholder="Price (₹)" placeholderTextColor="#8A8FA3" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Capacity" placeholderTextColor="#8A8FA3" value={capacity} onChangeText={setCapacity} keyboardType="numeric" />

        <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.buttonText}>Save Changes</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 12 },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  imagePicker: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderStyle: 'dashed',
    borderRadius: 12, height: 140, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  imagePickerText: { color: '#8A8FA3', fontSize: 14 },
  coverPreview: { width: '100%', height: '100%' },
  input: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
});