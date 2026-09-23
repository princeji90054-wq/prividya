import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toggleBookmark } from '@/lib/bookmarks';
import { supabase } from '@/lib/supabase';

export default function BookmarksScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookmarks = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setItems([]);
        return;
      }

      const { data: bookmarks, error: bmErr } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (bmErr || !bookmarks) {
        setItems([]);
        return;
      }

      const enriched = await Promise.all(
        bookmarks.map(async (b) => {
          const table =
            b.question_type === 'test' ? 'test_questions' : 'practice_questions';

          // Select all fields so options, correct answer, and images are fully fetched
          const { data: q } = await supabase
            .from(table)
            .select('*')
            .eq('id', b.question_id)
            .maybeSingle();

          return { ...b, question: q };
        })
      );

      // Filter out deleted/orphan questions
      setItems(enriched.filter((item) => !!item.question));
    } catch (e) {
      console.error('Error fetching bookmarks:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookmarks();
    }, [fetchBookmarks])
  );

  async function removeBookmark(item: any) {
    Alert.alert(
      'Remove Bookmark',
      'Kya aap is question ko bookmarks se hatana chahte hain?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await toggleBookmark(item.question_type, item.question_id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          },
        },
      ]
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Bookmarked Questions',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchBookmarks(true)}
            tintColor="#D4AF37"
            colors={['#D4AF37']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={44} color="#8A8FA3" />
            <Text style={styles.emptyText}>No bookmarks yet.</Text>
            <Text style={styles.emptySubtext}>
              Test ya Practice dete time bookmark icon par tap karein.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const q = item.question;
          const correctOpt = String(q.correct_option ?? '').trim().toLowerCase();

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <Text style={styles.typeTag}>{String(item.question_type).toUpperCase()}</Text>
                  <Text style={styles.indexTag}>Q.{index + 1}</Text>
                </View>
                <Pressable
                  onPress={() => removeBookmark(item)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                </Pressable>
              </View>

              {/* Question Text */}
              <Text style={styles.qText} textBreakStrategy="highQuality">
                {q.question_text}
              </Text>

              {/* Question Image if present */}
              {q.question_image_url && (
                <Image
                  source={{ uri: q.question_image_url }}
                  style={styles.qImage}
                  resizeMode="contain"
                />
              )}

              {/* Options A, B, C, D */}
              <View style={styles.optionsList}>
                {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                  const optText = q[`option_${opt}`];
                  if (!optText) return null;
                  const isCorrect = opt === correctOpt;

                  return (
                    <View
                      key={opt}
                      style={[
                        styles.optionRow,
                        isCorrect && styles.correctOptionRow,
                      ]}
                    >
                      <View
                        style={[
                          styles.optionCircle,
                          isCorrect && styles.correctOptionCircle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionLetter,
                            isCorrect && styles.correctOptionLetter,
                          ]}
                        >
                          {opt.toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          isCorrect && styles.correctOptionText,
                        ]}
                      >
                        {optText}
                      </Text>
                      {isCorrect && (
                        <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Solution / Explanation */}
              {q.solution_text && (
                <View style={styles.solutionBox}>
                  <Text style={styles.solutionTitle}>💡 Explanation:</Text>
                  <Text style={styles.solutionText}>{q.solution_text}</Text>
                </View>
              )}

              {/* Solution Image if present */}
              {q.solution_image_url && (
                <Image
                  source={{ uri: q.solution_image_url }}
                  style={styles.qImage}
                  resizeMode="contain"
                />
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  listContent: { padding: 16, gap: 14, paddingBottom: 50 },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 8, paddingHorizontal: 20 },
  emptyText: { color: 'white', fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: '#8A8FA3', fontSize: 13, textAlign: 'center' },
  card: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeTag: {
    backgroundColor: '#2A2410',
    borderColor: '#D4AF37',
    borderWidth: 1,
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  indexTag: { color: '#8A8FA3', fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  qText: { color: 'white', fontSize: 15, fontWeight: '600', lineHeight: 22 },
  qImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#0F1322',
  },
  optionsList: { gap: 8, marginTop: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1A2036',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  correctOptionRow: {
    backgroundColor: '#1B3322',
    borderColor: '#4ADE80',
  },
  optionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#262D47',
    alignItems: 'center',
    justifyContent: 'center',
  },
  correctOptionCircle: {
    backgroundColor: '#4ADE80',
  },
  optionLetter: { color: '#D4AF37', fontWeight: '700', fontSize: 12 },
  correctOptionLetter: { color: '#0A0E1A' },
  optionText: { color: '#E1E4EE', fontSize: 13, flex: 1, lineHeight: 18 },
  correctOptionText: { color: '#FFFFFF', fontWeight: '600' },
  solutionBox: {
    backgroundColor: '#1B2238',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
    marginTop: 4,
  },
  solutionTitle: { color: '#D4AF37', fontSize: 12, fontWeight: '700' },
  solutionText: { color: '#B8C0D8', fontSize: 13, lineHeight: 19 },
});