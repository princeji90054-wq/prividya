import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getStreak, getTodayMinutes } from '@/lib/studyTracking';
import { supabase } from '@/lib/supabase';

const CATEGORY_ICONS: Record<string, any> = {
  'Civil': 'business',
  'Defence': 'shield',
  'SSC / Bank': 'cash',
  'Railway': 'train',
  'Police': 'shield-checkmark',
  'Teaching': 'school',
};

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('Student');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, photo_url')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) setName(profile.full_name);
        if (profile?.photo_url) setPhotoUrl(profile.photo_url);
      }

      const { data: cats } = await supabase.from('categories').select('*').order('name');
      if (cats) setCategories(cats);

      const minutes = await getTodayMinutes();
      setTodayMinutes(minutes);
      const streakCount = await getStreak();
      setStreak(streakCount);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#8A8FA3" />
            </View>
          )}
          <Text style={styles.greeting}>Hello, {name}</Text>
          <Pressable style={styles.bellButton} onPress={() => router.push('/search' as any)}>
            <Ionicons name="search-outline" size={22} color="white" />
          </Pressable>
          <Pressable style={styles.bellButton} onPress={() => router.push('/notifications' as any)}>
            <Ionicons name="notifications-outline" size={24} color="white" />
          </Pressable>
        </View>

        {/* Study Time Card */}
        <View style={styles.studyCard}>
          <View style={styles.studyCardRow}>
            <Text style={styles.studyCardLabel}>Today's Study Time</Text>
            <Text style={styles.studyCardTime}>{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, (todayMinutes / 180) * 100)}%` }]} />
          </View>
          <Text style={styles.studyCardGoal}>Daily goal: 3 hours</Text>
          {streak > 0 && <Text style={styles.streakText}>🔥 {streak} day streak</Text>}
        </View>

        {/* Focus Study Mode */}
        <Pressable onPress={() => router.push('/focus' as any)}>
          <LinearGradient colors={['#2A3150', '#151A2C']} style={styles.focusCard}>
            <Ionicons name="timer" size={26} color="#D4AF37" />
            <Text style={styles.focusText}>Start Focus Study Session</Text>
          </LinearGradient>
        </Pressable>

        {/* Quick Row (Tests, Practice, Doubts) */}
        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={() => router.push('/tests' as any)}>
            <Ionicons name="document-text" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Tests</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/practice' as any)}>
            <Ionicons name="school" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Practice</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/doubts' as any)}>
            <Ionicons name="help-circle" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Doubts</Text>
          </Pressable>
        </View>

        {/* Quick Row (Analytics, Bookmarks, Mistakes) */}
        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={() => router.push('/analytics' as any)}>
            <Ionicons name="bar-chart" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Analytics</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/bookmarks' as any)}>
            <Ionicons name="bookmark" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Bookmarks</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/mistake-notebook' as any)}>
            <Ionicons name="albums" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Mistakes</Text>
          </Pressable>
        </View>

        {/* Quick Row (Forum, GK) */}
        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={() => router.push('/forum' as any)}>
            <Ionicons name="people-circle" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Forum</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/gk' as any)}>
            <Ionicons name="newspaper" size={22} color="#D4AF37" />
            <Text style={styles.quickCardText}>Current Affairs</Text>
          </Pressable>
        </View>

        {/* Featured Banner */}
        <LinearGradient
          colors={['#1A2036', '#2A3150', '#3C4568']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featuredBanner}>
          <Text style={styles.featuredLabel}>FEATURED BATCH</Text>
          <Text style={styles.featuredTitle}>New batches coming soon</Text>
          <Text style={styles.featuredDesc}>Check back once admin publishes a batch</Text>
        </LinearGradient>

        {/* My Courses quick card */}
        <Pressable onPress={() => router.push('/my-courses' as any)}>
          <LinearGradient colors={['#2A3150', '#151A2C']} style={styles.myCoursesCard}>
            <Ionicons name="school" size={28} color="#D4AF37" />
            <Text style={styles.myCoursesText}>My Courses</Text>
          </LinearGradient>
        </Pressable>

        {/* Categories */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={styles.categoryCardWrapper}
              onPress={() => router.push(`/category/${cat.id}?name=${cat.name}` as any)}>
              <LinearGradient colors={['#2A3150', '#151A2C']} style={styles.categoryCard}>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Ionicons name={CATEGORY_ICONS[cat.name] || 'book'} size={22} color="#D4AF37" />
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        {/* Nexus Pass Card */}
        <Pressable onPress={() => router.push('/(tabs)/nexus' as any)}>
          <LinearGradient
            colors={['#D4AF37', '#B8912C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nexusCard}>
            <Text style={styles.nexusTitle}>Nexus Pass</Text>
            <Text style={styles.nexusDesc}>Unlock access to all batches</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0E1A' },
  loadingContainer: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#151A2C',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A3150',
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#D4AF37' },
  greeting: { color: 'white', fontSize: 18, fontWeight: '600', flex: 1 },
  bellButton: { padding: 4 },
  studyCard: {
    backgroundColor: '#151A2C', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2A3150', gap: 8,
  },
  studyCardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  studyCardLabel: { color: '#8A8FA3', fontSize: 14 },
  studyCardTime: { color: '#D4AF37', fontSize: 16, fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: '#2A3150', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#D4AF37' },
  studyCardGoal: { color: '#8A8FA3', fontSize: 12 },
  streakText: { color: '#D4AF37', fontSize: 12, fontWeight: '700', marginTop: 4 },
  focusCard: {
    borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#2A3150',
  },
  focusText: { color: 'white', fontSize: 15, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 14, padding: 16, alignItems: 'center', gap: 6,
  },
  quickCardText: { color: 'white', fontSize: 11, fontWeight: '600' },
  featuredBanner: {
    borderRadius: 16, padding: 20, gap: 6,
    borderWidth: 1, borderColor: '#3C4568',
  },
  featuredLabel: { color: '#D4AF37', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  featuredTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  featuredDesc: { color: '#8A8FA3', fontSize: 13 },
  myCoursesCard: {
    borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#2A3150',
  },
  myCoursesText: { color: 'white', fontSize: 17, fontWeight: '600' },
  sectionTitle: { color: 'white', fontSize: 17, fontWeight: '700', marginTop: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  categoryCardWrapper: { width: '48%' },
  categoryCard: {
    borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#2A3150', height: 64,
  },
  categoryName: { color: 'white', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  nexusCard: { borderRadius: 16, padding: 20, gap: 4 },
  nexusTitle: { color: '#0A0E1A', fontSize: 18, fontWeight: '700' },
  nexusDesc: { color: '#0A0E1A', fontSize: 13, opacity: 0.8 },
});