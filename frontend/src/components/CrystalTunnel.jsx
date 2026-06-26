import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useMood } from "@/contexts/MoodContext";

/**
 * Crystal Tunnel — additive points wormhole.
 * - Spherical point cloud remapped into a tunnel
 * - Camera flies through; mouse banks direction
 * - Mood drives color & particle density; confidence drives glow
 */
export default function CrystalTunnel() {
  const mountRef = useRef(null);
  const moodRef = useRef(null);
  const { config, confidence } = useMood();

  // keep latest mood values in a ref so the rAF closure sees them
  useEffect(() => {
    moodRef.current = { config, confidence };
  }, [config, confidence]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0524, 0.025);

    const camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0a0524, 1);
    mount.appendChild(renderer.domElement);

    // ---- Tunnel geometry: ring of points stacked into depth ----
    const ringCount = 140;        // rings along z
    const pointsPerRing = 90;     // points per ring
    const radius = 6.0;
    const tunnelDepth = 220;

    const totalPoints = ringCount * pointsPerRing;
    const positions = new Float32Array(totalPoints * 3);
    const seeds = new Float32Array(totalPoints);

    let i = 0;
    for (let r = 0; r < ringCount; r++) {
      const z = -(r / ringCount) * tunnelDepth;
      for (let p = 0; p < pointsPerRing; p++) {
        const a = (p / pointsPerRing) * Math.PI * 2;
        positions[i * 3 + 0] = Math.cos(a) * radius;
        positions[i * 3 + 1] = Math.sin(a) * radius;
        positions[i * 3 + 2] = z;
        seeds[i] = Math.random();
        i++;
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));

    const uniforms = {
      uTime: { value: 0 },
      uCamZ: { value: 0 },
      uSwirl: { value: 0.6 },
      uColorA: { value: new THREE.Color(0x2bf0ff) },
      uColorB: { value: new THREE.Color(0x7a3cff) },
      uGlow: { value: 0.6 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform float uCamZ;
        uniform float uSwirl;
        attribute float seed;
        varying float vDist;
        varying float vSeed;

        // simple noise
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float n = i.x + i.y * 57.0 + 113.0 * i.z;
          return mix(
            mix(mix(hash(n), hash(n + 1.0), f.x),
                mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
            mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y),
            f.z
          );
        }

        void main() {
          vec3 pos = position;
          // recycle z so tunnel feels infinite
          float depth = 220.0;
          pos.z = mod(pos.z - uCamZ, depth) - depth * 0.5;

          // swirl rotation
          float angleOffset = uTime * 0.15 * uSwirl + pos.z * 0.02;
          float c = cos(angleOffset), s = sin(angleOffset);
          float x = pos.x * c - pos.y * s;
          float y = pos.x * s + pos.y * c;

          // noise ripple
          float n = noise(vec3(x * 0.5, y * 0.5, pos.z * 0.1 + uTime * 0.2));
          float ripple = (n - 0.5) * uSwirl * 1.2;
          float len = length(vec2(x, y));
          vec2 dir = vec2(x, y) / max(len, 0.001);
          x += dir.x * ripple;
          y += dir.y * ripple;

          pos.x = x; pos.y = y;
          vDist = -pos.z / depth;
          vSeed = seed;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = 2.4 + seed * 2.0;
          gl_PointSize = size * (260.0 / -mv.z);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uGlow;
        varying float vDist;
        varying float vSeed;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          float alpha = smoothstep(0.5, 0.0, d);
          alpha *= 0.85;
          vec3 col = mix(uColorA, uColorB, vSeed);
          // radial fade with depth
          float depthFade = 1.0 - smoothstep(0.0, 0.85, vDist);
          col *= depthFade * (0.7 + uGlow * 0.9);
          gl_FragColor = vec4(col, alpha * depthFade);
        }
      `,
    });

    const tunnel = new THREE.Points(geom, mat);
    scene.add(tunnel);

    // ---- drifting motes ----
    const moteCount = 300;
    const motePos = new Float32Array(moteCount * 3);
    for (let k = 0; k < moteCount; k++) {
      motePos[k * 3 + 0] = (Math.random() - 0.5) * 18;
      motePos[k * 3 + 1] = (Math.random() - 0.5) * 18;
      motePos[k * 3 + 2] = -Math.random() * tunnelDepth;
    }
    const moteGeom = new THREE.BufferGeometry();
    moteGeom.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0x8fe6ff,
      size: 0.08,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const motes = new THREE.Points(moteGeom, moteMat);
    scene.add(motes);

    // ---- interaction ----
    let mouseX = 0, mouseY = 0;
    let camTargetRotZ = 0, camRotZ = 0;
    let camTargetX = 0, camTargetY = 0, camX = 0, camY = 0;
    let camZ = 0; // depth into tunnel
    let scrollVel = 0;

    const onMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onWheel = (e) => {
      scrollVel += e.deltaY * 0.0008;
    };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", onResize);

    const targetColors = { a: new THREE.Color(0x2bf0ff), b: new THREE.Color(0x7a3cff) };

    let raf;
    const clock = new THREE.Clock();

    const tick = () => {
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;

      const m = moodRef.current || { config, confidence };
      const cfg = m.config;

      // smooth color toward mood palette
      targetColors.a.set(cfg.palette.primary);
      targetColors.b.set(cfg.palette.secondary);
      uniforms.uColorA.value.lerp(targetColors.a, 0.04);
      uniforms.uColorB.value.lerp(targetColors.b, 0.04);
      uniforms.uSwirl.value += (cfg.swirl - uniforms.uSwirl.value) * 0.05;
      uniforms.uGlow.value += ((0.3 + m.confidence * 0.9) * cfg.bloom * 2 - uniforms.uGlow.value) * 0.05;

      // scroll-driven camera depth
      scrollVel *= 0.92;
      camZ += (0.06 + scrollVel) * cfg.speedMultiplier;
      uniforms.uCamZ.value = camZ;

      // mouse banks the camera
      camTargetX = mouseX * 1.5;
      camTargetY = -mouseY * 1.0;
      camTargetRotZ = -mouseX * 0.3;
      camX += (camTargetX - camX) * 0.05;
      camY += (camTargetY - camY) * 0.05;
      camRotZ += (camTargetRotZ - camRotZ) * 0.05;
      camera.position.x = camX;
      camera.position.y = camY;
      camera.rotation.z = camRotZ + t * 0.04 * cfg.speedMultiplier;

      // motes drift forward & recycle
      const posAttr = moteGeom.attributes.position;
      for (let k = 0; k < moteCount; k++) {
        let z = posAttr.array[k * 3 + 2];
        z += 0.08 * cfg.speedMultiplier + scrollVel * 4;
        if (z > 4) z = -tunnelDepth;
        posAttr.array[k * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;
      moteMat.opacity = 0.3 + cfg.bloom * 0.4;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      geom.dispose();
      mat.dispose();
      moteGeom.dispose();
      moteMat.dispose();
      renderer.dispose();
      if (mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="crystal-tunnel"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
}
