import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2;

export const ALL_MENU_ITEMS = [
  // Core Security & Admin Management
  { title: 'Admin Staff', desc: 'Add/remove admins & permissions', icon: 'person-add', route: '/admin/admins', category: 'Security' },
  { title: 'Overview', desc: 'Realtime analytics & charts', icon: 'stats-chart', route: '/admin/overview', category: 'Reports' },

  // Course & Batches
  { title: 'Create Batch', desc: 'Launch new subject batches', icon: 'add-circle', route: '/admin/create-batch', category: 'Courses' },
  { title: 'Manage Batches', desc: 'Edit curriculum & timings', icon: 'library', route: '/admin/batches', category: 'Courses' },
  { title: 'Batch Categories', desc: 'Categorize streams & exams', icon: 'grid', route: '/admin/categories', category: 'Courses' },
  { title: 'Restrictions', desc: 'Device limits & access caps', icon: 'lock-closed', route: '/admin/batch-restrictions', category: 'Courses' },

  // Billing & Finance
  { title: 'Payments & UTR', desc: 'Verify 12-digit UTR proofs', icon: 'card', route: '/admin/payments', category: 'Billing' },
  { title: 'Verify Invoice QR', desc: 'Scan & authenticate bills', icon: 'qr-code-outline', route: '/admin/verify-invoice', category: 'Billing' },
  { title: 'Coupons & Passes', desc: 'Create discounts & free pass', icon: 'pricetag', route: '/admin/coupons', category: 'Billing' },
  { title: 'Nexus Requests', desc: 'All-access student passes', icon: 'star', route: '/admin/nexus', category: 'Nexus' },
  { title: 'Nexus Settings', desc: 'Configure pricing & spans', icon: 'star-outline', route: '/admin/nexus-settings', category: 'Nexus' },

  // Students & Security
  { title: 'Manage Students', desc: 'Search, block or view profile', icon: 'people', route: '/admin/students', category: 'Users' },
  { title: 'Verify Users OTP', desc: 'Approve pending OTP requests', icon: 'shield-checkmark', route: '/admin/verify-users', category: 'Users' },

  // Academic Content
  { title: 'Manage Tests', desc: 'Online tests & marksheets', icon: 'document-text', route: '/admin/manage-tests', category: 'Academics' },
  { title: 'Practice Qs', desc: 'MCQ bank & solutions', icon: 'school', route: '/admin/practice-questions', category: 'Academics' },
  { title: 'Shared Notes', desc: 'PDFs & revision formulas', icon: 'document-attach', route: '/admin/shared-notes', category: 'Academics' },
  { title: 'GK & Updates', desc: 'Current affairs updates', icon: 'newspaper', route: '/admin/gk-posts', category: 'Academics' },
  { title: 'Exam Calendar', desc: 'Upcoming competitive dates', icon: 'calendar', route: '/admin/exam-calendar', category: 'Academics' },

  // Student Support
  { title: 'Student Doubts', desc: 'Answer academic queries', icon: 'help-circle', route: '/admin/doubts', category: 'Support' },
  { title: 'Direct Messages', desc: '1-on-1 admin student chat', icon: 'chatbubbles', route: '/admin/messages', category: 'Support' },
  { title: 'Other Requests', desc: 'Refunds & course transfers', icon: 'receipt', route: '/admin/requests', category: 'Support' },

  // Communication & Moderation
  { title: 'Broadcast Alerts', desc: 'Send popups to all devices', icon: 'megaphone', route: '/admin/broadcast', category: 'Alerts' },
  { title: 'Notifications', desc: 'Push notification queue', icon: 'notifications', route: '/admin/notifications', category: 'Alerts' },
  { title: 'Chat Moderation', desc: 'Filter spam & bad language', icon: 'shield', route: '/admin/chat-moderation', category: 'Community' },
  { title: 'Video Comments', desc: 'Review doubts on lectures', icon: 'chatbox-ellipses', route: '/admin/video-comments', category: 'Community' },

  // Settings & System
  { title: 'Brand & Seal', desc: 'Logo, seal & signature setup', icon: 'settings', route: '/admin/settings', category: 'System' },
  { title: 'States & Districts', desc: 'Regional pin code filters', icon: 'map', route: '/admin/manage-states', category: 'System' },
  { title: 'Export Data', desc: 'Excel/CSV records export', icon: 'download', route: '/admin/export-data', category: 'System' },
  { title: 'System Logs', desc: 'Supabase & API error tracking', icon: 'bug', route: '/admin/error-logs', category: 'System' },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Kya aap Owner portal se log out karna chahte hain?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/(auth)/login' as any);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Logout nahi ho paya.');
            }
          },
        },
      ]
    );
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return ALL_MENU_ITEMS;
    return ALL_MENU_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Owner Control Center',
          headerStyle: { backgroundColor: '#070B14' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800', fontSize: 17 },
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/' as any);
              }}
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerRightWrap}>
              <Pressable
                onPress={() => router.push('/admin/admins' as any)}
                style={({ pressed }) => [styles.headerStaffBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="person-circle" size={20} color="#38BDF8" />
                <Text style={styles.headerStaffText}>Staff</Text>
              </Pressable>

              {/* Header Direct Logout Button */}
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [styles.headerLogoutBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Card */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View style={styles.authBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#10B981" />
              <Text style={styles.authBadgeText}>OWNER ROOT ACTIVE</Text>
            </View>
            <Text style={styles.moduleCount}>{filteredItems.length} TOOLS READY</Text>
          </View>
          <Text style={styles.headerTitle}>PriVidya Master Control</Text>
          <Text style={styles.headerSub}>
            Platform security, admins, batches, aur billing ek jagah se control karein.
          </Text>

          {/* Instant Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tool or setting..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* 2-by-2 Card Grid */}
        <View style={styles.grid}>
          {filteredItems.map((item, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.card,
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.88 },
              ]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name={item.icon as any} size={22} color="#38BDF8" />
                </View>
                <Text style={styles.categoryBadge}>{item.category}</Text>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.desc}</Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.openBtnText}>Open Tool</Text>
                <Ionicons name="chevron-forward" size={14} color="#38BDF8" />
              </View>
            </Pressable>
          ))}
        </View>

        {/* Bottom Full-Width Sign Out Card */}
        <Pressable
          style={({ pressed }) => [styles.logoutCard, pressed && { opacity: 0.85 }]}
          onPress={handleLogout}
        >
          <View style={styles.logoutIconBox}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </View>
          <View style={styles.logoutTextWrap}>
            <Text style={styles.logoutTitle}>Sign Out from Owner Portal</Text>
            <Text style={styles.logoutSub}>Admin session terminate karke login screen par jayein</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#EF4444" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B14' },
  headerBtn: { padding: 6, marginRight: 8 },
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  headerStaffText: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
  headerLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  headerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  authBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '800' },
  moduleCount: { color: '#64748B', fontSize: 10.5, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#94A3B8', fontSize: 12, lineHeight: 17 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginTop: 4,
    gap: 8,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 13 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 145,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardContent: { marginVertical: 6, gap: 2 },
  cardTitle: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  cardDesc: { color: '#8A8FA3', fontSize: 11, lineHeight: 15 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 6,
  },
  openBtnText: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  logoutCard: {
    backgroundColor: '#16131E',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  logoutIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTextWrap: { flex: 1, gap: 2 },
  logoutTitle: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  logoutSub: { color: '#94A3B8', fontSize: 11 },
});