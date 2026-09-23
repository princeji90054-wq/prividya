import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [stateId, setStateId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [districtOther, setDistrictOther] = useState('');
  const [village, setVillage] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [qualification, setQualification] = useState('');
  const [collegeOrJob, setCollegeOrJob] = useState('');
  const [mobile, setMobile] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('states')
      .select('*')
      .order('name')
      .then(({ data }) => setStates(data ?? []));
  }, []);

  useEffect(() => {
    if (!stateId) {
      setDistricts([]);
      return;
    }
    supabase
      .from('districts')
      .select('*')
      .eq('state_id', stateId)
      .order('name')
      .then(({ data }) => setDistricts(data ?? []));
  }, [stateId]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  // Back jane ya logout karne par session clear karke login screen bhejega
  async function handleBackOrLogout() {
    Alert.alert('Go Back', 'Do you want to log out and return to the login screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  async function handleSave() {
    if (!fullName || !age || !mobile) {
      Alert.alert('Missing info', 'Name, age, aur mobile number zaroori hain.');
      return;
    }

    if (mobile.length !== 10) {
      Alert.alert('Invalid mobile', 'Mobile number exactly 10 digits ka hona chahiye.');
      return;
    }

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      let photoUrl = null;
      if (photoUri && user) {
        photoUrl = await uploadImage(photoUri, 'avatars', `avatar-${user.id}`);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          gender: gender || null,
          age: parseInt(age),
          qualification,
          college_or_job: collegeOrJob,
          mobile,
          state_id: stateId,
          district_id: districtId,
          district_other: districtOther || null,
          village: village || null,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        })
        .eq('id', user?.id);

      if (error) throw error;

      router.replace('/(tabs)' as any);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header Navigation Bar */}
      <View style={styles.topNav}>
        <Pressable style={styles.backButton} onPress={handleBackOrLogout}>
          <Ionicons name="arrow-back" size={22} color="#D4AF37" />
        </Pressable>
        <Pressable onPress={handleBackOrLogout} hitSlop={10}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Just a few more details to get started</Text>

        <Pressable style={styles.photoPicker} onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.photoPickerText}>+ Add Photo</Text>
          )}
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#8A8FA3"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Gender (optional)"
          placeholderTextColor="#8A8FA3"
          value={gender}
          onChangeText={setGender}
        />
        <TextInput
          style={styles.input}
          placeholder="Age"
          placeholderTextColor="#8A8FA3"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Qualification"
          placeholderTextColor="#8A8FA3"
          value={qualification}
          onChangeText={setQualification}
        />
        <TextInput
          style={styles.input}
          placeholder="College / Job (optional)"
          placeholderTextColor="#8A8FA3"
          value={collegeOrJob}
          onChangeText={setCollegeOrJob}
        />
        <TextInput
          style={styles.input}
          placeholder="Mobile Number"
          placeholderTextColor="#8A8FA3"
          value={mobile}
          onChangeText={(t) => setMobile(t.replace(/[^0-9]/g, '').slice(0, 10))}
          keyboardType="phone-pad"
          maxLength={10}
        />

        <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '700', marginTop: 8 }}>State</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {states.map((s) => (
            <Pressable
              key={s.id}
              style={{
                backgroundColor: stateId === s.id ? '#D4AF37' : '#151A2C',
                borderWidth: 1,
                borderColor: '#2A3150',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
              onPress={() => {
                setStateId(s.id);
                setDistrictId(null);
              }}
            >
              <Text
                style={{
                  color: stateId === s.id ? '#0A0E1A' : '#B8C0D8',
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {stateId && (
          <>
            <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '700', marginTop: 8 }}>
              District
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {districts.map((d) => (
                <Pressable
                  key={d.id}
                  style={{
                    backgroundColor: districtId === d.id ? '#D4AF37' : '#151A2C',
                    borderWidth: 1,
                    borderColor: '#2A3150',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                  onPress={() => setDistrictId(d.id)}
                >
                  <Text
                    style={{
                      color: districtId === d.id ? '#0A0E1A' : '#B8C0D8',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {d.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={{
                  backgroundColor:
                    districtId === null && districtOther ? '#D4AF37' : '#151A2C',
                  borderWidth: 1,
                  borderColor: '#2A3150',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
                onPress={() => setDistrictId(null)}
              >
                <Text style={{ color: '#B8C0D8', fontSize: 12, fontWeight: '600' }}>Other</Text>
              </Pressable>
            </View>
          </>
        )}

        {stateId && districtId === null && (
          <TextInput
            style={styles.input}
            placeholder="Type your district name"
            placeholderTextColor="#8A8FA3"
            value={districtOther}
            onChangeText={setDistrictOther}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Village (optional)"
          placeholderTextColor="#8A8FA3"
          value={village}
          onChangeText={setVillage}
        />

        <Pressable style={styles.button} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0A0E1A" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#151A2C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A3150',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
    justifyContent: 'center',
    flexGrow: 1,
  },
  title: {
    color: '#D4AF37',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#8A8FA3',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  photoPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#151A2C',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 8,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPickerText: {
    color: '#8A8FA3',
    fontSize: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: 'white',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#0A0E1A',
    fontSize: 16,
    fontWeight: '700',
  },
});