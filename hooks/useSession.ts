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
};

export interface SessionControls {
  state: SessionState;
  start: () => void;
  stop: () => void;
  processPose: (landmarks: { x: number; y: number; z: number; visibility?: number }[]) => void;
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
    (landmarks: { x: number; y: number; z: number; visibility?: number }[]) => {
      if (!activeRef.current || landmarks.length === 0) return;

      const now = Date.now();
      const result = analyzeGesture(landmarks);
      const elapsed = (now - startTimeRef.current) / 1000;

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

        // ── Confetti at 95+ ──
        const shouldConfetti = roundedImpact >= 95 && !confettiFiredRef.current;
        if (shouldConfetti) confettiFiredRef.current = true;

        const tips = selectCoachTips(result, elapsed);

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
