import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ForumPostScreen() {
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  async function load() {
    const { data: postData } = await supabase.from('forum_posts').select('*, profiles(forum_nickname)').eq('id', id).single();
    setPost(postData);
    const { data: commentData } = await supabase.from('forum_comments').select('*, profiles(forum_nickname)').eq('post_id', id).order('created_at', { ascending: true });
    setComments(commentData ?? []);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(profile?.role === 'admin' || profile?.role === 'owner');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function sendComment() {
    if (!text.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('forum_comments').insert({ post_id: id, student_id: user?.id, body: text.trim() });
    setText('');
    load();
  }

  async function deleteComment(commentId: string) {
    await supabase.from('forum_comments').delete().eq('id', commentId);
    load();
  }

  async function deletePost() {
    await supabase.from('forum_posts').delete().eq('id', id);
  }

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Post', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.postCard}>
            <Text style={styles.nickname}>{post.profiles?.forum_nickname}</Text>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postBody}>{post.body}</Text>
            {isAdmin && <Pressable onPress={deletePost}><Text style={styles.deleteText}>Delete Post</Text></Pressable>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.commentCard}>
            <Text style={styles.nickname}>{item.profiles?.forum_nickname}</Text>
            <Text style={styles.commentBody}>{item.body}</Text>
            {isAdmin && <Pressable onPress={() => deleteComment(item.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>}
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Add a comment..." placeholderTextColor="#8A8FA3" value={text} onChangeText={setText} />
        <Pressable style={styles.sendBtn} onPress={sendComment}><Text style={styles.sendBtnText}>Send</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10 },
  postCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 12, padding: 14, gap: 6, marginBottom: 10 },
  nickname: { color: '#D4AF37', fontSize: 11, fontWeight: '700' },
  postTitle: { color: 'white', fontSize: 17, fontWeight: '700' },
  postBody: { color: '#B8C0D8', fontSize: 14 },
  commentCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12, gap: 4 },
  commentBody: { color: 'white', fontSize: 13 },
  deleteText: { color: '#FF6B6B', fontSize: 11, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#2A3150' },
  input: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: 'white' },
  sendBtn: { backgroundColor: '#D4AF37', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnText: { color: '#0A0E1A', fontWeight: '700' },
});