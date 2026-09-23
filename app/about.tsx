import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'About & Terms', headerShown: true, headerStyle: { backgroundColor: '#0A0E1A' }, headerTintColor: 'white' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>About PriVidya</Text>
        <Text style={styles.para}>PriVidya is a private learning platform for competitive exam preparation, offering structured batches, live and recorded classes, and study material.</Text>

        <Text style={styles.heading}>Terms & Conditions</Text>
        <Text style={styles.para}>1. This app is for the purchase and consumption of digital educational products and services provided by PriVidya.{"\n\n"}2. Access to purchased batches is provided as per the validity period mentioned in your invoice.{"\n\n"}3. No refund will be applicable once course access has been granted, except in critical cases reviewed by admin.{"\n\n"}4. Sharing your account, video content, or study material outside the app is strictly prohibited and may result in account suspension.{"\n\n"}5. Each account is bound to one device. Unauthorized attempts to bypass this may result in a permanent block.</Text>

        <Text style={styles.heading}>Privacy Policy</Text>
        <Text style={styles.para}>We collect your name, contact details, and usage data solely to provide and improve our services. Your data is not sold to third parties. Payment proofs are deleted after verification.</Text>

        <Text style={styles.heading}>Refund Policy</Text>
        <Text style={styles.para}>Refunds are not offered by default. In case of accidental or duplicate payments, contact support within 48 hours for review.</Text>

        <Text style={styles.heading}>Contact</Text>
        <Text style={styles.para}>support@prividya.in</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 20, gap: 10 },
  heading: { color: '#D4AF37', fontSize: 17, fontWeight: '700', marginTop: 16 },
  para: { color: '#B8C0D8', fontSize: 13, lineHeight: 20 },
});