'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Monitor, Volume2, VolumeX, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePoseLandmarker } from '@/hooks/usePoseLandmarker';
import { drawGlowingSkeleton } from '@/lib/gestureAnalysis';

type CameraState = 'idle' | 'granted' | 'denied';
type PostureState = 'good' | 'slouching' | 'unknown';

const SLOUCH_TRIGGER_MS = 2000;   // alert after 2s of continuous slouch
const ALERT_COOLDOWN_MS = 30000;  // 30s between alerts

// ── Sitting-specific slouch detector ─────────────────────────────────────────
// Designed for someone seated at a desk where hips are often off-camera.
// Uses two signals that work regardless of camera height:
//   1. Head drop ratio  — nose Y relative to shoulder midpoint, normalised by
//      shoulder width. Upright sitting ≈ 2.5–4+. Leaning/slouching < 1.8.
//   2. Shoulder roll    — chest caving narrows apparent shoulder width relative
//      to inter-ocular distance. Upright ≈ 5–7×. Rolled-forward < 4.0.
function detectSittingSlouch(
  lm: { x: number; y: number; z?: number; visibility?: number }[]
): boolean {
  const vis = (p: typeof lm[0], t = 0.3) => (p?.visibility ?? 1) >= t;

  const nose  = lm[0];
  const lEye  = lm[2];
  const rEye  = lm[5];
  const lS    = lm[11];
  const rS    = lm[12];

  if (!vis(nose) || !vis(lS) || !vis(rS)) return false;

  const shoulderMidY  = (lS.y + rS.y) / 2;
  const shoulderWidth = Math.abs(rS.x - lS.x);
  if (shoulderWidth < 0.06) return false; // person too far / partial view

  // Signal 1: head drop
  const headDropRatio = (shoulderMidY - nose.y) / shoulderWidth;
  const isHeadDropping = headDropRatio < 1.8;

  // Signal 2: shoulder roll (invariant to camera distance)
  const eyeWidth =
    vis(lEye, 0.5) && vis(rEye, 0.5) ? Math.abs(rEye.x - lEye.x) : 0;
  const isShoulderRolled = eyeWidth > 0.015 && shoulderWidth / eyeWidth < 4.0;

  return isHeadDropping || isShoulderRolled;
}

export default function OfficeErgonomics() {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const slouchStartRef = useRef<number | null>(null);
  const lastAlertRef   = useRef<number>(0);
  const voiceEnabledRef = useRef(true);

  const [cameraState,  setCameraState]  = useState<CameraState>('idle');
  const [postureState, setPostureState] = useState<PostureState>('unknown');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alertCount,   setAlertCount]   = useState(0);
  const [lastAlertTime, setLastAlertTime] = useState<number | null>(null);

  const { detect, isReady } = usePoseLandmarker();

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const speakAlert = useCallback(() => {
    if (!voiceEnabledRef.current) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('Sit up, please');
      u.rate = 0.9; u.pitch = 1.0; u.volume = 1.0;
      window.speechSynthesis.speak(u);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraState('granted');
      }
    } catch {
      setCameraState('denied');
    }
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
  }, []);

  // ── Detection loop (defined inside effect — same pattern as PracticeScreen) ──
  useEffect(() => {
    if (!isReady || cameraState !== 'granted') return;

    function loop(timestamp: number) {
      const video  = videoRef.current;
      const canvas = canvasRef.current;

      // Wait for video to have actual frames
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Resize canvas to match video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      const result    = detect(video, timestamp);
      const landmarks = result?.landmarks[0] ?? null;

      if (landmarks && landmarks.length > 0) {
        const slouching = detectSittingSlouch(landmarks);

        // Draw skeleton: red when slouching, green when upright
        drawGlowingSkeleton(
          ctx, landmarks, canvas.width, canvas.height,
          slouching ? 0 : 100,   // impact: 0 → yellow/red, 100 → green
          slouching
        );

        setPostureState(slouching ? 'slouching' : 'good');

        if (slouching) {
          if (slouchStartRef.current === null) {
            slouchStartRef.current = Date.now();
          } else {
            const elapsed = Date.now() - slouchStartRef.current;
            const now     = Date.now();
            if (
              elapsed >= SLOUCH_TRIGGER_MS &&
              now - lastAlertRef.current >= ALERT_COOLDOWN_MS
            ) {
              lastAlertRef.current = now;
              setLastAlertTime(now);
              setAlertCount(c => c + 1);
              speakAlert();
              slouchStartRef.current = now;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const postureColor =
    postureState === 'good'     ? 'text-emerald-400' :
    postureState === 'slouching' ? 'text-red-400'     : 'text-slate-400';

  const postureLabel =
    postureState === 'good'     ? 'Good posture' :
    postureState === 'slouching' ? 'Slouching detected!' : 'Stand by…';

  const timeSinceAlert = lastAlertTime
    ? Math.round((Date.now() - lastAlertTime) / 1000)
    : null;

  return (
    <div className="cyber-bg min-h-screen flex flex-col pb-28">
      {/* Header */}
      <div className="pt-safe px-4 pt-6 pb-3 flex items-center gap-3">
        <Monitor className="text-cyan-400" size={22} />
        <h1 className="text-xl font-bold gradient-text">Office Ergonomics</h1>
      </div>

      {/* Camera area */}
      <div
        className="relative mx-4 rounded-2xl overflow-hidden bg-black/60 border border-cyan-900/40"
        style={{ aspectRatio: '4/3' }}
      >
        {/* video + canvas both use camera-feed (scaleX -1) — drawGlowingSkeleton
            applies its own internal mirror so they stay in sync */}
        <video
          ref={videoRef}
          className="camera-feed absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="camera-feed absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {/* Idle / denied overlay */}
        {cameraState !== 'granted' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
            <div className="absolute top-4 left-5 right-5 flex flex-col gap-2 pointer-events-none">
              <div className="skeleton h-1.5 w-3/4 rounded-full opacity-40" />
              <div className="skeleton h-1.5 w-1/2 rounded-full opacity-25" />
            </div>
            <Monitor className="text-cyan-400/50" size={48} />
            <p className="text-slate-400 text-sm text-center">
              {cameraState === 'denied'
                ? 'Camera access denied. Please allow camera in browser settings.'
                : 'Enable camera to start posture monitoring'}
            </p>
            {cameraState === 'idle' && (
              <button
                onClick={startCamera}
                className="px-6 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
              >
                Allow Camera
              </button>
            )}
          </div>
        )}

        {/* Stop button */}
        {cameraState === 'granted' && (
          <button
            onClick={stopCamera}
            className="absolute top-3 right-3 z-10 px-3 py-1 rounded-lg bg-black/60 border border-white/10 text-xs text-slate-300 hover:bg-black/80 transition-colors"
          >
            Stop
          </button>
        )}

        {/* Posture badge */}
        {cameraState === 'granted' && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 border border-white/10">
            {postureState === 'good'
              ? <CheckCircle2 size={14} className="text-emerald-400" />
              : postureState === 'slouching'
              ? <AlertTriangle size={14} className="text-red-400 animate-pulse" />
              : <div className="w-3 h-3 rounded-full bg-slate-500" />}
            <span className={`text-xs font-medium ${postureColor}`}>{postureLabel}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Alerts today</span>
          <span className="text-3xl font-bold gradient-text">{alertCount}</span>
        </div>
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Last alert</span>
          <span className="text-sm font-medium text-slate-300 mt-1">
            {timeSinceAlert !== null ? `${timeSinceAlert}s ago` : '—'}
          </span>
        </div>
      </div>

      {/* Voice toggle */}
      <div className="mx-4 mt-4 glass-card rounded-xl p-4 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-200">Voice alert</span>
          <span className="text-xs text-slate-400">"Sit up, please" spoken after 2s of slouching</span>
        </div>
        <button
          onClick={() => setVoiceEnabled(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
            voiceEnabled
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
              : 'bg-white/5 border-white/10 text-slate-400'
          }`}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span className="text-xs font-medium">{voiceEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {/* Tips */}
      <div className="mx-4 mt-4 glass-card rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Tips</p>
        {[
          'Keep your back straight and shoulders level.',
          'Screen should be at or just below eye level.',
          'Feet flat on the floor or on a footrest.',
          'Take a break and stretch every 30 minutes.',
        ].map(tip => (
          <p key={tip} className="text-xs text-slate-300 leading-relaxed">• {tip}</p>
        ))}
      </div>
    </div>
  );
}
