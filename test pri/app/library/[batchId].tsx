import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

const EXPIRY_DAYS = 7;

export default function LibraryScreen() {
  const { batchId } = useLocalSearchParams();
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [downloaded, setDownloaded] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function checkDownloaded(pdfList: any[]) {
    const map: Record<string, string> = {};
    for (const pdf of pdfList) {
      const raw = await AsyncStorage.getItem(`pdf_download_${pdf.id}`);
      if (raw) {
        const { path, downloadedAt } = JSON.parse(raw);
        const ageDays = (Date.now() - downloadedAt) / (1000 * 60 * 60 * 24);
        if (ageDays > EXPIRY_DAYS) {
          await FileSystem.deleteAsync(path, { idempotent: true });
          await AsyncStorage.removeItem(`pdf_download_${pdf.id}`);
        } else {
          const info = await FileSystem.getInfoAsync(path);
          if (info.exists) map[pdf.id] = path;
        }
      }
    }
    setDownloaded(map);
  }

  useEffect(() => {
    supabase.from('pdfs').select('*').eq('batch_id', batchId).order('created_at', { ascending: false }).then(async ({ data }) => {
      const list = data ?? [];
      setPdfs(list);
      await checkDownloaded(list);
      setLoading(false);
    });
  }, [batchId]);

  async function downloadPdf(pdf: any) {
    try {
      const path = `${FileSystem.documentDirectory}pdf_${pdf.id}.pdf`;
      await FileSystem.downloadAsync(pdf.file_url, path);
      await AsyncStorage.setItem(`pdf_download_${pdf.id}`, JSON.stringify({ path, downloadedAt: Date.now() }));
      setDownloaded({ ...downloaded, [pdf.id]: path });
      Alert.alert('Downloaded', `Available offline for ${EXPIRY_DAYS} days.`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  function openPdf(pdf: any) {
    if (downloaded[pdf.id]) {
      Linking.openURL(downloaded[pdf.id]);
    } else {
      Linking.openURL(pdf.file_url);
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
      <Stack.Screen options={{ title: 'Library', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={pdfs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No notes/PDFs added for this batch yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable style={styles.cardMain} onPress={() => openPdf(item)}>
              <Ionicons name="document-text" size={22} color="#D4AF37" />
              <Text style={styles.title}>{item.title}</Text>
            </Pressable>
            {downloaded[item.id] ? (
              <Text style={styles.offlineTag}>Offline ✓</Text>
            ) : (
              <Pressable onPress={() => downloadPdf(item)}>
                <Ionicons name="download-outline" size={20} color="#8A8FA3" />
              </Pressable>
            )}
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  title: { color: 'white', fontSize: 14, flex: 1 },
  offlineTag: { color: '#4ADE80', fontSize: 11, fontWeight: '700' },
});