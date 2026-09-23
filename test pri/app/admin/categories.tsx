import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newName, setNewName] = useState('');

  async function load() {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addCategory() {
    if (!newName.trim()) return;
    const { error } = await supabase.from('categories').insert({ name: newName.trim() });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewName('');
      load();
    }
  }

  async function deleteCategory(id: string) {
    Alert.alert('Delete category', 'Batches in this category will keep working but lose their category label. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="New category name"
          placeholderTextColor="#8A8FA3"
          value={newName}
          onChangeText={setNewName}
        />
        <Pressable style={styles.addButton} onPress={addCategory}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowText}>{item.name}</Text>
            <Pressable onPress={() => deleteCategory(item.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16 },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  input: {
    flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 10, paddingHorizontal: 14, color: 'white',
  },
  addButton: { backgroundColor: '#D4AF37', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  addButtonText: { color: '#0A0E1A', fontWeight: '700' },
  listContent: { gap: 10 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14,
  },
  rowText: { color: 'white', fontSize: 15 },
  deleteText: { color: '#FF6B6B', fontWeight: '600' },
});