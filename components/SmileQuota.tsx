'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Settings, Bell, BellOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import BottomNav from './BottomNav';

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY       = 'gestureflow_smile_quota';
const SETTINGS_KEY      = 'gestureflow_smile_settings';
const NOTIF_KEY         = 'gestureflow_smile_last_notif';
const QUOTA             = 10;
const SUPER_QUOTA       = 10;
const SMILE_THRESHOLD   = 0.20;
const SMILE_COOLDOWN    = 1500;
const SMILE_HOLD_FRAMES = 3;

type SessionMode = '1x10' | '2x5';

interface SmileSettings {
  notificationsEnabled: boolean;
  reminderTime: string; // "HH:MM"
  sessionMode: SessionMode;
}

interface SmileData {
  date: string;
  count: number;
  superCount: number;
  session1Done: boolean;
}

// ── Storage helpers ────────────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_SETTINGS: SmileSettings = {
  notificationsEnabled: false,
  reminderTime: '20:00',
  sessionMode: '1x10',
};

function loadSettings(): SmileSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: SmileSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function loadSmileData(): SmileData {
  const empty: SmileData = { date: getTodayStr(), count: 0, superCount: 0, session1Done: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayStr()) return empty;
    return {
      ...empty,
      ...parsed,
      count: Math.min(parsed.count ?? 0, QUOTA),
      superCount: Math.min(parsed.superCount ?? 0, SUPER_QUOTA),
    };
  } catch {
    return empty;
  }
}

function saveSmileData(patch: Partial<SmileData>) {
  const current = loadSmileData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

// ── Notification helpers ───────────────────────────────────────────────────
async function requestNotifPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function fireLocalNotification(count: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification('Smile Quota Reminder 😊', {
    body:
      count === 0
        ? "Don't forget your daily smiles! Open the app to start."
        : `You've smiled ${count}/10 times today — finish strong!`,
    icon: '/icon-192.png',
    tag: 'smile-quota',
  });
  localStorage.setItem(NOTIF_KEY, getTodayStr());
}

// Module-level timeout so it survives re-renders
let notifTimeoutId: ReturnType<typeof setTimeout> | null = null;

function scheduleNotification(settings: SmileSettings, count: number) {
  if (notifTimeoutId) {
    clearTimeout(notifTimeoutId);
    notifTimeoutId = null;
  }
  if (!settings.notificationsEnabled) return;
  if (count >= QUOTA) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const lastNotif = localStorage.getItem(NOTIF_KEY);
  if (lastNotif === getTodayStr()) return;

  const now = new Date();
  const [h, m] = settings.reminderTime.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const msUntil = target.getTime() - now.getTime();

  if (msUntil <= 0) {
    fireLocalNotification(count);
  } else {
    notifTimeoutId = setTimeout(() => {
      const d = loadSmileData();
      if (d.count < QUOTA) fireLocalNotification(d.count);
    }, msUntil);
  }
}

// ── Celebrations ───────────────────────────────────────────────────────────
function fireFireworks() {
  const colors = ['#00f0ff', '#ff00cc', '#7b2fff', '#ffaa00', '#ffffff'];
  const shoot = (angle: number, x: number) =>
    confetti({ particleCount: 75, angle, spread: 60, origin: { x, y: 0.75 }, colors });
  shoot(60, 0);
  shoot(120, 1);
  setTimeout(() => confetti({ particleCount: 140, spread: 90, origin: { x: 0.5, y: 0.5 }, colors }), 300);
  setTimeout(() => { shoot(70, 0.15); shoot(110, 0.85); }, 650);
  setTimeout(() => confetti({ particleCount: 90, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.65 }, colors }), 950);
}

function fireMiniworks() {
  const colors = ['#00f0ff', '#7b2fff', '#ffffff'];
  confetti({ particleCount: 60, spread: 70, origin: { x: 0.5, y: 0.6 }, colors });
  setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.3, y: 0.7 }, colors }), 300);
  setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.7, y: 0.7 }, colors }), 500);
}

function fireSuperFireworks() {
  const colors = ['#ffaa00', '#ff6600', '#ffdd00', '#ff00cc', '#ffffff'];
  const shoot = (angle: number, x: number) =>
    confetti({ particleCount: 100, angle, spread: 70, origin: { x, y: 0.75 }, colors });
  shoot(60, 0);
  shoot(120, 1);
  setTimeout(() => confetti({ particleCount: 200, spread: 120, origin: { x: 0.5, y: 0.5 }, colors }), 200);
  setTimeout(() => { shoot(65, 0.1); shoot(115, 0.9); }, 500);
  setTimeout(() => confetti({ particleCount: 150, spread: 130, startVelocity: 60, origin: { x: 0.5, y: 0.6 }, colors }), 800);
  setTimeout(() => { shoot(60, 0); shoot(120, 1); }, 1200);
}

// ── Status messages ────────────────────────────────────────────────────────
function statusMsg(count: number, mode: SessionMode, superActive: boolean, superCount: number): string {
  if (superActive) {
    if (superCount === 0) return 'Bonus round! Keep those smiles coming!';
    if (superCount < 5)  return 'Super Smile mode activated 🌟';
    if (superCount < 9)  return 'Almost there — you\'re unstoppable!';
    if (superCount === 9) return 'One more for the ultimate day!';
    return 'SUPER SMILE DAY COMPLETE! 🏆';
  }
  if (mode === '2x5') {
    if (count < 5) {
      if (count === 0) return 'Smile at the camera to begin!';
      if (count < 3)   return 'Great start — keep going!';
      return 'Almost done with session 1!';
    }
    if (count === 5) return 'Session 1 done! Take a breather 🌟';
    const s2 = count - 5;
    if (s2 < 3) return 'Session 2 in motion 🔥';
    if (s2 < 5) return 'Almost done — one big push!';
  }
  if (count === 0) return 'Smile at the camera to begin!';
  if (count < 3)   return 'Great start — keep going!';
  if (count < 6)   return "You're on a roll 🔥";
  if (count < 9)   return 'Almost there — smile big!';
  if (count === 9) return "One more! You've got this!";
  return "Quota complete! You're glowing ✨";
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SmileQuota() {
  const router = useRouter();
  const { isReady, detectSmile } = useFaceLandmarker();

  // DOM / RAF refs
  const videoRef           = useRef<HTMLVideoElement>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const rafRef             = useRef<number | null>(null);
  const lastCountedRef     = useRef<number>(0);
  const smileFramesRef     = useRef<number>(0);
  const smiledThisEventRef = useRef<boolean>(false);

  // Celebration guards
  const fireworksFiredRef = useRef<boolean>(false);
  const miniworksFiredRef = useRef<boolean>(false);
  const superFiredRef     = useRef<boolean>(false);

  // Mutable refs for detection loop (avoids stale closures without restarting RAF)
  const superActiveRef  = useRef<boolean>(false);
  const sessionModeRef  = useRef<SessionMode>('1x10');

  // State
  const [settings,     setSettings]     = useState<SmileSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [cameraState,  setCameraState]  = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [smileCount,   setSmileCount]   = useState(0);
  const [superCount,   setSuperCount]   = useState(0);
  const [session1Done, setSession1Done] = useState(false);
  const [superActive,  setSuperActive]  = useState(false);
  const [isSmiling,    setIsSmiling]    = useState(false);

  // Keep mutable refs in sync with state/settings
  useEffect(() => { superActiveRef.current = superActive; }, [superActive]);
  useEffect(() => { sessionModeRef.current = settings.sessionMode; }, [settings.sessionMode]);

  // Load persisted data on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    sessionModeRef.current = s.sessionMode;

    const d = loadSmileData();
    setSmileCount(Math.min(d.count, QUOTA));
    setSuperCount(Math.min(d.superCount, SUPER_QUOTA));
    setSession1Done(d.session1Done);
    if (d.count >= QUOTA) fireworksFiredRef.current = true;
    if (d.session1Done)   miniworksFiredRef.current = true;
    if (d.superCount >= SUPER_QUOTA) superFiredRef.current = true;
    if (d.superCount > 0) {
      setSuperActive(true);
      superActiveRef.current = true;
    }

    scheduleNotification(s, d.count);
  }, []);

  // ── Settings helpers ───────────────────────────────────────────────────
  // NOTE: keep side-effects (saveSettings, scheduleNotification) outside the
  // setSettings updater — React StrictMode calls updaters twice, which would
  // cancel the scheduled timeout immediately.
  function updateSettings(patch: Partial<SmileSettings>) {
    const next = { ...settings, ...patch };
    saveSettings(next);
    setSettings(next);
    const currentData = loadSmileData();
    scheduleNotification(next, currentData.count);
  }

  async function toggleNotifications() {
    if (settings.notificationsEnabled) {
      updateSettings({ notificationsEnabled: false });
    } else {
      const granted = await requestNotifPermission();
      if (granted) {
        updateSettings({ notificationsEnabled: true });
        // Fire a confirmation notification immediately so the user knows it works
        setTimeout(() => {
          const d = loadSmileData();
          new Notification('Reminders are on! 😊', {
            body: `You'll be reminded at ${settings.reminderTime} if you haven't hit your quota.`,
            icon: '/icon-192.png',
            tag: 'smile-quota-confirm',
          });
          // Schedule the real daily reminder too
          scheduleNotification({ ...settings, notificationsEnabled: true }, d.count);
        }, 800);
      }
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────
  const requestCamera = useCallback(async () => {
    setCameraState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('granted');
    } catch {
      setCameraState('denied');
    }
  }, []);

  // ── Detection loop ────────────────────────────────────────────────────
  const runLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isReady || cameraState !== 'granted') {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }

    const now     = performance.now();
    const score   = detectSmile(video, now);
    const smiling = score >= SMILE_THRESHOLD;

    setIsSmiling(smiling);

    if (smiling) {
      smileFramesRef.current = Math.min(smileFramesRef.current + 1, SMILE_HOLD_FRAMES + 10);
    } else {
      smileFramesRef.current     = 0;
      smiledThisEventRef.current = false;
    }

    if (
      smiling &&
      !smiledThisEventRef.current &&
      smileFramesRef.current >= SMILE_HOLD_FRAMES &&
      now - lastCountedRef.current > SMILE_COOLDOWN
    ) {
      smiledThisEventRef.current = true;
      lastCountedRef.current     = now;

      if (superActiveRef.current) {
        // ── Super smile counting ──
        setSuperCount((prev) => {
          if (prev >= SUPER_QUOTA) return prev;
          const next = prev + 1;
          saveSmileData({ superCount: next });
          if (next >= SUPER_QUOTA && !superFiredRef.current) {
            superFiredRef.current = true;
            setTimeout(fireSuperFireworks, 200);
          }
          return next;
        });
      } else {
        // ── Base quota counting ──
        setSmileCount((prev) => {
          if (prev >= QUOTA) return prev;
          const next = prev + 1;
          saveSmileData({ count: next });

          // 2×5 mode: mini-celebration at session 1 completion
          if (sessionModeRef.current === '2x5' && next === 5 && !miniworksFiredRef.current) {
            miniworksFiredRef.current = true;
            saveSmileData({ session1Done: true });
            setSession1Done(true);
            setTimeout(fireMiniworks, 200);
          }

          // Full quota reached
          if (next >= QUOTA && !fireworksFiredRef.current) {
            fireworksFiredRef.current = true;
            setTimeout(fireFireworks, 200);
          }
          return next;
        });
      }
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [isReady, detectSmile, cameraState]);

  useEffect(() => {
    if (cameraState !== 'granted') return;
    rafRef.current = requestAnimationFrame(runLoop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cameraState, runLoop]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const isBaseComplete = smileCount >= QUOTA;
  const isSuperComplete = superCount >= SUPER_QUOTA;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="page-scroll cyber-bg scanline">
      <div className="min-h-full px-5 pt-safe pb-28 flex flex-col">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 pt-4 mb-4"
        >
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-xl flex items-center justify-center btn-press"
            style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <ArrowLeft size={18} className="text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white tracking-tight">
              Smile <span className="gradient-text">Quota</span>
            </h1>
            <p className="text-[11px] text-gray-500">Daily happiness workout</p>
          </div>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="w-10 h-10 rounded-xl flex items-center justify-center btn-press"
            style={{
              background: showSettings ? 'rgba(0,240,255,0.12)' : 'rgba(18,18,40,0.8)',
              border: showSettings ? '1px solid rgba(0,240,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <Settings size={17} style={{ color: showSettings ? '#00f0ff' : '#6b7280' }} />
          </button>
        </motion.div>

        {/* ── Settings Panel ── */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-4"
            >
              <div
                className="rounded-2xl p-4 flex flex-col gap-4"
                style={{
                  background: 'rgba(10,10,26,0.95)',
                  border: '1px solid rgba(0,240,255,0.12)',
                }}
              >
                {/* Notifications row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.notificationsEnabled
                      ? <Bell size={15} style={{ color: '#00f0ff' }} />
                      : <BellOff size={15} className="text-gray-500" />}
                    <span className="text-sm font-semibold text-white">Reminders</span>
                  </div>
                  <button
                    onClick={toggleNotifications}
                    className="relative w-11 h-6 rounded-full transition-colors duration-200 btn-press"
                    style={{
                      background: settings.notificationsEnabled
                        ? 'linear-gradient(135deg, #00f0ff, #7b2fff)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200"
                      style={{ left: settings.notificationsEnabled ? 'calc(100% - 1.375rem)' : '0.125rem' }}
                    />
                  </button>
                </div>

                {/* Reminder time (only when notifications enabled) */}
                <AnimatePresence>
                  {settings.notificationsEnabled && (
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
                          value={settings.reminderTime}
                          onChange={(e) => updateSettings({ reminderTime: e.target.value })}
                          className="bg-transparent text-xs font-bold text-white border-none outline-none"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                {/* Session style */}
                <div>
                  <span className="text-sm font-semibold text-white block mb-2.5">Session style</span>
                  <div className="flex gap-2">
                    {(['1x10', '2x5'] as SessionMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateSettings({ sessionMode: mode })}
                        className="flex-1 py-2 rounded-xl text-xs font-bold btn-press"
                        style={{
                          background: settings.sessionMode === mode
                            ? 'linear-gradient(135deg, rgba(0,240,255,0.15), rgba(123,47,255,0.15))'
                            : 'rgba(255,255,255,0.05)',
                          border: settings.sessionMode === mode
                            ? '1px solid rgba(0,240,255,0.4)'
                            : '1px solid rgba(255,255,255,0.07)',
                          color: settings.sessionMode === mode ? '#00f0ff' : '#6b7280',
                        }}
                      >
                        {mode === '1x10' ? '1 session · 10 smiles' : '2 sessions · 5 each'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Camera view ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-3xl overflow-hidden relative mb-6"
          style={{
            aspectRatio: '4/3',
            background: 'rgba(10,10,26,0.95)',
            border: isSmiling
              ? '2px solid #00f0ff'
              : '1px solid rgba(255,255,255,0.07)',
            boxShadow: isSmiling ? '0 0 32px rgba(0,240,255,0.28)' : 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          <video
            ref={videoRef}
            className="camera-feed w-full h-full object-cover"
            playsInline
            muted
            style={{ display: cameraState === 'granted' ? 'block' : 'none' }}
          />

          {cameraState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
              {/* Skeleton shimmer bars — hint that content will load */}
              <div className="absolute top-4 left-5 right-5 flex flex-col gap-2 pointer-events-none">
                <div className="skeleton h-1.5 w-3/4 rounded-full opacity-40" />
                <div className="skeleton h-1.5 w-1/2 rounded-full opacity-25" />
              </div>
              <div className="absolute bottom-4 left-5 right-5 flex flex-col gap-2 pointer-events-none">
                <div className="skeleton h-1.5 w-2/3 rounded-full opacity-30" />
                <div className="skeleton h-1.5 w-2/5 rounded-full opacity-20" />
              </div>

              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)' }}
              >
                <Camera size={28} style={{ color: '#00f0ff' }} />
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-bold text-white mb-1">Enable camera to detect smiles</p>
                <p className="text-xs text-gray-500">All processing is on-device — nothing is uploaded</p>
              </div>
              <button
                onClick={requestCamera}
                className="px-6 py-3 rounded-2xl font-bold text-sm text-[#050510] btn-press"
                style={{
                  background: 'linear-gradient(135deg, #00f0ff, #7b2fff)',
                  boxShadow: '0 0 20px rgba(0,240,255,0.35)',
                }}
              >
                Allow Camera
              </button>
            </div>
          )}

          {cameraState === 'requesting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#00f0ff', borderTopColor: 'transparent' }}
              />
              <p className="text-xs text-gray-400">Starting camera…</p>
            </div>
          )}

          {cameraState === 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
              <p className="text-sm font-bold text-red-400">Camera access denied</p>
              <p className="text-xs text-gray-500 text-center">
                Allow camera access in your browser settings and reload
              </p>
            </div>
          )}

          {cameraState === 'granted' && !isReady && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: 'rgba(5,5,16,0.72)', backdropFilter: 'blur(6px)' }}
            >
              <div
                className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#00f0ff', borderTopColor: 'transparent' }}
              />
              <p className="text-xs text-gray-300 font-medium">Loading smile AI…</p>
              <div className="skeleton w-36 h-2 rounded-full" />
              <div className="skeleton w-24 h-1.5 rounded-full opacity-60" />
            </div>
          )}

          {/* ── Smiling indicator pill ── */}
          {cameraState === 'granted' && isReady && (
            <AnimatePresence>
              {isSmiling && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -4 }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full flex items-center gap-2"
                  style={{
                    background: superActive ? 'rgba(255,170,0,0.18)' : 'rgba(0,240,255,0.18)',
                    border: `1px solid ${superActive ? 'rgba(255,170,0,0.5)' : 'rgba(0,240,255,0.5)'}`,
                    backdropFilter: 'blur(12px)',
                    boxShadow: `0 0 16px ${superActive ? 'rgba(255,170,0,0.3)' : 'rgba(0,240,255,0.3)'}`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: superActive ? '#ffaa00' : '#00f0ff' }}
                  />
                  <span
                    className="text-[11px] font-black tracking-widest uppercase"
                    style={{ color: superActive ? '#ffaa00' : '#00f0ff' }}
                  >
                    {superActive ? 'Super Smile' : 'Smiling'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* ── Completion banners ── */}
          <AnimatePresence>
            {isBaseComplete && !superActive && cameraState === 'granted' && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute bottom-0 left-0 right-0 py-2.5 text-center font-black text-sm tracking-wide"
                style={{
                  background: 'linear-gradient(90deg, rgba(0,240,255,0.25), rgba(255,0,204,0.25))',
                  backdropFilter: 'blur(12px)',
                  color: '#fff',
                  textShadow: '0 0 12px rgba(255,255,255,0.4)',
                }}
              >
                🎉 Quota Complete!
              </motion.div>
            )}
            {superActive && isSuperComplete && cameraState === 'granted' && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute bottom-0 left-0 right-0 py-2.5 text-center font-black text-sm tracking-wide"
                style={{
                  background: 'linear-gradient(90deg, rgba(255,170,0,0.3), rgba(255,0,204,0.3))',
                  backdropFilter: 'blur(12px)',
                  color: '#fff',
                  textShadow: '0 0 12px rgba(255,255,255,0.4)',
                }}
              >
                🏆 Super Smile Day Complete!
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Counter section ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="flex flex-col items-center mb-6"
        >
          {/* Big animated number */}
          <AnimatePresence mode="wait">
            <motion.span
              key={superActive ? `s${superCount}` : smileCount}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 260 }}
              className="text-9xl font-black leading-none tabular-nums"
              style={{
                color: superActive ? '#ffaa00' : isBaseComplete ? '#ff00cc' : '#00f0ff',
                textShadow: superActive
                  ? '0 0 40px #ffaa0099, 0 0 80px #ffaa0033'
                  : isBaseComplete
                  ? '0 0 40px #ff00cc99, 0 0 80px #ff00cc33'
                  : '0 0 40px #00f0ff99, 0 0 80px #00f0ff33',
              }}
            >
              {superActive ? superCount : smileCount}
            </motion.span>
          </AnimatePresence>

          <div className="flex items-center gap-1.5 mt-1 mb-5">
            <span className="text-sm text-gray-500">of</span>
            <span className="text-sm font-bold text-white">{superActive ? SUPER_QUOTA : QUOTA}</span>
            <span className="text-sm text-gray-500">
              {superActive ? 'bonus smiles' : 'smiles today'}
            </span>
          </div>

          {/* Progress dots — 2×5 shows two labelled rows */}
          {!superActive && settings.sessionMode === '2x5' ? (
            <div className="flex flex-col items-center gap-2">
              {/* Session 1 row */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600 w-16 text-right">Session 1</span>
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={false}
                      animate={{ scale: i < smileCount ? 1 : 0.7, opacity: i < smileCount ? 1 : 0.22 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 320 }}
                      className="w-4 h-4 rounded-full"
                      style={{
                        background: i < smileCount ? '#00f0ff' : 'rgba(255,255,255,0.15)',
                        boxShadow: i < smileCount ? '0 0 10px #00f0ff99' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Session 2 row */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600 w-16 text-right">Session 2</span>
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const filled = Math.max(0, smileCount - 5);
                    return (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={{ scale: i < filled ? 1 : 0.7, opacity: i < filled ? 1 : 0.22 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 320 }}
                        className="w-4 h-4 rounded-full"
                        style={{
                          background: i < filled ? '#ff00cc' : 'rgba(255,255,255,0.15)',
                          boxShadow: i < filled ? '0 0 10px #ff00cc99' : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Standard single-row dots */
            <div className="flex gap-2.5">
              {Array.from({ length: superActive ? SUPER_QUOTA : QUOTA }).map((_, i) => {
                const filled = superActive ? superCount : smileCount;
                const color  = superActive ? '#ffaa00' : isBaseComplete ? '#ff00cc' : '#00f0ff';
                return (
                  <motion.div
                    key={i}
                    initial={false}
                    animate={{ scale: i < filled ? 1 : 0.7, opacity: i < filled ? 1 : 0.22 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 320 }}
                    className="w-4 h-4 rounded-full"
                    style={{
                      background: i < filled ? color : 'rgba(255,255,255,0.15)',
                      boxShadow: i < filled ? `0 0 10px ${color}99` : 'none',
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Dynamic status message */}
          <AnimatePresence mode="wait">
            <motion.p
              key={`${superActive}-${superActive ? superCount : smileCount}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4 text-sm font-semibold text-gray-400"
            >
              {statusMsg(smileCount, settings.sessionMode, superActive, superCount)}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* ── Super Smile CTA (visible after base quota done, before super active) ── */}
        <AnimatePresence>
          {isBaseComplete && !superActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.15 }}
              className="rounded-3xl p-5 mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(255,170,0,0.08), rgba(255,0,204,0.1))',
                border: '1px solid rgba(255,170,0,0.22)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">⚡</span>
                <span
                  className="text-[11px] font-black tracking-widest uppercase"
                  style={{ color: '#ffaa00' }}
                >
                  Super Smile Day
                </span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">
                Crush it with <strong className="text-white">10 bonus smiles</strong> to turn today into a{' '}
                <span style={{ color: '#ffaa00', fontWeight: 700 }}>Super Smile Day</span>.
                Double the dopamine, double the glory.
              </p>
              <button
                onClick={() => {
                  setSuperActive(true);
                  superActiveRef.current = true;
                  saveSmileData({ superCount: 0 });
                }}
                className="w-full py-3 rounded-2xl font-black text-sm btn-press"
                style={{
                  background: 'linear-gradient(135deg, #ffaa00, #ff6600)',
                  boxShadow: '0 0 20px rgba(255,170,0,0.35)',
                  color: '#050510',
                }}
              >
                Go Super! ⚡
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Science quote card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="rounded-3xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(255,0,204,0.07), rgba(123,47,255,0.1))',
            border: '1px solid rgba(255,0,204,0.14)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🧠</span>
            <span
              className="text-[11px] font-black tracking-widest uppercase"
              style={{ color: '#ff00cc' }}
            >
              Did You Know?
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            <strong className="text-white">Even a fake smile makes you happier.</strong>{' '}
            When you smile — real or forced — your face muscles signal your brain to release{' '}
            <span style={{ color: '#00f0ff', fontWeight: 700 }}>serotonin</span> and{' '}
            <span style={{ color: '#ff00cc', fontWeight: 700 }}>dopamine</span>, the exact same
            chemicals as genuine joy. Your brain literally cannot tell the difference.{' '}
            <strong className="text-white">Fake it till you feel it. Science says so.</strong>
          </p>
        </motion.div>

        <div className="flex-1" />
      </div>

      <BottomNav />
    </div>
  );
}
