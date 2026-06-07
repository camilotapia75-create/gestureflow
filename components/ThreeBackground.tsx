'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Galaxy({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);

    const cInner = new THREE.Color('#00d4ff');
    const cMid   = new THREE.Color('#7b2fff');
    const cOuter = new THREE.Color('#ff00cc');

    for (let i = 0; i < count; i++) {
      const radius     = Math.pow(Math.random(), 0.55) * 11;
      const spin       = radius * 2.4;
      const branch     = ((i % 3) / 3) * Math.PI * 2;
      const scatter    = Math.pow(Math.random(), 2.5) * 1.8;
      const scatterAng = Math.random() * Math.PI * 2;

      positions[i * 3]     = Math.cos(branch + spin) * radius + Math.cos(scatterAng) * scatter;
      positions[i * 3 + 1] = (Math.random() - 0.5) * scatter * 0.6;
      positions[i * 3 + 2] = Math.sin(branch + spin) * radius + Math.sin(scatterAng) * scatter;

      const t = radius / 11;
      const c = new THREE.Color();
      if (i % 3 === 0)      c.lerpColors(cInner, cMid, t);
      else if (i % 3 === 1) c.lerpColors(cInner, cOuter, t);
      else                  c.lerpColors(cMid, cOuter, t);

      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    return [positions, colors];
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.028;
    ref.current.rotation.z = Math.sin(t * 0.012) * 0.04;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={count} array={colors}    itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.052}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function ThreeBackground() {
  const [count, setCount] = useState(4000);

  useEffect(() => {
    setCount(window.innerWidth < 768 ? 1800 : 4500);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 3.5, 14], fov: 68 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      >
        <Galaxy count={count} />
      </Canvas>
    </div>
  );
}
