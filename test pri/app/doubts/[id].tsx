import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pickOrCaptureImage } from '@/lib/pickImage';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function DoubtDetailScreen() {
  const { id } = useLocalSearchParams();
  const [doubt, setDoubt] = useState<any>(null);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [solutionText, setSolutionText] = useState('');
  const [solutionImage, setSolutionImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Full Screen Preview Modal State
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setMyId(user?.id ?? null);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        setIsAdmin(profile?.role === 'admin' || profile?.role === 'owner');
      }

      let currentDoubt: any = null;
      const { data: doubtData, error: doubtErr } = await supabase
        .from('doubts')
        .select('*, profiles:student_id(full_name)')
        .eq('id', id)
        .maybeSingle();

      if (doubtErr || !doubtData) {
        const { data: rawDoubt } = await supabase
          .from('doubts')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        currentDoubt = rawDoubt;
      } else {
        currentDoubt = doubtData;
      }

      setDoubt(currentDoubt);

      const { data: solutionData, error: solErr } = await supabase
        .from('doubt_solutions')
        .select('*, profiles:solver_id(full_name, role)')
        .eq('doubt_id', id)
        .order('created_at', { ascending: true });

      if (solErr || !solutionData) {
        const { data: rawSolutions } = await supabase
          .from('doubt_solutions')
          .select('*')
          .eq('doubt_id', id)
          .order('created_at', { ascending: true });
        setSolutions(rawSolutions ?? []);
      } else {
        setSolutions(solutionData ?? []);
      }
    } catch (e) {
      console.error('Error fetching doubt detail:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function submitSolution() {
    if (!solutionText.trim() && !solutionImage) {
      Alert.alert('Missing info', 'Kripya solution text likhein ya photo attach karein.');
      return;
    }
    setSubmitting(true);

    try {
      let imageUrl = null;
      if (solutionImage) {
        imageUrl = await uploadImage(solutionImage, 'doubt-images', `solution-${Date.now()}`);
      }

      const { error } = await supabase.from('doubt_solutions').insert({
        doubt_id: id,
        solver_id: myId,
        solution_text: solutionText.trim() || null,
        solution_image_url: imageUrl,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      setSolutionText('');
      setSolutionImage(null);
      Alert.alert('Success', 'Aapka solution submit ho gaya hai.');
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Solution submit nahi ho saka.');
    } finally {
      setSubmitting(false);
    }
  }

  async function markCorrect(solutionId: string) {
    Alert.alert(
      'Confirm Transfer',
      'Kya aap ise correct solution mark karna chahte hain? Coins turant solver ko transfer ho jayenge.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const { error } = await supabase.rpc('resolve_doubt', {
              p_doubt_id: id,
              p_solution_id: solutionId,
            });

            if (error) {
              Alert.alert('Database Error', error.message);
              return;
            }

            Alert.alert('Success', 'Coins transfer ho gaye aur doubt SOLVED mark ho gaya.');
            load();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!doubt) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Doubt',
            headerShown: true,
            headerStyle: { backgroundColor: '#0A0E1A' },
            headerTintColor: 'white',
          }}
        />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Doubt load nahi ho saka ya delete ho chuka hai.</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isAsker = myId === doubt.student_id;
  const isSolved = doubt.status === 'solved';
  const myOwnSolution = solutions.find((s) => s.solver_id === myId);

  const visibleSolutions =
    isAsker || isAdmin || isSolved
      ? solutions
      : solutions.filter((s) => s.solver_id === myId);

  const canSubmitSolution = !isSolved && !isAsker && !myOwnSolution;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Doubt',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Question Card */}
        <View style={styles.questionCard}>
          <View style={styles.cardTop}>
            <Text style={styles.asker}>
              {doubt.profiles?.full_name ?? (isAsker ? 'You' : 'Student')}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isSolved ? styles.solvedBadge : styles.openBadge,
              ]}
            >
              <Text style={styles.statusText}>{isSolved ? 'SOLVED' : 'OPEN'}</Text>
            </View>
          </View>
          {doubt.question_text && (
            <Text style={styles.questionText}>{doubt.question_text}</Text>
          )}
          {doubt.question_image_url && (
            <Pressable onPress={() => setPreviewImageUrl(doubt.question_image_url)}>
              <Image
                source={{ uri: doubt.question_image_url }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <Text style={styles.tapToViewText}>🔍 Tap to view full image</Text>
            </Pressable>
          )}
          <View style={styles.coinRow}>
            <Ionicons name="logo-bitcoin" size={16} color="#D4AF37" />
            <Text style={styles.coinText}>{doubt.coin_amount ?? 0} coins reward</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {isAsker || isAdmin || isSolved
            ? `Solutions (${visibleSolutions.length})`
            : 'Your Answer'}
        </Text>

        {!isAsker && !isAdmin && !isSolved && solutions.length > 0 && (
          <Text style={styles.hiddenNote}>
            {solutions.length} answer(s) submitted by others — hidden until the asker marks one correct.
          </Text>
        )}

        {/* Solutions List */}
        {visibleSolutions.map((s) => (
          <View
            key={s.id}
            style={[
              styles.solutionCard,
              doubt.winning_solution_id === s.id && styles.winningCard,
            ]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.solverName}>
                {s.profiles?.full_name ?? (s.solver_id === myId ? 'You' : 'User')}{' '}
                {s.profiles?.role !== 'student' && s.profiles?.role ? '(Admin)' : ''}
              </Text>
              {doubt.winning_solution_id === s.id && (
                <Text style={styles.winningTag}>✓ CORRECT</Text>
              )}
            </View>

            {s.solution_text && (
              <Text style={styles.solutionText} textBreakStrategy="highQuality">
                {s.solution_text}
              </Text>
            )}

            {s.solution_image_url && (
              <Pressable
                style={styles.solutionImageWrapper}
                onPress={() => setPreviewImageUrl(s.solution_image_url)}
              >
                <Image
                  source={{ uri: s.solution_image_url }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <Text style={styles.tapToViewText}>🔍 Tap to view full image</Text>
              </Pressable>
            )}

            {isAsker && !isSolved && (
              <Pressable
                style={styles.markCorrectBtn}
                onPress={() => markCorrect(s.id)}
              >
                <Text style={styles.markCorrectText}>Mark as Correct</Text>
              </Pressable>
            )}
          </View>
        ))}

        {/* Submit Form */}
        {canSubmitSolution && (
          <View style={styles.answerForm}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Type your solution..."
              placeholderTextColor="#8A8FA3"
              value={solutionText}
              onChangeText={setSolutionText}
              multiline
            />
            <Pressable
              style={styles.imagePicker}
              onPress={() => pickOrCaptureImage(setSolutionImage)}
            >
              {solutionImage ? (
                <Image
                  source={{ uri: solutionImage }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.imagePickerText}>
                  📷 Take a photo or choose from gallery
                </Text>
              )}
            </Pressable>
            <Pressable
              style={styles.submitButton}
              onPress={submitSolution}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#0A0E1A" />
              ) : (
                <Text style={styles.submitText}>Submit Solution</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Full View Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <Pressable
            style={styles.closeButton}
            onPress={() => setPreviewImageUrl(null)}
          >
            <Ionicons name="close-circle" size={36} color="white" />
          </Pressable>

          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 60 },
  notFoundContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  notFoundText: { color: '#8A8FA3', fontSize: 15, marginBottom: 14, textAlign: 'center' },
  retryButton: { backgroundColor: '#D4AF37', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#0A0E1A', fontWeight: '700' },
  questionCard: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  asker: { color: '#B8C0D8', fontSize: 13, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  openBadge: { backgroundColor: '#3A3320' },
  solvedBadge: { backgroundColor: '#203A20' },
  statusText: { fontSize: 10, fontWeight: '700', color: 'white' },
  questionText: { color: 'white', fontSize: 16, lineHeight: 24 },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 10,
    backgroundColor: '#0F1322',
  },
  tapToViewText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  coinText: { color: '#D4AF37', fontSize: 13, fontWeight: '700' },
  sectionTitle: { color: '#D4AF37', fontSize: 16, fontWeight: '700', marginTop: 8 },
  hiddenNote: { color: '#8A8FA3', fontSize: 12, fontStyle: 'italic' },
  solutionCard: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  winningCard: { borderColor: '#4ADE80', borderWidth: 1.5 },
  solverName: { color: 'white', fontSize: 14, fontWeight: '700' },
  winningTag: { color: '#4ADE80', fontSize: 12, fontWeight: '700' },
  solutionText: { color: '#E1E4EE', fontSize: 15, lineHeight: 22 },
  solutionImageWrapper: { marginTop: 4 },
  markCorrectBtn: {
    backgroundColor: '#203A20',
    borderWidth: 1,
    borderColor: '#4ADE80',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  markCorrectText: { color: '#4ADE80', fontWeight: '700', fontSize: 14 },
  answerForm: { gap: 10, marginTop: 8 },
  input: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: 'white',
    fontSize: 15,
  },
  textArea: { height: 110, textAlignVertical: 'top' },
  imagePicker: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePickerText: { color: '#8A8FA3', fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  imagePreview: { width: '100%', height: '100%' },
  submitButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 6,
  },
  fullscreenImage: {
    width: '100%',
    height: '85%',
  },
});