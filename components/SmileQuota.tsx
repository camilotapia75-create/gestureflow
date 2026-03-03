'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import BottomNav from './BottomNav';

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY      = 'gestureflow_smile_quota';
const QUOTA            = 10;
const SMILE_THRESHOLD  = 0.20;
const SMILE_COOLDOWN   = 1500; // ms between counted smiles
const SMILE_HOLD_FRAMES = 3;  // consecutive frames smile must persist

// ── LocalStorage helpers ───────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadTodayCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    return date === getTodayStr() ? Math.min(count, QUOTA) : 0;
  } catch {
    return 0;
  }
}

function saveTodayCount(count: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayStr(), count }));
}

// ── Fireworks ──────────────────────────────────────────────────────────────
function fireFireworks() {
  const colors = ['#00f0ff', '#ff00cc', '#7b2fff', '#ffaa00', '#ffffff'];
  const shoot   = (angle: number, x: number) =>
    confetti({ particleCount: 75, angle, spread: 60, origin: { x, y: 0.75 }, colors });

  shoot(60, 0);
  shoot(120, 1);
  setTimeout(() => confetti({ particleCount: 140, spread: 90, origin: { x: 0.5, y: 0.5 }, colors }), 300);
  setTimeout(() => { shoot(70, 0.15); shoot(110, 0.85); }, 650);
  setTimeout(() => confetti({ particleCount: 90, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.65 }, colors }), 950);
}

// ── Dynamic status messages ────────────────────────────────────────────────
function statusMsg(count: number): string {
  if (count === 0)  return 'Smile at the camera to begin!';
  if (count < 3)    return 'Great start — keep going!';
  if (count < 6)    return "You're on a roll 🔥";
  if (count < 9)    return 'Almost there — smile big!';
  if (count === 9)  return 'One more! You\'ve got this!';
  return 'Quota complete! You\'re glowing ✨';
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SmileQuota() {
  const router = useRouter();
  const { isReady, detectSmile } = useFaceLandmarker();

  const videoRef             = useRef<HTMLVideoElement>(null);
  const streamRef            = useRef<MediaStream | null>(null);
  const rafRef               = useRef<number | null>(null);
  const lastCountedRef       = useRef<number>(0);
  const smileFramesRef       = useRef<number>(0);
  const smiledThisEventRef   = useRef<boolean>(false);
  const fireworksFiredRef    = useRef<boolean>(false);

  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [smileCount,  setSmileCount]  = useState(0);
  const [isSmiling,   setIsSmiling]   = useState(false);

  // Load today's persisted count on mount
  useEffect(() => {
    const count = loadTodayCount();
    setSmileCount(count);
    if (count >= QUOTA) fireworksFiredRef.current = true;
  }, []);

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

    const now   = performance.now();
    const score = detectSmile(video, now);
    const smiling = score >= SMILE_THRESHOLD;

    setIsSmiling(smiling);

    if (smiling) {
      smileFramesRef.current = Math.min(smileFramesRef.current + 1, SMILE_HOLD_FRAMES + 10);
    } else {
      smileFramesRef.current      = 0;
      smiledThisEventRef.current  = false;
    }

    // Count on rising edge: enough held frames, not already counted this event, past cooldown
    if (
      smiling &&
      !smiledThisEventRef.current &&
      smileFramesRef.current >= SMILE_HOLD_FRAMES &&
      now - lastCountedRef.current > SMILE_COOLDOWN
    ) {
      smiledThisEventRef.current = true;
      lastCountedRef.current     = now;

      setSmileCount((prev) => {
        const next = Math.min(prev + 1, QUOTA);
        saveTodayCount(next);
        if (next >= QUOTA && !fireworksFiredRef.current) {
          fireworksFiredRef.current = true;
          setTimeout(fireFireworks, 200);
        }
        return next;
      });
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [isReady, detectSmile, cameraState]);

  useEffect(() => {
    if (cameraState !== 'granted') return;
    rafRef.current = requestAnimationFrame(runLoop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cameraState, runLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const isComplete = smileCount >= QUOTA;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="page-scroll cyber-bg scanline">
      <div className="min-h-full px-5 pt-safe pb-28 flex flex-col">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 pt-4 mb-6"
        >
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-xl flex items-center justify-center btn-press"
            style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <ArrowLeft size={18} className="text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Smile <span className="gradient-text">Quota</span>
            </h1>
            <p className="text-[11px] text-gray-500">Daily happiness workout</p>
          </div>
        </motion.div>

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
          {/* Live video — always rendered once granted so the ref is stable */}
          <video
            ref={videoRef}
            className="camera-feed w-full h-full object-cover"
            playsInline
            muted
            style={{ display: cameraState === 'granted' ? 'block' : 'none' }}
          />

          {/* ── Idle: ask for permission ── */}
          {cameraState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)' }}
              >
                <Camera size={28} style={{ color: '#00f0ff' }} />
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-bold text-white mb-1">
                  Enable camera to detect smiles
                </p>
                <p className="text-xs text-gray-500">
                  All processing is on-device — nothing is uploaded
                </p>
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

          {/* ── Requesting ── */}
          {cameraState === 'requesting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#00f0ff', borderTopColor: 'transparent' }}
              />
              <p className="text-xs text-gray-400">Starting camera…</p>
            </div>
          )}

          {/* ── Denied ── */}
          {cameraState === 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
              <p className="text-sm font-bold text-red-400">Camera access denied</p>
              <p className="text-xs text-gray-500 text-center">
                Allow camera access in your browser settings and reload
              </p>
            </div>
          )}

          {/* ── Model loading overlay (on top of live video) ── */}
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
              <div className="skeleton w-32 h-1.5 rounded-full" />
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
                    background: 'rgba(0,240,255,0.18)',
                    border: '1px solid rgba(0,240,255,0.5)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 0 16px rgba(0,240,255,0.3)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
                  <span className="text-[11px] font-black tracking-widest text-[#00f0ff] uppercase">
                    Smiling
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* ── Quota complete banner across bottom of camera ── */}
          <AnimatePresence>
            {isComplete && cameraState === 'granted' && (
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
                🎉 Quota Complete! Come back tomorrow!
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
              key={smileCount}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 260 }}
              className="text-9xl font-black leading-none tabular-nums"
              style={{
                color: isComplete ? '#ff00cc' : '#00f0ff',
                textShadow: isComplete
                  ? '0 0 40px #ff00cc99, 0 0 80px #ff00cc33'
                  : '0 0 40px #00f0ff99, 0 0 80px #00f0ff33',
              }}
            >
              {smileCount}
            </motion.span>
          </AnimatePresence>

          <div className="flex items-center gap-1.5 mt-1 mb-5">
            <span className="text-sm text-gray-500">of</span>
            <span className="text-sm font-bold text-white">10</span>
            <span className="text-sm text-gray-500">smiles today</span>
          </div>

          {/* Progress dots */}
          <div className="flex gap-2.5">
            {Array.from({ length: QUOTA }).map((_, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  scale:   i < smileCount ? 1 : 0.7,
                  opacity: i < smileCount ? 1 : 0.22,
                }}
                transition={{ type: 'spring', damping: 12, stiffness: 320 }}
                className="w-4 h-4 rounded-full"
                style={{
                  background: i < smileCount
                    ? (isComplete ? '#ff00cc' : '#00f0ff')
                    : 'rgba(255,255,255,0.15)',
                  boxShadow: i < smileCount
                    ? `0 0 10px ${isComplete ? '#ff00cc' : '#00f0ff'}99`
                    : 'none',
                }}
              />
            ))}
          </div>

          {/* Dynamic status message */}
          <AnimatePresence mode="wait">
            <motion.p
              key={smileCount}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4 text-sm font-semibold text-gray-400"
            >
              {statusMsg(smileCount)}
            </motion.p>
          </AnimatePresence>
        </motion.div>

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
            <strong className="text-white">
              Fake it till you feel it. Science says so.
            </strong>
          </p>
        </motion.div>

        <div className="flex-1" />
      </div>

      <BottomNav />
    </div>
  );
}
