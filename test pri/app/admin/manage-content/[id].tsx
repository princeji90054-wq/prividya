import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function ManageContentScreen() {
  const { id: batchId } = useLocalSearchParams();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newChapterName, setNewChapterName] = useState<Record<string, string>>({});
  const [newClassTitle, setNewClassTitle] = useState<Record<string, string>>({});
  const [newClassVideoId, setNewClassVideoId] = useState<Record<string, string>>({});
  const [newClassFree, setNewClassFree] = useState<Record<string, boolean>>({});
  const [newClassCommentsPrivate, setNewClassCommentsPrivate] = useState<Record<string, boolean>>({});
  const [newClassIsLive, setNewClassIsLive] = useState<Record<string, boolean>>({});
  const [newClassChatEnabled, setNewClassChatEnabled] = useState<Record<string, boolean>>({});
  const [newClassThumbnail, setNewClassThumbnail] = useState<Record<string, string>>({});
  const [newPdfTitle, setNewPdfTitle] = useState('');

  async function loadAll() {
    const { data: pdfData } = await supabase.from('pdfs').select('*').eq('batch_id', batchId).order('created_at', { ascending: false });
    setPdfs(pdfData ?? []);

    const { data: subs } = await supabase.from('subjects').select('*').eq('batch_id', batchId).order('order_index');
    if (!subs) return;

    const subjectsWithChapters = await Promise.all(
      subs.map(async (subject) => {
        const { data: chapters } = await supabase.from('chapters').select('*').eq('subject_id', subject.id).order('order_index');
        const chaptersWithClasses = await Promise.all(
          (chapters ?? []).map(async (chapter) => {
            const { data: classes } = await supabase.from('classes').select('*').eq('chapter_id', chapter.id).order('order_index');
            return { ...chapter, classes: classes ?? [] };
          })
        );
        return { ...subject, chapters: chaptersWithClasses };
      })
    );

    setSubjects(subjectsWithChapters);
  }

  useEffect(() => { loadAll(); }, [batchId]);

  async function uploadPdf() {
    if (!newPdfTitle.trim()) {
      Alert.alert('Missing title', 'Please enter a title for this PDF first.');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;

    const file = result.assets[0];
    const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    const path = `batch-${batchId}-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage.from('pdfs').upload(path, decode(base64), { contentType: 'application/pdf' });
    if (uploadError) { Alert.alert('Error', uploadError.message); return; }

    const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(path);
    await supabase.from('pdfs').insert({ batch_id: batchId, title: newPdfTitle.trim(), file_url: urlData.publicUrl });
    setNewPdfTitle('');
    loadAll();
  }

  async function deletePdf(id: string) {
    await supabase.from('pdfs').delete().eq('id', id);
    loadAll();
  }

  async function addSubject() {
    if (!newSubjectName.trim()) return;
    await supabase.from('subjects').insert({ batch_id: batchId, name: newSubjectName.trim() });
    setNewSubjectName('');
    loadAll();
  }

  async function addChapter(subjectId: string) {
    const name = newChapterName[subjectId];
    if (!name?.trim()) return;
    await supabase.from('chapters').insert({ subject_id: subjectId, name: name.trim() });
    setNewChapterName({ ...newChapterName, [subjectId]: '' });
    loadAll();
  }

  async function pickClassThumbnail(chapterId: string) {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled) setNewClassThumbnail({ ...newClassThumbnail, [chapterId]: result.assets[0].uri });
  }

  async function addClass(chapterId: string) {
    const title = newClassTitle[chapterId];
    const videoId = newClassVideoId[chapterId];
    if (!title?.trim() || !videoId?.trim()) {
      Alert.alert('Missing info', 'Class title and YouTube video ID both required.');
      return;
    }

    let thumbnailUrl = null;
    const thumbUri = newClassThumbnail[chapterId];
    if (thumbUri) thumbnailUrl = await uploadImage(thumbUri, 'batch-covers', `class-thumb-${Date.now()}`);

    await supabase.from('classes').insert({
      chapter_id: chapterId,
      title: title.trim(),
      youtube_video_id: videoId.trim(),
      is_free_demo: newClassFree[chapterId] ?? false,
      is_live: newClassIsLive[chapterId] ?? false,
      thumbnail_url: thumbnailUrl,
      chat_enabled: newClassChatEnabled[chapterId] ?? false,
    });

    setNewClassTitle({ ...newClassTitle, [chapterId]: '' });
    setNewClassVideoId({ ...newClassVideoId, [chapterId]: '' });
    setNewClassFree({ ...newClassFree, [chapterId]: false });
    setNewClassCommentsPrivate({ ...newClassCommentsPrivate, [chapterId]: false });
    setNewClassIsLive({ ...newClassIsLive, [chapterId]: false });
    setNewClassThumbnail({ ...newClassThumbnail, [chapterId]: '' });
    setNewClassChatEnabled({ ...newClassChatEnabled, [chapterId]: false });
    loadAll();
  }

  function toggleSubject(id: string) {
    const s = new Set(expandedSubjects);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedSubjects(s);
  }

  function toggleChapter(id: string) {
    const s = new Set(expandedChapters);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedChapters(s);
  }

  async function deleteSubject(id: string) { await supabase.from('subjects').delete().eq('id', id); loadAll(); }
  async function deleteChapter(id: string) { await supabase.from('chapters').delete().eq('id', id); loadAll(); }
  async function deleteClass(id: string) { await supabase.from('classes').delete().eq('id', id); loadAll(); }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Library / PDFs</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="PDF title (e.g. Chapter 1 Notes)"
            placeholderTextColor="#8A8FA3"
            value={newPdfTitle}
            onChangeText={setNewPdfTitle}
          />
          <Pressable style={styles.addButton} onPress={uploadPdf}>
            <Text style={styles.addButtonText}>Upload</Text>
          </Pressable>
        </View>
        {pdfs.map((pdf) => (
          <View key={pdf.id} style={styles.classRow}>
            <Text style={styles.classTitle}>{pdf.title}</Text>
            <Pressable onPress={() => deletePdf(pdf.id)}>
              <Ionicons name="trash" size={16} color="#FF6B6B" />
            </Pressable>
          </View>
        ))}

        <Text style={styles.title}>Curriculum</Text>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="New subject name (e.g. Reasoning)"
            placeholderTextColor="#8A8FA3"
            value={newSubjectName}
            onChangeText={setNewSubjectName}
          />
          <Pressable style={styles.addButton} onPress={addSubject}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {subjects.map((subject) => (
          <View key={subject.id} style={styles.subjectCard}>
            <Pressable style={styles.subjectHeader} onPress={() => toggleSubject(subject.id)}>
              <Ionicons name={expandedSubjects.has(subject.id) ? 'chevron-down' : 'chevron-forward'} size={18} color="#D4AF37" />
              <Text style={styles.subjectName}>{subject.name}</Text>
              <Pressable onPress={() => deleteSubject(subject.id)}>
                <Ionicons name="trash" size={16} color="#FF6B6B" />
              </Pressable>
            </Pressable>

            {expandedSubjects.has(subject.id) && (
              <View style={styles.nestedContent}>
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="New chapter name (e.g. Analogy)"
                    placeholderTextColor="#8A8FA3"
                    value={newChapterName[subject.id] ?? ''}
                    onChangeText={(t) => setNewChapterName({ ...newChapterName, [subject.id]: t })}
                  />
                  <Pressable style={styles.addButton} onPress={() => addChapter(subject.id)}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </Pressable>
                </View>

                {subject.chapters.map((chapter: any) => (
                  <View key={chapter.id} style={styles.chapterCard}>
                    <Pressable style={styles.chapterHeader} onPress={() => toggleChapter(chapter.id)}>
                      <Ionicons name={expandedChapters.has(chapter.id) ? 'chevron-down' : 'chevron-forward'} size={16} color="#3C9FFE" />
                      <Text style={styles.chapterName}>{chapter.name}</Text>
                      <Pressable onPress={() => deleteChapter(chapter.id)}>
                        <Ionicons name="trash" size={14} color="#FF6B6B" />
                      </Pressable>
                    </Pressable>

                    {expandedChapters.has(chapter.id) && (
                      <View style={styles.nestedContent}>
                        {chapter.classes.map((cls: any) => (
                          <View key={cls.id} style={styles.classRow}>
                            <Text style={styles.classTitle}>
                              {cls.title} {cls.is_free_demo ? '⭐ FREE' : ''} {cls.is_live ? '🔴 LIVE' : ''}
                            </Text>
                            <Pressable onPress={() => deleteClass(cls.id)}>
                              <Ionicons name="trash" size={14} color="#FF6B6B" />
                            </Pressable>
                          </View>
                        ))}

                        <TextInput
                          style={styles.input}
                          placeholder="Class title (e.g. Class 1)"
                          placeholderTextColor="#8A8FA3"
                          value={newClassTitle[chapter.id] ?? ''}
                          onChangeText={(t) => setNewClassTitle({ ...newClassTitle, [chapter.id]: t })}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="YouTube Video ID (e.g. dQw4w9WgXcQ)"
                          placeholderTextColor="#8A8FA3"
                          value={newClassVideoId[chapter.id] ?? ''}
                          onChangeText={(t) => setNewClassVideoId({ ...newClassVideoId, [chapter.id]: t })}
                        />

                        <Pressable style={styles.thumbPickerBtn} onPress={() => pickClassThumbnail(chapter.id)}>
                          <Text style={styles.imagePickerText}>
                            {newClassThumbnail[chapter.id] ? '✓ Thumbnail selected' : '+ Select Class Thumbnail'}
                          </Text>
                        </Pressable>

                        <View style={styles.freeRow}>
                          <Text style={styles.freeLabel}>Mark as free demo class</Text>
                          <Switch
                            value={newClassFree[chapter.id] ?? false}
                            onValueChange={(v) => setNewClassFree({ ...newClassFree, [chapter.id]: v })}
                          />
                        </View>
                        <View style={styles.freeRow}>
                          <Text style={styles.freeLabel}>Comments Private (only student+admin see)</Text>
                          <Switch
                            value={newClassCommentsPrivate[chapter.id] ?? false}
                            onValueChange={(v) => setNewClassCommentsPrivate({ ...newClassCommentsPrivate, [chapter.id]: v })}
                          />
                        </View>
                        <View style={styles.freeRow}>
                          <Text style={styles.freeLabel}>Mark as Live class</Text>
                          <Switch
                            value={newClassIsLive[chapter.id] ?? false}
                            onValueChange={(v) => setNewClassIsLive({ ...newClassIsLive, [chapter.id]: v })}
                          />
                        </View>
                        {newClassIsLive[chapter.id] && (
                          <View style={styles.freeRow}>
                            <Text style={styles.freeLabel}>Enable Live Chat (visible to all students)</Text>
                            <Switch
                              value={newClassChatEnabled[chapter.id] ?? false}
                              onValueChange={(v) => setNewClassChatEnabled({ ...newClassChatEnabled, [chapter.id]: v })}
                            />
                          </View>
                        )}

                        <Pressable style={styles.addButtonFull} onPress={() => addClass(chapter.id)}>
                          <Text style={styles.addButtonText}>Add Class</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 16, gap: 14 },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white', fontSize: 14,
  },
  addButton: { backgroundColor: '#D4AF37', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addButtonFull: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  addButtonText: { color: '#0A0E1A', fontWeight: '700', fontSize: 13 },
  subjectCard: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 12, gap: 10 },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectName: { color: 'white', fontSize: 15, fontWeight: '700', flex: 1 },
  nestedContent: { paddingLeft: 12, gap: 10, marginTop: 4 },
  chapterCard: { backgroundColor: '#1A2036', borderRadius: 10, padding: 10, gap: 8 },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterName: { color: '#E0E4F0', fontSize: 14, fontWeight: '600', flex: 1 },
  classRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  classTitle: { color: '#B8C0D8', fontSize: 13 },
  thumbPickerBtn: { backgroundColor: '#1A2036', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2A3150', borderStyle: 'dashed' },
  imagePickerText: { color: '#8A8FA3', fontSize: 12 },
  freeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  freeLabel: { color: '#8A8FA3', fontSize: 12 },
});