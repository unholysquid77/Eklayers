'use client';

import { useEffect, useRef, useCallback, memo } from 'react';
import * as THREE from 'three';

// ── Constants ────────────────────────────────────────────────────────────────
const R = 1.0;
const PIN_BASE_R = 0.004;

const COLORS = {
  earth: 0x0d1117,
  wire: 0x1f3a60,
  atmosphere: 0x58a6ff,
  stressLow: new THREE.Color(0x3fb950),
  stressMid: new THREE.Color(0xe3b341),
  stressHi: new THREE.Color(0xf78166),
  typeColors: {
    weather_advisory: new THREE.Color(0xf78166),
    port_congestion: new THREE.Color(0xe3b341),
    route_closure: new THREE.Color(0xf78166),
    public_advisory: new THREE.Color(0x58a6ff),
    capacity_event: new THREE.Color(0xd2a8ff),
    vessel_delay: new THREE.Color(0x7ee2e2),
    quality_event: new THREE.Color(0xf78166),
    financial_event: new THREE.Color(0xe3b341),
    sanction: new THREE.Color(0xf78166),
    unrest: new THREE.Color(0xf78166),
  } as Record<string, THREE.Color>,
};

const TEX = {
  night: 'https://cdn.jsdelivr.net/npm/three-globe@2.33.0/example/img/earth-night.jpg',
  day: 'https://cdn.jsdelivr.net/npm/three-globe@2.33.0/example/img/earth-blue-marble.jpg',
  bump: 'https://cdn.jsdelivr.net/npm/three-globe@2.33.0/example/img/earth-topology.png',
};

// ── Coordinate helper ────────────────────────────────────────────────────────
function latLonToVec3(lat: number, lon: number, radius = R): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function stressColor(level: number, baseline = 0.05): THREE.Color {
  const diff = Math.max(0, level - baseline);
  if (diff < 0.10) return COLORS.stressLow;
  if (diff < 0.30) return COLORS.stressMid;
  return COLORS.stressHi;
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface GlobeFeature {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    title: string;
    type: string;
    intensity: number;
    confidence: number;
    source: string;
    observed_at: string;
    [key: string]: unknown;
  };
}

interface SarvadarshiGlobeProps {
  data?: { type: string; features: GlobeFeature[] };
  onFeatureClick?: (feature: GlobeFeature) => void;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────
function SarvadarshiGlobeInner({ data, onFeatureClick, className }: SarvadarshiGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: { autoRotate: boolean; update: () => void };
    layers: {
      pins: THREE.Group;
      pulses: THREE.Group;
      arcs: THREE.Group;
      events: THREE.Group;
      borders: THREE.Group;
    };
    earthMat: THREE.MeshPhongMaterial;
    wireMat: THREE.LineBasicMaterial;
    atmoMat: THREE.ShaderMaterial;
  } | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // ── Initialize Three.js scene ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030507, 0.18);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0.6, 3.2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Controls (simple auto-rotate)
    const controls = { autoRotate: true, autoRotateSpeed: 0.35, update() {} };

    // Lights
    scene.add(new THREE.AmbientLight(0x203040, 0.7));
    const key = new THREE.DirectionalLight(0x58a6ff, 0.8);
    key.position.set(3, 2, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xf78166, 0.25);
    fill.position.set(-3, -1, -1);
    scene.add(fill);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xaabbdd, size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.7,
    })));

    // Earth
    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = 'anonymous';
    const texBump = texLoader.load(TEX.bump);

    const earthGeo = new THREE.SphereGeometry(R, 96, 96);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      specular: new THREE.Color(0x101828),
      shininess: 4,
      bumpMap: texBump,
      bumpScale: 0.012,
      emissive: new THREE.Color(0x050a12),
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Load night texture
    texLoader.load(TEX.night, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = tex;
      earthMat.emissiveMap = tex;
      earthMat.emissive.setHex(0xffffff);
      earthMat.emissiveIntensity = 0.55;
      earthMat.color.setHex(0x9aa8bf);
      earthMat.needsUpdate = true;
    });

    // Wire overlay
    const wireGeo = new THREE.SphereGeometry(R * 1.001, 36, 24);
    const wireMat = new THREE.LineBasicMaterial({ color: COLORS.wire, transparent: true, opacity: 0.10 });
    scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(wireGeo), wireMat));

    // Atmosphere halo
    const atmoGeo = new THREE.SphereGeometry(R * 1.05, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(COLORS.atmosphere) } },
      vertexShader: `
        varying vec3 vNormal;
        void main(){
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 uColor;
        void main(){
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(uColor, 1.0) * intensity;
        }`,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Latitude rings
    function ring(lat: number, color = 0x203048, opacity = 0.35) {
      const rad = lat * Math.PI / 180;
      const r = R * Math.cos(rad);
      const y = R * Math.sin(rad);
      const g = new THREE.BufferGeometry();
      const segs = 128;
      const arr = new Float32Array((segs + 1) * 3);
      for (let i = 0; i <= segs; i++) {
        const a = i / segs * Math.PI * 2;
        arr[i * 3] = r * Math.cos(a);
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = r * Math.sin(a);
      }
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    }
    scene.add(ring(0, 0x2c4668, 0.45));
    scene.add(ring(23.5));
    scene.add(ring(-23.5));
    scene.add(ring(66.5, 0x1a2638, 0.25));
    scene.add(ring(-66.5, 0x1a2638, 0.25));

    // Layer groups
    const layers = {
      pins: new THREE.Group(),
      pulses: new THREE.Group(),
      arcs: new THREE.Group(),
      events: new THREE.Group(),
      borders: new THREE.Group(),
    };
    Object.values(layers).forEach(g => scene.add(g));

    // Country borders
    const BORDERS_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector/geojson/ne_110m_admin_0_countries.geojson';
    fetch(BORDERS_URL)
      .then(r => r.json())
      .then((geo) => {
        const mat = new THREE.LineBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.28 });
        const borderR = R * 1.0015;
        for (const feat of geo.features || []) {
          const g = feat.geometry;
          if (!g) continue;
          const polys = g.type === 'Polygon' ? [g.coordinates]
            : g.type === 'MultiPolygon' ? g.coordinates : [];
          for (const poly of polys) {
            for (const ringCoords of poly) {
              const pts: THREE.Vector3[] = [];
              for (const [lon, lat] of ringCoords) {
                if (lon == null || lat == null) continue;
                pts.push(latLonToVec3(lat, lon, borderR));
              }
              if (pts.length < 2) continue;
              const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
              layers.borders.add(new THREE.LineLoop(lineGeo, mat));
            }
          }
        }
      })
      .catch(() => {});

    // Raycaster for clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickable: THREE.Object3D[] = [];

    renderer.domElement.addEventListener('click', (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickable, false);
      if (hits.length && hits[0].object.userData.feature) {
        onFeatureClick?.(hits[0].object.userData.feature);
      }
    });

    // Animation
    let last = performance.now();
    let autoRotateAngle = 0;
    function animate(now: number) {
      requestAnimationFrame(animate);
      const dt = (now - last) / 1000;
      last = now;

      // Auto-rotate
      if (controls.autoRotate) {
        autoRotateAngle += controls.autoRotateSpeed * dt * 0.1;
        camera.position.x = 3.2 * Math.sin(autoRotateAngle);
        camera.position.z = 3.2 * Math.cos(autoRotateAngle);
        camera.position.y = 0.6;
        camera.lookAt(0, 0, 0);
      }

      // Pulse halos
      layers.pulses.children.forEach(h => {
        const ud = h.userData;
        ud.phase = (ud.phase || 0) + dt * 2.0;
        const s = 1 + Math.sin(ud.phase) * 0.25;
        h.scale.setScalar(s);
        (h.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.15 * Math.sin(ud.phase);
      });

      // Event twinkle
      layers.events.children.forEach(d => {
        const ud = d.userData;
        ud.phase = (ud.phase || 0) + dt * 2.5;
        const s = 1 + Math.sin(ud.phase) * 0.35;
        d.scale.setScalar(s);
      });

      // Arc glow
      layers.arcs.children.forEach(a => {
        const ud = a.userData;
        ud.phase = (ud.phase || 0) + dt * 1.3;
        (a.material as THREE.LineBasicMaterial).opacity =
          ud.baseOpacity * (0.7 + 0.3 * Math.sin(ud.phase));
      });

      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);

    // Resize
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = { scene, camera, renderer, controls, layers, earthMat, wireMat, atmoMat };

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build scene objects from data ──────────────────────────────────────────
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || !data) return;
    const { layers } = ctx;

    // Clear previous
    layers.pins.clear();
    layers.pulses.clear();
    layers.arcs.clear();
    layers.events.clear();

    const clickable: THREE.Object3D[] = [];

    // Build port/signal pins
    for (const feat of data.features) {
      const [lon, lat] = feat.geometry.coordinates;
      if (lat == null || lon == null) continue;
      const intensity = feat.properties.intensity || 0.3;
      const pos = latLonToVec3(lat, lon, R * 1.01);
      const col = stressColor(intensity);
      const rad = PIN_BASE_R + Math.min(0.016, intensity * 0.016);

      // Pin sphere
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(rad, 10, 10),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.88 }),
      );
      pin.position.copy(pos);
      pin.userData = { feature: feat };
      layers.pins.add(pin);
      clickable.push(pin);

      // Standing ray
      const height = 0.012 + intensity * 0.04;
      const rayGeo = new THREE.CylinderGeometry(rad * 0.12, rad * 0.28, height, 5);
      const rayMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45 });
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.copy(pos.clone().multiplyScalar(1 + height / (2 * R)));
      ray.lookAt(new THREE.Vector3(0, 0, 0));
      ray.rotateX(Math.PI / 2);
      layers.pins.add(ray);

      // Pulsing halo for high intensity
      if (intensity > 0.5) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(rad * 1.7, 12, 12),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06 }),
        );
        halo.position.copy(pos);
        halo.userData = { phase: Math.random() * Math.PI * 2 };
        layers.pulses.add(halo);
      }

      // Event dot (colored by type)
      const typeColor = COLORS.typeColors[feat.properties.type] || new THREE.Color(0x888888);
      const eventDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.004 + intensity * 0.008, 8, 8),
        new THREE.MeshBasicMaterial({ color: typeColor, transparent: true, opacity: 0.9 }),
      );
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
      );
      eventDot.position.copy(pos.clone().add(jitter).normalize().multiplyScalar(R * 1.005));
      eventDot.userData = { phase: Math.random() * Math.PI * 2 };
      layers.events.add(eventDot);
    }

    // Build cascade arcs between features
    if (data.features.length > 1) {
      for (let i = 0; i < Math.min(data.features.length, 8); i++) {
        for (let j = i + 1; j < Math.min(data.features.length, 8); j++) {
          const f1 = data.features[i];
          const f2 = data.features[j];
          const [lon1, lat1] = f1.geometry.coordinates;
          const [lon2, lat2] = f2.geometry.coordinates;
          if (lat1 == null || lat2 == null) continue;

          const from = latLonToVec3(lat1, lon1, R * 1.01);
          const to = latLonToVec3(lat2, lon2, R * 1.01);
          const mid = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.15);
          const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
          const pts = curve.getPoints(48);

          const avgIntensity = ((f1.properties.intensity || 0.3) + (f2.properties.intensity || 0.3)) / 2;
          const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const arcMat = new THREE.LineBasicMaterial({
            color: stressColor(avgIntensity + 0.2, 0),
            transparent: true,
            opacity: 0.05 + avgIntensity * 0.10,
          });
          const line = new THREE.Line(arcGeo, arcMat);
          line.userData = { phase: Math.random() * Math.PI * 2, baseOpacity: arcMat.opacity };
          layers.arcs.add(line);
        }
      }
    }

    // Update clickable refs
    ctx.controls.autoRotate = true;
  }, [data]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', background: 'radial-gradient(ellipse at center, #0B1220 0%, #030507 80%)' }}
    />
  );
}

const SarvadarshiGlobe = memo(SarvadarshiGlobeInner);
export default SarvadarshiGlobe;
