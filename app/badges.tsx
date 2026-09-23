import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BADGE_DEFINITIONS, getBadgeStats } from '@/lib/badges';
import { getStreak } from '@/lib/studyTracking';

export default function BadgesScreen() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const badgeStats = await getBadgeStats();
      const streak = await getStreak();
      setStats({ ...badgeStats, streak });
    }
    load();
  }, []);

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Badges', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <FlatList
        data={BADGE_DEFINITIONS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => {
          const achieved = item.check(stats);
          return (
            <View style={[styles.card, !achieved && styles.cardLocked]}>
              <Text style={styles.icon}>{achieved ? item.icon : '🔒'}</Text>
              <Text style={[styles.title, !achieved && styles.titleLocked]}>{item.title}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 12 },
  card: {
    flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#D4AF37',
    borderRadius: 14, padding: 18, alignItems: 'center', gap: 8,
  },
  cardLocked: { borderColor: '#2A3150', opacity: 0.5 },
  icon: { fontSize: 32 },
  title: { color: 'white', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  titleLocked: { color: '#8A8FA3' },
});