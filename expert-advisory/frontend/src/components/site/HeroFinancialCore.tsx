"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowUpRight, Activity } from "lucide-react";

interface IndicatorMetric {
  label: string;
  value: string;
  status: "positive" | "neutral" | "warning";
}

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl", { powerPreference: "default" }) ||
      canvas.getContext("experimental-webgl");
    return !!(window.WebGLRenderingContext && gl);
  } catch {
    return false;
  }
}

export function HeroFinancialCore() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeCycle, setActiveCycle] = useState(0);
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);

  // Dynamic cycle data that gently updates every 9 seconds
  const cycles = [
    {
      indexName: "NIFTY 50",
      price: "25,418.50",
      change: "+0.64%",
      isPositive: true,
      metrics: [
        { label: "RSI (14)", value: "58.4", status: "neutral" as const },
        { label: "VOL RATIO", value: "1.24x", status: "positive" as const },
        { label: "20 EMA", value: "25,290", status: "positive" as const },
        { label: "50 EMA", value: "25,050", status: "positive" as const },
      ],
    },
    {
      indexName: "BANK NIFTY",
      price: "53,890.15",
      change: "+0.72%",
      isPositive: true,
      metrics: [
        { label: "RSI (14)", value: "62.1", status: "positive" as const },
        { label: "VOL RATIO", value: "1.38x", status: "positive" as const },
        { label: "20 EMA", value: "53,410", status: "positive" as const },
        { label: "50 EMA", value: "52,800", status: "positive" as const },
      ],
    },
    {
      indexName: "INDIA VIX",
      price: "12.42",
      change: "-3.25%",
      isPositive: true, // Lower VIX is favorable for market stability
      metrics: [
        { label: "REGIME", value: "Low Vol", status: "positive" as const },
        { label: "HIST. MED", value: "14.20", status: "neutral" as const },
        { label: "IV SKEW", value: "Normal", status: "positive" as const },
        { label: "RISK BIAS", value: "Stable", status: "positive" as const },
      ],
    },
  ];

  const currentData = cycles[activeCycle % cycles.length];

  // Periodic cycle ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCycle((prev) => prev + 1);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  // Three.js Scene Setup with safe WebGL detection & fallback
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (!checkWebGLSupport()) {
      setHasWebGL(false);
      return;
    }

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;
    let gridGeometry: THREE.BufferGeometry | null = null;
    let gridMaterial: THREE.LineBasicMaterial | null = null;
    let particleGeometry: THREE.BufferGeometry | null = null;
    let particleMaterial: THREE.PointsMaterial | null = null;
    let curveGeom: THREE.BufferGeometry | null = null;
    let curveMat: THREE.LineBasicMaterial | null = null;
    let handleMouseMove: ((event: MouseEvent) => void) | null = null;
    let handleResize: (() => void) | null = null;

    try {
      // Check reduced motion
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      const width = container.clientWidth || 540;
      const height = container.clientHeight || 540;

      // 1. Scene & Camera
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 24;

      // 2. WebGL Renderer
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "default",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2));
      container.appendChild(renderer.domElement);

      // 3. Financial Intelligence Core Object Group
      const coreGroup = new THREE.Group();
      scene.add(coreGroup);

      // A. Spherical Coordinate Grid Latticework
      const sphereRadius = 7.5;
      const latLines = 8;
      const lonLines = 16;
      const gridPoints: THREE.Vector3[] = [];

      for (let i = 1; i < latLines; i++) {
        const phi = (Math.PI * i) / latLines;
        const r = sphereRadius * Math.sin(phi);
        const y = sphereRadius * Math.cos(phi);
        const segments = 36;
        for (let j = 0; j < segments; j++) {
          const theta1 = (2 * Math.PI * j) / segments;
          const theta2 = (2 * Math.PI * (j + 1)) / segments;
          gridPoints.push(
            new THREE.Vector3(r * Math.cos(theta1), y, r * Math.sin(theta1)),
            new THREE.Vector3(r * Math.cos(theta2), y, r * Math.sin(theta2))
          );
        }
      }

      gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints);
      gridMaterial = new THREE.LineBasicMaterial({
        color: 0x1c2734,
        transparent: true,
        opacity: 0.5,
      });
      const gridMesh = new THREE.LineSegments(gridGeometry, gridMaterial);
      coreGroup.add(gridMesh);

      // B. Candlestick Fragments floating in orbit
      const candleGroup = new THREE.Group();
      const candleCount = 18;
      for (let i = 0; i < candleCount; i++) {
        const theta = (i / candleCount) * Math.PI * 2;
        const rad = 6.2 + Math.sin(i * 1.5) * 1.2;
        const y = Math.cos(i * 2) * 2.8;

        const isGreen = i % 3 !== 0;
        const candleColor = isGreen ? 0x22c55e : 0xf05252;

        const bodyHeight = 0.5 + Math.random() * 0.8;
        const bodyGeom = new THREE.BoxGeometry(0.22, bodyHeight, 0.22);
        const bodyMat = new THREE.MeshBasicMaterial({
          color: candleColor,
          transparent: true,
          opacity: 0.75,
        });
        const candleMesh = new THREE.Mesh(bodyGeom, bodyMat);

        const wickPoints = [
          new THREE.Vector3(0, -bodyHeight * 0.9, 0),
          new THREE.Vector3(0, bodyHeight * 0.9, 0),
        ];
        const wickGeom = new THREE.BufferGeometry().setFromPoints(wickPoints);
        const wickMat = new THREE.LineBasicMaterial({
          color: candleColor,
          transparent: true,
          opacity: 0.85,
        });
        const wick = new THREE.Line(wickGeom, wickMat);

        const singleCandle = new THREE.Group();
        singleCandle.add(candleMesh);
        singleCandle.add(wick);

        singleCandle.position.set(rad * Math.cos(theta), y, rad * Math.sin(theta));
        singleCandle.rotation.y = -theta;
        candleGroup.add(singleCandle);
      }
      coreGroup.add(candleGroup);

      // C. Data Particle Constellation
      const particleCount = 160;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);

      const cyanColor = new THREE.Color(0x43d9ff);
      const violetColor = new THREE.Color(0x7c5cff);

      for (let i = 0; i < particleCount; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = sphereRadius * (0.8 + Math.random() * 0.35);

        particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        particlePositions[i * 3 + 2] = r * Math.cos(phi);

        const col = Math.random() > 0.5 ? cyanColor : violetColor;
        particleColors[i * 3] = col.r;
        particleColors[i * 3 + 1] = col.g;
        particleColors[i * 3 + 2] = col.b;
      }

      particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(particlePositions, 3)
      );
      particleGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(particleColors, 3)
      );

      particleMaterial = new THREE.PointsMaterial({
        size: 0.16,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      coreGroup.add(particles);

      // D. Curved Market Spline Curve
      const curvePoints: THREE.Vector3[] = [];
      const curveSegments = 12;
      for (let i = 0; i <= curveSegments; i++) {
        const t = (i / curveSegments) * Math.PI * 2;
        const r = 6.8;
        const x = r * Math.cos(t);
        const z = r * Math.sin(t);
        const y = Math.sin(t * 3) * 1.8;
        curvePoints.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(curvePoints, true);
      curveGeom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
      curveMat = new THREE.LineBasicMaterial({
        color: 0x43d9ff,
        transparent: true,
        opacity: 0.65,
      });
      const curveLine = new THREE.Line(curveGeom, curveMat);
      coreGroup.add(curveLine);

      // 4. Mouse Parallax Damping on Desktop
      let mouseX = 0;
      let mouseY = 0;
      let targetRotationX = 0;
      let targetRotationY = 0;

      handleMouseMove = (event: MouseEvent) => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) return;
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        mouseX = (x / rect.width) * 0.6;
        mouseY = (y / rect.height) * 0.6;
      };

      window.addEventListener("mousemove", handleMouseMove);

      // 5. Animation Loop
      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        if (!prefersReducedMotion) {
          coreGroup.rotation.y = elapsedTime * 0.08;
          coreGroup.rotation.x = Math.sin(elapsedTime * 0.05) * 0.06;

          targetRotationY += (mouseX - targetRotationY) * 0.05;
          targetRotationX += (mouseY - targetRotationX) * 0.05;

          coreGroup.rotation.y += targetRotationY * 0.5;
          coreGroup.rotation.x += targetRotationX * 0.5;

          if (particleGeometry) {
            const positions = particleGeometry.attributes.position.array as Float32Array;
            for (let i = 0; i < particleCount; i++) {
              const idx = i * 3 + 1;
              positions[idx] += Math.sin(elapsedTime * 2 + i) * 0.002;
            }
            particleGeometry.attributes.position.needsUpdate = true;
          }
        }

        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      animate();

      // 6. Handle Window Resize
      handleResize = () => {
        if (!container || !renderer) return;
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };

      window.addEventListener("resize", handleResize);
      setHasWebGL(true);
    } catch (err) {
      console.warn("[HeroFinancialCore] WebGL initialization bypassed for system compatibility:", err);
      setHasWebGL(false);
    }

    // Cleanup
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (handleMouseMove) window.removeEventListener("mousemove", handleMouseMove);
      if (handleResize) window.removeEventListener("resize", handleResize);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer?.dispose();
      gridGeometry?.dispose();
      gridMaterial?.dispose();
      particleGeometry?.dispose();
      particleMaterial?.dispose();
      curveGeom?.dispose();
      curveMat?.dispose();
    };
  }, []);

  return (
    <div className="relative flex w-full items-center justify-center">
      {/* Three.js Canvas Container (Active if WebGL is supported) */}
      <div
        ref={mountRef}
        className="size-[280px] sm:size-[360px] md:size-[420px] lg:size-[460px] xl:size-[500px] flex items-center justify-center pointer-events-none select-none relative"
        aria-hidden="true"
      >
        {/* Universal CSS/SVG Fallback for older computers, Windows 7, or systems without GPU acceleration */}
        {hasWebGL === false && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Outer glowing pulsing ring */}
            <div className="size-[270px] sm:size-[350px] md:size-[400px] rounded-full border border-[#43D9FF]/20 animate-[spin_40s_linear_infinite] [border-dasharray:8_12] opacity-60" />
            {/* Middle orbital ring */}
            <div className="absolute size-[210px] sm:size-[270px] md:size-[310px] rounded-full border border-[#7C5CFF]/30 animate-[spin_25s_linear_infinite_reverse]" />
            {/* Inner technical grid rings */}
            <div className="absolute size-[160px] sm:size-[200px] md:size-[230px] rounded-full border border-dashed border-[#1C2734] bg-radial from-[#43D9FF]/10 to-transparent" />
            {/* Subtle cybernetic radar sweep */}
            <div className="absolute size-[240px] sm:size-[300px] rounded-full bg-gradient-to-tr from-transparent via-[#43D9FF]/5 to-transparent animate-pulse" />
          </div>
        )}
      </div>

      {/* Central Holographic Market HUD Card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative rounded-2xl border border-[#1C2734] bg-[#0D131C]/92 p-4 sm:p-5 backdrop-blur-xl shadow-[0_0_40px_rgba(67,217,255,0.12)] text-center transition-all duration-700 min-w-[190px] sm:min-w-[220px] pointer-events-auto">
          {/* Subtle top indicator bar */}
          <div className="flex items-center justify-center gap-1.5 mb-1.5 text-[10px] sm:text-[11px] font-mono tracking-widest text-[#9AA7B5] uppercase">
            <span className="size-1.5 rounded-full bg-[#43D9FF] animate-ping" />
            <Activity className="size-3 text-[#43D9FF]" />
            <span>Market Core</span>
          </div>

          <div className="text-xs sm:text-sm font-semibold tracking-wider text-[#F5F7FA] font-display">
            {currentData.indexName}
          </div>

          <div className="mt-0.5 text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#F5F7FA]">
            {currentData.price}
          </div>

          <div className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono font-medium text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20">
            <ArrowUpRight className="size-3" />
            {currentData.change}
          </div>

          {/* Surrounding Floating Technical Orbitals */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:gap-2 pt-2.5 border-t border-[#1C2734]/80 text-left">
            {currentData.metrics.map((m) => (
              <div key={m.label} className="bg-[#111923]/80 rounded p-1.5 border border-[#1C2734]">
                <div className="text-[9px] font-mono text-[#667383]">{m.label}</div>
                <div className="text-[10px] sm:text-[11px] font-mono font-semibold text-[#F5F7FA]">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
