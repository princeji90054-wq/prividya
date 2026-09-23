import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function MessagesScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function send() {
    if (!text.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('messages').insert({ student_id: user?.id, sender: 'student', message: text.trim() });
    setText('');
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Message Admin', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.sender === 'student' ? styles.myBubble : styles.theirBubble]}>
              <Text style={styles.bubbleText}>{item.message}</Text>
            </View>
          )}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message... (never share OTP/password)"
            placeholderTextColor="#8A8FA3"
            value={text}
            onChangeText={setText}
          />
          <Pressable style={styles.sendBtn} onPress={send}>
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 8 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 14 },
  myBubble: { backgroundColor: '#D4AF37', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#151A2C', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { color: 'white', fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#2A3150' },
  input: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: 'white' },
  sendBtn: { backgroundColor: '#D4AF37', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: '#0A0E1A', fontWeight: '700' },
});