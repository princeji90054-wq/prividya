import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function DoubtsFeedScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [doubts, setDoubts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadDoubts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // 1. Logged in user fetch karein
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id ?? null;
      setCurrentUserId(uid);

      console.log('Current User ID:', uid);

      // 2. Fetch doubts with fallback support
      const { data, error } = await supabase
        .from('doubts')
        .select(`
          *,
          profiles:student_id (full_name),
          doubt_solutions (id)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching doubts join:', error.message);
        const fallback = await supabase
          .from('doubts')
          .select('*')
          .order('created_at', { ascending: false });
        setDoubts(fallback.data ?? []);
      } else {
        setDoubts(data ?? []);
      }
    } catch (err) {
      console.error('Unexpected error loading doubts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDoubts();
    }, [loadDoubts])
  );

  // Tab ke hisab se display list filter
  const displayedDoubts = doubts.filter((item) => {
    if (tab === 'all') return true;
    if (tab === 'mine') {
      // Sirf wahi item dikhe jiska student_id logged-in user id se match kare
      return !!currentUserId && item.student_id === currentUserId;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Doubts',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
            ALL DOUBTS
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'mine' && styles.tabActive]}
          onPress={() => setTab('mine')}
        >
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            MY DOUBTS
          </Text>
        </Pressable>
      </View>

      {/* Doubts List */}
      {loading && !refreshing ? (
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayedDoubts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadDoubts(true)}
              tintColor="#D4AF37"
              colors={['#D4AF37']}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {tab === 'mine'
                ? 'You have not asked any doubts yet.'
                : 'No doubts posted yet.'}
            </Text>
          }
          renderItem={({ item }) => {
            const isMyDoubt = !!currentUserId && item.student_id === currentUserId;
            const askerName =
              item.profiles?.full_name || (isMyDoubt ? 'You' : 'Student');
            const solutionCount = item.doubt_solutions?.length ?? 0;
            const isSolved = item.status === 'solved';

            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/doubts/${item.id}` as any)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.asker}>
                    {askerName} {isMyDoubt && tab === 'all' ? '(You)' : ''}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isSolved ? styles.solvedBadge : styles.openBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {isSolved ? 'SOLVED' : 'OPEN'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.question} numberOfLines={2}>
                  {item.question_text || '📷 Image doubt'}
                </Text>

                <View style={styles.cardBottom}>
                  <View style={styles.coinRow}>
                    <Ionicons name="logo-bitcoin" size={14} color="#D4AF37" />
                    <Text style={styles.coinText}>{item.coin_amount ?? 0} coins</Text>
                  </View>
                  <Text style={styles.solutionCount}>
                    {solutionCount} answer{solutionCount === 1 ? '' : 's'} submitted
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Ask Doubt FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/doubts/ask' as any)}
      >
        <Ionicons name="add" size={28} color="#0A0E1A" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  tabRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  tab: {
    flex: 1,
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  tabText: { color: '#8A8FA3', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#0A0E1A' },
  listContent: { padding: 16, paddingTop: 8, gap: 12, paddingBottom: 90 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  asker: { color: '#B8C0D8', fontSize: 12, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  openBadge: { backgroundColor: '#3A3320' },
  solvedBadge: { backgroundColor: '#203A20' },
  statusText: { fontSize: 10, fontWeight: '700', color: 'white' },
  question: { color: 'white', fontSize: 15, fontWeight: '600', lineHeight: 20 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coinText: { color: '#D4AF37', fontSize: 12, fontWeight: '700' },
  solutionCount: { color: '#8A8FA3', fontSize: 11 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});