'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(68, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 3.5, 14);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const COUNT     = window.innerWidth < 768 ? 1800 : 4500;
    const positions = new Float32Array(COUNT * 3);
    const colors    = new Float32Array(COUNT * 3);
    const cInner    = new THREE.Color('#00d4ff');
    const cMid      = new THREE.Color('#7b2fff');
    const cOuter    = new THREE.Color('#ff00cc');

    for (let i = 0; i < COUNT; i++) {
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
      if (i % 3 === 0)      c.lerpColors(cInner, cMid,   t);
      else if (i % 3 === 1) c.lerpColors(cInner, cOuter, t);
      else                  c.lerpColors(cMid,   cOuter, t);

      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    const material = new THREE.PointsMaterial({
      size: 0.055,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const clock = new THREE.Clock();
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.028;
      points.rotation.z = Math.sin(t * 0.012) * 0.04;
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
