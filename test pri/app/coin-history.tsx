import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function CoinHistoryScreen() {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      // 1. Session / User ID safely resolve karein
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;

      if (!uid) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);
      } else {
        setCurrentUserId(uid);
      }

      const activeUid = uid;
      console.log('Fetching coin history for UID:', activeUid);

      if (!activeUid) {
        setTxns([]);
        return;
      }

      // 2. Query coin transactions
      const { data, error } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('student_id', activeUid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Coin history fetch error:', error.message);
        setErrorMessage(error.message);
      } else {
        console.log('Fetched transactions count:', data?.length ?? 0);
        setTxns(data ?? []);
      }
    } catch (err: any) {
      console.error('Unexpected error loading coin history:', err);
      setErrorMessage(err?.message || 'Error loading history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Coin History',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      {loading && !refreshing ? (
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHistory(true)}
              tintColor="#D4AF37"
              colors={['#D4AF37']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No coin activity yet.</Text>
              {errorMessage && (
                <Text style={styles.errorText}>Error: {errorMessage}</Text>
              )}
              {currentUserId && (
                <Text style={styles.uidDebugText}>
                  Logged in UID: {currentUserId}
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const numAmount = Number(item.amount);
            const isNegative = numAmount < 0;
            const formattedDate = item.created_at
              ? new Date(item.created_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <View style={styles.row}>
                <View style={styles.details}>
                  <Text style={styles.reason}>{item.reason ?? 'Coin adjustment'}</Text>
                  {formattedDate ? (
                    <Text style={styles.date}>{formattedDate}</Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.amount,
                    isNegative ? styles.negative : styles.positive,
                  ]}
                >
                  {isNegative ? '' : '+'}
                  {numAmount}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  emptyContainer: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
  emptyText: { color: '#8A8FA3', textAlign: 'center', fontSize: 14 },
  errorText: { color: '#FF6B6B', textAlign: 'center', marginTop: 8, fontSize: 12 },
  uidDebugText: { color: '#4A526E', textAlign: 'center', marginTop: 12, fontSize: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    padding: 14,
  },
  details: { flex: 1, marginRight: 12 },
  reason: { color: 'white', fontSize: 14, fontWeight: '600' },
  date: { color: '#8A8FA3', fontSize: 11, marginTop: 4 },
  amount: { fontWeight: '700', fontSize: 16 },
  positive: { color: '#4ADE80' },
  negative: { color: '#FF6B6B' },
});