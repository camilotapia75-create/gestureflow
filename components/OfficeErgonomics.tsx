'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Monitor, Volume2, VolumeX, CheckCircle2, AlertTriangle, ScanLine } from 'lucide-react';
import { usePoseLandmarker } from '@/hooks/usePoseLandmarker';
import { drawGlowingSkeleton } from '@/lib/gestureAnalysis';

type CameraState = 'idle' | 'granted' | 'denied';
type PostureState = 'good' | 'slouching' | 'unknown';

const SLOUCH_TRIGGER_MS   = 2000;
const ALERT_COOLDOWN_MS   = 30_000;
const CALIBRATION_FRAMES  = 60;   // ~2 s of data
const CAL_STORAGE_KEY     = 'gestureflow_office_calibration';
const VOICE_STORAGE_KEY   = 'gestureflow_office_voice';

// ── Voice profiles ────────────────────────────────────────────────────────────
// We match by BCP-47 lang tag + name heuristics from the browser voice list.
const VOICE_PROFILES = [
  { id: 'us-f',  label: 'Emma — US Female',         lang: 'en-US', pitch: 1.15, rate: 0.9,  prefer: /samantha|zira|google us eng.*fem|ava|emma/i },
  { id: 'us-m',  label: 'James — US Male',           lang: 'en-US', pitch: 0.85, rate: 0.88, prefer: /david|mark|alex|google us eng.*mal|james/i },
  { id: 'gb-f',  label: 'Sophie — British Female',   lang: 'en-GB', pitch: 1.1,  rate: 0.88, prefer: /hazel|kate|serena|google uk.*fem|emily/i },
  { id: 'gb-m',  label: 'Oliver — British Male',     lang: 'en-GB', pitch: 0.88, rate: 0.85, prefer: /daniel|george|google uk.*mal|oliver/i },
  { id: 'au-f',  label: 'Charlotte — Australian',    lang: 'en-AU', pitch: 1.1,  rate: 0.9,  prefer: /karen|lee|catherine|google aus.*fem/i },
  { id: 'au-m',  label: 'Jack — Australian Male',    lang: 'en-AU', pitch: 0.88, rate: 0.88, prefer: /gordon|google aus.*mal/i },
  { id: 'in-f',  label: 'Priya — Indian Female',     lang: 'en-IN', pitch: 1.1,  rate: 0.88, prefer: /heera|priya|google ind.*fem/i },
  { id: 'in-m',  label: 'Rajan — Indian Male',       lang: 'en-IN', pitch: 0.88, rate: 0.88, prefer: /rajan|google ind.*mal/i },
] as const;
type VoiceId = typeof VOICE_PROFILES[number]['id'];

interface Calibration { headDrop: number; shoulderEye: number }

// ── Slouch detection (calibration-relative) ────────────────────────────────────
// HEAD_DROP_SLACK: how much the ratio may fall below baseline before flagging
// SHOULDER_SLACK:  how much the ratio may fall below baseline before flagging
// Both signals must trigger simultaneously to avoid false positives.
const HEAD_DROP_SLACK  = 0.55;
const SHOULDER_SLACK   = 0.90;

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
    // No calibration — only flag very obvious cases (BOTH signals)
    const headBad     = r.headDrop < 1.2;
    const shoulderBad = r.shoulderEye !== null && r.shoulderEye < 3.2;
    return headBad && shoulderBad;
  }

  const headBad     = r.headDrop < cal.headDrop - HEAD_DROP_SLACK;
  const shoulderBad = r.shoulderEye !== null && r.shoulderEye < cal.shoulderEye - SHOULDER_SLACK;
  // Require BOTH to avoid false positives
  return headBad && shoulderBad;
}

// ── Resolve best matching browser voice ──────────────────────────────────────
function resolveVoice(profileId: VoiceId): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const p = VOICE_PROFILES.find(v => v.id === profileId)!;
  // 1. Try name preference regex + lang
  const byName = voices.find(v => v.lang.startsWith(p.lang.slice(0, 5)) && p.prefer.test(v.name));
  if (byName) return byName;
  // 2. Any voice matching lang
  const byLang = voices.find(v => v.lang.startsWith(p.lang.slice(0, 5)));
  if (byLang) return byLang;
  // 3. Any en- voice
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

  const [cameraState,   setCameraState]   = useState<CameraState>('idle');
  const [postureState,  setPostureState]  = useState<PostureState>('unknown');
  const [voiceEnabled,  setVoiceEnabled]  = useState(true);
  const [voiceId,       setVoiceId]       = useState<VoiceId>('gb-f');
  const [alertCount,    setAlertCount]    = useState(0);
  const [lastAlertTime, setLastAlertTime] = useState<number | null>(null);
  const [calProgress,   setCalProgress]   = useState(0);

  const { detect, isReady } = usePoseLandmarker();

  // Load persisted calibration + voice
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
  }, []);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { voiceIdRef.current = voiceId; }, [voiceId]);
  useEffect(() => { calibrationRef.current = calibration; }, [calibration]);
  useEffect(() => { isCalRef.current = isCalibrating; }, [isCalibrating]);

  const speakAlert = useCallback(() => {
    if (!voiceEnabledRef.current) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Sit up, please');
    const profile = VOICE_PROFILES.find(p => p.id === voiceIdRef.current)!;
    const voice   = resolveVoice(voiceIdRef.current);
    if (voice) u.voice = voice;
    u.lang   = profile.lang;
    u.pitch  = profile.pitch;
    u.rate   = profile.rate;
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
  }, []);

  const startCalibration = useCallback(() => {
    calSamplesRef.current = [];
    setCalProgress(0);
    setIsCalibrating(true);
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

  const postureColor = postureState === 'good' ? 'text-emerald-400' : postureState === 'slouching' ? 'text-red-400' : 'text-slate-400';
  const postureLabel = postureState === 'good' ? 'Good posture' : postureState === 'slouching' ? 'Slouching detected!' : 'Stand by…';
  const timeSinceAlert = lastAlertTime ? Math.round((Date.now() - lastAlertTime) / 1000) : null;

  return (
    <div className="cyber-bg min-h-screen flex flex-col pb-28">
      <div className="pt-safe px-4 pt-6 pb-3 flex items-center gap-3">
        <Monitor className="text-cyan-400" size={22} />
        <h1 className="text-xl font-bold gradient-text">Office Ergonomics</h1>
      </div>

      {/* Camera */}
      <div className="relative mx-4 rounded-2xl overflow-hidden bg-black/60 border border-cyan-900/40" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="camera-feed absolute inset-0 w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="camera-feed absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />

        {cameraState !== 'granted' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
            <div className="absolute top-4 left-5 right-5 flex flex-col gap-2 pointer-events-none">
              <div className="skeleton h-1.5 w-3/4 rounded-full opacity-40" />
              <div className="skeleton h-1.5 w-1/2 rounded-full opacity-25" />
            </div>
            <Monitor className="text-cyan-400/50" size={48} />
            <p className="text-slate-400 text-sm text-center">
              {cameraState === 'denied' ? 'Camera access denied.' : 'Enable camera to start posture monitoring'}
            </p>
            {cameraState === 'idle' && (
              <button onClick={startCamera} className="px-6 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-medium">
                Allow Camera
              </button>
            )}
          </div>
        )}

        {/* Calibration overlay */}
        {cameraState === 'granted' && isCalibrating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
            <ScanLine className="text-cyan-400 animate-pulse" size={36} />
            <p className="text-white font-semibold text-sm">Sit up straight and hold…</p>
            <div className="w-48 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-cyan-400 transition-all duration-100" style={{ width: `${calProgress}%` }} />
            </div>
            <p className="text-cyan-300 text-xs">{calProgress}%</p>
          </div>
        )}

        {cameraState === 'granted' && (
          <button onClick={stopCamera} className="absolute top-3 right-3 z-10 px-3 py-1 rounded-lg bg-black/60 border border-white/10 text-xs text-slate-300">
            Stop
          </button>
        )}

        {cameraState === 'granted' && !isCalibrating && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 border border-white/10">
            {postureState === 'good' ? <CheckCircle2 size={14} className="text-emerald-400" />
              : postureState === 'slouching' ? <AlertTriangle size={14} className="text-red-400 animate-pulse" />
              : <div className="w-3 h-3 rounded-full bg-slate-500" />}
            <span className={`text-xs font-medium ${postureColor}`}>{postureLabel}</span>
          </div>
        )}
      </div>

      {/* Calibrate CTA */}
      {cameraState === 'granted' && !isCalibrating && (
        <div className="mx-4 mt-3 glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Calibrate posture</p>
            <p className="text-xs text-slate-400">{calibration ? 'Calibrated ✓ — tap to redo' : 'Sit up straight, then tap to capture your baseline'}</p>
          </div>
          <button onClick={startCalibration} className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
            {calibration ? 'Re-calibrate' : 'Calibrate'}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Alerts today</span>
          <span className="text-3xl font-bold gradient-text">{alertCount}</span>
        </div>
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Last alert</span>
          <span className="text-sm font-medium text-slate-300 mt-1">{timeSinceAlert !== null ? `${timeSinceAlert}s ago` : '—'}</span>
        </div>
      </div>

      {/* Voice toggle + profile picker */}
      <div className="mx-4 mt-3 glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Voice alert</p>
            <p className="text-xs text-slate-400">"Sit up, please" after 2s of slouching</p>
          </div>
          <button
            onClick={() => setVoiceEnabled(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${voiceEnabled ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="text-xs font-medium">{voiceEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>

        {voiceEnabled && (
          <div className="grid grid-cols-2 gap-2">
            {VOICE_PROFILES.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setVoiceId(p.id);
                  localStorage.setItem(VOICE_STORAGE_KEY, p.id);
                  // Preview
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance('Sit up, please');
                    const voice = resolveVoice(p.id);
                    if (voice) u.voice = voice;
                    u.lang = p.lang; u.pitch = p.pitch; u.rate = p.rate; u.volume = 0.8;
                    window.speechSynthesis.speak(u);
                  }
                }}
                className={`px-3 py-2 rounded-xl border text-left transition-all ${
                  voiceId === p.id
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <p className="text-xs font-semibold leading-tight">{p.label.split(' — ')[0]}</p>
                <p className="text-[10px] opacity-70">{p.label.split(' — ')[1]}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mx-4 mt-3 glass-card rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Tips</p>
        {['Keep your back straight and shoulders level.', 'Screen at or just below eye level.', 'Feet flat on the floor or on a footrest.', 'Stretch every 30 minutes.'].map(t => (
          <p key={t} className="text-xs text-slate-300 leading-relaxed">• {t}</p>
        ))}
      </div>
    </div>
  );
}
