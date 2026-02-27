'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export function useFaceLandmarker() {
  const [isReady, setIsReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;

        let landmarker;
        try {
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            minFaceDetectionConfidence: 0.3,
            minFacePresenceConfidence: 0.3,
            minTrackingConfidence: 0.3,
          });
        } catch {
          if (cancelled) return;
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            minFaceDetectionConfidence: 0.3,
            minFacePresenceConfidence: 0.3,
            minTrackingConfidence: 0.3,
          });
        }

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsReady(true);
      } catch {
        // Face landmarker is optional — fail silently, smile detection just won't work
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Returns the raw blended smile score (0–1). Caller compares to threshold.
  //
  // mouthSmileLeft/Right tracks corner-of-mouth lift — accurate up close but
  // unreliable at distance because the mouth is tiny in the frame.
  // cheekSquintLeft/Right tracks the cheek raise that accompanies a genuine
  // (Duchenne) smile and squints the lower eyelid — a larger, more visible
  // movement that holds up much better when the face is small.
  // Blending both (60/40) makes the score robust across distances.
  const detectSmile = useCallback(
    (video: HTMLVideoElement, timestamp: number): number => {
      if (!landmarkerRef.current || !isReady) return 0;
      try {
        const result = landmarkerRef.current.detectForVideo(video, timestamp);
        if (!result.faceBlendshapes || result.faceBlendshapes.length === 0) return 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const categories: { categoryName: string; score: number }[] =
          result.faceBlendshapes[0].categories;
        const smileL  = categories.find((c) => c.categoryName === 'mouthSmileLeft')?.score  ?? 0;
        const smileR  = categories.find((c) => c.categoryName === 'mouthSmileRight')?.score ?? 0;
        const squintL = categories.find((c) => c.categoryName === 'cheekSquintLeft')?.score  ?? 0;
        const squintR = categories.find((c) => c.categoryName === 'cheekSquintRight')?.score ?? 0;
        const smileAvg  = (smileL  + smileR)  / 2;
        const squintAvg = (squintL + squintR) / 2;
        return smileAvg * 0.6 + squintAvg * 0.4;
      } catch {
        return 0;
      }
    },
    [isReady]
  );

  return { isReady, detectSmile };
}
