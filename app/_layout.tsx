import type { Session } from '@supabase/supabase-js';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  LogBox,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { isBiometricLockEnabled } from '@/lib/biometricLock';
import { supabase } from '@/lib/supabase';
import { checkForTampering, reportTamper } from '@/lib/tamperDetection';
import BiometricLockScreen from './biometric-lock';

// Mute harmless Expo/React Native LogBox warnings
LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
  "Response.blob() is using React Native",
]);

SplashScreen.preventAutoHideAsync();

const CURRENT_APP_VERSION = '1.0.0';

const STUDENT_ALLOWED_GROUPS = [
  '(tabs)',
  'category',
  'batch',
  'watch',
  'notifications',
  'doubts',
  'support',
  'leaderboard',
  'badges',
  'focus',
  'reset-password',
  'library',
  'invoices',
  'messages',
  'my-courses',
  'about',
  'referral-status',
  'coin-history',
  'edit-profile',
  'tests',
  'search',
  'share',
  'practice',
  'bookmarks',
  'analytics',
  'gk',
  'pyq',
  'notes',
  'forum',
  'exam-calendar',
  'mistake-notebook',
  'compare-batches',
  'study-planner',
  'policy-accept',
  'my-data-export',
];

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const isMountedRef = useRef(false);

  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [needsPolicyAccept, setNeedsPolicyAccept] = useState(false);
  const [verificationLocked, setVerificationLocked] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isLockedByBiometric, setIsLockedByBiometric] = useState(false);

  // Track component mounted status to prevent updating unmounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  useEffect(() => {
    checkForTampering().then(async (result) => {
      if (!isMountedRef.current) return;
      if (result.suspicious) {
        await reportTamper(result.reason!);
        Alert.alert(
          'Security Check Failed',
          'This app cannot run in this environment. Please use the official app on a genuine device.',
          [{ text: 'OK' }]
        );
      }
    });
  }, []);

  async function fetchProfile(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, gender, age, mobile, is_locked, is_blocked, verification_locked, accepted_policy_version')
      .eq('id', userId)
      .maybeSingle();

    if (!isMountedRef.current) return;

    if (!profile) {
      setProfileMissing(true);
      return;
    }

    setProfileMissing(false);
    setRole(profile.role ?? 'student');
    setProfileComplete(!!(profile.gender && profile.age && profile.mobile));
    setIsLocked(profile.is_locked ?? false);
    setIsBlocked(profile.is_blocked ?? false);
    setVerificationLocked(profile.verification_locked ?? false);

    const { data: policySettings } = await supabase
      .from('policy_settings')
      .select('current_version')
      .eq('id', 1)
      .maybeSingle();

    if (policySettings && profile.accepted_policy_version < policySettings.current_version) {
      setNeedsPolicyAccept(true);
    } else {
      setNeedsPolicyAccept(false);
    }
  }

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMountedRef.current) return;

      setSession(session);
      if (session) await fetchProfile(session.user.id);
      if (isMountedRef.current) setChecked(true);
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event: string, newSession: Session | null) => {
        if (!isMountedRef.current) return;
        setSession(newSession);
        if (newSession) {
          await fetchProfile(newSession.user.id);
        } else {
          setRole(null);
          setProfileComplete(true);
          setIsLocked(false);
          setIsBlocked(false);
          setVerificationLocked(false);
          setProfileMissing(false);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`profile-watch-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        (payload: any) => {
          if (!isMountedRef.current) return;
          setVerificationLocked(payload.new.verification_locked ?? false);
          setIsLocked(payload.new.is_locked ?? false);
          setIsBlocked(payload.new.is_blocked ?? false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    supabase
      .from('app_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (isMountedRef.current && data && data.version !== CURRENT_APP_VERSION) {
          setUpdateInfo(data);
        }
      });
  }, []);

  useEffect(() => {
    if (profileMissing) {
      supabase.auth.signOut();
    }
  }, [profileMissing]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active' && session) {
        const enabled = await isBiometricLockEnabled();
        if (isMountedRef.current && enabled) setIsLockedByBiometric(true);
      }
    });
    return () => sub.remove();
  }, [session]);

  // Safe Navigation Router Guard
  useEffect(() => {
    if (!checked || !isMountedRef.current) return;

    // Use requestAnimationFrame so that router execution happens after layout mounts
    const handle = requestAnimationFrame(() => {
      if (!isMountedRef.current) return;
      const currentGroup = segments[0];

      if (!session || profileMissing) {
        if (
          currentGroup !== 'login' &&
          currentGroup !== 'owner-recovery' &&
          currentGroup !== 'parent-signup'
        ) {
          router.replace('/login' as any);
        }
        return;
      }

      if (isBlocked && currentGroup !== 'account-locked') {
        router.replace('/account-locked' as any);
        return;
      }

      if (isLocked && currentGroup !== 'account-locked') {
        router.replace('/account-locked' as any);
        return;
      }

      if (verificationLocked && currentGroup !== 'verify-otp') {
        router.replace('/verify-otp' as any);
        return;
      }

      if (needsPolicyAccept && currentGroup !== 'policy-accept') {
        router.replace('/policy-accept' as any);
        return;
      }

      const isAdmin = role === 'admin' || role === 'owner';
      const isParent = role === 'parent';

      if (isParent && currentGroup !== 'parent-dashboard') {
        router.replace('/parent-dashboard' as any);
        return;
      }

      if (!isAdmin && !isParent && !isLocked && !isBlocked && !verificationLocked && !profileComplete) {
        if (currentGroup !== 'complete-profile') router.replace('/complete-profile' as any);
        return;
      }

      if (isAdmin && currentGroup !== 'admin') {
        router.replace('/admin' as any);
      } else if (
        !isAdmin &&
        !isParent &&
        !verificationLocked &&
        !STUDENT_ALLOWED_GROUPS.includes(currentGroup as string)
      ) {
        router.replace('/(tabs)' as any);
      }
    });

    return () => cancelAnimationFrame(handle);
  }, [
    session,
    role,
    profileComplete,
    isLocked,
    isBlocked,
    verificationLocked,
    needsPolicyAccept,
    profileMissing,
    checked,
    segments,
  ]);

  if (!checked) return null;

  if (isLockedByBiometric) {
    return <BiometricLockScreen onUnlocked={() => setIsLockedByBiometric(false)} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />

        {updateInfo && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <View
              style={{
                backgroundColor: '#151A2C',
                borderRadius: 16,
                padding: 24,
                gap: 12,
                borderWidth: 1,
                borderColor: '#D4AF37',
              }}
            >
              <Text style={{ color: '#D4AF37', fontSize: 18, fontWeight: '700' }}>
                Update Available: v{updateInfo.version}
              </Text>
              <Text style={{ color: '#B8C0D8', fontSize: 13 }}>{updateInfo.notes}</Text>
              <Pressable
                style={{
                  backgroundColor: '#D4AF37',
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  if (updateInfo.apk_url) Linking.openURL(updateInfo.apk_url);
                }}
              >
                <Text style={{ color: '#0A0E1A', fontWeight: '700' }}>Update Now</Text>
              </Pressable>
              {!updateInfo.is_mandatory && (
                <Pressable onPress={() => setUpdateInfo(null)}>
                  <Text style={{ color: '#8A8FA3', textAlign: 'center', fontSize: 13 }}>Later</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ThemeProvider>
    </ErrorBoundary>
  );
}