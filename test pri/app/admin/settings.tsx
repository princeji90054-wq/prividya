import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function AdminSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [sealUrl, setSealUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('Admin');

  // useFocusEffect taaki back aane par bhi automatic fresh data load ho
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, signature_url')
          .eq('id', user.id)
          .single();

        if (profile) {
          setAdminName(profile.full_name || 'Admin');
          if (profile.signature_url) {
            setSignatureUrl(profile.signature_url);
          }
        }
      }

      // Fetch permanent platform branding
      const { data: branding, error } = await supabase
        .from('app_branding')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.warn('Error loading branding:', error.message);
      }

      if (branding) {
        if (branding.logo_url) setLogoUrl(branding.logo_url);
        if (branding.seal_url) setSealUrl(branding.seal_url);
      }
    } catch (err: any) {
      console.error('Settings load error:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function pickAndUpload(type: 'logo' | 'seal' | 'signature') {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'seal' ? [1, 1] : undefined, // Circular seal square crop
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setSaving(true);
      const uri = result.assets[0].uri;
      const fileName = `${type}-${Date.now()}`;

      // Upload directly into public storage bucket
      const uploadedUrl = await uploadImage(uri, 'branding-assets', fileName);

      if (!uploadedUrl) {
        throw new Error('Image upload failed. Bucket check karein.');
      }

      if (type === 'logo') {
        const { error } = await supabase.from('app_branding').upsert({
          id: 1,
          logo_url: uploadedUrl,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setLogoUrl(uploadedUrl);
        Alert.alert('Success', 'PriVidya Logo save ho gaya!');
      } else if (type === 'seal') {
        const { error } = await supabase.from('app_branding').upsert({
          id: 1,
          seal_url: uploadedUrl,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setSealUrl(uploadedUrl);
        Alert.alert('Success', 'PriVidya Circular Seal Stamp permanent save ho gayi!');
      } else if (type === 'signature') {
        if (currentUserId) {
          const { error } = await supabase
            .from('profiles')
            .update({ signature_url: uploadedUrl })
            .eq('id', currentUserId);
          if (error) throw error;
          setSignatureUrl(uploadedUrl);
          Alert.alert('Success', 'Aapka authorized signature save ho gaya!');
        }
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
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
          title: 'Branding & Sign Settings',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Invoice Assets Management</Text>
        <Text style={styles.subText}>
          Yahan se upload kiye gaye Logo, Circle Seal Stamp aur Signature direct students ki Invoices par print honge.
        </Text>

        {saving && (
          <View style={styles.savingBox}>
            <ActivityIndicator color="#D4AF37" size="small" />
            <Text style={styles.savingText}>Uploading to permanent storage...</Text>
          </View>
        )}

        {/* 1. Official Brand Logo */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="image-outline" size={22} color="#D4AF37" />
            <Text style={styles.cardTitle}>PriVidya Brand Logo</Text>
          </View>
          <Text style={styles.cardDesc}>
            Invoice header ke design ke anusaar horizontal aspect ratio me dikhega.
          </Text>
          <View style={styles.logoPreviewWrap}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="contain" />
            ) : (
              <Text style={styles.noAsset}>No Logo Uploaded Yet</Text>
            )}
          </View>
          <Pressable style={styles.uploadBtn} onPress={() => pickAndUpload('logo')}>
            <Ionicons name="cloud-upload-outline" size={18} color="#0A0E1A" />
            <Text style={styles.uploadBtnText}>Upload / Change Logo</Text>
          </Pressable>
        </View>

        {/* 2. Official Circular Digital Seal */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="ribbon-outline" size={22} color="#D4AF37" />
            <Text style={styles.cardTitle}>Official Digital Seal (Circular Stamp)</Text>
          </View>
          <Text style={styles.cardDesc}>
            Invoice verification box me gol circular shape me seal print hogi.
          </Text>
          <View style={styles.sealPreviewWrap}>
            {sealUrl ? (
              <View style={styles.circleSealContainer}>
                <Image source={{ uri: sealUrl }} style={styles.sealCircleImage} resizeMode="cover" />
              </View>
            ) : (
              <Text style={styles.noAsset}>No Seal Stamp Uploaded</Text>
            )}
          </View>
          <Pressable style={styles.uploadBtn} onPress={() => pickAndUpload('seal')}>
            <Ionicons name="cloud-upload-outline" size={18} color="#0A0E1A" />
            <Text style={styles.uploadBtnText}>Upload Circular Stamp</Text>
          </Pressable>
        </View>

        {/* 3. Approving Admin Signature */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="pencil-outline" size={22} color="#D4AF37" />
            <Text style={styles.cardTitle}>My Authorized Signature ({adminName})</Text>
          </View>
          <Text style={styles.cardDesc}>
            Payment approve karte waqt invoice par aapka signature aur designation auto-attach hogi.
          </Text>
          <View style={styles.signPreviewWrap}>
            {signatureUrl ? (
              <Image source={{ uri: signatureUrl }} style={styles.signPreview} resizeMode="contain" />
            ) : (
              <Text style={styles.noAsset}>No Signature Uploaded</Text>
            )}
          </View>
          <Pressable style={styles.uploadBtn} onPress={() => pickAndUpload('signature')}>
            <Ionicons name="cloud-upload-outline" size={18} color="#0A0E1A" />
            <Text style={styles.uploadBtnText}>Upload My Signature</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { padding: 20, gap: 16 },
  headerTitle: { color: '#D4AF37', fontSize: 20, fontWeight: '800' },
  subText: { color: '#8A8FA3', fontSize: 13, lineHeight: 18, marginTop: -6 },
  savingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#151A2C',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  savingText: { color: '#D4AF37', fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: '#151A2C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A3150',
    padding: 16,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: 'white', fontWeight: '700', fontSize: 15 },
  cardDesc: { color: '#8A8FA3', fontSize: 12, lineHeight: 16 },
  logoPreviewWrap: {
    height: 90,
    backgroundColor: '#0E1322',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3150',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPreview: { width: '80%', height: 60 },
  sealPreviewWrap: {
    height: 120,
    backgroundColor: '#0E1322',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3150',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleSealContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#D4AF37',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  sealCircleImage: { width: '100%', height: '100%' },
  signPreviewWrap: {
    height: 90,
    backgroundColor: '#0E1322',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3150',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signPreview: { width: 150, height: 60 },
  noAsset: { color: '#555B73', fontSize: 12 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  uploadBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 14 },
});