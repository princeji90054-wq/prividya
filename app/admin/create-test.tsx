import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseQuestionsCsv } from '@/lib/csvQuestionParser';
import { supabase } from '@/lib/supabase';

export default function CreateTestScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [timerType, setTimerType] = useState<'overall' | 'sectionwise'>('overall');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [negativeMarking, setNegativeMarking] = useState('0.25');
  const [resultRelease, setResultRelease] = useState<'instant' | 'scheduled'>('instant');

  // PYQ States
  const [isPyq, setIsPyq] = useState(false);
  const [examYear, setExamYear] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [testId, setTestId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Manual question add
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [solutionText, setSolutionText] = useState('');
  const [qTextHi, setQTextHi] = useState('');
  const [optAHi, setOptAHi] = useState('');
  const [optBHi, setOptBHi] = useState('');
  const [optCHi, setOptCHi] = useState('');
  const [optDHi, setOptDHi] = useState('');
  const [showHindiFields, setShowHindiFields] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvUploading, setCsvUploading] = useState(false);

  useEffect(() => {
    supabase.from('batches').select('id, name').eq('is_published', true).then(({ data }) => setBatches(data ?? []));
  }, []);

  useEffect(() => {
    supabase.from('categories').select('id, name').then(({ data }) => setCategories(data ?? []));
  }, []);

  async function loadQuestions(id: string) {
    const { data } = await supabase.from('test_questions').select('*').eq('test_id', id).order('order_index');
    setQuestions(data ?? []);
  }

  async function saveSettings() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Please enter a test title.');
      return;
    }
    if (!isFree && !selectedBatchId) {
      Alert.alert('Missing info', 'Please select a batch for this paid test.');
      return;
    }

    setSavingSettings(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      batch_id: isFree ? null : selectedBatchId,
      timer_type: timerType,
      duration_minutes: timerType === 'overall' ? parseInt(durationMinutes) || 30 : null,
      negative_marking: parseFloat(negativeMarking) || 0,
      result_release: resultRelease,
      is_published: false,
      is_pyq: isPyq,
      exam_year: isPyq ? parseInt(examYear) || null : null,
      category_id: isPyq ? selectedCategoryId : null,
    };

    if (testId) {
      const { error } = await supabase.from('tests').update(payload).eq('id', testId);
      setSavingSettings(false);
      if (error) { Alert.alert('Error', error.message); return; }
      Alert.alert('Saved', 'Test settings updated.');
    } else {
      const { data, error } = await supabase.from('tests').insert(payload).select().single();
      setSavingSettings(false);
      if (error) { Alert.alert('Error', error.message); return; }
      setTestId(data.id);
      Alert.alert('Test created', 'Now add questions below (manually or bulk CSV upload).');
    }
  }

  async function addQuestion() {
    if (!testId) {
      Alert.alert('Save test first', 'Please save the test settings above before adding questions.');
      return;
    }
    if (!qText.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
      Alert.alert('Missing info', 'Question text and all 4 options are required.');
      return;
    }

    const { error } = await supabase.from('test_questions').insert({
      test_id: testId,
      question_text: qText.trim(),
      option_a: optA.trim(),
      option_b: optB.trim(),
      option_c: optC.trim(),
      option_d: optD.trim(),
      correct_option: correctOpt,
      solution_text: solutionText.trim() || null,
      order_index: questions.length,
      question_text_hi: qTextHi.trim() || null,
      option_a_hi: optAHi.trim() || null,
      option_b_hi: optBHi.trim() || null,
      option_c_hi: optCHi.trim() || null,
      option_d_hi: optDHi.trim() || null,
    });

    if (error) { Alert.alert('Error', error.message); return; }

    setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setSolutionText(''); setCorrectOpt('a');
    setQTextHi(''); setOptAHi(''); setOptBHi(''); setOptCHi(''); setOptDHi('');
    loadQuestions(testId);
  }

  async function deleteQuestion(id: string) {
    await supabase.from('test_questions').delete().eq('id', id);
    if (testId) loadQuestions(testId);
  }

  async function uploadCsv() {
    if (!testId) {
      Alert.alert('Save test first', 'Please save the test settings above before bulk-uploading questions.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '*/*'] });
    if (result.canceled) return;

    setCsvUploading(true);
    setCsvErrors([]);

    try {
      const csvText = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const { questions: parsed, errors } = parseQuestionsCsv(csvText);
      setCsvErrors(errors);

      if (parsed.length === 0) {
        setCsvUploading(false);
        Alert.alert('Nothing to import', 'No valid questions found in this CSV.');
        return;
      }

      const sectionCache: Record<string, string> = {};
      const rows = [];
      let orderCounter = questions.length;

      for (const q of parsed) {
        let sectionId: string | null = null;
        if (q.section_name) {
          if (!sectionCache[q.section_name]) {
            const { data: existingSection } = await supabase
              .from('test_sections').select('id').eq('test_id', testId).eq('name', q.section_name).maybeSingle();

            if (existingSection) {
              sectionCache[q.section_name] = existingSection.id;
            } else {
              const { data: newSection } = await supabase
                .from('test_sections')
                .insert({ test_id: testId, name: q.section_name, duration_minutes: 20, order_index: Object.keys(sectionCache).length })
                .select().single();
              sectionCache[q.section_name] = newSection.id;
            }
          }
          sectionId = sectionCache[q.section_name];
        }

        rows.push({
          test_id: testId,
          section_id: sectionId,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          solution_text: q.solution_text ?? null,
          order_index: orderCounter++,
        });
      }

      const { error: insertError } = await supabase.from('test_questions').insert(rows);
      setCsvUploading(false);

      if (insertError) {
        Alert.alert('Error', insertError.message);
        return;
      }

      Alert.alert('Imported', `${rows.length} question(s) imported successfully.${errors.length ? ` ${errors.length} row(s) skipped — see errors below.` : ''}`);
      loadQuestions(testId);
    } catch (err: any) {
      setCsvUploading(false);
      Alert.alert('Error reading file', err.message);
    }
  }

  async function publishTest() {
    if (!testId) return;
    if (questions.length === 0) {
      Alert.alert('No questions', 'Add at least one question before publishing.');
      return;
    }
    const { error } = await supabase.from('tests').update({ is_published: true }).eq('id', testId);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Published!', 'This test is now live.');
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Create Test', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Test Settings</Text>

        <TextInput style={styles.input} placeholder="Test title" placeholderTextColor="#8A8FA3" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input, styles.textArea]} placeholder="Description (optional)" placeholderTextColor="#8A8FA3" value={description} onChangeText={setDescription} multiline />

        <View style={styles.row}>
          <Text style={styles.label}>Free Test (open to everyone)</Text>
          <Switch value={isFree} onValueChange={setIsFree} />
        </View>

        {!isFree && (
          <View style={styles.batchList}>
            {batches.map((b) => (
              <Pressable key={b.id} style={[styles.batchChip, selectedBatchId === b.id && styles.batchChipActive]} onPress={() => setSelectedBatchId(b.id)}>
                <Text style={[styles.batchChipText, selectedBatchId === b.id && styles.batchChipTextActive]}>{b.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Timer Type</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.toggleChip, timerType === 'overall' && styles.toggleChipActive]} onPress={() => setTimerType('overall')}>
              <Text style={styles.toggleChipText}>Overall</Text>
            </Pressable>
            <Pressable style={[styles.toggleChip, timerType === 'sectionwise' && styles.toggleChipActive]} onPress={() => setTimerType('sectionwise')}>
              <Text style={styles.toggleChipText}>Section-wise</Text>
            </Pressable>
          </View>
        </View>

        {timerType === 'overall' && (
          <TextInput style={styles.input} placeholder="Duration (minutes)" placeholderTextColor="#8A8FA3" value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="numeric" />
        )}
        {timerType === 'sectionwise' && (
          <Text style={styles.hint}>Section durations are set per-section — add sections via the CSV's section_name column, or they'll default to 20 min each (editable later).</Text>
        )}

        <TextInput style={styles.input} placeholder="Negative marking (e.g. 0.25, 0.5, 1)" placeholderTextColor="#8A8FA3" value={negativeMarking} onChangeText={setNegativeMarking} keyboardType="decimal-pad" />

        <View style={styles.row}>
          <Text style={styles.label}>Result Release</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.toggleChip, resultRelease === 'instant' && styles.toggleChipActive]} onPress={() => setResultRelease('instant')}>
              <Text style={styles.toggleChipText}>Instant</Text>
            </Pressable>
            <Pressable style={[styles.toggleChip, resultRelease === 'scheduled' && styles.toggleChipActive]} onPress={() => setResultRelease('scheduled')}>
              <Text style={styles.toggleChipText}>Scheduled</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Previous Year Paper (PYQ)</Text>
          <Switch value={isPyq} onValueChange={setIsPyq} />
        </View>
        {isPyq && (
          <>
            <TextInput style={styles.input} placeholder="Exam Year (e.g. 2023)" placeholderTextColor="#8A8FA3" value={examYear} onChangeText={setExamYear} keyboardType="numeric" />
            <View style={styles.chipRow}>
              {categories.map((c) => (
                <Pressable key={c.id} style={[styles.batchChip, selectedCategoryId === c.id && styles.batchChipActive]} onPress={() => setSelectedCategoryId(c.id)}>
                  <Text style={[styles.batchChipText, selectedCategoryId === c.id && styles.batchChipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Pressable style={styles.saveBtn} onPress={saveSettings} disabled={savingSettings}>
          {savingSettings ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.saveBtnText}>{testId ? 'Update Settings' : 'Save & Create Test'}</Text>}
        </Pressable>

        {testId && (
          <>
            <Text style={styles.sectionTitle}>Bulk Upload (CSV)</Text>
            <Text style={styles.hint}>Columns required: question_text, option_a, option_b, option_c, option_d, correct_option (a/b/c/d). Optional: solution_text, section_name.</Text>
            <Pressable style={styles.uploadBtn} onPress={uploadCsv} disabled={csvUploading}>
              {csvUploading ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.saveBtnText}>Upload CSV</Text>}
            </Pressable>
            {csvErrors.length > 0 && (
              <View style={styles.errorBox}>
                {csvErrors.map((e, i) => <Text key={i} style={styles.errorText}>{e}</Text>)}
              </View>
            )}

            <Text style={styles.sectionTitle}>Add Question Manually</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Question text" placeholderTextColor="#8A8FA3" value={qText} onChangeText={setQText} multiline />
            <TextInput style={styles.input} placeholder="Option A" placeholderTextColor="#8A8FA3" value={optA} onChangeText={setOptA} />
            <TextInput style={styles.input} placeholder="Option B" placeholderTextColor="#8A8FA3" value={optB} onChangeText={setOptB} />
            <TextInput style={styles.input} placeholder="Option C" placeholderTextColor="#8A8FA3" value={optC} onChangeText={setOptC} />
            <TextInput style={styles.input} placeholder="Option D" placeholderTextColor="#8A8FA3" value={optD} onChangeText={setOptD} />

            <View style={styles.row}>
              <Text style={styles.label}>Correct Option</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                  <Pressable key={opt} style={[styles.optChip, correctOpt === opt && styles.optChipActive]} onPress={() => setCorrectOpt(opt)}>
                    <Text style={styles.optChipText}>{opt.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <TextInput style={[styles.input, styles.textArea]} placeholder="Solution explanation (optional)" placeholderTextColor="#8A8FA3" value={solutionText} onChangeText={setSolutionText} multiline />

            <Pressable onPress={() => setShowHindiFields(!showHindiFields)}>
              <Text style={{ color: '#3C9FFE', fontSize: 12, fontWeight: '600' }}>{showHindiFields ? '- Hide' : '+ Add'} Hindi Translation (optional)</Text>
            </Pressable>
            {showHindiFields && (
              <>
                <TextInput style={[styles.input, styles.textArea]} placeholder="Question (Hindi)" placeholderTextColor="#8A8FA3" value={qTextHi} onChangeText={setQTextHi} multiline />
                <TextInput style={styles.input} placeholder="Option A (Hindi)" placeholderTextColor="#8A8FA3" value={optAHi} onChangeText={setOptAHi} />
                <TextInput style={styles.input} placeholder="Option B (Hindi)" placeholderTextColor="#8A8FA3" value={optBHi} onChangeText={setOptBHi} />
                <TextInput style={styles.input} placeholder="Option C (Hindi)" placeholderTextColor="#8A8FA3" value={optCHi} onChangeText={setOptCHi} />
                <TextInput style={styles.input} placeholder="Option D (Hindi)" placeholderTextColor="#8A8FA3" value={optDHi} onChangeText={setOptDHi} />
              </>
            )}

            <Pressable style={styles.saveBtn} onPress={addQuestion}>
              <Text style={styles.saveBtnText}>Add Question</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Questions Added ({questions.length})</Text>
            <FlatList
              data={questions}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <View style={styles.qCard}>
                  <Text style={styles.qText}>{index + 1}. {item.question_text}</Text>
                  <Text style={styles.qMeta}>Correct: {item.correct_option?.toUpperCase()}</Text>
                  <Pressable onPress={() => deleteQuestion(item.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              )}
            />

            <Pressable style={styles.publishBtn} onPress={publishTest}>
              <Text style={styles.saveBtnText}>Publish Test</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 60 },
  sectionTitle: { color: '#D4AF37', fontSize: 17, fontWeight: '700', marginTop: 16 },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: 'white', fontSize: 15 },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  label: { color: '#B8C0D8', fontSize: 13, fontWeight: '600' },
  hint: { color: '#8A8FA3', fontSize: 11 },
  batchList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  batchChip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  batchChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  batchChipText: { color: '#B8C0D8', fontSize: 12 },
  batchChipTextActive: { color: '#0A0E1A', fontWeight: '700' },
  toggleChip: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  toggleChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  toggleChipText: { color: 'white', fontSize: 12, fontWeight: '600' },
  optChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', alignItems: 'center', justifyContent: 'center' },
  optChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  optChipText: { color: 'white', fontWeight: '700' },
  saveBtn: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 15 },
  uploadBtn: { backgroundColor: '#3C9FFE', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  errorBox: { backgroundColor: '#3A2020', borderRadius: 10, padding: 10, gap: 4 },
  errorText: { color: '#FF9B9B', fontSize: 11 },
  qCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 10, padding: 12, gap: 4, marginBottom: 8 },
  qText: { color: 'white', fontSize: 13 },
  qMeta: { color: '#8A8FA3', fontSize: 11 },
  deleteText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  publishBtn: { backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
});