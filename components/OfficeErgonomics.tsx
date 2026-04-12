'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Monitor, Volume2, VolumeX, CheckCircle2, AlertTriangle, ScanLine, ArrowLeft, ChevronRight, Settings, Bell, BellOff, X } from 'lucide-react';
import CameraPermission from './CameraPermission';
import BottomNav from './BottomNav';
import { usePoseLandmarker } from '@/hooks/usePoseLandmarker';
import { drawGlowingSkeleton } from '@/lib/gestureAnalysis';

type CameraState = 'idle' | 'requesting' | 'granted' | 'denied';
type PostureState = 'good' | 'slouching' | 'unknown';

const SLOUCH_TRIGGER_MS   = 2000;
const ALERT_COOLDOWN_MS   = 30_000;
const CALIBRATION_FRAMES  = 60;   // ~2 s of data
const CAL_STORAGE_KEY     = 'gestureflow_office_calibration';
const VOICE_STORAGE_KEY   = 'gestureflow_office_voice';
const OFFICE_SETTINGS_KEY = 'gestureflow_office_settings';
const OFFICE_NOTIF_KEY    = 'gestureflow_office_last_notif';

interface OfficeSettings {
  notificationsEnabled: boolean;
  reminderTime: string; // "HH:MM"
}
const DEFAULT_OFFICE_SETTINGS: OfficeSettings = { notificationsEnabled: false, reminderTime: '09:00' };

function loadOfficeSettings(): OfficeSettings {
  try {
    const raw = localStorage.getItem(OFFICE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_OFFICE_SETTINGS };
    return { ...DEFAULT_OFFICE_SETTINGS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_OFFICE_SETTINGS }; }
}

// ── Push subscription helpers (shared with SmileQuota) ────────────────────────
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

function localToUtcTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

async function subscribeToPush(reminderTime: string, source: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), reminderTime: localToUtcTime(reminderTime), source }),
  });
}

async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

// ── Voice profiles ────────────────────────────────────────────────────────────
// mobile:true → shown on phones (<768px). All animal SFX always shown.
const VOICE_PROFILES = [
  { id: 'gb-f',  label: 'Sophie',    lang: 'en-GB', pitch: 1.1,  rate: 0.88, mobile: false, prefer: /hazel|kate|serena|google uk.*fem|emily/i },
  { id: 'gb-m',  label: 'Oliver',    lang: 'en-GB', pitch: 0.88, rate: 0.85, mobile: true,  prefer: /daniel|george|google uk.*mal|oliver/i },
  { id: 'au-f',  label: 'Charlotte', lang: 'en-AU', pitch: 1.1,  rate: 0.9,  mobile: true,  prefer: /karen|lee|catherine|google aus.*fem/i },
  // ── Sound effects (always available) ──
  { id: 'sfx-cat',  label: '🐱 Cat — Meow',   lang: 'en-US', pitch: 1, rate: 1, mobile: true, prefer: /never_match_x/i },
  { id: 'sfx-dog',  label: '🐶 Dog — Woof',   lang: 'en-US', pitch: 1, rate: 1, mobile: true, prefer: /never_match_x/i },
  { id: 'sfx-duck', label: '🦆 Duck — Quack', lang: 'en-US', pitch: 1, rate: 1, mobile: true, prefer: /never_match_x/i },
  { id: 'sfx-cow',  label: '🐄 Cow — Moo',    lang: 'en-US', pitch: 1, rate: 1, mobile: true, prefer: /never_match_x/i },
] as const;
type VoiceId = typeof VOICE_PROFILES[number]['id'];

interface Calibration { headDrop: number; shoulderEye: number }

// ── Slouch detection (calibration-relative) ────────────────────────────────────
// HEAD_DROP_SLACK: how much the ratio may fall below baseline before flagging
// SHOULDER_SLACK:  how much the ratio may fall below baseline before flagging
// Both signals must trigger simultaneously to avoid false positives.
const HEAD_DROP_SLACK  = 0.28;
const SHOULDER_SLACK   = 0.50;

function extractRatios(lm: { x: number; y: number; visibility?: number }[]) {
  const vis = (p: typeof lm[0], t = 0.3) => (p?.visibility ?? 1) >= t;
  const nose = lm[0], lEye = lm[2], rEye = lm[5], lS = lm[11], rS = lm[12];

  if (!vis(nose) || !vis(lS) || !vis(rS)) return null;
  const shoulderWidth = Math.abs(rS.x - lS.x);
  if (shoulderWidth < 0.06) return null;

  const headDrop   = ((lS.y + rS.y) / 2 - nose.y) / shoulderWidth;
  const eyeWidth   = vis(lEye, 0.5) && vis(rEye, 0.5) ? Math.abs(rEye.x - lEye.x) : 0;
  const shoulderEye = eyeWidth > 0.015 ? shoulderWidth / eyeWidth : null;

  return { headDrop, shoulderEye };
}

function isSlouching(
  lm: { x: number; y: number; visibility?: number }[],
  cal: Calibration | null
): boolean {
  const r = extractRatios(lm);
  if (!r) return false;

  if (!cal) {
    // Uncalibrated: use either signal with moderate thresholds
    const headBad     = r.headDrop < 1.5;
    const shoulderBad = r.shoulderEye !== null && r.shoulderEye < 3.8;
    return headBad || shoulderBad;
  }

  const headBad     = r.headDrop < cal.headDrop - HEAD_DROP_SLACK;
  const shoulderBad = r.shoulderEye !== null && r.shoulderEye < cal.shoulderEye - SHOULDER_SLACK;
  // Require BOTH to avoid false positives
  return headBad && shoulderBad;
}

// ── Real animal sounds — served from /public/sounds/ (downloaded at build time) ─
// scripts/download-sounds.mjs fetches them from Wikimedia Commons during
// Vercel build so they're on the same origin — zero CORS issues.
const SFX_URLS: Record<string, string> = {
  'sfx-cat':  '/sounds/cat.ogg',
  'sfx-dog':  '/sounds/dog.ogg',
  'sfx-duck': '/sounds/duck.ogg',
  'sfx-cow':  '/sounds/cow.ogg',
};

function playSfxFallback(id: string) {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const now = ctx.currentTime;

  if (id === 'sfx-cat') {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(650, now); o.frequency.linearRampToValueAtTime(1050, now + 0.12); o.frequency.linearRampToValueAtTime(780, now + 0.38);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.3, now + 0.05); g.gain.linearRampToValueAtTime(0, now + 0.5);
    o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.5);
  } else if (id === 'sfx-dog') {
    [0, 0.22].forEach(t => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; const g = ctx.createGain();
      o.frequency.setValueAtTime(160, now + t); o.frequency.linearRampToValueAtTime(110, now + t + 0.15);
      g.gain.setValueAtTime(0.4, now + t); g.gain.exponentialRampToValueAtTime(0.01, now + t + 0.18);
      o.connect(g); g.connect(ctx.destination); o.start(now + t); o.stop(now + t + 0.2);
    });
  } else if (id === 'sfx-duck') {
    // Two nasal quacks: fast rise then drop in pitch
    [0, 0.32].forEach(t => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(700, now + t); o.frequency.linearRampToValueAtTime(1100, now + t + 0.06); o.frequency.linearRampToValueAtTime(450, now + t + 0.22);
      g.gain.setValueAtTime(0, now + t); g.gain.linearRampToValueAtTime(0.5, now + t + 0.02); g.gain.linearRampToValueAtTime(0, now + t + 0.25);
      o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(now + t); o.stop(now + t + 0.28);
    });
  } else if (id === 'sfx-cow') {
    // Deep resonant moo: low fundamental, slow pitch arc, formant filter
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 350; f.Q.value = 4;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(75, now); o.frequency.linearRampToValueAtTime(120, now + 0.35); o.frequency.linearRampToValueAtTime(80, now + 1.1);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5, now + 0.1); g.gain.setValueAtTime(0.45, now + 0.9); g.gain.linearRampToValueAtTime(0, now + 1.3);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 1.35);
  } else {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    g.gain.value = 0.2; o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.2);
  }
}

function playSfx(id: string) {
  const url = SFX_URLS[id];
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = 0.9;
  audio.play().catch(() => playSfxFallback(id));
}

// ── Resolve best matching browser voice ──────────────────────────────────────
// Known female/male names used by iOS/macOS/Android TTS voices
const FEMALE_VOICE_NAMES = /karen|samantha|victoria|moira|tessa|hazel|kate|serena|emily|fiona|vicki|susan|alice|catherine|siri.*fem|google.*fem/i;
const MALE_VOICE_NAMES   = /daniel|gordon|tom|rishi|alex|fred|bruce|siri.*mal|google.*mal/i;

function resolveVoice(profileId: VoiceId): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const p = VOICE_PROFILES.find(v => v.id === profileId)!;
  const isFemale = profileId.endsWith('-f');

  // 1. Preferred name match within the target language
  const byName = voices.find(v => v.lang.startsWith(p.lang.slice(0, 5)) && p.prefer.test(v.name));
  if (byName) return byName;

  // 2. Any same-lang voice — skip obviously wrong gender (e.g. "Daniel" for Sophie)
  const byLang = voices.find(v =>
    v.lang.startsWith(p.lang.slice(0, 5)) &&
    (isFemale ? !MALE_VOICE_NAMES.test(v.name) : !FEMALE_VOICE_NAMES.test(v.name))
  );
  if (byLang) return byLang;

  // 3. Cross-region English fallback matching gender (iOS: Karen=AU-F, Samantha=US-F, etc.)
  const byGender = voices.find(v =>
    v.lang.startsWith('en') &&
    (isFemale ? FEMALE_VOICE_NAMES.test(v.name) : MALE_VOICE_NAMES.test(v.name))
  );
  if (byGender) return byGender;

  // 4. Any English voice
  return voices.find(v => v.lang.startsWith('en')) ?? null;
}

export default function OfficeErgonomics() {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const rafRef          = useRef<number>(0);
  const slouchStartRef  = useRef<number | null>(null);
  const lastAlertRef    = useRef<number>(0);
  const voiceEnabledRef = useRef(true);
  const voiceIdRef      = useRef<VoiceId>('gb-f');

  // Calibration
  const calSamplesRef   = useRef<{ headDrop: number; shoulderEye: number }[]>([]);
  const [calibration,   setCalibration]   = useState<Calibration | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const calibrationRef  = useRef<Calibration | null>(null);
  const isCalRef        = useRef(false);

  const [cameraState,   setCameraState]   = useState<CameraState>(() =>
    typeof window !== 'undefined' && localStorage.getItem('gestureflow_camera_autostart') === 'true'
      ? 'requesting'
      : 'idle'
  );
  const [autoStart,     setAutoStart]     = useState(false);
  const [postureState,  setPostureState]  = useState<PostureState>('unknown');
  const [voiceEnabled,  setVoiceEnabled]  = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('gestureflow_office_mute') !== 'true' : true
  );
  const [voiceId,       setVoiceId]       = useState<VoiceId>('gb-f');
  const [alertCount,    setAlertCount]    = useState(0);
  const [lastAlertTime, setLastAlertTime] = useState<number | null>(null);
  const [calProgress,   setCalProgress]   = useState(0);
  const [isMobile,      setIsMobile]      = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings>(DEFAULT_OFFICE_SETTINGS);
  const [showReminderBanner, setShowReminderBanner] = useState(false);

  const router = useRouter();
  const { detect, isReady } = usePoseLandmarker();

  // Detect mobile
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Reset to Oliver if Sophie is selected on mobile (Sophie is desktop-only)
  useEffect(() => {
    if (isMobile && voiceId === 'gb-f') {
      setVoiceId('gb-m');
      voiceIdRef.current = 'gb-m';
    }
  }, [isMobile, voiceId]);

  // Load persisted calibration + voice + office settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CAL_STORAGE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as Calibration;
        setCalibration(c);
        calibrationRef.current = c;
      }
    } catch { /* ignore */ }
    try {
      const v = localStorage.getItem(VOICE_STORAGE_KEY) as VoiceId | null;
      if (v && VOICE_PROFILES.some(p => p.id === v)) {
        setVoiceId(v);
        voiceIdRef.current = v;
      }
    } catch { /* ignore */ }
    setOfficeSettings(loadOfficeSettings());
  }, []);

  // In-app reminder check — every 30 s, works on all platforms including iOS
  useEffect(() => {
    if (!officeSettings.notificationsEnabled) return;
    function checkTime() {
      const now = new Date();
      const [h, m] = officeSettings.reminderTime.split(':').map(Number);
      if (now.getHours() !== h || now.getMinutes() !== m) return;
      const last = localStorage.getItem(OFFICE_NOTIF_KEY);
      if (last === getTodayStr()) return;
      localStorage.setItem(OFFICE_NOTIF_KEY, getTodayStr());
      setShowReminderBanner(true);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Posture Check ⚠️', {
          body: 'Time to sit up straight! Open Office Ergonomics for a posture check.',
          icon: '/icons/icon-192.png',
          tag: 'office-posture',
        });
      }
    }
    checkTime();
    const id = setInterval(checkTime, 30_000);
    return () => clearInterval(id);
  }, [officeSettings.notificationsEnabled, officeSettings.reminderTime]);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { voiceIdRef.current = voiceId; }, [voiceId]);
  useEffect(() => { calibrationRef.current = calibration; }, [calibration]);
  useEffect(() => { isCalRef.current = isCalibrating; }, [isCalibrating]);

  const speakAlert = useCallback(() => {
    if (!voiceEnabledRef.current) return;
    if (voiceIdRef.current.startsWith('sfx-')) { playSfx(voiceIdRef.current); return; }
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Sit up, please');
    const profile = VOICE_PROFILES.find(p => p.id === voiceIdRef.current)!;
    const voice   = resolveVoice(voiceIdRef.current);
    if (voice) u.voice = voice;
    u.lang = profile.lang; u.pitch = profile.pitch; u.rate = profile.rate; u.volume = 1.0;
    window.speechSynthesis.speak(u);
  }, []);

  const startCalibration = useCallback(() => {
    calSamplesRef.current = [];
    setCalProgress(0);
    setIsCalibrating(true);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraState('granted');
      }
    } catch { setCameraState('denied'); }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setCameraState('idle');
    setPostureState('unknown');
    slouchStartRef.current = null;
    setIsCalibrating(false);
  }, []);

  // ── Detection loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || cameraState !== 'granted') return;

    function loop(timestamp: number) {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      const result    = detect(video, timestamp);
      const landmarks = result?.landmarks[0] ?? null;

      if (landmarks && landmarks.length > 0) {
        // ── Calibration mode: collect samples ────────────────────────────
        if (isCalRef.current) {
          const r = extractRatios(landmarks);
          if (r && r.shoulderEye !== null) {
            calSamplesRef.current.push({ headDrop: r.headDrop, shoulderEye: r.shoulderEye! });
            const progress = Math.round((calSamplesRef.current.length / CALIBRATION_FRAMES) * 100);
            setCalProgress(progress);

            if (calSamplesRef.current.length >= CALIBRATION_FRAMES) {
              const samples = calSamplesRef.current;
              const avg = (key: 'headDrop' | 'shoulderEye') =>
                samples.reduce((s, v) => s + v[key], 0) / samples.length;
              const cal: Calibration = { headDrop: avg('headDrop'), shoulderEye: avg('shoulderEye') };
              calibrationRef.current = cal;
              setCalibration(cal);
              setIsCalibrating(false);
              isCalRef.current = false;
              localStorage.setItem(CAL_STORAGE_KEY, JSON.stringify(cal));
            }
          }
          // Draw skeleton green (showing good posture during calibration)
          drawGlowingSkeleton(ctx, landmarks, canvas.width, canvas.height, 100, false);
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        // ── Normal detection ──────────────────────────────────────────────
        const slouching = isSlouching(landmarks, calibrationRef.current);
        drawGlowingSkeleton(ctx, landmarks, canvas.width, canvas.height, slouching ? 0 : 100, slouching);
        setPostureState(slouching ? 'slouching' : 'good');

        if (slouching) {
          if (slouchStartRef.current === null) slouchStartRef.current = Date.now();
          else {
            const now = Date.now();
            if (
              now - slouchStartRef.current >= SLOUCH_TRIGGER_MS &&
              now - lastAlertRef.current  >= ALERT_COOLDOWN_MS
            ) {
              lastAlertRef.current = now;
              slouchStartRef.current = now;
              setLastAlertTime(now);
              setAlertCount(c => c + 1);
              speakAlert();
            }
          }
        } else {
          slouchStartRef.current = null;
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setPostureState('unknown');
        slouchStartRef.current = null;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isReady, cameraState, detect, speakAlert]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current?.srcObject)
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    window.speechSynthesis?.cancel();
  }, []);

  // Auto-start camera if user previously opted in
  useEffect(() => {
    if (localStorage.getItem('gestureflow_camera_autostart') === 'true') {
      startCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateOfficeSettings(patch: Partial<OfficeSettings>) {
    const next = { ...officeSettings, ...patch };
    localStorage.setItem(OFFICE_SETTINGS_KEY, JSON.stringify(next));
    setOfficeSettings(next);
    if (next.notificationsEnabled && patch.reminderTime) {
      subscribeToPush(next.reminderTime, 'office').catch(console.warn);
    }
  }

  async function toggleOfficeNotifications() {
    if (officeSettings.notificationsEnabled) {
      updateOfficeSettings({ notificationsEnabled: false });
      unsubscribeFromPush().catch(() => {});
    } else {
      let granted = false;
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          granted = true;
        } else if (Notification.permission === 'default') {
          const res = await Notification.requestPermission().catch(() => 'default');
          granted = res === 'granted';
        }
      }
      updateOfficeSettings({ notificationsEnabled: true });
      if (granted) {
        subscribeToPush(officeSettings.reminderTime, 'office').catch(console.warn);
        setTimeout(() => {
          new Notification('Office reminders on! ⚠️', {
            body: `We'll remind you at ${officeSettings.reminderTime} to check your posture.`,
            icon: '/icons/icon-192.png',
            tag: 'office-confirm',
          });
        }, 600);
      }
    }
  }

  const postureColor = postureState === 'good' ? 'text-emerald-400' : postureState === 'slouching' ? 'text-red-400' : 'text-slate-400';
  const postureLabel = postureState === 'good' ? 'Good posture' : postureState === 'slouching' ? 'Slouching detected!' : 'Stand by…';
  const timeSinceAlert = lastAlertTime ? Math.round((Date.now() - lastAlertTime) / 1000) : null;

  return (
    <div className="cyber-bg flex flex-col" style={{ height: '100dvh' }}>

      {/* ── In-app reminder banner ── */}
      <AnimatePresence>
        {showReminderBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-16 left-4 right-4 z-[60] rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.4)', backdropFilter: 'blur(16px)' }}
          >
            <Bell size={18} style={{ color: '#00f0ff', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Posture reminder!</p>
              <p className="text-xs text-gray-400 mt-0.5">Time for your posture check — sit up straight!</p>
            </div>
            <button onClick={() => setShowReminderBanner(false)} className="flex-shrink-0 p-1">
              <X size={15} className="text-gray-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="pt-safe px-4 pt-4 pb-2 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 rounded-xl flex items-center justify-center btn-press"
          style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <ArrowLeft size={18} className="text-gray-400" />
        </button>
        <Monitor className="text-cyan-400" size={20} />
        <h1 className="text-lg font-bold gradient-text flex-1">Office Ergonomics</h1>
        <button
          onClick={() => setShowSettings(v => !v)}
          className="w-10 h-10 rounded-xl flex items-center justify-center btn-press"
          style={{
            background: showSettings ? 'rgba(0,240,255,0.12)' : 'rgba(18,18,40,0.8)',
            border: showSettings ? '1px solid rgba(0,240,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <Settings size={17} style={{ color: showSettings ? '#00f0ff' : '#6b7280' }} />
        </button>
      </div>

      {/* Settings panel (collapses open below header) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden shrink-0 mx-4"
          >
            <div className="rounded-2xl p-4 flex flex-col gap-3 mb-2"
              style={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(0,240,255,0.12)' }}>

              {/* Reminder toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {officeSettings.notificationsEnabled
                    ? <Bell size={15} style={{ color: '#00f0ff' }} />
                    : <BellOff size={15} className="text-gray-500" />}
                  <span className="text-sm font-semibold text-white">Posture reminders</span>
                </div>
                <button
                  onClick={toggleOfficeNotifications}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200 btn-press"
                  style={{
                    background: officeSettings.notificationsEnabled
                      ? 'linear-gradient(135deg, #00f0ff, #7b2fff)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200"
                    style={{ left: officeSettings.notificationsEnabled ? 'calc(100% - 1.375rem)' : '0.125rem' }}
                  />
                </button>
              </div>

              {/* Reminder time picker */}
              <AnimatePresence>
                {officeSettings.notificationsEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between pl-5">
                      <span className="text-xs text-gray-400">Remind me at</span>
                      <input
                        type="time"
                        value={officeSettings.reminderTime}
                        onChange={e => updateOfficeSettings({ reminderTime: e.target.value })}
                        className="bg-transparent text-xs font-bold text-white border-none outline-none"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera — fills all remaining space, controls overlay inside */}
      <div className="relative flex-1 mx-4 mb-20 rounded-2xl overflow-hidden bg-black border border-cyan-900/40">

        {/* Idle / denied: permission prompt fills the camera area */}
        {(cameraState === 'idle' || cameraState === 'denied') && (
          <CameraPermission
            inline
            onRequest={() => {
              if (autoStart) localStorage.setItem('gestureflow_camera_autostart', 'true');
              startCamera();
            }}
            autoStart={autoStart}
            onAutoStartChange={setAutoStart}
            error={cameraState === 'denied' ? 'Camera access denied. Please allow camera in your browser settings.' : null}
          />
        )}

        <video ref={videoRef} className="camera-feed absolute inset-0 w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="camera-feed absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />

        {/* Requesting — spinner while camera starts */}
        {cameraState === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#050510] z-10">
            <div className="w-10 h-10 rounded-full border-2 animate-spin"
              style={{ borderColor: '#00f0ff', borderTopColor: 'transparent' }} />
            <p className="text-sm text-gray-400">Starting camera…</p>
          </div>
        )}

        {/* Calibration fullscreen overlay */}
        {cameraState === 'granted' && isCalibrating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 z-20">
            <ScanLine className="text-cyan-400 animate-pulse" size={36} />
            <p className="text-white font-semibold text-sm">Sit up straight and hold…</p>
            <div className="w-48 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-cyan-400 transition-all duration-100" style={{ width: `${calProgress}%` }} />
            </div>
            <p className="text-cyan-300 text-xs">{calProgress}%</p>
          </div>
        )}

        {/* Stop button — top right */}
        {cameraState === 'granted' && (
          <button onClick={stopCamera} className="absolute top-3 right-3 z-10 px-3 py-1 rounded-lg bg-black/60 border border-white/10 text-xs text-slate-300">
            Stop
          </button>
        )}

        {/* Posture badge — top left */}
        {cameraState === 'granted' && !isCalibrating && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 border border-white/10">
            {postureState === 'good' ? <CheckCircle2 size={14} className="text-emerald-400" />
              : postureState === 'slouching' ? <AlertTriangle size={14} className="text-red-400 animate-pulse" />
              : <div className="w-3 h-3 rounded-full bg-slate-500" />}
            <span className={`text-xs font-medium ${postureColor}`}>{postureLabel}</span>
          </div>
        )}

        {/* ── Bottom overlay: dark gradient + all controls ── */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-16"
          style={{ background: 'linear-gradient(to top, rgba(2,4,18,0.95) 0%, rgba(2,4,18,0.7) 60%, transparent 100%)' }}>

          {/* Calibrate row */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                {calibration ? '✓ Posture calibrated' : '⚠️ Calibrate first'}
              </p>
              <p className="text-[10px] text-slate-400">
                {calibration ? 'Tap to redo' : 'Sit up straight, then tap'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Stats inline */}
              <div className="text-right mr-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Alerts</p>
                <p className="text-lg font-bold gradient-text leading-tight">{alertCount}</p>
              </div>
              {/* Voice toggle */}
              <button onClick={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                localStorage.setItem('gestureflow_office_mute', next ? 'false' : 'true');
                if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              }}
                className={`p-2 rounded-xl border transition-all ${voiceEnabled ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              {/* Calibrate button */}
              {cameraState === 'granted' && !isCalibrating && (
                <button onClick={startCalibration}
                  className="shrink-0 px-3 py-2 rounded-xl font-bold text-xs text-black"
                  style={{ background: calibration ? 'rgba(0,240,255,0.85)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
                  {calibration ? 'Re-cal' : 'Calibrate'}
                </button>
              )}
            </div>
          </div>

          {/* Voice picker — horizontal scroll with right-fade hint */}
          <div className="relative">
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {VOICE_PROFILES.filter(p => !isMobile || p.mobile).map(p => (
              <button key={p.id}
                onClick={() => {
                  setVoiceId(p.id);
                  localStorage.setItem(VOICE_STORAGE_KEY, p.id);
                  if (!voiceEnabledRef.current) return; // respect mute
                  if (p.id.startsWith('sfx-')) { playSfx(p.id); }
                  else if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance('Sit up, please');
                    const voice = resolveVoice(p.id);
                    if (voice) u.voice = voice;
                    u.lang = p.lang; u.pitch = p.pitch; u.rate = p.rate; u.volume = 0.8;
                    window.speechSynthesis.speak(u);
                  }
                }}
                className={`shrink-0 px-3 py-1.5 rounded-xl border text-left transition-all ${
                  voiceId === p.id ? 'bg-cyan-500/30 border-cyan-500/60 text-cyan-300' : 'bg-black/40 border-white/10 text-slate-300'
                }`}>
                <p className="text-xs font-semibold whitespace-nowrap">{p.label.split(' — ')[0]}</p>
                <p className="text-[10px] opacity-60 whitespace-nowrap">{p.label.split(' — ')[1]}</p>
              </button>
            ))}
            </div>
            {/* Right-fade scroll hint */}
            <div
              className="absolute right-0 top-0 bottom-0.5 w-10 pointer-events-none flex items-center justify-end pr-1"
              style={{ background: 'linear-gradient(to left, rgba(2,4,18,0.95) 0%, transparent 100%)' }}
            >
              <ChevronRight size={14} className="text-slate-400 opacity-70" />
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

