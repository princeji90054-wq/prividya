import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import jsQR from 'jsqr';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

interface VerificationResult {
  isGenuine: boolean;
  tamperedFields: string[];
  dbInvoice: any;
  student: any;
  payload?: any;
}

export default function AdminVerifyInvoiceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Common DB Integrity Verification (Supports Invoice Number, Verification Code, or Order ID)
  async function verifyAgainstDB(invoiceIdentifier: string, parsedPayload?: any) {
    setLoading(true);
    try {
      const cleanIdentifier = invoiceIdentifier.trim();

      // 1. Check using RPC first for bypass of strict RLS filters
      const { data: rpcRecords } = await supabase.rpc('verify_invoice_by_identifier', {
        p_identifier: cleanIdentifier,
      });

      let realInvoice = rpcRecords && rpcRecords.length > 0 ? rpcRecords[0] : null;

      // 2. Direct fallback lookup across verification_code, invoice_number, and order_id
      if (!realInvoice) {
        const { data: fallbackData } = await supabase
          .from('invoices')
          .select('*')
          .or(
            `invoice_number.ilike.%${cleanIdentifier}%,verification_code.ilike.%${cleanIdentifier}%,order_id.ilike.%${cleanIdentifier}%`
          )
          .maybeSingle();

        realInvoice = fallbackData;
      }

      if (!realInvoice) {
        setLoading(false);
        Alert.alert(
          '🚨 FAKE INVOICE (NOT FOUND)',
          `Invoice record "${cleanIdentifier}" official PriVidya database me exist nahi karta! Yeh 100% fake invoice hai.`,
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
        return;
      }

      const tampered: string[] = [];

      // 3. Check for alterations against parsed payload if present
      if (parsedPayload) {
        if (
          parsedPayload.uid &&
          String(realInvoice.student_id).toLowerCase() !== String(parsedPayload.uid).toLowerCase()
        ) {
          tampered.push(
            `Student User ID Mismatch (DB: ${realInvoice.student_id} vs QR: ${parsedPayload.uid})`
          );
        }

        if (
          parsedPayload.amt !== undefined &&
          Number(realInvoice.amount) !== Number(parsedPayload.amt)
        ) {
          tampered.push(
            `Amount Edited (DB: ₹${realInvoice.amount} vs Invoice QR: ₹${parsedPayload.amt})`
          );
        }

        if (
          parsedPayload.txn &&
          realInvoice.transaction_id &&
          parsedPayload.txn !== realInvoice.transaction_id
        ) {
          tampered.push(
            `Transaction UTR Altered (Real DB: ${realInvoice.transaction_id} vs QR: ${parsedPayload.txn})`
          );
        }
      }

      // 4. Fetch student profile details
      const { data: student } = await supabase
        .from('profiles')
        .select('full_name, email, mobile, student_id')
        .eq('id', realInvoice.student_id)
        .maybeSingle();

      setResult({
        isGenuine: tampered.length === 0,
        tamperedFields: tampered,
        dbInvoice: realInvoice,
        student,
        payload: parsedPayload,
      });
    } catch (err: any) {
      Alert.alert('Verification Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // QR Payload Decode & Match
  async function processQrData(data: string) {
    if (data.startsWith('prividya-auth://secure-invoice?data=')) {
      try {
        const rawPayload = decodeURIComponent(
          data.replace('prividya-auth://secure-invoice?data=', '')
        );
        const parsed = JSON.parse(rawPayload);
        await verifyAgainstDB(parsed.inv || parsed.sig, parsed);
        return;
      } catch (err: any) {
        Alert.alert('QR Error', 'Payload parsing failed: ' + err.message, [
          { text: 'Retry', onPress: () => setScanned(false) },
        ]);
        return;
      }
    }

    // Handles direct verification URLs or codes like https://prividya.in/verify?code=PV-VER-...
    if (data.includes('code=')) {
      const extractedCode = data.split('code=')[1]?.split('&')[0];
      if (extractedCode) {
        await verifyAgainstDB(decodeURIComponent(extractedCode));
        return;
      }
    }

    if (data.startsWith('PV-')) {
      await verifyAgainstDB(data);
      return;
    }

    Alert.alert('🚨 UNRECOGNIZED QR FORMAT', 'Yeh QR code PriVidya invoice verification ka nahi hai.', [
      { text: 'Scan Again', onPress: () => setScanned(false) },
    ]);
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned || loading) return;
    setScanned(true);
    processQrData(data);
  }

  // Upload Invoice Image & Decode QR
  async function pickFullInvoicePhoto() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery access zaroori hai.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: true,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      setLoading(true);
      const asset = pickerResult.assets[0];

      let base64Data = asset.base64;
      if (!base64Data && asset.uri) {
        base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      if (base64Data) {
        try {
          const jpeg = require('jpeg-js');
          const { Buffer } = require('buffer');
          const rawBuffer = Buffer.from(base64Data, 'base64');
          const decoded = jpeg.decode(rawBuffer, { useTArray: true });
          const code = jsQR(decoded.data, decoded.width, decoded.height);

          if (code && code.data) {
            setScanned(true);
            await processQrData(code.data);
            return;
          }
        } catch (err: any) {
          console.warn('Decode error:', err);
        }
      }

      setLoading(false);
      Alert.alert(
        'QR Code Read Nahi Hua',
        'Crop kiye gaye area mein QR detect nahi ho saka. Aap verification code ya invoice number type karke bhi check kar sakte hain.',
        [
          {
            text: 'Enter Code Manually',
            onPress: () => setShowManualInput(true),
          },
          { text: 'Try Again' },
        ]
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Error', err.message);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Invoice Authenticator',
          headerShown: true,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#D4AF37" size="large" />
          <Text style={styles.loadingText}>Verifying against live database records...</Text>
        </View>
      )}

      {!result ? (
        <View style={{ flex: 1 }}>
          {!permission?.granted ? (
            <View style={styles.centerCard}>
              <Ionicons name="camera-outline" size={56} color="#D4AF37" />
              <Text style={styles.permTitle}>Camera Access Required</Text>
              <Text style={styles.permDesc}>
                Invoice ka QR scan karne ke liye camera enable karein ya gallery se photo upload karein.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={requestPermission}>
                <Text style={styles.primaryBtnText}>Enable Camera</Text>
              </Pressable>

              <Pressable style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={pickFullInvoicePhoto}>
                <Ionicons name="images-outline" size={20} color="#D4AF37" />
                <Text style={styles.secondaryBtnText}>Upload & Crop QR Photo</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />

              <View style={styles.viewFinderOverlay}>
                <View style={styles.targetFrame}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                </View>

                <Text style={styles.scanHint}>Invoice ka QR camera frame ke andar layein</Text>

                <View style={styles.buttonRow}>
                  <Pressable style={styles.floatingActionBtn} onPress={pickFullInvoicePhoto}>
                    <Ionicons name="images" size={18} color="#0A0E1A" />
                    <Text style={styles.floatingActionText}>Gallery Photo</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.floatingActionBtn, { backgroundColor: '#2A3150' }]}
                    onPress={() => setShowManualInput(!showManualInput)}
                  >
                    <Ionicons name="keypad-outline" size={18} color="#D4AF37" />
                    <Text style={[styles.floatingActionText, { color: '#D4AF37' }]}>Enter Code</Text>
                  </Pressable>
                </View>

                {showManualInput && (
                  <View style={styles.manualInputCard}>
                    <TextInput
                      style={styles.input}
                      placeholder="Invoice / Verification Code (e.g. PV-VER-2026...)"
                      placeholderTextColor="#8A8FA3"
                      value={manualCode}
                      onChangeText={setManualCode}
                      autoCapitalize="characters"
                    />
                    <Pressable
                      style={styles.verifyBtn}
                      onPress={() => {
                        if (manualCode.trim()) verifyAgainstDB(manualCode.trim());
                      }}
                    >
                      <Text style={styles.verifyBtnText}>Verify</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultContent}>
          {result.isGenuine ? (
            <View style={styles.genuineBadge}>
              <Ionicons name="checkmark-circle" size={32} color="#4ADE80" />
              <View style={{ flex: 1 }}>
                <Text style={styles.genuineTitle}>✓ 100% GENUINE INVOICE</Text>
                <Text style={styles.genuineSub}>Authentic PriVidya payment record. No edits detected.</Text>
              </View>
            </View>
          ) : (
            <View style={styles.fakeBadge}>
              <Ionicons name="alert-circle" size={32} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={styles.fakeTitle}>🚨 TAMPERED / FAKE INVOICE</Text>
                <Text style={styles.fakeSub}>Data in image has been modified compared to live database!</Text>
              </View>
            </View>
          )}

          {result.tamperedFields.length > 0 && (
            <View style={styles.tamperBox}>
              <Text style={styles.tamperHead}>Detected Manipulations:</Text>
              {result.tamperedFields.map((field, idx) => (
                <Text key={idx} style={styles.tamperItem}>
                  • {field}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.invNumber}>{result.dbInvoice.invoice_number}</Text>
          <Text style={styles.orderId}>Order ID: {result.dbInvoice.order_id}</Text>

          <View style={styles.detailsBox}>
            <Text style={styles.boxTitle}>Official Database Record (Ground Truth)</Text>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Student Name</Text>
              <Text style={styles.val}>{result.student?.full_name || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Mobile</Text>
              <Text style={styles.val}>
                {result.dbInvoice.mobile || result.student?.mobile || 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Batch / Course</Text>
              <Text style={styles.val}>{result.dbInvoice.product_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Original UTR / TXN</Text>
              <Text style={[styles.val, styles.mono]}>{result.dbInvoice.transaction_id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Original Amount</Text>
              <Text style={[styles.val, styles.gold]}>₹{result.dbInvoice.amount}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Valid From</Text>
              <Text style={styles.val}>{result.dbInvoice.valid_from || 'Immediate'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Valid Until</Text>
              <Text style={styles.val}>{result.dbInvoice.valid_until || '1 Year'}</Text>
            </View>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setResult(null);
              setScanned(false);
              setManualCode('');
            }}
          >
            <Text style={styles.primaryBtnText}>Verify Another Invoice</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 26, 0.9)',
    zIndex: 99,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: '#D4AF37', fontWeight: '600', fontSize: 14 },
  centerCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  permTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginTop: 8 },
  permDesc: { color: '#8A8FA3', textAlign: 'center', fontSize: 13, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: '#0A0E1A', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  secondaryBtnText: { color: '#D4AF37', fontWeight: '700', fontSize: 14 },
  viewFinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  targetFrame: {
    width: width * 0.72,
    height: width * 0.72,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#D4AF37',
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  scanHint: { color: '#FFFFFF', marginTop: 20, fontSize: 14, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  floatingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D4AF37',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  floatingActionText: { color: '#0A0E1A', fontWeight: '800', fontSize: 13 },
  manualInputCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#151A2C',
    padding: 10,
    borderRadius: 12,
    marginTop: 16,
    width: width * 0.88,
    borderWidth: 1,
    borderColor: '#2A3150',
  },
  input: { flex: 1, color: 'white', fontSize: 13, paddingHorizontal: 10 },
  verifyBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  verifyBtnText: { color: '#0A0E1A', fontWeight: '700', fontSize: 13 },
  resultContent: { padding: 20, gap: 14, justifyContent: 'center' },
  genuineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#14532D',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  genuineTitle: { color: '#4ADE80', fontWeight: '900', fontSize: 16 },
  genuineSub: { color: '#86EFAC', fontSize: 12, marginTop: 2 },
  fakeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#450A0A',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  fakeTitle: { color: '#F87171', fontWeight: '900', fontSize: 16 },
  fakeSub: { color: '#FCA5A5', fontSize: 12, marginTop: 2 },
  tamperBox: {
    backgroundColor: '#2A1010',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  tamperHead: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
  tamperItem: { color: '#FCA5A5', fontSize: 12 },
  invNumber: { color: 'white', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  orderId: { color: '#8A8FA3', fontSize: 13, textAlign: 'center' },
  detailsBox: {
    backgroundColor: '#151A2C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A3150',
    padding: 16,
    gap: 12,
  },
  boxTitle: {
    color: '#D4AF37',
    fontWeight: '700',
    fontSize: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3150',
    paddingBottom: 8,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#8A8FA3', fontSize: 13 },
  val: { color: 'white', fontWeight: '600', fontSize: 13, maxWidth: '60%', textAlign: 'right' },
  mono: { fontFamily: 'monospace', color: '#60A5FA' },
  gold: { color: '#D4AF37', fontWeight: '800' },
});