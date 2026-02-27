'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lightbulb, Square } from 'lucide-react';

import { usePoseLandmarker } from '@/hooks/usePoseLandmarker';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { useSession } from '@/hooks/useSession';
import { drawGlowingSkeleton } from '@/lib/gestureAnalysis';
import { recordSession, formatTime } from '@/lib/storage';
import LoadingScreen from './LoadingScreen';
import CameraPermission from './CameraPermission';
import SessionSummary from './SessionSummary';

// ── Gesture colour map ────────────────────────────────────────────────────
const GESTURE_COLORS: Record<string, string> = {
  'OPEN GESTURE': '#00f0ff',
  'POWER POSE': '#ff00cc',
  STEEPLE: '#7b2fff',
  POINTING: '#ffaa00',
  EMPHASIS: '#00ff88',
  'WIDE STANCE': '#ff6600',
  REST: '#555577',
};

// ── Impact badge ──────────────────────────────────────────────────────────
function ImpactBadge({ impact }: { impact: number }) {
  const color = impact >= 80 ? '#00f0ff' : impact >= 60 ? '#ffaa00' : '#888';
  return (
    <motion.div
      animate={{ scale: impact >= 90 ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 0.4, repeat: impact >= 90 ? Infinity : 0 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm"
      style={{
        background: `${color}20`,
        border: `1px solid ${color}60`,
        color,
        boxShadow: impact >= 80 ? `0 0 12px ${color}50` : 'none',
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {impact}%
    </motion.div>
  );
}

// ── Coach tip bubble ──────────────────────────────────────────────────────
function TipBubble({ text, icon, delay = 0 }: { text: string; icon: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      transition={{ duration: 0.35, delay, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl max-w-xs"
      style={{
        background: 'rgba(8,8,22,0.88)',
        border: '1px solid rgba(0,240,255,0.18)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      <Lightbulb size={14} style={{ color: '#00f0ff', flexShrink: 0, marginTop: 1 }} />
      <span className="text-xs text-gray-200 leading-snug font-medium">
        <span className="mr-1">{icon}</span>
        {text}
      </span>
    </motion.div>
  );
}

// ── Timer display ─────────────────────────────────────────────────────────
function TimerDisplay({ seconds }: { seconds: number }) {
  return (
    <span className="font-mono font-bold text-white text-base tabular-nums">
      {formatTime(seconds)}
    </span>
  );
}

// ── Impact arc (semicircle) ───────────────────────────────────────────────
function ImpactArc({ impact }: { impact: number }) {
  const r = 52;
  const circumference = Math.PI * r; // half circle
  const offset = circumference - (impact / 100) * circumference;
  const color = impact >= 80 ? '#00f0ff' : impact >= 60 ? '#ffaa00' : '#444466';

  return (
    <svg width="120" height="64" viewBox="0 0 120 64" className="absolute bottom-0 left-1/2 -translate-x-1/2">
      {/* Background arc */}
      <path
        d={`M 8,60 A ${r},${r} 0 0 1 112,60`}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Foreground arc */}
      <path
        d={`M 8,60 A ${r},${r} 0 0 1 112,60`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={offset}
        style={{
          filter: `drop-shadow(0 0 6px ${color})`,
          transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease',
          transformOrigin: '60px 60px',
          transform: 'scaleX(-1)',
        }}
      />
      {/* Value text */}
      <text
        x="60"
        y="52"
        textAnchor="middle"
        fill="white"
        fontSize="18"
        fontWeight="900"
        fontFamily="Inter, sans-serif"
      >
        {impact}
      </text>
      <text x="60" y="64" textAnchor="middle" fill="#888" fontSize="9" fontFamily="Inter, sans-serif">
        IMPACT
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main PracticeScreen
// ─────────────────────────────────────────────────────────────────────────
type PermState = 'unknown' | 'requesting' | 'granted' | 'denied';

export default function PracticeScreen() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastProcessTimeRef = useRef(0);

  const [perm, setPerm] = useState<PermState>('unknown');
  const [permError, setPermError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionEnded, setSessionEnded] = useState<{
    duration: number;
    gestures: number;
    bestStreak: number;
    smileCount: number;
    slouchCount: number;
    goodPostureSeconds: number;
  } | null>(null);

  const { stage, progress, error: modelError, isReady, detect } = usePoseLandmarker();
  const { isReady: faceReady, detectSmile } = useFaceLandmarker();
  const { state, start, stop, processPose } = useSession();

  const [isSmiling, setIsSmiling] = useState(false);
  const isSmilingRef = useRef(false);
  const lastFaceDetectRef = useRef(0);
  // Stable refs so the RAF loop doesn't need to restart on every render.
  // React state (impact, isSlouching, etc.) is stale inside the effect closure —
  // these refs are kept in sync during render and read from the loop instead.
  const faceReadyRef = useRef(false);
  const detectSmileRef = useRef(detectSmile);
  const impactRef = useRef(0);
  const isSlouchingRef = useRef(false);

  const nullStreakRef = useRef(0);
  const debugTimerRef = useRef(0);
  const [debugLine, setDebugLine] = useState('');

  // ── Camera setup ────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setPerm('requesting');
    setPermError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPerm('granted');
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings.'
          : 'Could not access camera. Please check your device.';
      setPermError(msg);
      setPerm('denied');
    }
  }, []);

  // Assign stream once the video element mounts (perm transitions to 'granted')
  useEffect(() => {
    if (perm === 'granted' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [perm]);

  // Auto-check existing permission
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((result) => {
        if (result.state === 'granted') startCamera();
      })
      .catch(() => {/* permissions API not available */});
  }, [startCamera]);

  // ── Inference loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || perm !== 'granted') return;

    // Auto-start session when camera + model ready
    if (!state.isActive) start();

    function loop(timestamp: number) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Resize canvas to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      const result = detect(video, timestamp);
      const ctx = canvas.getContext('2d');

      const now = Date.now();

      if (result && result.landmarks.length > 0 && ctx) {
        nullStreakRef.current = 0;
        const lms = result.landmarks[0];

        // Smile detection at ~7fps (lightweight polling)
        if (faceReadyRef.current && now - lastFaceDetectRef.current > 150) {
          lastFaceDetectRef.current = now;
          const smiling = detectSmileRef.current(video, timestamp);
          if (smiling !== isSmilingRef.current) {
            isSmilingRef.current = smiling;
            setIsSmiling(smiling);
          }
        }

        processPose(lms, isSmilingRef.current);
        drawGlowingSkeleton(ctx, lms, canvas.width, canvas.height, impactRef.current, isSlouchingRef.current);
      } else {
        nullStreakRef.current += 1;
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Debug: flush every 500ms
      if (now - debugTimerRef.current > 500) {
        debugTimerRef.current = now;
        const lmCount = result?.landmarks?.length ?? 0;
        setDebugLine(
          `model:${stage} vr:${video.readyState} lm:${lmCount} nulls:${nullStreakRef.current} ${video.videoWidth}×${video.videoHeight}`
        );
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, perm, detect]);

  // ── Confetti ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.confetti) return;
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#00f0ff', '#ff00cc', '#7b2fff', '#ffffff', '#ffaa00'],
        gravity: 0.8,
        scalar: 1.1,
      });
    });
  }, [state.confetti]);

  // ── End session ──────────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    stop();

    const ended = {
      duration: state.elapsed,
      gestures: state.gestures,
      bestStreak: state.bestStreak,
      smileCount: state.smileCount,
      slouchCount: state.slouchCount,
      goodPostureSeconds: state.goodPostureSeconds,
    };

    recordSession({
      ...ended,
      impact: 0,
      streak: ended.bestStreak,
      peakImpact: state.peakImpact,
    });
    setSessionEnded(ended);
    setShowSummary(true);
  }, [state, stop]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Keep stable refs in sync so the RAF loop always sees the latest values
  faceReadyRef.current = faceReady;
  detectSmileRef.current = detectSmile;
  impactRef.current = state.impact;
  isSlouchingRef.current = state.isSlouching;

  const gestureColor = GESTURE_COLORS[state.gesture] ?? '#00f0ff';

  // ── Render: Loading model ─────────────────────────────────────────────
  if (stage === 'loading-wasm' || stage === 'loading-model' || stage === 'idle') {
    return <LoadingScreen progress={progress} stage={stage} />;
  }

  if (stage === 'error') {
    return (
      <div className="fixed inset-0 bg-[#050510] flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-red-400 text-center font-semibold">
          {modelError ?? 'Failed to load AI model.'}
        </p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 rounded-2xl bg-white/10 text-white font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Render: Need camera permission ────────────────────────────────────
  if (perm === 'unknown' || perm === 'denied' || perm === 'requesting') {
    return (
      <CameraPermission
        onRequest={startCamera}
        error={permError}
      />
    );
  }

  // ── Render: Main practice UI ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* ── Camera feed ── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover camera-feed"
        playsInline
        muted
        autoPlay
      />

      {/* ── Skeleton canvas ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full camera-feed"
        style={{ pointerEvents: 'none' }}
      />

      {/* ── Debug overlay ── */}
      {debugLine && (
        <div className="absolute bottom-20 left-2 z-50 text-[10px] font-mono text-white/60 bg-black/50 px-2 py-1 rounded pointer-events-none">
          {debugLine}
        </div>
      )}

      {/* ── Dark overlay (top and bottom gradients) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,5,16,0.75) 0%, transparent 25%, transparent 60%, rgba(5,5,16,0.9) 100%)',
        }}
      />

      {/* ── TOP BAR ── */}
      <div className="absolute top-0 left-0 right-0 pt-safe z-20">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          {/* Back button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              endSession();
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(5,5,16,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ArrowLeft size={18} className="text-white" />
          </motion.button>

          {/* Gesture name (center) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={state.gesture}
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center"
            >
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: gestureColor }}
              >
                Detecting
              </span>
              <span className="text-white font-black text-lg leading-tight tracking-wide">
                {state.gesture}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Impact badge */}
          <ImpactBadge impact={state.impact} />
        </div>
      </div>

      {/* ── RIGHT SIDE: streak + skeleton legend ── */}
      <div className="absolute top-20 right-4 z-20 flex flex-col gap-2 items-end">
        <AnimatePresence>
          {state.streak > 3 && (
            <motion.div
              key="streak"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-black"
                style={{
                  background: 'rgba(123,47,255,0.2)',
                  border: '1px solid rgba(123,47,255,0.5)',
                  color: '#7b2fff',
                  boxShadow: '0 0 12px rgba(123,47,255,0.4)',
                }}
              >
                ⚡ {state.streak}s streak
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skeleton color legend — always visible so users know what colors mean */}
        <div
          className="flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl"
          style={{ background: 'rgba(5,5,16,0.72)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {(
            [
              { color: '#00ff88', label: 'Great form' },
              { color: '#ffcc00', label: 'Extend arms' },
              { color: '#ff4444', label: 'Slouching!' },
            ] as const
          ).map(({ color, label }) => (
            <div key={color} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: color, boxShadow: `0 0 5px ${color}` }}
              />
              <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CENTER SLOUCH WARNING — unmissable banner ── */}
      <AnimatePresence>
        {state.isSlouching && (
          <motion.div
            key="slouch-center"
            initial={{ opacity: 0, scale: 0.8, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: -8 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            style={{ top: '28%' }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 30px rgba(255,40,40,0.45)',
                  '0 0 60px rgba(255,40,40,0.75)',
                  '0 0 30px rgba(255,40,40,0.45)',
                ],
              }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-2 px-10 py-5 rounded-3xl"
              style={{
                background: 'rgba(160,10,10,0.35)',
                border: '2px solid rgba(255,60,60,0.85)',
                backdropFilter: 'blur(18px)',
                minWidth: '220px',
              }}
            >
              <span className="text-5xl leading-none">🪑</span>
              <span
                className="text-3xl font-black tracking-widest uppercase leading-none"
                style={{ color: '#ff4444' }}
              >
                Sit Up!
              </span>
              <span className="text-sm font-medium text-center" style={{ color: 'rgba(255,180,180,0.85)' }}>
                Slouching hurts your presence
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT SIDE: smile indicator (visible once face model is ready) ── */}
      <AnimatePresence>
        {faceReady && (
          <motion.div
            key="smile"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-20 left-4 z-20"
          >
            <div
              className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-black transition-all duration-300"
              style={{
                background: isSmiling ? 'rgba(0,255,136,0.15)' : 'rgba(30,30,50,0.6)',
                border: `1px solid ${isSmiling ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: isSmiling ? '#00ff88' : '#666688',
                boxShadow: isSmiling ? '0 0 12px rgba(0,255,136,0.3)' : 'none',
              }}
            >
              {isSmiling ? '😊' : '😐'} {isSmiling ? 'Smiling!' : 'Smile'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COACH TIPS ── */}
      <div className="absolute left-4 right-4 z-20" style={{ bottom: '160px' }}>
        <div className="flex flex-col items-start gap-2">
          <AnimatePresence mode="popLayout">
            {state.tips.map((tip, i) => (
              <TipBubble key={tip.id} text={tip.text} icon={tip.icon} delay={i * 0.1} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── IMPACT ARC (center bottom) ── */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        style={{ bottom: '100px', width: '120px', height: '80px' }}
      >
        <ImpactArc impact={state.impact} />
      </div>

      {/* ── BOTTOM BAR ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 pb-safe"
        style={{ background: 'linear-gradient(0deg, rgba(5,5,16,0.97) 0%, rgba(5,5,16,0.8) 100%)' }}
      >
        <div className="flex items-center justify-between px-6 pt-4 pb-4">

          {/* Good moves counter */}
          <motion.div
            animate={{ scale: state.gestures > 0 ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center min-w-[72px]"
          >
            <span
              className="text-2xl font-black leading-none"
              style={{ color: '#00ff88', textShadow: '0 0 12px rgba(0,255,136,0.4)' }}
            >
              {state.gestures}
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              GOOD MOVES
            </span>
          </motion.div>

          {/* Record / Stop button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={endSession}
            className="relative w-18 h-18 rounded-full flex items-center justify-center"
            style={{ width: 72, height: 72 }}
          >
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(255,50,50,0.5)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
            {/* Button face */}
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #ff3333, #cc0000)',
                boxShadow: '0 0 20px rgba(255,50,50,0.5), 0 4px 16px rgba(0,0,0,0.5)',
              }}
            >
              <Square size={22} fill="white" style={{ color: 'white' }} />
            </div>
          </motion.button>

          {/* Timer */}
          <div className="flex flex-col items-center min-w-[72px]">
            <TimerDisplay seconds={state.elapsed} />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              TIME
            </span>
          </div>
        </div>
      </div>

      {/* ── High impact flash overlay ── */}
      <AnimatePresence>
        {state.impact >= 90 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none z-5"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0,240,255,0.04) 0%, transparent 70%)',
              boxShadow: 'inset 0 0 60px rgba(0,240,255,0.12)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Session summary ── */}
      <SessionSummary
        open={showSummary}
        onClose={() => {
          setShowSummary(false);
          router.push('/');
        }}
        stats={sessionEnded ?? { duration: 0, gestures: 0, bestStreak: 0, smileCount: 0, slouchCount: 0, goodPostureSeconds: 0 }}
      />
    </div>
  );
}
