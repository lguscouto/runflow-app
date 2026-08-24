"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Video,
  Eye,
  Compass,
  Heart,
  Mountain,
  Gauge,
  Timer,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TrackPoint } from "@/lib/types";
import { processTrackPoints3D, type Track3DData } from "@/lib/flyover3d/coordinates";
import { formatDuration, formatPace } from "@/lib/format";

interface ActivityFlyover3DProps {
  points: TrackPoint[];
  activityName?: string;
  onClose?: () => void;
}

export function ActivityFlyover3D({
  points,
  activityName,
  onClose,
}: ActivityFlyover3DProps) {
  const { t } = useI18n();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Playback States
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0 a 1
  const [speedMultiplier, setSpeedMultiplier] = useState(5);
  const [cameraMode, setCameraMode] = useState<"chase" | "aerial" | "free">("chase");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Current Telemetry
  const [currentDistKm, setCurrentDistKm] = useState("0.00");
  const [currentPace, setCurrentPace] = useState("--:--");
  const [currentElevM, setCurrentElevM] = useState(0);
  const [currentHr, setCurrentHr] = useState<number | null>(null);
  const [currentElapsedSec, setCurrentElapsedSec] = useState(0);

  // Three.js References
  const trackDataRef = useRef<Track3DData | null>(null);
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const runnerMeshRef = useRef<THREE.Group | null>(null);
  const runnerLightRef = useRef<THREE.PointLight | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isDraggingScrubber = useRef(false);

  // Free Orbit Touch/Mouse Drag State
  const isOrbiting = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const orbitAngles = useRef({ theta: Math.PI / 4, phi: Math.PI / 4, radius: 80 });

  // 1. Processa pontos 3D na montagem
  useEffect(() => {
    const data = processTrackPoints3D(points);
    if (!data || data.points.length < 2) return;

    trackDataRef.current = data;

    // Constrói curva Catmull-Rom
    const vectors = data.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.CatmullRomCurve3(vectors);
    curve.curveType = "catmullrom";
    curve.tension = 0.5;
    curveRef.current = curve;
  }, [points]);

  // 2. Inicializa Cena Three.js
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !trackDataRef.current || !curveRef.current) {
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const data = trackDataRef.current;
    const curve = curveRef.current;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Cena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);
    scene.fog = new THREE.FogExp2(0x0b0e14, 0.005);
    sceneRef.current = scene;

    // Câmera
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 50, 80);
    cameraRef.current = camera;

    // Renderizador
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    const blueBackLight = new THREE.DirectionalLight(0x0284c7, 0.8);
    blueBackLight.position.set(-50, 50, -50);
    scene.add(blueBackLight);

    // Grade de chão e base topográfica
    const groundSize = Math.max(data.bounds.sizeX, data.bounds.sizeZ, 120) * 1.8;
    const gridHelper = new THREE.GridHelper(groundSize, 40, 0x0284c7, 0x1e293b);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    // Chão com reflexão sutil
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x07090e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.1;
    scene.add(ground);

    // ── Construção da Trilha 3D com Gradiente de Ritmo ───────────────────────
    const tubularSegments = Math.min(data.points.length * 3, 1500);
    const tubeGeo = new THREE.TubeGeometry(curve, tubularSegments, 0.65, 8, false);

    // Atribui cores de vértices com base nos ritmos normalizados
    const posAttr = tubeGeo.attributes.position;
    const colors: number[] = [];
    const tempVec = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      tempVec.fromBufferAttribute(posAttr, i);
      // Encontra ponto da curva mais próximo
      const u = (i / posAttr.count);
      const pointIndex = Math.min(
        Math.floor(u * data.points.length),
        data.points.length - 1
      );
      const pt = data.points[pointIndex];
      const col = pt ? pt.color : [0.06, 0.72, 0.5];
      colors.push(col[0], col[1], col[2]);
    }

    tubeGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const tubeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x051515,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tubeMesh);

    // ── Marcador de Início (Largada) ─────────────────────────────────────────
    const startPoint = data.points[0];
    const startGroup = new THREE.Group();
    startGroup.position.set(startPoint.x, startPoint.y, startPoint.z);

    const startPoleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 8);
    const startPoleMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669 });
    const startPole = new THREE.Mesh(startPoleGeo, startPoleMat);
    startPole.position.y = 3;
    startGroup.add(startPole);

    const startSphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const startSphereMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const startSphere = new THREE.Mesh(startSphereGeo, startSphereMat);
    startSphere.position.y = 6;
    startGroup.add(startSphere);
    scene.add(startGroup);

    // ── Marcador de Chegada (Fim) ────────────────────────────────────────────
    const endPoint = data.points[data.points.length - 1];
    const endGroup = new THREE.Group();
    endGroup.position.set(endPoint.x, endPoint.y, endPoint.z);

    const endPoleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 8);
    const endPoleMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xd97706 });
    const endPole = new THREE.Mesh(endPoleGeo, endPoleMat);
    endPole.position.y = 3;
    endGroup.add(endPole);

    const endSphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const endSphereMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const endSphere = new THREE.Mesh(endSphereGeo, endSphereMat);
    endSphere.position.y = 6;
    endGroup.add(endSphere);
    scene.add(endGroup);

    // ── Avatar / Corredor 3D Luminoso ────────────────────────────────────────
    const runnerGroup = new THREE.Group();

    // Esfera central brilhante
    const runnerGeo = new THREE.SphereGeometry(1.1, 24, 24);
    const runnerMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      roughness: 0.1,
      metalness: 0.9,
    });
    const runnerSphere = new THREE.Mesh(runnerGeo, runnerMat);
    runnerGroup.add(runnerSphere);

    // Anel de pulso
    const ringGeo = new THREE.RingGeometry(1.5, 1.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const runnerRing = new THREE.Mesh(ringGeo, ringMat);
    runnerRing.rotation.x = Math.PI / 2;
    runnerGroup.add(runnerRing);

    // Luz pontual seguidora
    const runnerLight = new THREE.PointLight(0x38bdf8, 3, 25);
    runnerLight.position.set(0, 1, 0);
    runnerGroup.add(runnerLight);
    runnerLightRef.current = runnerLight;

    scene.add(runnerGroup);
    runnerMeshRef.current = runnerGroup;

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      // Desalocação profunda recursiva de objetos WebGL/Three.js (Prevenção de Leaks de RAM/VRAM)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => {
                mat.dispose();
              });
            } else {
              object.material.dispose();
            }
          }
        }
      });

      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss?.();

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      runnerMeshRef.current = null;
      runnerLightRef.current = null;
    };
  }, []);

  // Refs para controle contínuo sem re-render do loop de 60fps
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  const progressRef = useRef(progress);

  // 3. Loop Estável de Animação e Renderização da Câmera (Single Loop desacoplado)
  useEffect(() => {
    let lastTime = performance.now();
    let lastUiUpdateTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      const curve = curveRef.current;
      const data = trackDataRef.current;
      const runner = runnerMeshRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;

      if (curve && data && runner && camera && renderer && scene) {
        // Atualiza progresso contínuo
        if (isPlayingRef.current && !isDraggingScrubber.current) {
          const increment = (deltaSec * speedMultiplierRef.current) / 45;
          let next = progressRef.current + increment;
          if (next >= 1) {
            next = 1;
            setIsPlaying(false);
          }
          progressRef.current = next;
        }

        // Posição na curva Catmull-Rom
        const clampedT = Math.max(0, Math.min(1, progressRef.current));
        const pos = curve.getPointAt(clampedT);
        const tangent = curve.getTangentAt(clampedT).normalize();

        runner.position.copy(pos);

        // Atualização da UI React em frequência controlada (10 Hz) para poupar CPU/GC
        if (now - lastUiUpdateTime >= 100) {
          lastUiUpdateTime = now;
          setProgress(clampedT);

          const ptIndex = Math.min(
            Math.floor(clampedT * data.points.length),
            data.points.length - 1
          );
          const currentPt = data.points[ptIndex];
          if (currentPt) {
            setCurrentDistKm((currentPt.distanceM / 1000).toFixed(2));
            setCurrentPace(formatPace(currentPt.paceSecKm));
            setCurrentElevM(Math.round(currentPt.elevationM));
            setCurrentHr(currentPt.hr || null);
            setCurrentElapsedSec(Math.round(currentPt.elapsedSec));
          }
        }

        // ── Atualização da Câmera por Modo ──
        const currentMode = cameraModeRef.current;
        if (currentMode === "chase") {
          const chaseOffset = tangent.clone().multiplyScalar(-14).add(new THREE.Vector3(0, 7, 0));
          const targetCamPos = pos.clone().add(chaseOffset);
          camera.position.lerp(targetCamPos, 0.08);

          const lookTarget = pos.clone().add(tangent.clone().multiplyScalar(8));
          camera.lookAt(lookTarget);
        } else if (currentMode === "aerial") {
          const topOffset = new THREE.Vector3(0, 45, 15);
          camera.position.lerp(pos.clone().add(topOffset), 0.08);
          camera.lookAt(pos);
        } else if (currentMode === "free") {
          const r = orbitAngles.current.radius;
          const theta = orbitAngles.current.theta;
          const phi = orbitAngles.current.phi;

          const cx = pos.x + r * Math.sin(phi) * Math.sin(theta);
          const cy = pos.y + r * Math.cos(phi);
          const cz = pos.z + r * Math.sin(phi) * Math.cos(theta);

          camera.position.set(cx, cy, cz);
          camera.lookAt(pos);
        }

        renderer.render(scene, camera);
      }

      if (!document.hidden) {
        animFrameIdRef.current = requestAnimationFrame(animate);
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        lastTime = performance.now();
        animFrameIdRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  // ── Controles de Toque / Mouse para Modo Órbita ──
  const handlePointerDown = (e: React.PointerEvent) => {
    if (cameraMode !== "free") return;
    isOrbiting.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isOrbiting.current || cameraMode !== "free") return;

    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };

    orbitAngles.current.theta -= deltaX * 0.01;
    orbitAngles.current.phi = Math.max(
      0.1,
      Math.min(Math.PI / 2 - 0.05, orbitAngles.current.phi - deltaY * 0.01)
    );
  };

  const handlePointerUp = () => {
    isOrbiting.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (cameraMode !== "free") return;
    orbitAngles.current.radius = Math.max(
      15,
      Math.min(250, orbitAngles.current.radius + e.deltaY * 0.08)
    );
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className={`relative w-full rounded-2xl overflow-hidden border border-[var(--border)] bg-[#0b0e14] select-none transition-all shadow-2xl ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "h-[440px] sm:h-[500px]"
      }`}
    >
      {/* Canvas 3D */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* ── Top Bar HUD ── */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none gap-2">
        <div className="flex items-center gap-2 pointer-events-auto bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold">
          <Video size={15} className="text-[var(--accent)]" />
          <span className="truncate max-w-[140px] sm:max-w-[220px]">
            {activityName || t("flyover.title")}
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Seletor de Câmera */}
          <div className="flex bg-black/60 backdrop-blur-md border border-white/10 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setCameraMode("chase")}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                cameraMode === "chase"
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-white/60 hover:text-white"
              }`}
              title={t("flyover.camera_chase")}
            >
              <Eye size={14} />
              <span className="hidden sm:inline">{t("flyover.camera_chase")}</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraMode("aerial")}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                cameraMode === "aerial"
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-white/60 hover:text-white"
              }`}
              title={t("flyover.camera_top")}
            >
              <Compass size={14} />
              <span className="hidden sm:inline">{t("flyover.camera_top")}</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraMode("free")}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                cameraMode === "free"
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-white/60 hover:text-white"
              }`}
              title={t("flyover.camera_free")}
            >
              <Maximize2 size={14} />
              <span className="hidden sm:inline">{t("flyover.camera_free")}</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn-ghost bg-black/60 backdrop-blur-md border border-white/10 p-2 text-white/80 hover:text-white rounded-xl"
            title="Tela cheia"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Fechar */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost bg-black/60 backdrop-blur-md border border-white/10 p-2 text-white/80 hover:text-white rounded-xl"
              title="Fechar 3D"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Telemetria ao Vivo (Pills Flutuantes) ── */}
      <div className="absolute top-18 left-4 flex flex-wrap gap-2 pointer-events-none">
        {/* Distância */}
        <div className="bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs text-white shadow-lg">
          <span className="text-[var(--muted)] font-mono">KM</span>
          <span className="font-bold text-emerald-400 text-sm">{currentDistKm}</span>
        </div>

        {/* Ritmo */}
        <div className="bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs text-white shadow-lg">
          <Gauge size={13} className="text-amber-400" />
          <span className="font-bold text-sm">{currentPace}</span>
          <span className="text-[10px] text-[var(--muted)]">/km</span>
        </div>

        {/* Altitude */}
        <div className="bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs text-white shadow-lg">
          <Mountain size={13} className="text-sky-400" />
          <span className="font-bold text-sm">{currentElevM}</span>
          <span className="text-[10px] text-[var(--muted)]">m</span>
        </div>

        {/* Frequência Cardíaca (se houver) */}
        {currentHr != null && (
          <div className="bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs text-white shadow-lg">
            <Heart size={13} className="text-red-400 animate-pulse" />
            <span className="font-bold text-sm">{currentHr}</span>
            <span className="text-[10px] text-[var(--muted)]">bpm</span>
          </div>
        )}

        {/* Tempo decorrido */}
        <div className="bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs text-white shadow-lg">
          <Timer size={13} className="text-[var(--muted)]" />
          <span className="font-mono font-bold text-sm">{formatDuration(currentElapsedSec)}</span>
        </div>
      </div>

      {/* ── Barra Inferior: Scrubber & Playback Controls ── */}
      <div className="absolute bottom-4 left-4 right-4 bg-black/65 backdrop-blur-xl border border-white/15 rounded-2xl p-3 space-y-2 shadow-2xl">
        {/* Scrubber Timeline Slider */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onPointerDown={() => {
              isDraggingScrubber.current = true;
            }}
            onPointerUp={() => {
              isDraggingScrubber.current = false;
            }}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              progressRef.current = val;
              setProgress(val);
            }}
            className="w-full h-2 rounded-lg bg-white/20 accent-[var(--accent)] cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-white/90 shrink-0 w-12 text-right">
            {Math.round(progress * 100)}%
          </span>
        </div>

        {/* Controles: Play/Pause, Velocidade, Reset */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (progressRef.current >= 1) {
                  progressRef.current = 0;
                  setProgress(0);
                }
                setIsPlaying(!isPlaying);
              }}
              className="p-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold transition-all shadow-md active:scale-95"
              title={isPlaying ? "Pausar" : "Reproduzir"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              type="button"
              onClick={() => {
                progressRef.current = 0;
                setProgress(0);
                setIsPlaying(true);
              }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-all active:scale-95"
              title="Reiniciar"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Velocidade de reprodução */}
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
            {[1, 2, 5, 10, 20].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeedMultiplier(spd)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  speedMultiplier === spd
                    ? "bg-[var(--accent)] text-white shadow"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
