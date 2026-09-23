import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ForumScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostVisible, setNewPostVisible] = useState(false);

  async function load() {
    const { data } = await supabase.from('forum_posts').select('*, profiles(forum_nickname)').order('created_at', { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Discussion Forum', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No posts yet. Be the first!</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/forum/${item.id}` as any)}>
            <Text style={styles.nickname}>{item.profiles?.forum_nickname ?? 'Learner'}</Text>
            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postBody} numberOfLines={2}>{item.body}</Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => setNewPostVisible(true)}>
        <Ionicons name="add" size={26} color="#0A0E1A" />
      </Pressable>
      <NewPostModal visible={newPostVisible} onClose={() => setNewPostVisible(false)} onPosted={() => { setNewPostVisible(false); load(); }} />
    </SafeAreaView>
  );
}

function NewPostModal({ visible, onClose, onPosted }: any) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  async function submit() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing info', 'Title and content required.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('forum_posts').insert({ student_id: user?.id, title: title.trim(), body: body.trim() });
    if (error) { Alert.alert('Error', error.message); return; }
    setTitle(''); setBody('');
    onPosted();
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Pressable onPress={onClose}><Text style={styles.closeText}>Close</Text></Pressable>
          <Text style={styles.modalTitle}>New Post (anonymous)</Text>
          <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#8A8FA3" value={title} onChangeText={setTitle} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="What's on your mind?" placeholderTextColor="#8A8FA3" value={body} onChangeText={setBody} multiline />
          <Pressable style={styles.submitBtn} onPress={submit}><Text style={styles.submitBtnText}>Post</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  nickname: { color: '#D4AF37', fontSize: 11, fontWeight: '700' },
  postTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
  postBody: { color: '#B8C0D8', fontSize: 13 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 20, gap: 10 },
  closeText: { color: '#3C9FFE', fontSize: 15, marginBottom: 8 },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white' },
  textArea: { height: 120, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#0A0E1A', fontWeight: '700' },
});