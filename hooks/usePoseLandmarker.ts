'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PoseLandmarkerResult {
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }[]>;
  worldLandmarks: Array<{ x: number; y: number; z: number; visibility?: number }[]>;
}

export type LoadingStage =
  | 'idle'
  | 'loading-wasm'
  | 'loading-model'
  | 'ready'
  | 'error';

export interface PoseLandmarkerState {
  stage: LoadingStage;
  progress: number;
  error: string | null;
  isReady: boolean;
  detect: (video: HTMLVideoElement, timestamp: number) => PoseLandmarkerResult | null;
}

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export function usePoseLandmarker(): PoseLandmarkerState {
  const [stage, setStage] = useState<LoadingStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStage('loading-wasm');
        setProgress(10);

        // Dynamic import to avoid SSR issues
        const { FilesetResolver, PoseLandmarker } = await import(
          '@mediapipe/tasks-vision'
        );

        if (cancelled) return;
        setProgress(30);
        setStage('loading-model');

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;
        setProgress(55);

        // Try GPU first, fall back to CPU
        let landmarker;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
        } catch {
          if (cancelled) return;
          setProgress(65);
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
        }

        if (cancelled) {
          landmarker.close();
          return;
        }

        setProgress(100);
        landmarkerRef.current = landmarker;
        setStage('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[PoseLandmarker] init failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load AI model');
        setStage('error');
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const detect = useCallback(
    (video: HTMLVideoElement, timestamp: number): PoseLandmarkerResult | null => {
      if (!landmarkerRef.current || stage !== 'ready') return null;
      try {
        return landmarkerRef.current.detectForVideo(video, timestamp);
      } catch {
        return null;
      }
    },
    [stage]
  );

  return {
    stage,
    progress,
    error,
    isReady: stage === 'ready',
    detect,
  };
}
