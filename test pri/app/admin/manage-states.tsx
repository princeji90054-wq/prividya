import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ManageStatesScreen() {
  const [states, setStates] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [newStateName, setNewStateName] = useState('');
  const [newDistrictName, setNewDistrictName] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadStates() {
    const { data } = await supabase.from('states').select('*').order('name');
    setStates(data ?? []);
    setLoading(false);
  }

  async function loadDistricts(stateId: string) {
    const { data } = await supabase.from('districts').select('*').eq('state_id', stateId).order('name');
    setDistricts(data ?? []);
  }

  useEffect(() => { loadStates(); }, []);

  async function addState() {
    if (!newStateName.trim()) return;
    const { error } = await supabase.from('states').insert({ name: newStateName.trim() });
    if (error) { Alert.alert('Error', error.message); return; }
    setNewStateName('');
    loadStates();
  }

  async function deleteState(id: string) {
    await supabase.from('states').delete().eq('id', id);
    if (selectedState?.id === id) setSelectedState(null);
    loadStates();
  }

  async function addDistrict() {
    if (!newDistrictName.trim() || !selectedState) return;
    const { error } = await supabase.from('districts').insert({ state_id: selectedState.id, name: newDistrictName.trim() });
    if (error) { Alert.alert('Error', error.message); return; }
    setNewDistrictName('');
    loadDistricts(selectedState.id);
  }

  async function deleteDistrict(id: string) {
    await supabase.from('districts').delete().eq('id', id);
    if (selectedState) loadDistricts(selectedState.id);
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
      <View style={styles.column}>
        <Text style={styles.title}>States</Text>
        <View style={styles.addRow}>
          <TextInput style={styles.input} placeholder="New state name" placeholderTextColor="#8A8FA3" value={newStateName} onChangeText={setNewStateName} />
          <Pressable style={styles.addBtn} onPress={addState}><Text style={styles.addBtnText}>Add</Text></Pressable>
        </View>
        <FlatList
          data={states}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={[styles.row, selectedState?.id === item.id && styles.rowActive]} onPress={() => { setSelectedState(item); loadDistricts(item.id); }}>
              <Text style={styles.rowText}>{item.name}</Text>
              <Pressable onPress={() => deleteState(item.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>
            </Pressable>
          )}
        />
      </View>

      {selectedState && (
        <View style={styles.column}>
          <Text style={styles.title}>Districts in {selectedState.name}</Text>
          <View style={styles.addRow}>
            <TextInput style={styles.input} placeholder="New district name" placeholderTextColor="#8A8FA3" value={newDistrictName} onChangeText={setNewDistrictName} />
            <Pressable style={styles.addBtn} onPress={addDistrict}><Text style={styles.addBtnText}>Add</Text></Pressable>
          </View>
          <FlatList
            data={districts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowText}>{item.name}</Text>
                <Pressable onPress={() => deleteDistrict(item.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A', padding: 16, gap: 20 },
  column: { gap: 10 },
  title: { color: '#D4AF37', fontSize: 17, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white' },
  addBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#0A0E1A', fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12, marginBottom: 6 },
  rowActive: { borderColor: '#D4AF37' },
  rowText: { color: 'white', fontSize: 14 },
  deleteText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
});