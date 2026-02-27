export interface SessionRecord {
  id: string;
  date: string;
  duration: number; // seconds
  gestures: number;
  impact: number; // average (kept for compat)
  streak: number;
  peakImpact: number;
  smileCount: number;
  slouchCount: number;
  goodPostureSeconds: number;
}

export interface StoredStats {
  totalGestures: number;
  totalSessions: number;
  bestStreak: number;
  bestImpact: number;
  totalTime: number; // seconds
  sessions: SessionRecord[];
}

const STORAGE_KEY = 'gestureflow_stats';

const DEFAULT_STATS: StoredStats = {
  totalGestures: 0,
  totalSessions: 0,
  bestStreak: 0,
  bestImpact: 0,
  totalTime: 0,
  sessions: [],
};

export function loadStats(): StoredStats {
  if (typeof window === 'undefined') return DEFAULT_STATS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveStats(stats: StoredStats): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep only last 20 sessions
    const toSave = { ...stats, sessions: stats.sessions.slice(-20) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export function recordSession(session: Omit<SessionRecord, 'id' | 'date'>): StoredStats {
  const stats = loadStats();
  const record: SessionRecord = {
    ...session,
    id: Date.now().toString(),
    date: new Date().toISOString(),
  };

  const updated: StoredStats = {
    totalGestures: stats.totalGestures + session.gestures,
    totalSessions: stats.totalSessions + 1,
    bestStreak: Math.max(stats.bestStreak, session.streak),
    bestImpact: Math.max(stats.bestImpact, session.peakImpact),
    totalTime: stats.totalTime + session.duration,
    sessions: [...stats.sessions, record],
  };

  saveStats(updated);
  return updated;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
