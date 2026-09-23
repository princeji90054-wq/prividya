import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pickOrCaptureImage } from '@/lib/pickImage';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function MyNotesScreen() {
  const { classId } = useLocalSearchParams();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('personal_notes').select('*').eq('student_id', user.id).eq('class_id', classId).order('created_at', { ascending: false });
    setNotes(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [classId]);

  async function addNote(uri: string) {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const imageUrl = await uploadImage(uri, 'doubt-images', `note-${Date.now()}`);
    await supabase.from('personal_notes').insert({ student_id: user?.id, class_id: classId, image_url: imageUrl });
    setUploading(false);
    load();
  }

  async function toggleShare(note: any) {
    await supabase.from('personal_notes').update({ shared_with_admin: !note.shared_with_admin }).eq('id', note.id);
    load();
  }

  async function deleteNote(id: string) {
    await supabase.from('personal_notes').delete().eq('id', id);
    load();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'My Notes', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />

      <Pressable style={styles.addBtn} onPress={() => pickOrCaptureImage(addNote)} disabled={uploading}>
        {uploading ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.addBtnText}>📷 Add Note Photo</Text>}
      </Pressable>

      <Text style={styles.privacyNote}>Your notes are private by default. Only you can see them — tap "Share with Admin" if you want help on a specific note.</Text>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        ListEmptyComponent={<Text style={styles.emptyText}>No notes yet for this class.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.image_url }} style={styles.image} />
            <Pressable style={[styles.shareBtn, item.shared_with_admin && styles.sharedBtn]} onPress={() => toggleShare(item)}>
              <Text style={styles.shareBtnText}>{item.shared_with_admin ? '✓ Shared with Admin' : 'Share with Admin'}</Text>
            </Pressable>
            <Pressable onPress={() => deleteNote(item.id)}>
              <Ionicons name="trash" size={16} color="#FF6B6B" />
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  addBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 14, alignItems: 'center', margin: 16, marginBottom: 8 },
  addBtnText: { color: '#0A0E1A', fontWeight: '700' },
  privacyNote: { color: '#8A8FA3', fontSize: 11, paddingHorizontal: 16, marginBottom: 8 },
  listContent: { padding: 8, gap: 8 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 20, width: '100%' },
  card: { flex: 1, margin: 8, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 8, gap: 6 },
  image: { width: '100%', height: 140, borderRadius: 8 },
  shareBtn: { backgroundColor: '#2A3150', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  sharedBtn: { backgroundColor: '#203A20' },
  shareBtnText: { color: 'white', fontSize: 10, fontWeight: '600' },
});