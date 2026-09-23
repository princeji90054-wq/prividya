import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Pressable, Share, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';

import { isDataSaverEnabled } from '@/lib/dataSaver';
import { logStudyMinutes } from '@/lib/studyTracking';
import { supabase } from '@/lib/supabase';

// FIX (Bug #7): usePreventScreenCapture() used to be called here, which only
// applied FLAG_SECURE while THIS screen was mounted. It has been moved to
// the root _layout.tsx so the whole app is protected all the time, not just
// while a video is open (this also covers PDFs and every other screen).
// The screenshot LISTENER below is unrelated to that and stays here — it's
// for detecting/counting attempts, not for blocking them.

export default function WatchScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [videoId, setVideoId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [commentsPrivate, setCommentsPrivate] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [dataSaver, setDataSaver] = useState(false);

  const playerRef = useRef<any>(null);
  const lastTapLeft = useRef(0);
  const lastTapRight = useRef(0);
  const watchStartTime = useRef(Date.now());
  const saveProgressInterval = useRef<any>(null);

  const leftFlash = useRef(new Animated.Value(0)).current;
  const rightFlash = useRef(new Animated.Value(0)).current;
  const watermarkAnim = useRef(new Animated.ValueXY({ x: 10, y: 10 })).current;

  const { width: screenW, height: screenH } = useWindowDimensions();
  const isCurrentlyLandscape = screenW > screenH;
  const portraitVideoHeight = Math.round((screenW * 9) / 16);
  const landscapeVideoWidth = Math.min(screenW, screenH * (16 / 9));

  useEffect(() => {
    isDataSaverEnabled().then(setDataSaver);
  }, []);

  useEffect(() => {
    supabase.from('classes').select('youtube_video_id, title, is_live, share_token, chat_enabled, comments_private').eq('id', id).single().then(({ data }) => {
      if (data) {
        setVideoId(data.youtube_video_id);
        setTitle(data.title);
        setIsLive(!!data.is_live);
        setShareToken(data.share_token);
        setChatEnabled(!!data.chat_enabled);
        setCommentsPrivate(!!data.comments_private);
      }
    });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('full_name, mobile').eq('id', user.id).single();
      if (data) {
        setStudentName(data.full_name ?? '');
        const mobile = data.mobile ?? '';
        setStudentMobile(mobile.length >= 4 ? `XXXXXX${mobile.slice(-4)}` : mobile);
      }
    });

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      const minutesWatched = Math.round((Date.now() - watchStartTime.current) / 60000);
      logStudyMinutes(minutesWatched);
    };
  }, [id]);

  useEffect(() => { setIsLandscape(isCurrentlyLandscape); }, [isCurrentlyLandscape]);

  useEffect(() => {
    const moveWatermark = () => {
      const randX = Math.random() * (screenW - 140);
      const randY = Math.random() * (screenH * 0.6) + 20;
      Animated.timing(watermarkAnim, { toValue: { x: randX, y: randY }, duration: 3000, useNativeDriver: false }).start();
    };
    const interval = setInterval(moveWatermark, 6000);
    return () => clearInterval(interval);
  }, [screenW, screenH]);

  useEffect(() => {
    saveProgressInterval.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const time = await playerRef.current?.getCurrentTime();
        if (time && time > 0) {
          await supabase.from('watch_progress').upsert(
            { student_id: user.id, class_id: id, position_seconds: Math.floor(time), updated_at: new Date().toISOString() },
            { onConflict: 'student_id,class_id' }
          );
        }
      } catch (e) {}
    }, 10000); // every 10 seconds

    return () => clearInterval(saveProgressInterval.current);
  }, [id]);

  useEffect(() => {
    const sub = ScreenCapture.addScreenshotListener(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('security_violations').select('*').eq('student_id', user.id).eq('violation_type', 'screenshot').maybeSingle();
      const newCount = (existing?.count ?? 0) + 1;

      if (existing) {
        await supabase.from('security_violations').update({ count: newCount }).eq('id', existing.id);
      } else {
        await supabase.from('security_violations').insert({ student_id: user.id, violation_type: 'screenshot', count: 1 });
      }

      if (newCount >= 3) {
        await supabase.from('profiles').update({
          is_locked: true,
          lock_reason: 'Repeated screenshot/recording attempts detected (3 warnings).',
        }).eq('id', user.id);
        Alert.alert('Account Locked', 'All batches have been locked due to repeated screenshot attempts. Contact admin to review.');
      } else {
        Alert.alert('Warning', `Screenshot detected. ${3 - newCount} warning(s) remaining before your batches get locked.`);
      }
    });
    return () => sub.remove();
  }, []);

  const flashIcon = (anim: Animated.Value) => {
    anim.setValue(1);
    Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
  };

  const seekBy = async (delta: number) => {
    try {
      const time = await playerRef.current?.getCurrentTime();
      playerRef.current?.seekTo(Math.max(0, time + delta), true);
    } catch (e) {}
  };

  const handleLeftPress = () => {
    const now = Date.now();
    if (now - lastTapLeft.current < 300) { seekBy(-10); flashIcon(leftFlash); }
    lastTapLeft.current = now;
  };

  const handleRightPress = () => {
    const now = Date.now();
    if (now - lastTapRight.current < 300) { seekBy(10); flashIcon(rightFlash); }
    lastTapRight.current = now;
  };

  const toggleOrientation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsLandscape(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsLandscape(true);
    }
  };

  async function shareVideo() {
    if (!shareToken) return;
    await Share.share({
      message: `Watch this class on PriVidya: prividya://share/class/${shareToken}`,
    });
  }

  const getInjectedJS = (isDataSaverMode: boolean) => `
    const style = document.createElement('style');
    style.innerHTML = \`
      .ytp-chrome-top, .ytp-chrome-bottom, .ytp-gradient-top, .ytp-gradient-bottom,
      .ytp-pause-overlay, .ytp-watermark, .ytp-youtube-button, .ytp-bezel-text-wrapper,
      .ytp-settings-button, a[href*="youtube.com"] {
        display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;
      }
    \`;
    document.head.appendChild(style);
    ${isDataSaverMode ? `
      setTimeout(() => {
        const player = document.querySelector('video');
        if (player && window.YT && window.YT.get) {
          try {
            const ytPlayer = window.YT.get(Object.keys(window.YT.get)[0]);
            if (ytPlayer && ytPlayer.setPlaybackQuality) ytPlayer.setPlaybackQuality('small');
          } catch (e) {}
        }
      }, 1500);
    ` : ''}
    true;
  `;

  const webViewProps = useMemo(
    () => ({
      injectedJavaScript: getInjectedJS(dataSaver),
      mediaPlaybackRequiresUserAction: false,
      allowsInlineMediaPlayback: true,
      androidLayerType: 'hardware' as const,
      scalesPageToFit: true,
      setSupportMultipleWindows: false,
      onShouldStartLoadWithRequest: (request: any) => {
        const url = (request.url || '').toLowerCase();
        if (
          url.startsWith('intent://') || url.startsWith('vnd.youtube:') || url.startsWith('market://') ||
          url.includes('youtube.com/watch') || url.includes('youtu.be')
        ) return false;
        return url.includes('embed') || url.startsWith('about:blank');
      },
    }),
    [dataSaver]
  );

  if (!videoId) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: !isLandscape,
          title: isLive ? `🔴 LIVE — ${title}` : title,
          headerStyle: { backgroundColor: '#0A0E1A' },
          headerTintColor: 'white',
        }}
      />
      <StatusBar hidden={isLandscape} />

      <View
        style={
          isLandscape
            ? [styles.videoContainerFullscreen, { width: screenW, height: screenH }]
            : [styles.videoContainerPortrait, { width: screenW, height: portraitVideoHeight }]
        }
      >
        <YoutubePlayer
          ref={playerRef}
          height={isLandscape ? screenH : portraitVideoHeight}
          width={isLandscape ? landscapeVideoWidth : screenW}
          videoId={videoId}
          initialPlayerParams={{ controls: false, modestbranding: true, rel: false, preventFullScreen: true, iv_load_policy: 3 }}
          webViewProps={webViewProps}
          webViewStyle={styles.webView}
          onReady={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: progress } = await supabase
              .from('watch_progress').select('position_seconds').eq('student_id', user.id).eq('class_id', id).maybeSingle();
            if (progress?.position_seconds) {
              playerRef.current?.seekTo(progress.position_seconds, true);
            }
          }}
        />

        <View style={styles.overlayRow} pointerEvents="box-none">
          <Pressable style={styles.sideZone} onPress={handleLeftPress}>
            <Animated.View style={[styles.flashBox, { opacity: leftFlash }]} pointerEvents="none">
              <Text style={styles.flashText}>⟲ 10s</Text>
            </Animated.View>
          </Pressable>
          <View style={styles.centerHole} pointerEvents="none" />
          <Pressable style={styles.sideZone} onPress={handleRightPress}>
            <Animated.View style={[styles.flashBox, { opacity: rightFlash }]} pointerEvents="none">
              <Text style={styles.flashText}>10s ⟳</Text>
            </Animated.View>
          </Pressable>
        </View>

        <Animated.View
          style={[styles.watermark, { transform: [{ translateX: watermarkAnim.x }, { translateY: watermarkAnim.y }] }]}
          pointerEvents="none">
          <Text style={styles.watermarkText}>{studentName}</Text>
          <Text style={styles.watermarkText}>{studentMobile}</Text>
        </Animated.View>

        {isLive && (
          <View style={styles.liveBadge} pointerEvents="none">
            <Text style={styles.liveBadgeText}>🔴 LIVE</Text>
          </View>
        )}

        <TouchableOpacity style={styles.rotateBtn} onPress={toggleOrientation}>
          <Text style={styles.rotateText}>⛶</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.notesBtn} onPress={() => router.push(`/notes/${id}` as any)}>
          <Text style={styles.rotateText}>📝</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={shareVideo}>
          <Text style={styles.rotateText}>↗</Text>
        </TouchableOpacity>
      </View>

      {!isLandscape && isLive && chatEnabled && <LiveChat classId={String(id)} />}
      {!isLandscape && <VideoComments classId={String(id)} isPrivate={commentsPrivate} />}
    </SafeAreaView>
  );
}

function VideoComments({ classId, isPrivate }: { classId: string; isPrivate: boolean }) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setMyId(user?.id ?? null);
    let isUserAdmin = false;
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      isUserAdmin = profile?.role === 'admin' || profile?.role === 'owner';
      setIsAdmin(isUserAdmin);
    }
    let query = supabase.from('video_comments').select('*, profiles(full_name)').eq('class_id', classId).order('created_at', { ascending: false });

    if (isPrivate && !isUserAdmin) {
      query = query.eq('student_id', user?.id);
    }
    const { data } = await query;
    setComments(data ?? []);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`video-comments-${classId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'video_comments', filter: `class_id=eq.${classId}` }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [classId]);

  async function send() {
    if (!text.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('video_comments').insert({ student_id: user?.id, class_id: classId, comment: text.trim() });
    setText('');
    load();
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: 'white' }}
          placeholder="Add a comment..."
          placeholderTextColor="#8A8FA3"
          value={text}
          onChangeText={setText}
        />
        <Pressable style={{ backgroundColor: '#D4AF37', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' }} onPress={send}>
          <Text style={{ color: '#0A0E1A', fontWeight: '700' }}>Post</Text>
        </Pressable>
      </View>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2A3150' }}>
            <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: '700' }}>{item.profiles?.full_name}</Text>
            <Text style={{ color: 'white', fontSize: 13 }}>{item.comment}</Text>
          </View>
        )}
      />
    </View>
  );
}

function LiveChat({ classId }: { classId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');

  async function load() {
    const { data } = await supabase.from('live_chat_messages').select('*, profiles(full_name)').eq('class_id', classId).order('created_at', { ascending: true }).limit(100);
    setMessages(data ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`live-chat-${classId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `class_id=eq.${classId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [classId]);

  async function send() {
    if (!text.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('live_chat_messages').insert({ class_id: classId, student_id: user?.id, message: text.trim() });
    setText('');
  }

  return (
    <View style={{ height: 220, borderTopWidth: 1, borderTopColor: '#2A3150', padding: 12, gap: 8 }}>
      <Text style={{ color: '#D4AF37', fontWeight: '700', fontSize: 13 }}>Live Chat</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text style={{ color: 'white', fontSize: 12, marginBottom: 4 }}>
            <Text style={{ color: '#D4AF37', fontWeight: '700' }}>{item.profiles?.full_name}: </Text>{item.message}
          </Text>
        )}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: '#151A2C', borderWidth: 1, borderColor: '#2A3150', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, color: 'white' }}
          placeholder="Message..."
          placeholderTextColor="#8A8FA3"
          value={text}
          onChangeText={setText}
        />
        <Pressable style={{ backgroundColor: '#D4AF37', borderRadius: 20, paddingHorizontal: 14, justifyContent: 'center' }} onPress={send}>
          <Text style={{ color: '#0A0E1A', fontWeight: '700', fontSize: 12 }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  loadingContainer: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  videoContainerPortrait: { backgroundColor: '#000', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  videoContainerFullscreen: { position: 'absolute', top: 0, left: 0, zIndex: 999, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  webView: { backgroundColor: '#000000', opacity: 0.99 },
  overlayRow: { ...StyleSheet.absoluteFill, flexDirection: 'row', zIndex: 30 },
  sideZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerHole: { width: 120, height: '100%' },
  flashBox: { backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 },
  flashText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  watermark: { position: 'absolute', opacity: 0.35, zIndex: 35 },
  watermarkText: { color: 'white', fontSize: 11, fontWeight: '600' },
  liveBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(220,38,38,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, zIndex: 40 },
  liveBadgeText: { color: 'white', fontWeight: '700', fontSize: 11 },
  rotateBtn: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.65)', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  notesBtn: { position: 'absolute', bottom: 16, right: 108, backgroundColor: 'rgba(0,0,0,0.65)', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  rotateText: { color: '#fff', fontSize: 18 },
  shareBtn: { position: 'absolute', bottom: 16, right: 62, backgroundColor: 'rgba(0,0,0,0.65)', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
});