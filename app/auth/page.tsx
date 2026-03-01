'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const router = useRouter();

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Account created! Check your email to confirm, then sign in.');
        switchMode('signin');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 pb-10"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,240,255,0.07) 0%, transparent 70%), #050510',
      }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h1 className="text-3xl font-black text-white tracking-tight">
          <span style={{ color: '#00f0ff', textShadow: '0 0 16px #00f0ff55' }}>Gesture</span>
          Flow
        </h1>
        <p className="text-gray-500 text-sm mt-1">AI Presentation Coach</p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.08, type: 'spring', damping: 24 }}
        className="w-full max-w-sm rounded-3xl p-6"
        style={{
          background: 'rgba(13,13,35,0.96)',
          border: '1px solid rgba(0,240,255,0.18)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,240,255,0.06)',
        }}
      >
        {/* Mode tabs */}
        <div
          className="flex rounded-2xl p-1 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={{
                background: mode === m ? 'rgba(0,240,255,0.12)' : 'transparent',
                color: mode === m ? '#00f0ff' : '#555577',
                border: mode === m ? '1px solid rgba(0,240,255,0.25)' : '1px solid transparent',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
              Email
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-3 rounded-2xl text-sm text-white placeholder-gray-600 outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full pl-9 pr-11 py-3 rounded-2xl text-sm text-white placeholder-gray-600 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="text-[11px] text-gray-600 mt-1.5 ml-1">Minimum 6 characters</p>
            )}
          </div>

          {/* Feedback messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-400 text-center px-1"
              >
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                key="ok"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-green-400 text-center px-1"
              >
                {success}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl font-black text-base text-[#050510] relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #00f0ff, #7b2fff)',
              boxShadow: '0 0 24px rgba(0,240,255,0.3)',
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading
              ? <Loader2 size={18} className="animate-spin mx-auto" />
              : mode === 'signin' ? 'Sign In' : 'Create Account'
            }
          </motion.button>
        </form>

        {/* Skip */}
        <button
          onClick={() => router.push('/')}
          className="w-full mt-4 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Continue without account →
        </button>
      </motion.div>

      {/* Why create an account */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 max-w-sm text-center"
      >
        <p className="text-xs text-gray-600 leading-relaxed">
          An account syncs your session history across devices and keeps your progress
          safe long-term. Your camera feed is never uploaded — all AI runs locally in your browser.
        </p>
      </motion.div>
    </div>
  );
}
