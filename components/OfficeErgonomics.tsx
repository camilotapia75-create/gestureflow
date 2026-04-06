'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Monitor, Volume2, VolumeX, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePoseLandmarker } from '@/hooks/usePoseLandmarker';
import { analyzeGesture, drawGlowingSkeleton } from '@/lib/gestureAnalysis';

type CameraState = 'idle' | 'granted' | 'denied';
type PostureState = 'good' | 'slouching' | 'unknown';

const SLOUCH_TRIGGER_MS = 2000;   // alert after 2s of continuous slouch
const ALERT_COOLDOWN_MS = 30000;  // 30s cooldown between alerts

export default function OfficeErgonomics() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const slouchStartRef = useRef<number | null>(null);
  const lastAlertRef = useRef<number>(0);
  const voiceEnabledRef = useRef(true);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [postureState, setPostureState] = useState<PostureState>('unknown');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [lastAlertTime, setLastAlertTime] = useState<number | null>(null);

  const { detect, isReady } = usePoseLandmarker();

  // Keep ref in sync so RAF loop always reads latest value
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const speakAlert = useCallback(() => {
    if (!voiceEnabledRef.current) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Sit up, please');
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
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
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setCameraState('idle');
    setPostureState('unknown');
    slouchStartRef.current = null;
  }, []);

  // Detection loop
  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isReady) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const landmarks = detect(video, performance.now());

    if (landmarks && landmarks.length > 0) {
      const result = analyzeGesture(landmarks);
      const slouching = result.isSlouching;

      drawGlowingSkeleton(ctx, landmarks, canvas.width, canvas.height, result.impact ?? 0, slouching);

      if (slouching) {
        setPostureState('slouching');
        if (slouchStartRef.current === null) {
          slouchStartRef.current = Date.now();
        } else {
          const elapsed = Date.now() - slouchStartRef.current;
          const now = Date.now();
          if (elapsed >= SLOUCH_TRIGGER_MS && now - lastAlertRef.current >= ALERT_COOLDOWN_MS) {
            lastAlertRef.current = now;
            setLastAlertTime(now);
            setAlertCount(c => c + 1);
            speakAlert();
            slouchStartRef.current = now; // reset so it doesn't fire every frame
          }
        }
      } else {
        setPostureState('good');
        slouchStartRef.current = null;
      }
    } else {
      setPostureState('unknown');
      slouchStartRef.current = null;
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [isReady, detect, speakAlert]);

  // Start loop when camera granted and model ready
  useEffect(() => {
    if (cameraState === 'granted' && isReady) {
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraState, isReady, loop]);

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
    postureState === 'good' ? 'text-emerald-400' :
    postureState === 'slouching' ? 'text-red-400' :
    'text-slate-400';

  const postureLabel =
    postureState === 'good' ? 'Good posture' :
    postureState === 'slouching' ? 'Slouching detected!' :
    'Stand by…';

  const timeSinceAlert = lastAlertTime ? Math.round((Date.now() - lastAlertTime) / 1000) : null;

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
        <video
          ref={videoRef}
          className="camera-feed w-full h-full object-cover scale-x-[-1]"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full scale-x-[-1]"
        />

        {/* Skeleton shimmer + prompt when idle */}
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
            className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-black/60 border border-white/10 text-xs text-slate-300 hover:bg-black/80 transition-colors"
          >
            Stop
          </button>
        )}

        {/* Posture badge */}
        {cameraState === 'granted' && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 border border-white/10">
            {postureState === 'good'
              ? <CheckCircle2 size={14} className="text-emerald-400" />
              : postureState === 'slouching'
              ? <AlertTriangle size={14} className="text-red-400 animate-pulse" />
              : <div className="w-3 h-3 rounded-full bg-slate-500" />
            }
            <span className={`text-xs font-medium ${postureColor}`}>{postureLabel}</span>
          </div>
        )}
      </div>

      {/* Stats row */}
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
