import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function AdminPracticeQuestionsScreen() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [solutionText, setSolutionText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('subjects').select('*').then(({ data }) => { setSubjects(data ?? []); setLoading(false); });
  }, []);

  async function selectSubject(subject: any) {
    setSelectedSubject(subject);
    setSelectedChapter(null);
    const { data } = await supabase.from('chapters').select('*').eq('subject_id', subject.id);
    setChapters(data ?? []);
  }

  async function selectChapter(chapter: any) {
    setSelectedChapter(chapter);
    loadQuestions(chapter.id);
  }

  async function loadQuestions(chapterId: string) {
    const { data } = await supabase.from('practice_questions').select('*').eq('chapter_id', chapterId).order('created_at', { ascending: false });
    setQuestions(data ?? []);
  }

  async function addQuestion() {
    if (!selectedChapter) { Alert.alert('Select chapter first'); return; }
    if (!qText.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
      Alert.alert('Missing info', 'Question and all 4 options required.');
      return;
    }
    const { error } = await supabase.from('practice_questions').insert({
      chapter_id: selectedChapter.id,
      question_text: qText.trim(),
      option_a: optA.trim(), option_b: optB.trim(), option_c: optC.trim(), option_d: optD.trim(),
      correct_option: correctOpt,
      solution_text: solutionText.trim() || null,
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setSolutionText(''); setCorrectOpt('a');
    loadQuestions(selectedChapter.id);
  }

  async function deleteQuestion(id: string) {
    await supabase.from('practice_questions').delete().eq('id', id);
    if (selectedChapter) loadQuestions(selectedChapter.id);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Practice Questions</Text>

        <Text style={styles.label}>Subject</Text>
        <View style={styles.chipRow}>
          {subjects.map((s) => (
            <Pressable key={s.id} style={[styles.chip, selectedSubject?.id === s.id && styles.chipActive]} onPress={() => selectSubject(s)}>
              <Text style={styles.chipText}>{s.name}</Text>
            </Pressable>
          ))}
        </View>

        {selectedSubject && (
          <>
            <Text style={styles.label}>Chapter</Text>
            <View style={styles.chipRow}>
              {chapters.map((c) => (
                <Pressable key={c.id} style={[styles.chip, selectedChapter?.id === c.id && styles.chipActive]} onPress={() => selectChapter(c)}>
                  <Text style={styles.chipText}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {selectedChapter && (
          <>
            <Text style={styles.sectionTitle}>Add Question</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Question" placeholderTextColor="#8A8FA3" value={qText} onChangeText={setQText} multiline />
            <TextInput style={styles.input} placeholder="Option A" placeholderTextColor="#8A8FA3" value={optA} onChangeText={setOptA} />
            <TextInput style={styles.input} placeholder="Option B" placeholderTextColor="#8A8FA3" value={optB} onChangeText={setOptB} />
            <TextInput style={styles.input} placeholder="Option C" placeholderTextColor="#8A8FA3" value={optC} onChangeText={setOptC} />
            <TextInput style={styles.input} placeholder="Option D" placeholderTextColor="#8A8FA3" value={optD} onChangeText={setOptD} />
            <View style={styles.chipRow}>
              {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                <Pressable key={opt} style={[styles.optChip, correctOpt === opt && styles.chipActive]} onPress={() => setCorrectOpt(opt)}>
                  <Text style={styles.chipText}>{opt.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Solution (optional)" placeholderTextColor="#8A8FA3" value={solutionText} onChangeText={setSolutionText} multiline />
            <Pressable style={styles.addBtn} onPress={addQuestion}><Text style={styles.addBtnText}>Add Question</Text></Pressable>

            <Text style={styles.sectionTitle}>Questions ({questions.length})</Text>
            <FlatList
              data={questions}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <View style={styles.qCard}>
                  <Text style={styles.qText}>{index + 1}. {item.question_text}</Text>
                  <Pressable onPress={() => deleteQuestion(item.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>
                </View>
              )}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 10 },
  title: { color: '#D4AF37', fontSize: 20, fontWeight: '700' },
  label: { color: '#B8C0D8', fontSize: 13, fontWeight: '600', marginTop: 8 },
  sectionTitle: { color: '#D4AF37', fontSize: 16, fontWeight: '700', marginTop: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  optChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: 'white', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: 'white', fontSize: 15 },
  textArea: { height: 70, textAlignVertical: 'top' },
  addBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#0A0E1A', fontWeight: '700' },
  qCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12, marginBottom: 6 },
  qText: { color: 'white', fontSize: 13, flex: 1 },
  deleteText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
});