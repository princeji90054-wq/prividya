import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkIfBlocked } from '@/lib/blockCheck';
import { requestCaptcha, verifyCaptcha } from '@/lib/captcha';
import { checkDeviceBinding, confirmDeviceReset, getDeviceId } from '@/lib/deviceBinding';
import { signInWithGoogle } from '@/lib/googleAuth';
import { notifyAdmins } from '@/lib/notifyAdmins';
import { checkRateLimit, clearRateLimit, recordFailedLogin } from '@/lib/serverRateLimit';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);

  // CAPTCHA state
  const [captchaChallengeId, setCaptchaChallengeId] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(true);

  async function loadCaptcha() {
    setCaptchaLoading(true);
    setCaptchaAnswer('');
    try {
      const { challengeId, question } = await requestCaptcha();
      setCaptchaChallengeId(challengeId);
      setCaptchaQuestion(question);
    } catch (err: any) {
      Alert.alert('Error', 'Could not load verification challenge: ' + err.message);
    } finally {
      setCaptchaLoading(false);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert('Enter email', 'Please type your email above first, then tap Forgot Password.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'privydia://reset-password',
    });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Check your email', 'We sent you a password reset link.');
  }

  // Device check
  async function handleDeviceCheckAfterLogin(userId: string) {
    const deviceCheck = await checkDeviceBinding(userId);

    if (deviceCheck.status === 'blocked') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single();

      if (profile?.role === 'admin' || profile?.role === 'owner') {
        await notifyAdmins(
          'Unauthorized Admin Login Attempt',
          `${profile.full_name ?? 'An admin'} tried to log in from a new, unrecognized device and was blocked. Contact them if this wasn't expected.`
        );
      }

      await supabase.auth.signOut();
      Alert.alert(
        'Device not recognized',
        'This account is already bound to another device. Please contact admin/owner to reset it.'
      );
      return 'blocked';
    }

    if (deviceCheck.status === 'needs-confirmation') {
      return new Promise<'handled'>((resolve) => {
        Alert.alert(
          'New device detected',
          'This will reset your account to this new device (allowed once for free). Continue?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: async () => {
                await supabase.auth.signOut();
                resolve('handled');
              },
            },
            {
              text: 'Continue',
              onPress: async () => {
                await confirmDeviceReset(userId, deviceCheck.currentDeviceId!);
                resolve('handled');
              },
            },
          ]
        );
      });
    }

    return 'ok';
  }

  // Role routing helper
  async function routeUserByRole(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'admin' || profile?.role === 'owner') {
      router.replace('/admin' as any);
    } else {
      router.replace('/(tabs)' as any);
    }
  }

  async function handleGoogleSignIn() {
    if (!captchaChallengeId || !captchaAnswer.trim()) {
      Alert.alert('Verification required', 'Please solve the math challenge above first.');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyCaptcha(captchaChallengeId, captchaAnswer.trim());
      if (!isValid) {
        Alert.alert('Verification failed', 'Incorrect answer. Please try again.');
        setLoading(false);
        loadCaptcha();
        return;
      }

      await signInWithGoogle();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .maybeSingle();

        if (!existingProfile) {
          const deviceId = await getDeviceId();
          const blocked = await checkIfBlocked(deviceId, user.email?.toLowerCase() ?? '', null);
          if (blocked) {
            await supabase.auth.signOut();
            Alert.alert(
              'Cannot register',
              `This device or email is blocked. Reason: ${blocked.reason ?? 'Policy violation'}`
            );
            setLoading(false);
            return;
          }

          await supabase.from('profiles').insert({
            id: user.id,
            full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? '',
            email: user.email,
            role: 'student',
          });
          await checkDeviceBinding(user.id);
          router.replace('/(tabs)' as any);
        } else {
          const deviceStatus = await handleDeviceCheckAfterLogin(user.id);
          if (deviceStatus !== 'blocked') {
            await routeUserByRole(user.id);
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Google Sign-In failed', err.message);
    } finally {
      setLoading(false);
      loadCaptcha();
    }
  }

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Email and password are both required.');
      return;
    }
    if (isSignup && !fullName) {
      Alert.alert('Missing info', 'Please enter your name too.');
      return;
    }
    if (!captchaChallengeId || !captchaAnswer.trim()) {
      Alert.alert('Verification required', 'Please solve the math challenge above first.');
      return;
    }

    const attemptKey = email.trim().toLowerCase();

    if (!isSignup) {
      const rateCheck = await checkRateLimit(attemptKey);
      if (rateCheck.locked) {
        Alert.alert('Too many attempts', `Please try again in ${rateCheck.minutesLeft} minute(s).`);
        return;
      }
    }

    setLoading(true);

    const isCaptchaValid = await verifyCaptcha(captchaChallengeId, captchaAnswer.trim()).catch(
      (err) => {
        Alert.alert('Error', err.message);
        return false;
      }
    );

    if (!isCaptchaValid) {
      Alert.alert('Verification failed', 'Incorrect answer to the math challenge. Please try again.');
      setLoading(false);
      loadCaptcha();
      return;
    }

    if (isSignup) {
      const deviceId = await getDeviceId();
      const blocked = await checkIfBlocked(deviceId, email.trim().toLowerCase(), null);
      if (blocked) {
        Alert.alert(
          'Cannot register',
          `This device or email is blocked. Reason: ${blocked.reason ?? 'Policy violation'}`
        );
        setLoading(false);
        loadCaptcha();
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        Alert.alert('Signup failed', error.message);
        setLoading(false);
        loadCaptcha();
        return;
      }

      if (data.user) {
        let referrerId = null;
        if (referralCode.trim()) {
          const { data: referrer } = await supabase
            .from('profiles')
            .select('id')
            .ilike('student_id', referralCode.trim())
            .maybeSingle();
          referrerId = referrer?.id ?? null;

          if (referralCode.trim() && !referrerId) {
            Alert.alert(
              'Referral code not found',
              'We could not find that referral code. Your account will still be created without it.'
            );
          }
        }

        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          email: email,
          role: 'student',
          referred_by: referrerId,
        });

        if (profileError) Alert.alert('Profile error', profileError.message);
        await checkDeviceBinding(data.user.id);
        router.replace('/(tabs)' as any);
      }

      Alert.alert('Success', 'Account created! Logging you in...');
      setLoading(false);
      loadCaptcha();
    } else {
      // Regular login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        const result = await recordFailedLogin(attemptKey);
        if (result.locked) {
          Alert.alert(
            'Too many attempts',
            `Locked for ${result.minutesLeft} minutes due to repeated failed logins.`
          );
        } else {
          Alert.alert('Login failed', error.message);
        }
        setLoading(false);
        loadCaptcha();
        return;
      }

      await clearRateLimit(attemptKey);

      if (data.user) {
        const deviceStatus = await handleDeviceCheckAfterLogin(data.user.id);

        if (deviceStatus !== 'blocked') {
          // Direct role routing
          await routeUserByRole(data.user.id);
        }
      }

      setLoading(false);
      loadCaptcha();
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.logo}>PriVidya</Text>
          <Text style={styles.subtitle}>{isSignup ? 'Create a new account' : 'Welcome back'}</Text>

          {isSignup && (
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#8A8FA3"
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#8A8FA3"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8A8FA3"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {isSignup && (
            <TextInput
              style={styles.input}
              placeholder="Referral Code (optional)"
              placeholderTextColor="#8A8FA3"
              value={referralCode}
              onChangeText={setReferralCode}
              autoCapitalize="characters"
            />
          )}

          <Pressable style={styles.captchaBox} onPress={loadCaptcha}>
            {captchaLoading ? (
              <ActivityIndicator color="#D4AF37" />
            ) : (
              <Text style={styles.captchaQuestion}>
                {captchaQuestion} <Text style={styles.refreshHint}>(tap to refresh)</Text>
              </Text>
            )}
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Answer"
            placeholderTextColor="#8A8FA3"
            value={captchaAnswer}
            onChangeText={setCaptchaAnswer}
            keyboardType="numeric"
          />

          {!isSignup && (
            <Pressable onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          )}

          <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#0A0E1A" />
            ) : (
              <Text style={styles.buttonText}>{isSignup ? 'Sign Up' : 'Login'}</Text>
            )}
          </Pressable>

          <Pressable style={styles.googleButton} onPress={handleGoogleSignIn} disabled={loading}>
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>

          <Pressable onPress={() => setIsSignup(!isSignup)}>
            <Text style={styles.switchText}>
              {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign up"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('/owner-recovery' as any)}>
            <Text style={styles.ownerRecoveryText}>Owner? Recover your account</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/parent-signup' as any)}>
            <Text style={styles.ownerRecoveryText}>Parent? Create a linked account</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0A0E1A' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  logo: { color: '#D4AF37', fontSize: 36, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#8A8FA3', fontSize: 16, textAlign: 'center', marginBottom: 24 },
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
  captchaBox: {
    backgroundColor: '#1A2036',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  captchaQuestion: { color: '#D4AF37', fontSize: 16, fontWeight: '700' },
  refreshHint: { color: '#8A8FA3', fontSize: 10, fontWeight: '400' },
  forgotText: { color: '#3C9FFE', fontSize: 13, textAlign: 'right' },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#0A0E1A', fontSize: 16, fontWeight: '700' },
  googleButton: {
    backgroundColor: '#151A2C',
    borderWidth: 1,
    borderColor: '#2A3150',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  googleButtonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  switchText: { color: '#3C9FFE', textAlign: 'center', marginTop: 16, fontSize: 14 },
  ownerRecoveryText: { color: '#8A8FA3', textAlign: 'center', fontSize: 12, marginTop: 8 },
});