import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

interface AdminStaff {
  id: string;
  admin_id: string;
  email: string;
  role: string;
  permissions: {
    batches: boolean;
    payments: boolean;
    coupons: boolean;
    students: boolean;
    content: boolean;
    doubts: boolean;
    messages: boolean;
    broadcast: boolean;
    exports: boolean;
  };
}

export default function AdminStaffManagement() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminStaff[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAdmins(data as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Direct Admin Creation via Database RPC (Auto Verified & Instant Login)
  const handleCreateAdmin = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Kripya email aur password dono daalein.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password kam se kam 6 characters ka hona chahiye.');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_admin_direct', {
        p_email: newEmail.trim().toLowerCase(),
        p_password: newPassword,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (data && data.success === false) {
        Alert.alert('Error', data.message || 'Admin create nahi ho saka.');
        return;
      }

      Alert.alert(
        'Admin Created!',
        `Naya admin account ban gaya hai!\nEmail: ${newEmail}\nAb yeh seedha login kar sakte hain bina kisi dikkat ke.`
      );
      setNewEmail('');
      setNewPassword('');
      fetchAdmins();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  // Toggle Specific Feature Access
  const handleTogglePermission = async (
    admin: AdminStaff,
    key: keyof AdminStaff['permissions']
  ) => {
    const updatedPerms = {
      ...admin.permissions,
      [key]: !admin.permissions[key],
    };

    setAdmins((prev) =>
      prev.map((item) =>
        item.admin_id === admin.admin_id
          ? { ...item, permissions: updatedPerms }
          : item
      )
    );

    try {
      await supabase
        .from('admin_permissions')
        .update({ permissions: updatedPerms })
        .eq('admin_id', admin.admin_id);
    } catch (err) {
      console.error(err);
      fetchAdmins();
    }
  };

  // Remove Admin Completely
  const handleRemoveAdmin = (adminId: string, email: string) => {
    Alert.alert(
      'Remove Admin',
      `Kya aap ${email} ke saare admin rights aur access hatana chahte hain?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('admin_permissions').delete().eq('admin_id', adminId);
              await supabase.from('profiles').update({ role: 'student' }).eq('id', adminId);
              setAdmins((prev) => prev.filter((a) => a.admin_id !== adminId));
              Alert.alert('Success', 'Admin access revoke kar diya gaya hai.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Admin Access & Roles',
          headerStyle: { backgroundColor: '#070B14' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800', fontSize: 17 },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Create Direct Admin Box */}
        <View style={styles.createCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="person-add" size={20} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeading}>Create Admin Directly</Text>
              <Text style={styles.cardSubtitle}>
                Owner dashboard se instant account activate hoga bina email confirm kiye.
              </Text>
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Admin Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. faculty@prividya.in"
              placeholderTextColor="#64748B"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Set Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters password"
              placeholderTextColor="#64748B"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>

          <Pressable
            style={[styles.createBtn, creating && { opacity: 0.7 }]}
            onPress={handleCreateAdmin}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#070B14" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#070B14" />
                <Text style={styles.createBtnText}>Create & Authorize Admin</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Existing Admins List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Admins & Feature Controls</Text>
          <Text style={styles.sectionBadge}>{admins.length} Total</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 24 }} />
        ) : admins.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-outline" size={42} color="#64748B" />
            <Text style={styles.emptyText}>Koi bhi secondary admin active nahi hai.</Text>
          </View>
        ) : (
          admins.map((admin) => (
            <View key={admin.admin_id} style={styles.adminCard}>
              <View style={styles.adminCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminEmail}>{admin.email}</Text>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>VERIFIED ADMIN</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleRemoveAdmin(admin.admin_id, admin.email)}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </Pressable>
              </View>

              <Text style={styles.permTitle}>Owner Feature Permissions (Turn ON/OFF):</Text>

              {/* Comprehensive Permissions Grid */}
              <View style={styles.permList}>
                {[
                  { key: 'batches', label: 'Batches & Courses', icon: 'library-outline' },
                  { key: 'payments', label: 'Payment Approvals & UTR', icon: 'card-outline' },
                  { key: 'coupons', label: 'Coupons & Free Passes', icon: 'pricetag-outline' },
                  { key: 'students', label: 'Student Management & OTP', icon: 'people-outline' },
                  { key: 'content', label: 'Tests, Practice & Notes', icon: 'document-text-outline' },
                  { key: 'doubts', label: 'Student Doubts & Queries', icon: 'help-circle-outline' },
                  { key: 'messages', label: 'Direct Messages / Chat', icon: 'chatbubbles-outline' },
                  { key: 'broadcast', label: 'Send Broadcast Alerts', icon: 'megaphone-outline' },
                  { key: 'exports', label: 'Export Data / CSV', icon: 'download-outline' },
                ].map((item) => (
                  <View key={item.key} style={styles.permRow}>
                    <View style={styles.permLeft}>
                      <Ionicons name={item.icon as any} size={16} color="#38BDF8" />
                      <Text style={styles.permName}>{item.label}</Text>
                    </View>
                    <Switch
                      value={(admin.permissions as any)?.[item.key] ?? false}
                      onValueChange={() =>
                        handleTogglePermission(admin, item.key as any)
                      }
                      trackColor={{ false: '#334155', true: '#10B981' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B14' },
  headerBackBtn: { padding: 6, marginRight: 8 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  createCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cardSubtitle: { color: '#94A3B8', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  inputWrap: { gap: 4, marginTop: 4 },
  inputLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '700' },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    color: '#FFFFFF',
    fontSize: 13,
  },
  createBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    marginTop: 6,
  },
  createBtnText: { color: '#070B14', fontSize: 14, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sectionBadge: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: '#64748B', fontSize: 13 },
  adminCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  adminCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 10,
  },
  adminEmail: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  roleTagText: { color: '#10B981', fontSize: 9.5, fontWeight: '800' },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 7,
    borderRadius: 8,
  },
  permTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  permList: { gap: 6 },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  permLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  permName: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
});