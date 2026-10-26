"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play, RotateCcw } from "lucide-react";
const modes = [
  { name: "CLARITY", caption: "SEE THE WHOLE PICTURE", color: 0x39cfff },
  { name: "TRUST", caption: "KNOW WHAT MATTERS", color: 0x9b86ff },
  { name: "CONTROL", caption: "MOVE WITH CONFIDENCE", color: 0x38ffd0 },
];
export default function CinematicCore() {
  const mount = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const current = useRef(0);
  const stopped = useRef(false);
  const reset = useRef(0);
  const [mode, setMode] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    current.current = mode;
  }, [mode]);
  useEffect(() => {
    stopped.current = paused;
  }, [paused]);
  useEffect(() => {
    let alive = true;
    let cleanup = () => {};
    const hostElement = mount.current;
    if (!hostElement) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer?.disconnect();
        import("three")
          .then((THREE) => {
            if (!alive || !mount.current) return;
            const host = mount.current;
            let renderer: import("three").WebGLRenderer;
            // Supply an already-created context: this avoids Three.js's multiple internal
            // getContext attempts and allows a clean, silent failure on unsupported devices.
            const canvas = document.createElement("canvas");
            const options: WebGLContextAttributes = {
              alpha: true,
              antialias: false,
              depth: true,
              stencil: false,
              preserveDrawingBuffer: false,
              premultipliedAlpha: true,
              powerPreference: "default",
              failIfMajorPerformanceCaveat: false,
            };
            let gl: WebGLRenderingContext | WebGL2RenderingContext | null;
            try {
              gl = canvas.getContext(
                "webgl2",
                options,
              ) as WebGL2RenderingContext | null;
              if (!gl)
                gl = canvas.getContext(
                  "webgl",
                  options,
                ) as WebGLRenderingContext | null;
              if (!gl) {
                if (alive) setError(true);
                return;
              }
              renderer = new THREE.WebGLRenderer({
                canvas,
                context: gl,
                alpha: true,
                antialias: false,
                powerPreference: "default",
              });
            } catch (e) {
              console.info("ORYQEN: switching to motion fallback", e);
              if (alive) setError(true);
              return;
            }
            if (!alive) {
              renderer.dispose();
              return;
            }
            setReady(true);
            renderer.setPixelRatio(
              Math.min(window.devicePixelRatio || 1, 1.25),
            );
            renderer.setClearColor(0x06172d, 0);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            host.appendChild(renderer.domElement);
            const onContextLost = (event: Event) => {
              event.preventDefault();
              if (alive) setError(true);
            };
            renderer.domElement.addEventListener(
              "webglcontextlost",
              onContextLost,
              false,
            );
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
            camera.position.set(0, 0, 9.7);
            const group = new THREE.Group();
            scene.add(group);
            const coreGeo = new THREE.IcosahedronGeometry(1.32, 5);
            const coreMat = new THREE.MeshPhysicalMaterial({
              color: 0x1399db,
              metalness: 0.52,
              roughness: 0.13,
              transmission: 0.27,
              thickness: 1.6,
              clearcoat: 1,
              clearcoatRoughness: 0.08,
              flatShading: false,
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            group.add(core);
            const inner = new THREE.Mesh(
              new THREE.IcosahedronGeometry(0.86, 2),
              new THREE.MeshStandardMaterial({
                color: 0x04234d,
                metalness: 0.7,
                roughness: 0.25,
                emissive: 0x0868bd,
                emissiveIntensity: 0.75,
                wireframe: true,
              }),
            );
            group.add(inner);
            const knot = new THREE.Mesh(
              new THREE.TorusKnotGeometry(1.85, 0.045, 260, 16, 2, 5),
              new THREE.MeshStandardMaterial({
                color: 0x7ceaff,
                emissive: 0x1b8aff,
                emissiveIntensity: 1.4,
                metalness: 0.65,
                roughness: 0.16,
              }),
            );
            group.add(knot);
            const rings: import("three").Mesh[] = [];
            for (let i = 0; i < 3; i++) {
              const r = new THREE.Mesh(
                new THREE.TorusGeometry(
                  2.1 + i * 0.31,
                  0.012 + i * 0.003,
                  10,
                  200,
                ),
                new THREE.MeshBasicMaterial({
                  color: i === 1 ? 0x7f94ff : 0x77dfff,
                  transparent: true,
                  opacity: 0.58,
                  side: THREE.DoubleSide,
                }),
              );
              r.rotation.set(0.5 + i * 0.8, 0.7 + i * 0.4, i * 0.6);
              group.add(r);
              rings.push(r);
            }
            const particleCount = 230;
            const positions = new Float32Array(particleCount * 3);
            for (let i = 0; i < particleCount; i++) {
              const angle = i * 2.399963;
              const z = 1 - (2 * (i + 0.5)) / particleCount;
              const rr = Math.sqrt(1 - z * z);
              const dist = 3.1 + (i % 11) * 0.13;
              positions[i * 3] = Math.cos(angle) * rr * dist;
              positions[i * 3 + 1] = Math.sin(angle) * rr * dist;
              positions[i * 3 + 2] = z * dist;
            }
            const particleGeo = new THREE.BufferGeometry();
            particleGeo.setAttribute(
              "position",
              new THREE.BufferAttribute(positions, 3),
            );
            const particles = new THREE.Points(
              particleGeo,
              new THREE.PointsMaterial({
                color: 0x95eaff,
                size: 0.027,
                transparent: true,
                opacity: 0.7,
                sizeAttenuation: true,
              }),
            );
            group.add(particles);
            scene.add(new THREE.AmbientLight(0xb5e8ff, 1.5));
            const key = new THREE.PointLight(0x5ddcff, 75);
            key.position.set(-3, 3, 5);
            scene.add(key);
            const rim = new THREE.PointLight(0x7a69ff, 65);
            rim.position.set(3, -2, -1);
            scene.add(rim);
            const clock = new THREE.Clock();
            let raf = 0;
            let elapsed = 0;
            let last = 0;
            const reduce = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches;
            const resize = () => {
              const w = host.clientWidth,
                h = host.clientHeight;
              renderer.setSize(w, h, false);
              camera.aspect = w / Math.max(h, 1);
              camera.updateProjectionMatrix();
            };
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(host);
            resize();
            const animate = () => {
              raf = requestAnimationFrame(animate);
              const now = clock.getElapsedTime();
              const delta = Math.min(now - last, 0.05);
              last = now;
              if (!stopped.current && !reduce) elapsed += delta;
              const target = (modes[current.current] ?? modes[0]!).color;
              const col = new THREE.Color(target);
              coreMat.color.lerp(col, 0.045);
              (
                knot.material as import("three").MeshStandardMaterial
              ).color.lerp(col, 0.045);
              key.color.lerp(col, 0.035);
              group.rotation.y +=
                (pointer.current.x * 0.34 + elapsed * 0.13 - group.rotation.y) *
                0.045;
              group.rotation.x +=
                (-pointer.current.y * 0.27 +
                  Math.sin(elapsed * 0.19) * 0.08 -
                  group.rotation.x) *
                0.045;
              core.rotation.y = elapsed * 0.19;
              core.rotation.z = elapsed * 0.12;
              inner.rotation.y = -elapsed * 0.3;
              knot.rotation.z = elapsed * 0.09;
              rings.forEach((r, i) => {
                r.rotation.z +=
                  stopped.current || reduce ? 0 : 0.0016 * (i % 2 ? -1 : 1);
              });
              particles.rotation.y = elapsed * 0.015;
              if (reset.current) {
                pointer.current = { x: 0, y: 0 };
                reset.current = 0;
              }
              renderer.render(scene, camera);
            };
            animate();
            cleanup = () => {
              cancelAnimationFrame(raf);
              resizeObserver.disconnect();
              scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
                  obj.geometry.dispose();
                  const mats = Array.isArray(obj.material)
                    ? obj.material
                    : [obj.material];
                  mats.forEach((m) => m.dispose());
                }
              });
              renderer.domElement.removeEventListener(
                "webglcontextlost",
                onContextLost,
              );
              renderer.dispose();
              renderer.domElement.remove();
            };
          })
          .catch(() => {
            if (alive) setError(true);
          });
      },
      { rootMargin: "280px" },
    );
    observer.observe(hostElement);
    return () => {
      alive = false;
      observer?.disconnect();
      cleanup();
    };
  }, []);
  return (
    <div className="cinema-shell v5-shell">
      <div className="cinema-bar">
        <span>
          <i /> ORYQEN / SPATIAL EXPERIENCE
        </span>
        <span>REAL 3D · ADAPTIVE · 006</span>
      </div>
      <div
        className="cinema-stage v5-stage"
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          const r = e.currentTarget.getBoundingClientRect();
          pointer.current = {
            x: ((e.clientX - r.left) / r.width) * 2 - 1,
            y: ((e.clientY - r.top) / r.height) * 2 - 1,
          };
        }}
        onPointerLeave={() => (pointer.current = { x: 0, y: 0 })}
      >
        <div className="v5-radial" />
        <div className="v5-grid" />
        <div
          className="v5-canvas"
          ref={mount}
          aria-label="Rotating interactive three dimensional crystalline orb with orbital rings"
          role="img"
        />
        {!ready && (
          <div className="v6-sculpture" role="img" aria-label="ORYQEN spatial sculpture">
            <div className="v6-halo v6-halo-a" />
            <div className="v6-halo v6-halo-b" />
            <div className="v6-halo v6-halo-c" />
            <div className="v6-gem">
              <div className="v6-gem-inner" />
            </div>
            <div className="v6-spark v6-spark-a" />
            <div className="v6-spark v6-spark-b" />
          </div>
        )}
        {error && <span className="v6-mode-note">ADAPTIVE VISUAL MODE</span>}
        <div className="cinema-overlay-top">
          <span>OQ — 006 / SPATIAL CORE</span>
          <span>DRAG YOUR GAZE WITH THE CURSOR ↗</span>
        </div>
        <div className="v5-side-mark">DESIGNED TO MAKE WORK CLEARER / 2026</div>
        <div className="cinema-overlay-bottom">
          <div>
            <small>EXPLORE THE ORYQEN UNIVERSE</small>
            <h3>
              CLARITY,
              <br />
              <em>IN EVERY DIMENSION.</em>
            </h3>
          </div>
          <span>SPATIAL SYSTEM / INTERACTIVE</span>
        </div>
      </div>
      <div className="cinema-controls">
        <div className="cinema-modes">
          {modes.map((m, i) => (
            <button
              key={m.name}
              type="button"
              className={mode === i ? "active" : ""}
              aria-pressed={mode === i}
              onClick={() => setMode(i)}
            >
              <span>0{i + 1}</span> {m.name}
            </button>
          ))}
        </div>
        <div className="v5-actions">
          <button
            className="cinema-pause"
            onClick={() => {
              reset.current = 1;
            }}
            aria-label="Reset camera interaction"
          >
            <RotateCcw size={15} /> RESET
          </button>
          <button
            className="cinema-pause"
            onClick={() => setPaused((v) => !v)}
            aria-label={paused ? "Resume animation" : "Pause animation"}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
            {paused ? "PLAY" : "PAUSE"}
          </button>
        </div>
      </div>
      <div className="cinema-caption">
        <span>{modes[mode]?.caption ?? ""} / VISUAL CONCEPT</span>
        <a href="#lab">
          TRY THE INTERACTIVE DEMO <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  );
}
