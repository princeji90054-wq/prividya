import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pickOrCaptureImage } from '@/lib/pickImage';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

const MIN_DOUBT_COIN = 5;

export default function AskDoubtScreen() {
  const router = useRouter();
  const [questionText, setQuestionText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [coinAmount, setCoinAmount] = useState(String(MIN_DOUBT_COIN));
  const [myCoins, setMyCoins] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('coins').eq('id', user.id).single();
      setMyCoins(data?.coins ?? 0);
    });
  }, []);

  async function submit() {
    const coins = parseInt(coinAmount, 10);

    if (!questionText.trim() && !imageUri) {
      Alert.alert('Missing info', 'Please type your doubt or attach a photo.');
      return;
    }
    if (!coins || isNaN(coins) || coins < MIN_DOUBT_COIN) {
      Alert.alert('Invalid coins', `Minimum ${MIN_DOUBT_COIN} coins required to post a doubt.`);
      return;
    }
    if (coins > myCoins) {
      Alert.alert('Not enough coins', `You only have ${myCoins} coins available.`);
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    let imageUrl = null;
    if (imageUri) {
      imageUrl = await uploadImage(imageUri, 'doubt-images', `doubt-${Date.now()}`);
    }

    const { error } = await supabase.from('doubts').insert({
      student_id: user?.id,
      question_text: questionText.trim() || null,
      question_image_url: imageUrl,
      coin_amount: coins,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Posted!', 'Your doubt is live. You will be notified when someone answers.');
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Ask a Doubt', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Your Doubt</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Type your question here..."
          placeholderTextColor="#8A8FA3"
          value={questionText}
          onChangeText={setQuestionText}
          multiline
        />

        <Pressable style={styles.imagePicker} onPress={() => pickOrCaptureImage(setImageUri)}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <Text style={styles.imagePickerText}>📷 Take a photo or choose from gallery (optional)</Text>
          )}
        </Pressable>

        <Text style={styles.label}>Coins to offer (you have {myCoins})</Text>
        <TextInput
          style={styles.input}
          placeholder={`Minimum ${MIN_DOUBT_COIN}`}
          placeholderTextColor="#8A8FA3"
          value={coinAmount}
          onChangeText={setCoinAmount}
          keyboardType="numeric"
        />
        <Text style={styles.hint}>These coins go to whoever solves your doubt correctly. You choose who wins.</Text>

        <Pressable style={styles.submitButton} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.submitText}>Post Doubt</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 10 },
  label: { color: '#D4AF37', fontSize: 13, fontWeight: '700', marginTop: 12 },
  input: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16,
  },
  textArea: { height: 110, textAlignVertical: 'top' },
  imagePicker: {
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderStyle: 'dashed',
    borderRadius: 12, height: 140, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  imagePickerText: { color: '#8A8FA3', fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  imagePreview: { width: '100%', height: '100%' },
  hint: { color: '#8A8FA3', fontSize: 12 },
  submitButton: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
});