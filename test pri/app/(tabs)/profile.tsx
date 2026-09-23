import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [coins, setCoins] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, coins, photo_url')
          .eq('id', user.id)
          .single();
        if (profile) {
          setFullName(profile.full_name);
          setCoins(profile.coins ?? 0);
          setPhotoUrl(profile.photo_url);
        }
        setReferralCode(user.id.substring(0, 8).toUpperCase());
      }
      setLoading(false);
    }
    load();
  }, []);

  function shareReferral() {
    Share.share({ message: `Join PriVidya with my referral code ${referralCode} and get 2 days free access to a batch!` });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{fullName}</Text>
          <Pressable onPress={() => router.push('/edit-profile' as any)}>
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{coins}</Text>
            <Text style={styles.statLabel}>Coins</Text>
          </View>
          <Pressable style={styles.statCard} onPress={shareReferral}>
            <Text style={styles.statValue}>{referralCode}</Text>
            <Text style={styles.statLabel}>Referral Code (tap to share)</Text>
          </Pressable>
        </View>

        <View style={styles.menuSection}>
          <Pressable style={styles.menuRow} onPress={() => router.push('/my-courses' as any)}>
            <Ionicons name="school-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>My Courses</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/invoices' as any)}>
            <Ionicons name="receipt-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>Invoices</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/notifications' as any)}>
            <Ionicons name="notifications-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/doubts' as any)}>
            <Ionicons name="help-circle-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>My Doubts</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/messages' as any)}>
            <Ionicons name="chatbubble-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>Message Admin</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/leaderboard' as any)}>
            <Ionicons name="trophy-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>Leaderboard</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/badges' as any)}>
            <Ionicons name="ribbon-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>Badges</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/referral-status' as any)}>
            <Ionicons name="people-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>My Referrals</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/coin-history' as any)}>
            <Ionicons name="cash-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>Coin History</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/support' as any)}>
            <Ionicons name="chatbubbles-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push('/about' as any)}>
            <Ionicons name="information-circle-outline" size={20} color="#D4AF37" />
            <Text style={styles.menuText}>About & Terms</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8FA3" />
          </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 20, alignItems: 'center' },
  profileCard: { alignItems: 'center', gap: 8, marginTop: 20 },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#151A2C',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#D4AF37',
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#D4AF37' },
  avatarText: { color: '#D4AF37', fontSize: 32, fontWeight: '700' },
  name: { color: 'white', fontSize: 20, fontWeight: '600' },
  editText: { color: '#3C9FFE', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  statCard: {
    flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 14, padding: 16, alignItems: 'center', gap: 4,
  },
  statValue: { color: '#D4AF37', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#8A8FA3', fontSize: 11, textAlign: 'center' },
  menuSection: { width: '100%', gap: 10 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14,
  },
  menuText: { color: 'white', fontSize: 14, fontWeight: '600', flex: 1 },
  logoutButton: { backgroundColor: '#2A3150', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 10 },
  logoutText: { color: '#FF6B6B', fontWeight: '600' },
});