'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Award, RotateCcw, Lock } from 'lucide-react';
import BottomNav from './BottomNav';

// ── Paywall gate — flip to true when payment is wired up ──────────────────────
const COURSE_LOCKED = false;

// ── Lesson content ────────────────────────────────────────────────────────────
const LESSONS = [
  {
    id: 'why',
    emoji: '🧠',
    title: 'Why Ergonomics Matters',
    color: '#00f0ff',
    facts: [
      { stat: '80%', text: 'of office workers will experience significant back pain from poor desk posture during their career.', source: 'American Chiropractic Association' },
      { stat: '47%', text: 'higher mental fatigue occurs from slouched sitting — your brain literally receives less oxygen.', source: 'drsteffens.com / ergonomics research' },
      { stat: '31%', text: 'reduction in blood flow to the brain from forward head posture alone — causing brain fog and headaches.', source: 'Posture Pro / Doppler studies' },
    ],
    takeaway: 'Ergonomics isn\'t about comfort — it\'s about protecting your brain, body, and long-term health.',
  },
  {
    id: 'tech-neck',
    emoji: '📱',
    title: 'Tech Neck & Your Spine',
    color: '#ff00cc',
    facts: [
      { stat: '10 lbs', text: 'of extra force is added to your spine for every inch your head moves forward. At 3 inches forward, that\'s 40 extra pounds of load — all day long.', source: 'Spine Health / Dr. Kenneth Hansraj' },
      { stat: '3×', text: 'more likely to suffer chronic headaches if you have forward head posture from looking down at screens.', source: 'Journal of Physical Therapy Science' },
      { stat: '60 lbs', text: 'of pressure on your cervical spine when looking at your phone at a 60° angle — equivalent to carrying an 8-year-old on your neck.', source: 'Surgical Technology International' },
    ],
    takeaway: 'Raise your screen to eye level. Every inch counts — literally measured in pounds of force on your spine.',
  },
  {
    id: 'posture',
    emoji: '🦴',
    title: 'Posture, Energy & Focus',
    color: '#7b2fff',
    facts: [
      { stat: '30%', text: 'reduction in lung capacity from slouching — compressed lungs mean less oxygen in your blood, which is why you crash in the afternoon.', source: 'Journal of Physical Therapy' },
      { stat: '+225%', text: 'increase in brain blood flow measured in MRA studies after posture correction. More blood flow = sharper thinking, fewer headaches, better memory.', source: 'uprightposture.co.uk / MRA Study' },
      { stat: '+40%', text: 'productivity boost linked to proper ergonomic posture by University of Leicester research — through reduced discomfort and sustained energy.', source: 'LifeSpan Europe / University of Leicester' },
    ],
    takeaway: 'Your posture directly controls how much oxygen and blood your brain gets. Better posture = clearer thinking, instantly.',
  },
  {
    id: 'setup',
    emoji: '🖥️',
    title: 'Setting Up Your Workspace',
    color: '#00ff88',
    facts: [
      { stat: 'Eye level', text: 'Your monitor\'s top edge should be at or just below eye level, 18–24 inches from your face. Looking down all day strains your neck and causes headaches.', source: 'OSHA ergonomics guidelines' },
      { stat: '90°–90°', text: 'Your hips and knees should both be at 90°, feet flat on the floor. This neutral alignment keeps your spine stacked correctly and reduces muscle tension.', source: 'Cornell University Ergonomics Web' },
      { stat: '45 min', text: 'Maximum time to sit in any one position — even perfect posture fatigues muscles over time. A 2-minute stand or walk resets circulation, energy, and focus.', source: 'British Journal of Sports Medicine' },
    ],
    takeaway: 'A properly set up desk isn\'t a luxury — it\'s a tool for protecting your health and getting more done every single day.',
  },
  {
    id: 'habits',
    emoji: '✅',
    title: 'Daily Habits That Eliminate Pain',
    color: '#ffaa00',
    facts: [
      { stat: '−72%', text: 'reduction in headache frequency seen in office workers after 8 weeks of consistent posture correction and ergonomic awareness — with no medication.', source: 'Journal of Physical Therapy Science' },
      { stat: '21%', text: 'productivity improvement in 6 months for employees who received posture training and workstation adjustments — especially in sustained computer tasks.', source: 'Ergonomics Journal 2022' },
      { stat: 'Today', text: 'The benefits start immediately. Correcting your posture right now begins restoring blood flow to your brain within minutes, reducing headache pressure within hours.', source: 'Chiropractic research / MRA studies' },
    ],
    takeaway: 'You don\'t need an expensive chair or standing desk. Awareness + reminders + small adjustments compound into life-changing results.',
  },
];

// ── Quiz questions ────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    q: 'How much extra force does each inch of forward head posture add to your spine?',
    options: ['5 lbs', '10 lbs', '20 lbs', '30 lbs'],
    correct: 1,
    explanation: 'Each inch of forward head posture adds ~10 lbs of load. At 3 inches forward, that\'s 40 extra pounds on your spine all day.',
  },
  {
    q: 'Slouching can reduce your lung capacity by up to how much?',
    options: ['10%', '20%', '30%', '50%'],
    correct: 2,
    explanation: 'Slouching compresses your lungs by up to 30%, reducing oxygen intake and leaving you drained by mid-afternoon.',
  },
  {
    q: 'Correcting your posture can increase brain blood flow by up to:',
    options: ['50%', '100%', '175%', '225%'],
    correct: 3,
    explanation: 'An MRA study found posture correction increased cerebral blood flow between 23% and 225.9% in every patient — immediately after correction.',
  },
  {
    q: 'Where should the top of your monitor be positioned?',
    options: ['Well above eye level', 'At or just below eye level', 'Below your chin', 'Doesn\'t matter'],
    correct: 1,
    explanation: 'The top edge of your monitor should be at or just below eye level, 18–24 inches away. This prevents the chin-down tilt that causes tech neck.',
  },
  {
    q: 'What is the maximum recommended time to sit in one position before moving?',
    options: ['30 minutes', '45–60 minutes', '90 minutes', '2 hours'],
    correct: 1,
    explanation: 'Even perfect posture fatigues muscles over time. A 2-minute stand or walk every 45–60 minutes resets circulation and focus.',
  },
  {
    q: 'What hip and knee angle is ideal when seated at a desk?',
    options: ['45°', '70°', '90°', '110°'],
    correct: 2,
    explanation: 'Both hips and knees at 90° with feet flat on the floor keeps your spine in neutral alignment and reduces chronic muscle tension.',
  },
  {
    q: 'Consistent posture correction reduced office worker headaches by up to how much in 8 weeks?',
    options: ['25%', '40%', '60%', '72%'],
    correct: 3,
    explanation: 'A clinical study found posture correction reduced headache frequency by up to 72% in 8 weeks — with no medication required.',
  },
  {
    q: 'How many office workers will experience significant back pain from poor desk posture in their career?',
    options: ['40%', '60%', '80%', '95%'],
    correct: 2,
    explanation: '80% of office workers will experience significant back pain — making it the #1 workplace health issue globally.',
  },
  {
    q: 'Looking at your phone at a 60° angle puts how much pressure on your cervical spine?',
    options: ['20 lbs', '40 lbs', '60 lbs', '80 lbs'],
    correct: 2,
    explanation: 'A 60° angle puts about 60 lbs of force on your neck — equivalent to carrying an 8-year-old on your head all day.',
  },
  {
    q: 'Posture training with workstation adjustments improved productivity by how much over 6 months?',
    options: ['8%', '14%', '21%', '35%'],
    correct: 2,
    explanation: 'A 2022 Ergonomics Journal study found employees with posture training showed 21% productivity improvement over 6 months, especially on sustained computer tasks.',
  },
];

const PASS_SCORE = 0.75;
const CERT_KEY = 'gestureflow_ergo_cert';

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        animate={{ width: `${(current / total) * 100}%` }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

function LessonCard({ lesson, onNext }: { lesson: typeof LESSONS[0]; onNext: () => void }) {
  return (
    <motion.div
      key={lesson.id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="flex flex-col gap-3 w-full max-w-xl"
    >
      <div className="text-center">
        <div className="text-4xl mb-2">{lesson.emoji}</div>
        <h2 className="text-xl font-black text-white">{lesson.title}</h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {lesson.facts.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl p-3"
            style={{ background: 'rgba(18,18,40,0.9)', border: `1px solid ${lesson.color}22` }}
          >
            <div className="flex gap-3 items-start">
              <div
                className="text-base font-black shrink-0 leading-none pt-0.5"
                style={{ color: lesson.color, minWidth: '54px' }}
              >
                {f.stat}
              </div>
              <div>
                <p className="text-xs text-gray-300 leading-relaxed">{f.text}</p>
                <p className="text-[10px] mt-1 italic" style={{ color: 'rgba(255,255,255,0.25)' }}>Source: {f.source}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div
        className="rounded-2xl p-3 text-xs font-semibold text-center leading-relaxed"
        style={{ background: `${lesson.color}14`, border: `1px solid ${lesson.color}30`, color: lesson.color }}
      >
        💡 {lesson.takeaway}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2"
        style={{ background: `linear-gradient(135deg, ${lesson.color}, #7b2fff)`, color: '#050510' }}
      >
        Continue <ArrowRight size={18} />
      </button>
    </motion.div>
  );
}

function QuizQuestion({
  question, index, total, onAnswer,
}: {
  question: typeof QUESTIONS[0]; index: number; total: number; onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  function pick(i: number) {
    if (answered) return;
    setSelected(i);
    setTimeout(() => onAnswer(i === question.correct), 900);
  }

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="flex flex-col gap-4 w-full max-w-xl"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00f0ff' }}>
          Question {index + 1} of {total}
        </p>
        <h3 className="text-lg font-black text-white leading-snug">{question.q}</h3>
      </div>

      <div className="flex flex-col gap-2.5">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correct;
          const isSelected = i === selected;
          let bg = 'rgba(18,18,40,0.9)';
          let border = 'rgba(255,255,255,0.1)';
          let textColor = '#fff';
          if (answered) {
            if (isCorrect) { bg = 'rgba(0,255,136,0.12)'; border = '#00ff88'; textColor = '#00ff88'; }
            else if (isSelected) { bg = 'rgba(255,50,50,0.12)'; border = '#ff4444'; textColor = '#ff8888'; }
          } else if (isSelected) {
            bg = 'rgba(0,240,255,0.1)'; border = '#00f0ff';
          }
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              className="w-full text-left rounded-2xl p-4 text-sm font-semibold flex items-center gap-3 transition-all duration-200"
              style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                style={{ background: answered && isCorrect ? '#00ff8822' : 'rgba(255,255,255,0.07)' }}
              >
                {answered && isCorrect ? <CheckCircle size={16} color="#00ff88" /> : answered && isSelected ? <XCircle size={16} color="#ff4444" /> : String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-3 text-sm leading-relaxed"
            style={{
              background: selected === question.correct ? 'rgba(0,255,136,0.08)' : 'rgba(255,80,80,0.08)',
              border: `1px solid ${selected === question.correct ? 'rgba(0,255,136,0.2)' : 'rgba(255,80,80,0.2)'}`,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {question.explanation}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ErgoCourse() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'lesson' | 'quiz' | 'result'>('intro');
  const [lessonIdx, setLessonIdx] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const hasCert = typeof window !== 'undefined' && !!localStorage.getItem(CERT_KEY);

  function startCourse() { setPhase('lesson'); setLessonIdx(0); }

  function nextLesson() {
    if (lessonIdx + 1 < LESSONS.length) setLessonIdx(l => l + 1);
    else setPhase('quiz');
  }

  function handleAnswer(wasCorrect: boolean) {
    const next = [...answers, wasCorrect];
    setAnswers(next);
    if (wasCorrect) setCorrect(c => c + 1);
    if (quizIdx + 1 < QUESTIONS.length) setQuizIdx(q => q + 1);
    else {
      const score = (wasCorrect ? correct + 1 : correct) / QUESTIONS.length;
      if (score >= PASS_SCORE) localStorage.setItem(CERT_KEY, new Date().toISOString());
      setPhase('result');
    }
  }

  function retry() {
    setPhase('quiz');
    setQuizIdx(0);
    setCorrect(0);
    setAnswers([]);
  }

  const score = answers.length > 0 ? correct / QUESTIONS.length : 0;
  const passed = score >= PASS_SCORE;

  if (COURSE_LOCKED) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-24" style={{ background: '#050510' }}>
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-black text-white mb-2">Premium Content</h2>
        <p className="text-gray-500 text-center text-sm max-w-xs mb-6">
          The Ergonomics Certification Course is a premium feature. Upgrade to unlock the full course and earn your certificate.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 rounded-2xl font-black text-sm"
          style={{ background: 'linear-gradient(135deg, #00f0ff, #7b2fff)', color: '#050510' }}
        >
          Upgrade to Premium
        </button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page-scroll flex flex-col items-center px-5 pt-6 pb-32" style={{ background: '#050510' }}>
      {/* Header */}
      <div className="w-full max-w-xl flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/')} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <ArrowLeft size={16} className="text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-black text-white">Ergonomics Certification</h1>
          <p className="text-xs text-gray-500">5 lessons · 10-question exam · 75% to pass</p>
        </div>
        {hasCert && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88' }}>
            <Award size={12} /> Certified
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">

        {/* ── INTRO ── */}
        {phase === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-5 w-full max-w-xl">
            <div className="text-6xl">🏅</div>
            <div className="text-center">
              <h2 className="text-2xl font-black text-white mb-2">Office Ergonomics<br/>Crash Course</h2>
              <p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
                Learn the science behind good posture, tech neck, and why ergonomics directly affects your energy, focus, and health — then pass the exam to earn your certificate.
              </p>
            </div>

            <div className="w-full rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(18,18,40,0.9)', border: '1px solid rgba(0,240,255,0.15)' }}>
              {LESSONS.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${l.color}15`, border: `1px solid ${l.color}25` }}>{l.emoji}</div>
                  <div>
                    <p className="text-sm font-bold text-white">{`${i + 1}. ${l.title}`}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 mt-1 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.2)' }}>📝</div>
                <div>
                  <p className="text-sm font-bold text-white">6. Final Exam</p>
                  <p className="text-xs text-gray-500">10 questions · 75% to pass · earn certificate</p>
                </div>
              </div>
            </div>

            <button
              onClick={startCourse}
              className="w-full py-4 rounded-2xl font-black text-base"
              style={{ background: 'linear-gradient(135deg, #00f0ff, #7b2fff)', color: '#050510' }}
            >
              Start Course →
            </button>

            {hasCert && (
              <button onClick={() => setPhase('quiz')} className="text-xs font-bold" style={{ color: '#00f0ff' }}>
                Retake exam only
              </button>
            )}
          </motion.div>
        )}

        {/* ── LESSONS ── */}
        {phase === 'lesson' && (
          <motion.div key={`lesson-${lessonIdx}`} className="w-full max-w-xl">
            <div className="mb-4">
              <ProgressBar current={lessonIdx + 1} total={LESSONS.length + 1} color={LESSONS[lessonIdx].color} />
              <p className="text-xs text-gray-600 mt-1.5">Lesson {lessonIdx + 1} of {LESSONS.length}</p>
            </div>
            <AnimatePresence mode="wait">
              <LessonCard key={lessonIdx} lesson={LESSONS[lessonIdx]} onNext={nextLesson} />
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── QUIZ ── */}
        {phase === 'quiz' && (
          <motion.div key={`quiz-${quizIdx}`} className="w-full max-w-xl">
            <div className="mb-4">
              <ProgressBar current={quizIdx + 1} total={QUESTIONS.length} color="#ffaa00" />
              <div className="flex justify-between mt-1.5">
                <p className="text-xs text-gray-600">Exam — question {quizIdx + 1} of {QUESTIONS.length}</p>
                <p className="text-xs font-bold" style={{ color: '#00ff88' }}>{correct} correct</p>
              </div>
            </div>
            <AnimatePresence mode="wait">
              <QuizQuestion key={quizIdx} question={QUESTIONS[quizIdx]} index={quizIdx} total={QUESTIONS.length} onAnswer={handleAnswer} />
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── RESULT ── */}
        {phase === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 w-full max-w-xl">
            {passed ? (
              <>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, delay: 0.2 }} className="text-7xl">🏅</motion.div>
                <div className="text-center">
                  <h2 className="text-2xl font-black text-white mb-1">You passed!</h2>
                  <p className="text-sm text-gray-400">Score: <span className="font-black" style={{ color: '#00ff88' }}>{Math.round(score * 100)}%</span> · {correct}/{QUESTIONS.length} correct</p>
                </div>

                <div className="w-full rounded-3xl p-6 text-center" style={{ background: 'rgba(0,255,136,0.06)', border: '2px solid rgba(0,255,136,0.25)' }}>
                  <Award size={32} className="mx-auto mb-3" style={{ color: '#00ff88' }} />
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#00ff88' }}>Certificate of Completion</p>
                  <h3 className="text-xl font-black text-white mb-1">Office Ergonomics</h3>
                  <p className="text-xs text-gray-500">Issued by GestureFlow · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>

                <div className="w-full rounded-2xl p-4" style={{ background: 'rgba(18,18,40,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00f0ff' }}>Question Review</p>
                  <div className="flex flex-wrap gap-2">
                    {answers.map((a, i) => (
                      <div key={i} className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black" style={{ background: a ? 'rgba(0,255,136,0.15)' : 'rgba(255,80,80,0.15)', color: a ? '#00ff88' : '#ff6666' }}>
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button onClick={retry} className="flex-1 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2" style={{ background: 'rgba(255,255,255,0.06)', color: '#aaa' }}>
                    <RotateCcw size={14} /> Retake
                  </button>
                  <button onClick={() => router.push('/')} className="flex-1 py-3 rounded-2xl text-sm font-black" style={{ background: 'linear-gradient(135deg, #00f0ff, #7b2fff)', color: '#050510' }}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-7xl">😓</div>
                <div className="text-center">
                  <h2 className="text-2xl font-black text-white mb-1">Not quite!</h2>
                  <p className="text-sm text-gray-400">Score: <span className="font-black" style={{ color: '#ff6666' }}>{Math.round(score * 100)}%</span> · Need 75% to pass · {correct}/{QUESTIONS.length} correct</p>
                </div>

                <div className="w-full rounded-2xl p-4" style={{ background: 'rgba(18,18,40,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#ffaa00' }}>Review your answers</p>
                  <div className="flex flex-wrap gap-2">
                    {answers.map((a, i) => (
                      <div key={i} className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black" style={{ background: a ? 'rgba(0,255,136,0.15)' : 'rgba(255,80,80,0.15)', color: a ? '#00ff88' : '#ff6666' }}>
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Tip: Review the lesson content before retaking the exam — each lesson covers the answers.</p>
                </div>

                <div className="flex gap-3 w-full">
                  <button onClick={() => { setPhase('lesson'); setLessonIdx(0); setQuizIdx(0); setCorrect(0); setAnswers([]); }} className="flex-1 py-3 rounded-2xl text-sm font-black" style={{ background: 'rgba(255,255,255,0.06)', color: '#aaa' }}>
                    Review Lessons
                  </button>
                  <button onClick={retry} className="flex-1 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #ffaa00, #ff6600)', color: '#050510' }}>
                    <RotateCcw size={14} /> Try Again
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>
      <BottomNav />
    </div>
  );
}
