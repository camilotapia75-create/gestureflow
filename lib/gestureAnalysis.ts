// ─── Types ─────────────────────────────────────────────────────────────────

export type GestureType =
  | 'OPEN GESTURE'
  | 'POWER POSE'
  | 'STEEPLE'
  | 'POINTING'
  | 'EMPHASIS'
  | 'WIDE STANCE'
  | 'REST';

export interface GestureResult {
  gesture: GestureType;
  impact: number; // 0–100
  armAngleLeft: number;
  armAngleRight: number;
  shoulderWidth: number;
  handsAboveWaist: boolean;
  symmetry: number; // 0–100
  fidgeting: boolean;
  isPowerMove: boolean;
  isSlouching: boolean;
  noseAboveShoulder: number;   // raw ratio for debug/calibration
  shoulderToEyeRatio: number;  // shoulder width / inter-ocular distance; drops when shoulders roll forward
  torsoLeanZ: number;          // shoulder Z minus hip Z; negative = leaning forward
}

export interface CoachTip {
  id: string;
  text: string;
  icon: string;
  priority: number;
}

// ─── Landmark indices (MediaPipe BlazePose 33) ────────────────────────────

export const LM = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
} as const;

// ─── Math helpers ─────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export function angleBetween(a: Point, b: Point, c: Point): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function dist2d(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function isVisible(lm: Point, threshold = 0.3): boolean {
  return (lm.visibility ?? 1) > threshold;
}

// Inverted parabola peaking at 110° — rewards the natural presenter gesture range
// (90–130° elbow angle). Penalises limp arms (<60°) and locked-out arms (>155°).
function armQuality(angle: number): number {
  const delta = (angle - 110) / 70;
  return clamp(100 - delta * delta * 100);
}

// ─── Core Analysis ────────────────────────────────────────────────────────

export function analyzeGesture(landmarks: Point[]): GestureResult {
  const lEye = landmarks[LM.LEFT_EYE];
  const rEye = landmarks[LM.RIGHT_EYE];
  const lS = landmarks[LM.LEFT_SHOULDER];
  const rS = landmarks[LM.RIGHT_SHOULDER];
  const lE = landmarks[LM.LEFT_ELBOW];
  const rE = landmarks[LM.RIGHT_ELBOW];
  const lW = landmarks[LM.LEFT_WRIST];
  const rW = landmarks[LM.RIGHT_WRIST];
  const lH = landmarks[LM.LEFT_HIP];
  const rH = landmarks[LM.RIGHT_HIP];
  const nose = landmarks[LM.NOSE];
  const lI = landmarks[LM.LEFT_INDEX];
  const rI = landmarks[LM.RIGHT_INDEX];
  const lT = landmarks[LM.LEFT_THUMB];
  const rT = landmarks[LM.RIGHT_THUMB];

  // ── Arm extension angles (elbow angle: shoulder → elbow → wrist) ──
  const leftArmAngle = isVisible(lS) && isVisible(lE) && isVisible(lW)
    ? angleBetween(lS, lE, lW)
    : 90;
  const rightArmAngle = isVisible(rS) && isVisible(rE) && isVisible(rW)
    ? angleBetween(rS, rE, rW)
    : 90;

  // ── Shoulder width (normalized to image width) ──
  const shoulderWidth = isVisible(lS) && isVisible(rS)
    ? Math.abs(rS.x - lS.x)
    : 0.3;

  // ── Hand spread (wrist span vs shoulder span) ──
  const wristSpan = isVisible(lW) && isVisible(rW) ? Math.abs(rW.x - lW.x) : 0;
  const handSpread = shoulderWidth > 0 ? wristSpan / shoulderWidth : 0;

  // ── Hands above waist? ──
  const hipY = isVisible(lH) && isVisible(rH) ? (lH.y + rH.y) / 2 : 0.7;
  const handsAboveWaist =
    (!isVisible(lW) || lW.y < hipY) && (!isVisible(rW) || rW.y < hipY);

  // ── Slouching — forward-lean only (leaning backward is fine) ──────────────
  //
  // Signal 1 · Shoulder roll (width relative to inter-ocular distance)
  //   As the chest caves and shoulders roll forward, the apparent shoulder width
  //   narrows while the eye-to-eye distance stays constant — truly invariant to
  //   camera distance. Upright: ~6–7×. Threshold 4.5 catches moderate roll.
  //   NOTE: nose-above-shoulder (head-drop) was intentionally removed because
  //   it also fires when leaning backward, which is acceptable posture.
  const shoulderMidY = isVisible(lS) && isVisible(rS) ? (lS.y + rS.y) / 2 : 0.4;
  const noseAboveShoulder =
    isVisible(nose) && isVisible(lS) && isVisible(rS) && shoulderWidth > 0
      ? (shoulderMidY - nose.y) / shoulderWidth
      : 0.5; // kept for debug output only
  const eyeWidth =
    isVisible(lEye, 0.5) && isVisible(rEye, 0.5)
      ? Math.abs(rEye.x - lEye.x)
      : 0;
  const shoulderToEyeRatio = eyeWidth > 0.015 ? shoulderWidth / eyeWidth : 6.0;
  const isShoulderRolled = eyeWidth > 0.015 && shoulderToEyeRatio < 4.5;

  // Signal 2 · Forward torso lean (shoulder Z vs hip Z)
  //   When you lean your chest forward, shoulders come closer to the camera
  //   (Z decreases) while hips stay anchored on the seat.
  //   MediaPipe Z: smaller/more-negative = closer to camera.
  //   shoulder-vs-hip Z is ≈ 0 when upright, goes negative on forward lean.
  const shoulderMidZ = isVisible(lS) && isVisible(rS)
    ? ((lS.z ?? 0) + (rS.z ?? 0)) / 2
    : 0;
  const hipMidZ = isVisible(lH) && isVisible(rH)
    ? ((lH.z ?? 0) + (rH.z ?? 0)) / 2
    : shoulderMidZ;
  const torsoLeanZ = shoulderMidZ - hipMidZ;
  const isLeaningForward =
    isVisible(lH) && isVisible(rH) && torsoLeanZ < -0.12;

  const isSlouching = isShoulderRolled || isLeaningForward;

  // ── Power zone: hands between shoulders and hips score highest (Navarro / TED research) ──
  const shoulderY = isVisible(lS) && isVisible(rS) ? (lS.y + rS.y) / 2 : 0.35;
  const zoneScore = (wrist: Point, visible: boolean) => {
    if (!visible) return 60;
    if (wrist.y > shoulderY && wrist.y < hipY) return 100; // in zone
    if (wrist.y <= shoulderY) return 65;                   // above shoulders (theatrical)
    return 40;                                             // below hips (passive)
  };
  const powerZoneScore = (
    zoneScore(lW, isVisible(lW)) + zoneScore(rW, isVisible(rW))
  ) / 2;

  // ── Hands near face (fidgeting) ──
  const faceDist = 0.18;
  const leftFidget = isVisible(lW) && dist2d(lW, nose) < faceDist;
  const rightFidget = isVisible(rW) && dist2d(rW, nose) < faceDist;
  const fidgeting = leftFidget || rightFidget;

  // ── Symmetry: ratio of left vs right arm extension ──
  const leftExtend = isVisible(lS) && isVisible(lW) ? dist2d(lS, lW) : 0;
  const rightExtend = isVisible(rS) && isVisible(rW) ? dist2d(rS, rW) : 0;
  const maxExt = Math.max(leftExtend, rightExtend, 0.001);
  const symmetry = clamp(100 - (Math.abs(leftExtend - rightExtend) / maxExt) * 100);

  // ── Pointing asymmetry: one arm clearly more extended than the other ──
  const extRatio = Math.min(leftExtend, rightExtend) / maxExt;
  const isAsymmetric = extRatio < 0.65 && maxExt > shoulderWidth * 0.6;

  // ── Hand openness: thumb-index spread ──
  const leftOpenness =
    isVisible(lI) && isVisible(lT) ? clamp(dist2d(lI, lT) * 1000) : 50;
  const rightOpenness =
    isVisible(rI) && isVisible(rT) ? clamp(dist2d(rI, rT) * 1000) : 50;
  const handOpenness = (leftOpenness + rightOpenness) / 2;

  // ── Posture openness ──
  const postureScore = clamp(shoulderWidth * 350);

  // ── Arm quality score (peaks at 110°, penalises limp or locked-out arms) ──
  const armScore = (armQuality(leftArmAngle) + armQuality(rightArmAngle)) / 2;

  // ── Build Impact score ──
  // Weights informed by TED/executive presentation research:
  //   arm quality (30%) · power zone (25%) · open palms (20%) · posture (15%) · hand spread bonus · symmetry barely matters
  let impact =
    armScore * 0.30 +
    powerZoneScore * 0.25 +
    (handOpenness / 100) * 20 +
    postureScore * 0.15 +
    symmetry * 0.05 +
    (handSpread > 0.9 ? 15 : handSpread * 12);

  // Penalties
  if (fidgeting) impact -= 10;
  if (isSlouching) impact -= 15;
  impact = clamp(impact);

  // ── Classify gesture ──
  const leftArmUp = isVisible(lW) && lW.y < lS.y;
  const rightArmUp = isVisible(rW) && rW.y < rS.y;
  const leftStraight = leftArmAngle > 120;
  const rightStraight = rightArmAngle > 120;
  const handsClose =
    isVisible(lW) && isVisible(rW) && dist2d(lW, rW) < 0.16;
  const handsAtChest =
    isVisible(lW) && isVisible(rW) &&
    lW.y > (lS.y ?? 0) && lW.y < (lH.y ?? 1) &&
    rW.y > (rS.y ?? 0) && rW.y < (rH.y ?? 1);

  let gesture: GestureType = 'REST';

  if (leftArmUp && rightArmUp && handSpread > 1.1) {
    gesture = 'POWER POSE';
  } else if (handSpread > 0.9 || (leftStraight && rightStraight)) {
    gesture = 'OPEN GESTURE';
  } else if (handsClose && handsAtChest) {
    gesture = 'STEEPLE';
  } else if (isAsymmetric) {
    gesture = 'POINTING';
  } else if (impact > 30) {
    gesture = 'EMPHASIS';
  } else if (postureScore > 60 && !handsAboveWaist) {
    gesture = 'WIDE STANCE';
  } else if (handsAboveWaist || impact > 15) {
    // Catch-all: any sign of engagement avoids a false REST
    gesture = 'EMPHASIS';
  }

  const isPowerMove = gesture === 'POWER POSE' || gesture === 'OPEN GESTURE';

  return {
    gesture,
    impact: Math.round(impact),
    armAngleLeft: Math.round(leftArmAngle),
    armAngleRight: Math.round(rightArmAngle),
    shoulderWidth,
    handsAboveWaist,
    symmetry: Math.round(symmetry),
    fidgeting,
    isPowerMove,
    isSlouching,
    noseAboveShoulder: Math.round(noseAboveShoulder * 100) / 100,
    shoulderToEyeRatio: Math.round(shoulderToEyeRatio * 10) / 10,
    torsoLeanZ: Math.round(torsoLeanZ * 100) / 100,
  };
}

// ─── Coach Tips ───────────────────────────────────────────────────────────

export const ALL_TIPS: CoachTip[] = [
  { id: 'open-palms', text: 'Palms open — builds trust with your audience!', icon: '👐', priority: 1 },
  { id: 'raise-hands', text: 'Raise hands to chest level on key points', icon: '🙌', priority: 2 },
  { id: 'extend-arms', text: 'Extend arms wider — project more authority', icon: '💪', priority: 3 },
  { id: 'chest-open', text: 'Keep shoulders back and chest open', icon: '🏆', priority: 4 },
  { id: 'no-face-touch', text: 'Avoid touching your face — it signals doubt', icon: '🚫', priority: 1 },
  { id: 'mirror-arms', text: 'Mirror your arms for powerful emphasis', icon: '🔄', priority: 5 },
  { id: 'slow-gestures', text: 'Slow your gestures — deliberate > frantic', icon: '🎯', priority: 6 },
  { id: 'above-waist', text: 'Keep gestures above the waist to stay visible', icon: '⬆️', priority: 2 },
  { id: 'steeple', text: 'Try the "steeple" — fingertips touching = confidence', icon: '🤝', priority: 7 },
  { id: 'room-size', text: 'Scale gestures to your audience size — go bigger!', icon: '📢', priority: 8 },
  { id: 'stillness', text: 'Pause with stillness for dramatic effect', icon: '⏸️', priority: 9 },
  { id: 'symmetry', text: 'Balance both sides — asymmetry looks uncertain', icon: '⚖️', priority: 3 },
  { id: 'power-pose', text: 'Arms up + wide — the ultimate power move!', icon: '⚡', priority: 1 },
  { id: 'open-chest', text: 'Open chest toward camera for maximum presence', icon: '🌟', priority: 4 },
  { id: 'slouching', text: 'Sit up straight — upright posture commands respect!', icon: '🪑', priority: 1 },
  { id: 'smile', text: 'Smile! Warmth and confidence go hand in hand.', icon: '😊', priority: 3 },
];

export function selectCoachTips(result: GestureResult, elapsed: number, isSmiling = true): CoachTip[] {
  const tips: CoachTip[] = [];

  // Slouching is the highest-priority correction — add it first
  if (result.isSlouching) tips.push(ALL_TIPS.find((t) => t.id === 'slouching')!);
  if (result.fidgeting) tips.push(ALL_TIPS.find((t) => t.id === 'no-face-touch')!);
  if (!result.handsAboveWaist) tips.push(ALL_TIPS.find((t) => t.id === 'above-waist')!);
  if (result.symmetry < 60) tips.push(ALL_TIPS.find((t) => t.id === 'symmetry')!);
  if (result.armAngleLeft < 100 && result.armAngleRight < 100)
    tips.push(ALL_TIPS.find((t) => t.id === 'extend-arms')!);
  if (result.gesture === 'REST' && elapsed > 5)
    tips.push(ALL_TIPS.find((t) => t.id === 'raise-hands')!);
  if (result.gesture === 'POWER POSE')
    tips.push(ALL_TIPS.find((t) => t.id === 'power-pose')!);
  if (result.impact > 75)
    tips.push(ALL_TIPS.find((t) => t.id === 'open-chest')!);
  if (result.gesture === 'STEEPLE')
    tips.push(ALL_TIPS.find((t) => t.id === 'steeple')!);
  if (!isSmiling && elapsed > 8)
    tips.push(ALL_TIPS.find((t) => t.id === 'smile')!);

  // Always show at least 2 tips
  while (tips.length < 2) {
    const fallback = ALL_TIPS[tips.length % ALL_TIPS.length];
    if (!tips.find((t) => t.id === fallback.id)) tips.push(fallback);
    else tips.push(ALL_TIPS[(tips.length + 1) % ALL_TIPS.length]);
  }

  // Filter out any undefineds and return top 2 by priority
  return tips
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 2);
}

// ─── Canvas Rendering ─────────────────────────────────────────────────────

// These are the 33-landmark connections from MediaPipe BlazePose
export const POSE_CONNECTIONS: [number, number][] = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Right arm
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Left leg
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

const ARM_INDICES = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
const ARM_CONNECTIONS = POSE_CONNECTIONS.filter(
  ([a, b]) => ARM_INDICES.has(a) && ARM_INDICES.has(b)
);

export function drawGlowingSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  canvasWidth: number,
  canvasHeight: number,
  impact: number,
  isSlouching = false
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Mirror transform for selfie camera
  ctx.save();
  ctx.translate(canvasWidth, 0);
  ctx.scale(-1, 1);

  // Color encodes posture quality:
  //   red   = slouching (bad)
  //   yellow = low impact (could be better)
  //   green  = good posture + high impact (great)
  const lineColor = isSlouching ? '#ff4444' : impact >= 60 ? '#00ff88' : '#ffcc00';
  const glowStrength = 8 + (impact / 100) * 18;

  // ── Draw body connections ──
  ctx.shadowBlur = glowStrength;
  ctx.shadowColor = lineColor;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = landmarks[a];
    const lmB = landmarks[b];
    if (!lmA || !lmB) continue;
    if ((lmA.visibility ?? 1) < 0.25 || (lmB.visibility ?? 1) < 0.25) continue;

    ctx.beginPath();
    ctx.moveTo(lmA.x * canvasWidth, lmA.y * canvasHeight);
    ctx.lineTo(lmB.x * canvasWidth, lmB.y * canvasHeight);
    ctx.stroke();
  }

  // ── Draw arm connections thicker ──
  ctx.shadowBlur = glowStrength * 1.8;
  ctx.shadowColor = lineColor;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 4;

  for (const [a, b] of ARM_CONNECTIONS) {
    const lmA = landmarks[a];
    const lmB = landmarks[b];
    if (!lmA || !lmB) continue;
    if ((lmA.visibility ?? 1) < 0.25 || (lmB.visibility ?? 1) < 0.25) continue;

    ctx.beginPath();
    ctx.moveTo(lmA.x * canvasWidth, lmA.y * canvasHeight);
    ctx.lineTo(lmB.x * canvasWidth, lmB.y * canvasHeight);
    ctx.stroke();
  }

  // ── Draw landmark dots (match line color) ──
  ctx.shadowBlur = glowStrength * 2.5;
  ctx.shadowColor = lineColor;
  ctx.fillStyle = lineColor;

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm || (lm.visibility ?? 1) < 0.3) continue;
    const radius = ARM_INDICES.has(i) ? 5.5 : 3.5;
    ctx.beginPath();
    ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Wrist/hand glow dots (always white — easy to track hands) ──
  ctx.shadowBlur = glowStrength * 3;
  ctx.shadowColor = '#ffffff';
  ctx.fillStyle = '#ffffff';

  for (const idx of [LM.LEFT_WRIST, LM.RIGHT_WRIST]) {
    const lm = landmarks[idx];
    if (!lm || (lm.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
