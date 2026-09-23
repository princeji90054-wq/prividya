import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isBiometricAvailable, isBiometricLockEnabled, setBiometricLockEnabled } from '@/lib/biometricLock';
import { isDataSaverEnabled, setDataSaverEnabled } from '@/lib/dataSaver';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function EditProfileScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [qualification, setQualification] = useState('');
  const [collegeOrJob, setCollegeOrJob] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [dataSaverOn, setDataSaverOnState] = useState(false);

  const [linkCode, setLinkCode] = useState<string | null>(null);

  async function loadLinkCode() {
    const { data } = await supabase.rpc('generate_parent_link_code');
    setLinkCode(data);
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setFullName(data.full_name ?? '');
        setGender(data.gender ?? '');
        setAge(data.age ? String(data.age) : '');
        setQualification(data.qualification ?? '');
        setCollegeOrJob(data.college_or_job ?? '');
        setPhotoUrl(data.photo_url);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    isBiometricLockEnabled().then(setBiometricEnabledState);
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  useEffect(() => {
    isDataSaverEnabled().then(setDataSaverOnState);
  }, []);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setNewPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      let finalPhotoUrl = photoUrl;
      if (newPhotoUri && user) {
        finalPhotoUrl = await uploadImage(newPhotoUri, 'avatars', `avatar-${user.id}-${Date.now()}`);
      }

      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        gender,
        age: age ? parseInt(age) : null,
        qualification,
        college_or_job: collegeOrJob,
        photo_url: finalPhotoUrl,
      }).eq('id', user?.id);

      if (error) throw error;

      Alert.alert('Saved', 'Profile updated successfully.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
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
      <Stack.Screen options={{ title: 'Edit Profile', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.photoPicker} onPress={pickPhoto}>
          {(newPhotoUri || photoUrl) ? (
            <Image source={{ uri: newPhotoUri ?? photoUrl! }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.photoPickerText}>+ Add Photo</Text>
          )}
        </Pressable>

        <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#8A8FA3" value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="Gender" placeholderTextColor="#8A8FA3" value={gender} onChangeText={setGender} />
        <TextInput style={styles.input} placeholder="Age" placeholderTextColor="#8A8FA3" value={age} onChangeText={setAge} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Qualification" placeholderTextColor="#8A8FA3" value={qualification} onChangeText={setQualification} />
        <TextInput style={styles.input} placeholder="College / Job" placeholderTextColor="#8A8FA3" value={collegeOrJob} onChangeText={setCollegeOrJob} />

        {biometricAvailable && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: '#B8C0D8', fontSize: 14 }}>App Lock (Fingerprint/Face)</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={async (v) => { await setBiometricLockEnabled(v); setBiometricEnabledState(v); }}
            />
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: '#B8C0D8', fontSize: 14 }}>Data Saver Mode (lower video quality)</Text>
          <Switch
            value={dataSaverOn}
            onValueChange={async (v) => { await setDataSaverEnabled(v); setDataSaverOnState(v); }}
          />
        </View>

        <Pressable style={{ backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, marginTop: 12 }} onPress={loadLinkCode}>
          <Text style={{ color: '#D4AF37', fontWeight: '700', fontSize: 13 }}>Family Link</Text>
          <Text style={{ color: '#8A8FA3', fontSize: 12, marginTop: 4 }}>
            {linkCode ? `Your code: ${linkCode}` : 'Tap to generate a code for your parent to link their account'}
          </Text>
        </Pressable>

        <Pressable style={{ backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, padding: 14, marginTop: 12 }} onPress={() => router.push('/my-data-export' as any)}>
          <Text style={{ color: '#D4AF37', fontWeight: '700', fontSize: 13 }}>Download My Data</Text>
        </Pressable>

        <Text style={styles.note}>To change mobile or email, contact support (Help & Support section).</Text>

        <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.buttonText}>Save Changes</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 24, gap: 12 },
  photoPicker: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#151A2C', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A3150', borderStyle: 'dashed', overflow: 'hidden', marginBottom: 8 },
  photoPreview: { width: '100%', height: '100%' },
  photoPickerText: { color: '#8A8FA3', fontSize: 12, textAlign: 'center' },
  input: { backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: 'white', fontSize: 16 },
  note: { color: '#8A8FA3', fontSize: 12, textAlign: 'center' },
  button: { backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
});