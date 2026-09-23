import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ChatModerationScreen() {
  const [tab, setTab] = useState<'words' | 'log'>('words');
  const [words, setWords] = useState<any[]>([]);
  const [newWord, setNewWord] = useState('');
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: w } = await supabase.from('chat_flagged_words').select('*').order('word');
    setWords(w ?? []);
    const { data: l } = await supabase
      .from('chat_moderation_log').select('*, profiles(full_name), classes(title)').order('created_at', { ascending: false }).limit(100);
    setLog(l ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addWord() {
    if (!newWord.trim()) return;
    const { error } = await supabase.from('chat_flagged_words').insert({ word: newWord.trim().toLowerCase() });
    if (error) { Alert.alert('Error', error.message); return; }
    setNewWord('');
    load();
  }

  async function removeWord(id: string) {
    await supabase.from('chat_flagged_words').delete().eq('id', id);
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
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'words' && styles.tabActive]} onPress={() => setTab('words')}>
          <Text style={styles.tabText}>Flagged Words</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'log' && styles.tabActive]} onPress={() => setTab('log')}>
          <Text style={styles.tabText}>Blocked Attempts</Text>
        </Pressable>
      </View>

      {tab === 'words' ? (
        <FlatList
          data={words}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.addRow}>
              <TextInput style={styles.input} placeholder="Add a word to block" placeholderTextColor="#8A8FA3" value={newWord} onChangeText={setNewWord} autoCapitalize="none" />
              <Pressable style={styles.addBtn} onPress={addWord}><Text style={styles.addBtnText}>Add</Text></Pressable>
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No words added yet. Live chat has no auto-moderation until you add some.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowText}>{item.word}</Text>
              <Pressable onPress={() => removeWord(item.id)}><Text style={styles.deleteText}>Remove</Text></Pressable>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={log}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No blocked messages yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name}</Text>
              <Text style={styles.meta}>In: {item.classes?.title ?? 'Unknown class'}</Text>
              <Text style={styles.meta}>Matched word: "{item.matched_word}"</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  tabRow: { flexDirection: 'row', gap: 8, padding: 16 },
  tab: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  tabText: { color: 'white', fontSize: 12, fontWeight: '700' },
  listContent: { padding: 16, paddingTop: 0, gap: 8 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white' },
  addBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#0A0E1A', fontWeight: '700' },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12 },
  rowText: { color: 'white', fontSize: 14 },
  deleteText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  name: { color: 'white', fontWeight: '700', fontSize: 13 },
  meta: { color: '#8A8FA3', fontSize: 12 },
  date: { color: '#8A8FA3', fontSize: 10 },
});