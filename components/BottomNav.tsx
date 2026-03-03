'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Home, Smile } from 'lucide-react';

const TABS = [
  { label: 'Home',  icon: Home,  path: '/' },
  { label: 'Smile', icon: Smile, path: '/smile' },
] as const;

export default function BottomNav() {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
      style={{
        background: 'rgba(5,5,16,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-center justify-around px-8 pt-3 pb-2">
        {TABS.map(({ label, icon: Icon, path }) => {
          const active = pathname === path;
          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              className="flex flex-col items-center gap-1 min-w-[64px] btn-press"
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200"
                style={{
                  background: active ? 'rgba(0,240,255,0.12)' : 'transparent',
                  border:     active ? '1px solid rgba(0,240,255,0.25)' : '1px solid transparent',
                  boxShadow:  active ? '0 0 12px rgba(0,240,255,0.15)' : 'none',
                }}
              >
                <Icon size={20} style={{ color: active ? '#00f0ff' : '#44445a' }} />
              </div>
              <span
                className="text-[10px] font-semibold tracking-wide transition-colors duration-200"
                style={{ color: active ? '#00f0ff' : '#44445a' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
