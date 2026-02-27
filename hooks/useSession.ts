'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeGesture, selectCoachTips, GestureResult, CoachTip } from '@/lib/gestureAnalysis';

export interface SessionState {
  isActive: boolean;
  elapsed: number; // seconds
  gestures: number;
  impact: number; // live 0–100
  averageImpact: number;
  peakImpact: number;
  streak: number; // current
  bestStreak: number;
  gesture: GestureResult['gesture'];
  tips: CoachTip[];
  confetti: boolean;
  isSlouching: boolean;
  noseAboveShoulder: number; // raw ratio for debug calibration
  smileCount: number;
  slouchCount: number;
  goodPostureSeconds: number;
}

const INITIAL_STATE: SessionState = {
  isActive: false,
  elapsed: 0,
  gestures: 0,
  impact: 0,
  averageImpact: 0,
  peakImpact: 0,
  streak: 0,
  bestStreak: 0,
  gesture: 'REST',
  tips: [],
  confetti: false,
  isSlouching: false,
  noseAboveShoulder: 0.5,
  smileCount: 0,
  slouchCount: 0,
  goodPostureSeconds: 0,
};

export interface SessionControls {
  state: SessionState;
  start: () => void;
  stop: () => void;
  processPose: (landmarks: { x: number; y: number; z: number; visibility?: number }[], isSmiling?: boolean) => void;
}

export function useSession(): SessionControls {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  // Refs for mutable session tracking (avoid stale closures)
  const activeRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastTickRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Impact smoothing buffer (last 300ms of samples)
  const impactBufferRef = useRef<number[]>([]);
  const impactSampleTimerRef = useRef(0);

  // Gesture counting
  const lastGestureRef = useRef<string>('REST');
  const gestureCountRef = useRef(0);

  // Streak tracking
  const streakTimerRef = useRef(0);
  const highImpactStartRef = useRef(0);
  const currentStreakRef = useRef(0);
  const bestStreakRef = useRef(0);

  // Impact history for average
  const impactHistoryRef = useRef<number[]>([]);
  const peakImpactRef = useRef(0);

  // Confetti debounce
  const confettiFiredRef = useRef(false);

  // Positive-behaviour counters
  const smileCountRef = useRef(0);
  const slouchCountRef = useRef(0);
  const goodPostureSecondsRef = useRef(0);
  const lastSmilingRef = useRef(false);
  const lastSlouchingRef = useRef(false);

  const start = useCallback(() => {
    activeRef.current = true;
    startTimeRef.current = Date.now();
    lastTickRef.current = Date.now();
    impactBufferRef.current = [];
    impactHistoryRef.current = [];
    gestureCountRef.current = 0;
    currentStreakRef.current = 0;
    bestStreakRef.current = 0;
    peakImpactRef.current = 0;
    highImpactStartRef.current = 0;
    confettiFiredRef.current = false;
    smileCountRef.current = 0;
    slouchCountRef.current = 0;
    goodPostureSecondsRef.current = 0;
    lastSmilingRef.current = false;
    lastSlouchingRef.current = false;

    setState({ ...INITIAL_STATE, isActive: true });

    // 1-second timer tick
    timerRef.current = setInterval(() => {
      if (!activeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setState((prev) => ({ ...prev, elapsed }));
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setState((prev) => ({ ...prev, isActive: false }));
  }, []);

  const processPose = useCallback(
    (landmarks: { x: number; y: number; z: number; visibility?: number }[], isSmiling = true) => {
      if (!activeRef.current || landmarks.length === 0) return;

      const now = Date.now();
      const result = analyzeGesture(landmarks);
      const elapsed = (now - startTimeRef.current) / 1000;

      // ── Per-frame transition counters ──
      if (isSmiling && !lastSmilingRef.current) smileCountRef.current += 1;
      lastSmilingRef.current = isSmiling;

      if (result.isSlouching && !lastSlouchingRef.current) slouchCountRef.current += 1;
      lastSlouchingRef.current = result.isSlouching;

      // ── Impact smoothing (300ms window) ──
      impactBufferRef.current.push(result.impact);
      if (now - impactSampleTimerRef.current >= 300) {
        impactSampleTimerRef.current = now;
        const buf = impactBufferRef.current.slice(-12); // last 12 samples ≈ 300ms at 30fps
        const smoothedImpact = buf.reduce((a, b) => a + b, 0) / buf.length;
        const roundedImpact = Math.round(smoothedImpact);

        impactHistoryRef.current.push(roundedImpact);
        const avgImpact = Math.round(
          impactHistoryRef.current.reduce((a, b) => a + b, 0) /
            impactHistoryRef.current.length
        );
        peakImpactRef.current = Math.max(peakImpactRef.current, roundedImpact);

        // ── Gesture count (count transitions into power moves) ──
        if (
          result.isPowerMove &&
          lastGestureRef.current !== result.gesture &&
          result.impact > 60
        ) {
          gestureCountRef.current += 1;
        }
        lastGestureRef.current = result.gesture;

        // ── Streak (impact > 80 for 3+ seconds) ──
        if (roundedImpact >= 80) {
          if (highImpactStartRef.current === 0) {
            highImpactStartRef.current = now;
          } else if (now - highImpactStartRef.current >= 3000) {
            currentStreakRef.current = Math.floor((now - highImpactStartRef.current) / 1000);
            bestStreakRef.current = Math.max(
              bestStreakRef.current,
              currentStreakRef.current
            );
          }
        } else {
          highImpactStartRef.current = 0;
          currentStreakRef.current = 0;
        }

        // ── Good posture time: accumulate ~0.3s per 300ms tick when posture is good ──
        if (roundedImpact >= 60 && !result.isSlouching) {
          goodPostureSecondsRef.current += 0.3;
        }

        // ── Confetti at 95+ ──
        const shouldConfetti = roundedImpact >= 95 && !confettiFiredRef.current;
        if (shouldConfetti) confettiFiredRef.current = true;

        const tips = selectCoachTips(result, elapsed, isSmiling);

        setState((prev) => ({
          ...prev,
          impact: roundedImpact,
          averageImpact: avgImpact,
          peakImpact: peakImpactRef.current,
          gesture: result.gesture,
          gestures: gestureCountRef.current,
          streak: currentStreakRef.current,
          bestStreak: bestStreakRef.current,
          tips,
          confetti: shouldConfetti,
          isSlouching: result.isSlouching,
          noseAboveShoulder: result.noseAboveShoulder,
          smileCount: smileCountRef.current,
          slouchCount: slouchCountRef.current,
          goodPostureSeconds: Math.round(goodPostureSecondsRef.current),
        }));
      }
    },
    []
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { state, start, stop, processPose };
}
