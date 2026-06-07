'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; alpha: number;
  color: string;
}

const COLORS = ['#00f0ff', '#7b2fff', '#ff00cc', '#00ff88'];

export default function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth, H = window.innerHeight;
    let raf: number;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Particles
    const COUNT = Math.min(80, Math.floor((W * H) / 14000));
    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.4 + 0.4,
      alpha: Math.random() * 0.5 + 0.1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    // Aurora blobs
    const blobs = [
      { x: W * 0.2, y: H * 0.2, r: W * 0.45, color: 'rgba(0,240,255,0.045)', dx: 0.18, dy: 0.12 },
      { x: W * 0.8, y: H * 0.7, r: W * 0.5,  color: 'rgba(123,47,255,0.055)', dx: -0.14, dy: 0.1 },
      { x: W * 0.5, y: H * 0.9, r: W * 0.4,  color: 'rgba(255,0,204,0.035)', dx: 0.1,  dy: -0.16 },
    ];

    let t = 0;
    function draw() {
      ctx!.clearRect(0, 0, W, H);

      // Aurora blobs
      blobs.forEach(b => {
        b.x += Math.sin(t * b.dx) * 0.6;
        b.y += Math.cos(t * b.dy) * 0.6;
        const g = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, b.color);
        g.addColorStop(1, 'transparent');
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, W, H);
      });

      // Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = p.color.replace(')', `,${p.alpha})`).replace('rgb', 'rgba').replace('#', '');
        // simple hex to rgba
        const hex = p.color.replace('#', '');
        const r = parseInt(hex.slice(0,2),16), g2 = parseInt(hex.slice(2,4),16), b2 = parseInt(hex.slice(4,6),16);
        ctx!.fillStyle = `rgba(${r},${g2},${b2},${p.alpha})`;
        ctx!.fill();
      });

      // Connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(0,240,255,${0.06 * (1 - dist / 80)})`;
            ctx!.lineWidth = 0.5;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      t += 0.008;
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.85 }}
    />
  );
}
