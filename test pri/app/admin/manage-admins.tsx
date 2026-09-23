import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PERMISSION_MODULES, PermissionMap } from '@/lib/adminPermissions';
import { supabase } from '@/lib/supabase';

export default function ManageAdminsScreen() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

  async function loadAdmins() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_blocked, admin_permissions(permissions)')
      .eq('role', 'admin')
      .order('full_name');
    setAdmins(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAdmins(); }, []);

  async function resetAdminDevice(adminId: string) {
    const { data, error } = await supabase.functions.invoke('admin-reset-device', {
      body: { studentId: adminId },
    });
    if (error || data?.error) {
      Alert.alert('Reset failed', data?.error || error?.message || 'Unknown error');
      return;
    }
    Alert.alert('Done', 'This admin can now log in from a new device.');
  }

  async function toggleAdminBlock(admin: any) {
    const newState = !admin.is_blocked;
    const { error } = await supabase.from('profiles').update({ is_blocked: newState }).eq('id', admin.id);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Done', newState ? 'Admin blocked.' : 'Admin unblocked.');
    loadAdmins();
  }

  function openEdit(admin: any) {
    setSelectedAdmin(admin);
    setEditModalVisible(true);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Admins</Text>
        <Pressable style={styles.addBtn} onPress={() => setCreateModalVisible(true)}>
          <Ionicons name="add" size={20} color="#0A0E1A" />
          <Text style={styles.addBtnText}>New Admin</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={admins}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No admins yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              {item.is_blocked && <Text style={styles.blockedTag}>BLOCKED</Text>}
              <View style={styles.actionRow}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(item)}>
                  <Text style={styles.actionText}>Edit Permissions</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => resetAdminDevice(item.id)}>
                  <Text style={styles.actionText}>Reset Device</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, item.is_blocked ? styles.unblockBtn : styles.blockBtn]} onPress={() => toggleAdminBlock(item)}>
                  <Text style={styles.actionText}>{item.is_blocked ? 'Unblock' : 'Block'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <CreateAdminModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={() => { setCreateModalVisible(false); loadAdmins(); }}
      />

      <EditPermissionsModal
        visible={editModalVisible}
        admin={selectedAdmin}
        onClose={() => setEditModalVisible(false)}
        onSaved={() => { setEditModalVisible(false); loadAdmins(); }}
      />
    </SafeAreaView>
  );
}

function CreateAdminModal({ visible, onClose, onCreated }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [saving, setSaving] = useState(false);

  function togglePermission(moduleKey: string, action: string) {
    setPermissions((prev) => {
      const current = prev[moduleKey] ?? [];
      const has = current.includes(action);
      return {
        ...prev,
        [moduleKey]: has ? current.filter((a) => a !== action) : [...current, action],
      };
    });
  }

  async function create() {
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      Alert.alert('Missing info', 'Name, email, and an 8+ character password are required.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke('owner-create-admin', {
      body: { email: email.trim(), password, fullName: fullName.trim(), permissions },
    });
    setSaving(false);

    if (error || data?.error) {
      Alert.alert('Failed', data?.error || error?.message || 'Unknown error');
      return;
    }

    Alert.alert('Done', 'New admin created.');
    setFullName(''); setEmail(''); setPassword(''); setPermissions({});
    onCreated();
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Pressable onPress={onClose}><Text style={styles.closeText}>Close</Text></Pressable>
          <Text style={styles.modalTitle}>Create New Admin</Text>

          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#8A8FA3" value={fullName} onChangeText={setFullName} />
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8A8FA3" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Password (min 8 chars)" placeholderTextColor="#8A8FA3" value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.sectionTitle}>Permissions</Text>
          {PERMISSION_MODULES.map((mod) => (
            <View key={mod.key} style={styles.moduleCard}>
              <Text style={styles.moduleLabel}>{mod.label}</Text>
              {mod.actions.map((action) => (
                <View key={action} style={styles.permRow}>
                  <Text style={styles.permLabel}>{action}</Text>
                  <Switch
                    value={permissions[mod.key]?.includes(action) ?? false}
                    onValueChange={() => togglePermission(mod.key, action)}
                  />
                </View>
              ))}
            </View>
          ))}

          <Pressable style={styles.saveBtn} onPress={create} disabled={saving}>
            {saving ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.saveBtnText}>Create Admin</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function EditPermissionsModal({ visible, admin, onClose, onSaved }: any) {
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (admin) {
      setPermissions(admin.admin_permissions?.[0]?.permissions ?? {});
    }
  }, [admin]);

  function togglePermission(moduleKey: string, action: string) {
    setPermissions((prev) => {
      const current = prev[moduleKey] ?? [];
      const has = current.includes(action);
      return {
        ...prev,
        [moduleKey]: has ? current.filter((a) => a !== action) : [...current, action],
      };
    });
  }

  async function save() {
    if (!admin?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('admin_permissions')
      .upsert({ admin_id: admin.id, permissions, updated_at: new Date().toISOString() }, { onConflict: 'admin_id' });
    setSaving(false);

    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Saved', 'Permissions updated.');
    onSaved();
  }

  if (!admin) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Pressable onPress={onClose}><Text style={styles.closeText}>Close</Text></Pressable>
          <Text style={styles.modalTitle}>Edit Permissions — {admin.full_name}</Text>

          {PERMISSION_MODULES.map((mod) => (
            <View key={mod.key} style={styles.moduleCard}>
              <Text style={styles.moduleLabel}>{mod.label}</Text>
              {mod.actions.map((action) => (
                <View key={action} style={styles.permRow}>
                  <Text style={styles.permLabel}>{action}</Text>
                  <Switch
                    value={permissions[mod.key]?.includes(action) ?? false}
                    onValueChange={() => togglePermission(mod.key, action)}
                  />
                </View>
              ))}
            </View>
          ))}

          <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.saveBtnText}>Save Permissions</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: '#D4AF37', fontSize: 20, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D4AF37', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 12 },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, gap: 4 },
  name: { color: 'white', fontWeight: '700', fontSize: 15 },
  email: { color: '#8A8FA3', fontSize: 12 },
  blockedTag: { color: '#FF6B6B', fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: '#2A3150', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  blockBtn: { backgroundColor: '#3A2020' },
  unblockBtn: { backgroundColor: '#203A20' },
  actionText: { color: 'white', fontSize: 11, fontWeight: '600' },
  modalContent: { padding: 20, gap: 10 },
  closeText: { color: '#3C9FFE', fontSize: 15, marginBottom: 8 },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 15 },
  sectionTitle: { color: '#D4AF37', fontSize: 15, fontWeight: '700', marginTop: 10 },
  moduleCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12, gap: 6 },
  moduleLabel: { color: '#D4AF37', fontSize: 13, fontWeight: '700' },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  permLabel: { color: '#B8C0D8', fontSize: 13, textTransform: 'capitalize' },
  saveBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
});