import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminGkPostsScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('gk_posts').select('*').order('created_at', { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addPost() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing info', 'Title and content required.');
      return;
    }
    const { error } = await supabase.from('gk_posts').insert({ title: title.trim(), body: body.trim() });
    if (error) { Alert.alert('Error', error.message); return; }
    setTitle(''); setBody('');
    load();
  }

  async function deletePost(id: string) {
    await supabase.from('gk_posts').delete().eq('id', id);
    load();
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
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New GK Post</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#8A8FA3" value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Content" placeholderTextColor="#8A8FA3" value={body} onChangeText={setBody} multiline />
            <Pressable style={styles.addBtn} onPress={addPost}><Text style={styles.addBtnText}>Post</Text></Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postBody} numberOfLines={2}>{item.body}</Text>
            <Pressable onPress={() => deletePost(item.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  formCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 8, marginBottom: 10 },
  formTitle: { color: '#D4AF37', fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: '#1A2036', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white' },
  textArea: { height: 80, textAlignVertical: 'top' },
  addBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#0A0E1A', fontWeight: '700' },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  postTitle: { color: 'white', fontWeight: '700', fontSize: 14 },
  postBody: { color: '#B8C0D8', fontSize: 12 },
  deleteText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
});