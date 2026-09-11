'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  CascadeMap, Vessel, Flight, RelationArc,
  ShippingLane, GeoFeatureCollection, LayerVisibility,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Constants & Theme Palette
// ---------------------------------------------------------------------------

const R = 1.0; // Globe radius
const BORDERS_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const COLOR_TACTICAL_GREEN = 0x00ff88;
const COLOR_AMBER = 0xfbbf24;
const COLOR_CRIMSON = 0xff3344;
const COLOR_CYAN = 0x38bdf8;
const COLOR_ORANGE = 0xf97316;
const COLOR_PURPLE = 0xa855f7;

// High-res Night Earth Textures from NASA / three-globe
const TEX_NIGHT = 'https://cdn.jsdelivr.net/npm/three-globe@2.33.0/example/img/earth-night.jpg';
const TEX_BUMP  = 'https://cdn.jsdelivr.net/npm/three-globe@2.33.0/example/img/earth-topology.png';

// ---------------------------------------------------------------------------
// Spatial Helpers
// ---------------------------------------------------------------------------

function latLonToVec3(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function vec3ToLatLon(vec: THREE.Vector3): { lat: number; lon: number } {
  const norm = vec.clone().normalize();
  const phi = Math.acos(Math.max(-1, Math.min(1, norm.y)));
  const lat = 90 - (phi * 180) / Math.PI;
  const theta = Math.atan2(norm.z, -norm.x);
  let lon = (theta * 180) / Math.PI - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lat, lon };
}

function stressColor(stress: number): THREE.Color {
  if (stress < 0.45) return new THREE.Color(COLOR_TACTICAL_GREEN);
  if (stress < 0.70) return new THREE.Color(COLOR_AMBER);
  return new THREE.Color(COLOR_CRIMSON);
}

function buildElevationSafeArc(src: THREE.Vector3, tgt: THREE.Vector3, severity: number = 0.5): THREE.Vector3[] {
  const dist = src.distanceTo(tgt); // Chord distance (0 to 2.0)
  const arcHeight = Math.min(0.24, Math.max(0.022, dist * 0.18 * (0.6 + severity * 0.4)));
  
  // Start and end points physically elevated above surface (R * 1.015)
  const p0 = src.clone().normalize().multiplyScalar(R * 1.015);
  const p2 = tgt.clone().normalize().multiplyScalar(R * 1.015);
  const p1 = p0.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.018 + arcHeight);
  
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  return curve.getPoints(50);
}

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

export interface HoveredEntityInfo {
  id: string;
  name: string;
  category: string;
  stress_level: number;
  criticality: number;
  country?: string;
  connectedCount: number;
  lat: number;
  lon: number;
  x: number;
  y: number;
}

export interface SarvadarshiGlobeProps {
  cascadeData?: CascadeMap | null;
  vessels?: Vessel[];
  flights?: Flight[];
  earthquakes?: GeoFeatureCollection | null;
  infraLayers?: Partial<Record<string, GeoFeatureCollection>>;
  shippingLanes?: { type: string; features: ShippingLane[] } | null;
  bomArcs?: RelationArc[];
  activeLayers: LayerVisibility;
  autoRotate?: boolean;
  onToggleAutoRotate?: () => void;
  onFeatureClick?: (feature: { id: string; name: string; kind: string; data: unknown }) => void;
  onDrillDown?: (drill: { lat: number; lon: number; title: string; category?: string; stress?: number }) => void;
  selectedChokepointId?: string | null;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SarvadarshiGlobe({
  cascadeData,
  vessels = [],
  flights = [],
  earthquakes,
  infraLayers = {},
  shippingLanes,
  bomArcs = [],
  activeLayers,
  autoRotate = true,
  onToggleAutoRotate,
  onFeatureClick,
  onDrillDown,
  selectedChokepointId: externalSelectedId,
}: SarvadarshiGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<HoveredEntityInfo | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(externalSelectedId || null);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    globe: THREE.Mesh;
    groups: Record<string, THREE.Group | THREE.Object3D>;
    cpMeshMap: Map<string, { group: THREE.Group; head: THREE.Mesh; ring: THREE.Mesh; beacon: THREE.Mesh; data: any }>;
    arcMeshList: { line: THREE.Line; fromId: string; toId: string; severity: number; curve: THREE.QuadraticBezierCurve3 }[];
    animId: number;
    clock: THREE.Clock;
  } | null>(null);

  // Sync external selection
  useEffect(() => {
    if (externalSelectedId !== undefined) {
      setSelectedId(externalSelectedId);
    }
  }, [externalSelectedId]);

  // Sync auto-rotation
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.controls.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // ------------------------------------------------------------------
  // Init Three.js Scene
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // Scene with dark tactical background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020604);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 1000);
    camera.position.set(0, 0.6, 2.8);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    el.appendChild(renderer.domElement);

    // Controls: allows deep zoom down to surface (1.025)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.minDistance = 1.025;
    controls.maxDistance = 6.0;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.35;

    // Lights
    scene.add(new THREE.AmbientLight(0x183020, 0.85));
    const sun = new THREE.DirectionalLight(0x58a6ff, 1.2);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const sun2 = new THREE.DirectionalLight(0x00ff88, 0.5);
    sun2.position.set(-5, -3, -5);
    scene.add(sun2);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    for (let i = 0; i < 1600; i++) {
      const r = 80 + Math.random() * 40;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPositions.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x44ffa2, size: 0.12, opacity: 0.5, transparent: true })
    );
    scene.add(stars);

    // Earth: Night Earth with city lights + subtle topology bump
    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = 'anonymous';

    const nightTex = texLoader.load(TEX_NIGHT);
    nightTex.colorSpace = THREE.SRGBColorSpace;
    const bumpTex = texLoader.load(TEX_BUMP);

    const earthGeo = new THREE.SphereGeometry(R, 96, 96);
    const earthMat = new THREE.MeshPhongMaterial({
      map: nightTex,
      bumpMap: bumpTex,
      bumpScale: 0.012,
      emissiveMap: nightTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.60,
      color: new THREE.Color(0x9aa8bf), // Muted albedo so glowing lights & green atmosphere pop
      specular: new THREE.Color(0x081a0e),
      shininess: 8,
    });
    const globe = new THREE.Mesh(earthGeo, earthMat);
    scene.add(globe);

    // Latitude & Longitude Tactical Wire Rings
    const ringGroup = new THREE.Group();
    function createLatRing(lat: number, color = 0x143a22, opacity = 0.4) {
      const rad = lat * (Math.PI / 180);
      const r = R * Math.cos(rad);
      const y = R * Math.sin(rad);
      const segs = 128;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      return new THREE.Line(g, m);
    }
    ringGroup.add(createLatRing(0, 0x00ff88, 0.45)); // Equator
    ringGroup.add(createLatRing(23.5, 0x143a22, 0.35)); // Tropic of Cancer
    ringGroup.add(createLatRing(-23.5, 0x143a22, 0.35)); // Tropic of Capricorn
    ringGroup.add(createLatRing(66.5, 0x143a22, 0.25)); // Arctic
    ringGroup.add(createLatRing(-66.5, 0x143a22, 0.25)); // Antarctic
    scene.add(ringGroup);

    // Atmosphere Glow with Green Hue
    const atmMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0x00ff88) },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 uColor;
        void main() {
          float d = dot(vNormal, vec3(0.0, 0.0, -1.0));
          float intensity = pow(0.72 - d, 2.6);
          gl_FragColor = vec4(uColor, intensity * 0.50);
        }
      `,
    });
    const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 64, 64), atmMat);
    scene.add(atm);

    // Layer Groups
    const groups: Record<string, THREE.Group> = {
      borders: new THREE.Group(),
      chokepoints: new THREE.Group(),
      events: new THREE.Group(),
      cascadeArcs: new THREE.Group(),
      bomArcs: new THREE.Group(),
      vessels: new THREE.Group(),
      flights: new THREE.Group(),
      shippingLanes: new THREE.Group(),
      landRoutes: new THREE.Group(),
      infraPoints: new THREE.Group(),
      infraLines: new THREE.Group(),
      earthquakes: new THREE.Group(),
    };

    Object.values(groups).forEach((g) => scene.add(g));

    const cpMeshMap = new Map<string, { group: THREE.Group; head: THREE.Mesh; ring: THREE.Mesh; beacon: THREE.Mesh; data: any }>();
    const arcMeshList: { line: THREE.Line; fromId: string; toId: string; severity: number; curve: THREE.QuadraticBezierCurve3 }[] = [];

    // Raycaster for Hover and Click
    const raycaster = new THREE.Raycaster();
    raycaster.params.Mesh = { threshold: 0.02 };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      const heads = Array.from(cpMeshMap.values()).map((c) => c.head);
      const hits = raycaster.intersectObjects(heads, false);

      if (hits.length > 0) {
        const hit = hits[0];
        for (const [id, entry] of cpMeshMap.entries()) {
          if (entry.head === hit.object) {
            let connected = 0;
            arcMeshList.forEach((a) => {
              if (a.fromId === id || a.toId === id) connected++;
            });

            setHoverInfo({
              id: entry.data.id,
              name: entry.data.name,
              category: entry.data.category || 'Strategic Chokepoint',
              stress_level: entry.data.stress_level || 0.35,
              criticality: entry.data.criticality || 0.5,
              country: entry.data.country || '',
              connectedCount: connected,
              lat: entry.data.latitude || 0,
              lon: entry.data.longitude || 0,
              x: e.clientX,
              y: e.clientY,
            });
            el.style.cursor = 'pointer';
            return;
          }
        }
      } else {
        setHoverInfo(null);
        el.style.cursor = 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      const heads = Array.from(cpMeshMap.values()).map((c) => c.head);
      const hits = raycaster.intersectObjects(heads, false);

      if (hits.length > 0) {
        const hit = hits[0];
        for (const [id, entry] of cpMeshMap.entries()) {
          if (entry.head === hit.object) {
            setSelectedId((prev) => (prev === id ? null : id));
            if (onFeatureClick) {
              onFeatureClick({
                id: entry.data.id,
                name: entry.data.name,
                kind: entry.data.category || 'chokepoint',
                data: entry.data,
              });
            }
            return;
          }
        }
      }
    };

    // Double-click for High-Resolution 2D Tactical Drill-Down
    const handleDoubleClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      // Check hit on pins first
      const heads = Array.from(cpMeshMap.values()).map((c) => c.head);
      const hits = raycaster.intersectObjects(heads, false);
      if (hits.length > 0) {
        for (const entry of cpMeshMap.values()) {
          if (entry.head === hits[0].object) {
            if (onDrillDown) {
              onDrillDown({
                lat: entry.data.latitude || 0,
                lon: entry.data.longitude || 0,
                title: entry.data.name,
                category: entry.data.category,
                stress: entry.data.stress_level,
              });
            }
            return;
          }
        }
      }

      // Otherwise check hit on globe sphere
      const globeHits = raycaster.intersectObject(globe);
      if (globeHits.length > 0 && onDrillDown) {
        const pt = globeHits[0].point;
        const coords = vec3ToLatLon(pt);
        onDrillDown({
          lat: coords.lat,
          lon: coords.lon,
          title: `Surface Sector [${coords.lat.toFixed(2)}&deg;, ${coords.lon.toFixed(2)}&deg;]`,
          category: 'Tactical Recon Sector',
          stress: 0.35,
        });
      }
    };

    // Spacebar listener to toggle auto-rotation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (onToggleAutoRotate) onToggleAutoRotate();
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('keydown', handleKeyDown);

    // Animation Loop
    const clock = new THREE.Clock();
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      controls.update();

      // Subtle pulse animation on high stress beacons
      for (const entry of cpMeshMap.values()) {
        if (entry.data.stress_level > 0.5) {
          const s = 1.0 + Math.sin(elapsed * 3.5 + (entry.data.latitude || 0)) * 0.15;
          entry.ring.scale.set(s, s, 1);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = { renderer, scene, camera, controls, globe, groups, cpMeshMap, arcMeshList, animId, clock };

    // Country Borders in Tactical Phosphor Green
    fetch(BORDERS_URL)
      .then((r) => r.json())
      .then((gj) => {
        if (!sceneRef.current) return;
        const g = sceneRef.current.groups.borders as THREE.Group;
        const mat = new THREE.LineBasicMaterial({ color: COLOR_TACTICAL_GREEN, opacity: 0.28, transparent: true });
        for (const feat of (gj as { features: { geometry: { type: string; coordinates: unknown[] } }[] }).features) {
          const geom = feat.geometry;
          const rings = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
          for (const poly of rings as number[][][][]) {
            for (const r of poly) {
              const pts = r.map(([lon, lat]: number[]) => latLonToVec3(lat, lon, R * 1.002));
              g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', handleKeyDown);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      renderer.dispose();
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  // Layer Visibility
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { groups } = ref;
    if (groups.borders)       groups.borders.visible       = activeLayers.countryBorders;
    if (groups.chokepoints)   groups.chokepoints.visible   = activeLayers.chokepointPins;
    if (groups.events)        groups.events.visible        = activeLayers.eventDots;
    if (groups.cascadeArcs)   groups.cascadeArcs.visible   = activeLayers.cascadeArcs;
    if (groups.bomArcs)       groups.bomArcs.visible       = activeLayers.bomArcs;
    if (groups.vessels)       groups.vessels.visible       = activeLayers.vessels;
    if (groups.flights)       groups.flights.visible       = activeLayers.flights;
    if (groups.shippingLanes) groups.shippingLanes.visible = activeLayers.shippingLanes;
    if (groups.landRoutes)    groups.landRoutes.visible    = activeLayers.landRoutes;
    if (groups.infraPoints)   groups.infraPoints.visible   = true;
    if (groups.infraLines)    groups.infraLines.visible    = true;
    if (groups.earthquakes)   groups.earthquakes.visible   = activeLayers.earthquakes;
  }, [activeLayers]);

  // ------------------------------------------------------------------
  // Render High-Visibility Refined 3D Pins and Safe Cascade Arcs
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    const data = cascadeData || undefined;
    if (!ref || !data) return;
    const { groups, cpMeshMap, arcMeshList } = ref;
    const cpGroup = groups.chokepoints as THREE.Group;
    const evGroup = groups.events as THREE.Group;
    const arcGroup = groups.cascadeArcs as THREE.Group;

    cpGroup.clear();
    evGroup.clear();
    arcGroup.clear();
    cpMeshMap.clear();
    arcMeshList.length = 0;

    // 1. Render Sleek, Delicate Chokepoint Pins
    for (const cp of data.chokepoints) {
      if (cp.latitude == null || cp.longitude == null) continue;

      const posSurface = latLonToVec3(cp.latitude, cp.longitude, R * 1.002);
      const posHead = latLonToVec3(cp.latitude, cp.longitude, R * 1.014);
      const color = stressColor(cp.stress_level);

      const nodeGroup = new THREE.Group();

      // Slim Head Sphere (Radius 0.007 to 0.012)
      const headRadius = 0.007 + cp.stress_level * 0.005;
      const headGeo = new THREE.SphereGeometry(headRadius, 12, 12);
      const headMat = new THREE.MeshBasicMaterial({ color, depthTest: true });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.copy(posHead);
      nodeGroup.add(head);

      // Standing Slim Beacon Ray
      const beaconHeight = 0.012 + cp.stress_level * 0.024;
      const beaconGeo = new THREE.CylinderGeometry(0.0014, 0.0014, beaconHeight, 6);
      const beaconMat = new THREE.MeshBasicMaterial({ color, opacity: 0.80, transparent: true });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.copy(posSurface.clone().add(posHead).multiplyScalar(0.5));
      beacon.lookAt(new THREE.Vector3(0, 0, 0));
      beacon.rotateX(Math.PI / 2);
      nodeGroup.add(beacon);

      // Soft Pulsating Ambient Halo
      const ringGeo = new THREE.RingGeometry(headRadius * 1.4, headRadius * 2.4, 18);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.40,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(posSurface);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      nodeGroup.add(ring);

      cpGroup.add(nodeGroup);
      cpMeshMap.set(cp.id, { group: nodeGroup, head, ring, beacon, data: cp });
    }

    // 2. Render Events as Small Radiant Hazard Dots
    for (const ev of data.events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const pos = latLonToVec3(ev.latitude, ev.longitude, R * 1.010);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 8, 8),
        new THREE.MeshBasicMaterial({ color: ev.severity > 0.6 ? COLOR_CRIMSON : COLOR_AMBER })
      );
      dot.position.copy(pos);
      evGroup.add(dot);
    }

    // 3. Render Elevation-Safe Vibrant Cascade Arcs
    const cpById = Object.fromEntries(data.chokepoints.map((c) => [c.id, c]));
    const findCoord = (id: string) => {
      if (cpById[id]) return { lat: cpById[id].latitude, lon: cpById[id].longitude };
      const raw = id.toLowerCase().replace(/^(cp\.|cp\.auto_|cp\.user_)/, '');
      const found = data.chokepoints.find((c) => {
        const cRaw = c.id.toLowerCase().replace(/^(cp\.|cp\.auto_|cp\.user_)/, '');
        return cRaw === raw || c.name.toLowerCase().includes(raw);
      });
      if (found) return { lat: found.latitude, lon: found.longitude };
      const foundEv = data.events.find((e) => e.id === id);
      if (foundEv) return { lat: foundEv.latitude, lon: foundEv.longitude };
      return null;
    };

    for (const edge of data.impact_edges) {
      let srcLat = (edge as any).from_lat;
      let srcLon = (edge as any).from_lon;
      if (srcLat == null || srcLon == null) {
        const c = findCoord(edge.from_chokepoint);
        if (c) { srcLat = c.lat; srcLon = c.lon; }
      }
      if (srcLat == null || srcLon == null) continue;

      let tgtLat = (edge as any).to_lat;
      let tgtLon = (edge as any).to_lon;
      if (tgtLat == null || tgtLon == null) {
        const c = findCoord(edge.to_entity_id);
        if (c) { tgtLat = c.lat; tgtLon = c.lon; }
      }
      if (tgtLat == null || tgtLon == null) continue;

      const srcVec = latLonToVec3(srcLat, srcLon, R);
      const tgtVec = latLonToVec3(tgtLat, tgtLon, R);

      const pts = buildElevationSafeArc(srcVec, tgtVec, edge.severity);
      const color = stressColor(edge.severity);

      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        opacity: 0.85,
        transparent: true,
        depthWrite: false,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      arcGroup.add(line);

      const dist = srcVec.distanceTo(tgtVec);
      const arcHeight = Math.min(0.24, Math.max(0.022, dist * 0.18 * (0.6 + edge.severity * 0.4)));
      const mid = srcVec.clone().add(tgtVec).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.018 + arcHeight);
      const curve = new THREE.QuadraticBezierCurve3(srcVec, mid, tgtVec);

      arcMeshList.push({
        line,
        fromId: edge.from_chokepoint,
        toId: edge.to_entity_id,
        severity: edge.severity,
        curve,
      });
    }

    // 4. Render BOM Supply Arcs
    if (bomArcs && bomArcs.length > 0) {
      for (const bArc of bomArcs) {
        if (!bArc.source || !bArc.target || bArc.source.lat == null || bArc.source.lon == null || bArc.target.lat == null || bArc.target.lon == null) continue;
        const srcVec = latLonToVec3(bArc.source.lat, bArc.source.lon, R);
        const tgtVec = latLonToVec3(bArc.target.lat, bArc.target.lon, R);
        const pts = buildElevationSafeArc(srcVec, tgtVec, 0.4);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x06b6d4,
          opacity: 0.70,
          transparent: true,
          depthWrite: false,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        arcGroup.add(line);
      }
    }
  }, [cascadeData, bomArcs]);

  // ------------------------------------------------------------------
  // Render Strategic Infrastructure (Refineries, LNG, Pipelines, etc.)
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { groups } = ref;
    const ptGroup = groups.infraPoints as THREE.Group;
    const lnGroup = groups.infraLines as THREE.Group;

    ptGroup.clear();
    lnGroup.clear();

    const layerMeta: Record<string, { color: number; size: number; active: boolean }> = {
      ports: { color: 0x06b6d4, size: 0.007, active: !!activeLayers.ports },
      airports: { color: 0xf8fafc, size: 0.006, active: !!activeLayers.airports },
      warehouses: { color: 0xfbbf24, size: 0.006, active: !!activeLayers.warehouses },
      refineries: { color: COLOR_ORANGE, size: 0.007, active: !!activeLayers.refineries },
      lng_terminals: { color: 0x38bdf8, size: 0.007, active: !!activeLayers.lngTerminals },
      storage_facilities: { color: COLOR_PURPLE, size: 0.006, active: !!activeLayers.storageFacilities },
      nuclear_sites: { color: COLOR_CRIMSON, size: 0.007, active: !!activeLayers.nuclearSites },
      data_centers: { color: 0x3b82f6, size: 0.006, active: !!activeLayers.dataCenters },
      military_bases: { color: 0xdc2626, size: 0.006, active: !!activeLayers.militaryBases },
      economic_centers: { color: 0x10b981, size: 0.006, active: !!activeLayers.economicCenters },
    };

    // Render Point Infrastructures
    for (const [layerName, meta] of Object.entries(layerMeta)) {
      if (!meta.active) continue;
      const featCol = infraLayers[layerName];
      if (!featCol || !featCol.features) continue;

      const mat = new THREE.MeshBasicMaterial({ color: meta.color });
      for (const f of featCol.features) {
        if (!f.geometry || f.geometry.type !== 'Point') continue;
        const [lon, lat] = f.geometry.coordinates as [number, number];
        const pos = latLonToVec3(lat, lon, R * 1.008);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(meta.size, 8, 8), mat);
        marker.position.copy(pos);
        ptGroup.add(marker);
      }
    }

    // Render Linear Infrastructures (Pipelines, Power Lines, Undersea Cables)
    const lineLayers: Record<string, { color: number; opacity: number; active: boolean }> = {
      pipelines: { color: 0xf59e0b, opacity: 0.85, active: !!activeLayers.pipelines },
      power_lines: { color: 0x10b981, opacity: 0.75, active: !!activeLayers.powerLines },
      undersea_cables: { color: 0x06b6d4, opacity: 0.70, active: !!activeLayers.underseaCables },
      land_routes: { color: 0x84cc16, opacity: 0.65, active: !!activeLayers.landRoutes },
    };

    for (const [lName, lMeta] of Object.entries(lineLayers)) {
      if (!lMeta.active) continue;
      const featCol = infraLayers[lName];
      if (!featCol || !featCol.features) continue;

      const lineMat = new THREE.LineBasicMaterial({
        color: lMeta.color,
        opacity: lMeta.opacity,
        transparent: true,
        depthWrite: false,
      });

      for (const f of featCol.features) {
        if (!f.geometry || f.geometry.type !== 'LineString') continue;
        const coords = f.geometry.coordinates as [number, number][];
        const pts = coords.map(([lon, lat]) => latLonToVec3(lat, lon, R * 1.004));
        lnGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
    }

    // Render Shipping Lanes
    if (activeLayers.shippingLanes && shippingLanes && shippingLanes.features) {
      const laneMat = new THREE.LineBasicMaterial({
        color: 0x059669,
        opacity: 0.50,
        transparent: true,
        depthWrite: false,
      });
      for (const f of shippingLanes.features) {
        if (!f.geometry || f.geometry.type !== 'LineString') continue;
        const coords = f.geometry.coordinates as [number, number][];
        const pts = coords.map(([lon, lat]) => latLonToVec3(lat, lon, R * 1.003));
        lnGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), laneMat));
      }
    }
  }, [infraLayers, shippingLanes, activeLayers]);

  // ------------------------------------------------------------------
  // Render Live Sensor Feeds (Vessels, Flights, Earthquakes)
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { groups } = ref;
    const vsGroup = groups.vessels as THREE.Group;
    const flGroup = groups.flights as THREE.Group;
    const eqGroup = groups.earthquakes as THREE.Group;

    vsGroup.clear();
    flGroup.clear();
    eqGroup.clear();

    // 1. Live AIS Vessels
    if (activeLayers.vessels && vessels.length > 0) {
      for (const v of vessels) {
        if (v.lat == null || v.lon == null) continue;
        const pos = latLonToVec3(v.lat, v.lon, R * 1.006);
        const col = v.bucket === 'tanker' ? COLOR_AMBER : v.bucket === 'passenger' ? COLOR_TACTICAL_GREEN : 0x38bdf8;
        const vMesh = new THREE.Mesh(
          new THREE.ConeGeometry(0.0035, 0.008, 4),
          new THREE.MeshBasicMaterial({ color: col })
        );
        vMesh.position.copy(pos);
        vMesh.lookAt(new THREE.Vector3(0, 0, 0));
        vMesh.rotateX(Math.PI / 2);
        if (v.heading) {
          vMesh.rotateZ((v.heading * Math.PI) / 180);
        }
        vsGroup.add(vMesh);
      }
    }

    // 2. Live Flights (Airborne at R * 1.035)
    if (activeLayers.flights && flights.length > 0) {
      const flMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      for (const fl of flights) {
        if (fl.lat == null || fl.lon == null) continue;
        const pos = latLonToVec3(fl.lat, fl.lon, R * 1.030);
        const flMesh = new THREE.Mesh(
          new THREE.ConeGeometry(0.003, 0.009, 3),
          flMat
        );
        flMesh.position.copy(pos);
        flMesh.lookAt(new THREE.Vector3(0, 0, 0));
        flMesh.rotateX(Math.PI / 2);
        if (fl.heading) {
          flMesh.rotateZ((fl.heading * Math.PI) / 180);
        }
        flGroup.add(flMesh);
      }
    }

    // 3. USGS Earthquakes
    if (activeLayers.earthquakes && earthquakes && earthquakes.features) {
      for (const eq of earthquakes.features) {
        if (!eq.geometry || eq.geometry.type !== 'Point') continue;
        const [lon, lat] = eq.geometry.coordinates as [number, number];
        const mag = (eq.properties as any)?.mag || 4.5;
        const pos = latLonToVec3(lat, lon, R * 1.004);
        const eqRing = new THREE.Mesh(
          new THREE.RingGeometry(0.004, 0.004 + mag * 0.002, 16),
          new THREE.MeshBasicMaterial({
            color: 0xec4899,
            opacity: 0.65,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        eqRing.position.copy(pos);
        eqRing.lookAt(new THREE.Vector3(0, 0, 0));
        eqGroup.add(eqRing);
      }
    }
  }, [vessels, flights, earthquakes, activeLayers]);

  // ------------------------------------------------------------------
  // Blast Radius Selection & Network Highlighting
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { cpMeshMap, arcMeshList } = ref;

    if (!selectedId) {
      for (const entry of cpMeshMap.values()) {
        entry.head.scale.set(1, 1, 1);
        (entry.head.material as THREE.MeshBasicMaterial).opacity = 1.0;
        (entry.beacon.material as THREE.MeshBasicMaterial).opacity = 0.80;
        (entry.ring.material as THREE.MeshBasicMaterial).opacity = 0.40;
      }
      for (const a of arcMeshList) {
        (a.line.material as THREE.LineBasicMaterial).opacity = 0.85;
        (a.line.material as THREE.LineBasicMaterial).color = stressColor(a.severity);
      }
      return;
    }

    const connectedNodeIds = new Set<string>([selectedId]);
    for (const a of arcMeshList) {
      if (a.fromId === selectedId) connectedNodeIds.add(a.toId);
      if (a.toId === selectedId) connectedNodeIds.add(a.fromId);
    }

    for (const [id, entry] of cpMeshMap.entries()) {
      const isSelected = id === selectedId;
      const isConnected = connectedNodeIds.has(id);

      const hMat = entry.head.material as THREE.MeshBasicMaterial;
      const bMat = entry.beacon.material as THREE.MeshBasicMaterial;
      const rMat = entry.ring.material as THREE.MeshBasicMaterial;

      if (isSelected) {
        hMat.color = new THREE.Color(COLOR_TACTICAL_GREEN);
        entry.head.scale.set(2.4, 2.4, 2.4);
        rMat.opacity = 1.0;
        entry.ring.scale.set(1.8, 1.8, 1);
      } else if (isConnected) {
        hMat.color = stressColor(entry.data.stress_level);
        entry.head.scale.set(1.6, 1.6, 1.6);
        rMat.opacity = 0.70;
      } else {
        hMat.opacity = 0.15;
        entry.head.scale.set(0.7, 0.7, 0.7);
        bMat.opacity = 0.08;
        rMat.opacity = 0.05;
      }
    }

    for (const a of arcMeshList) {
      const isDirect = a.fromId === selectedId || a.toId === selectedId;
      const lMat = a.line.material as THREE.LineBasicMaterial;
      if (isDirect) {
        lMat.opacity = 1.0;
        lMat.color = new THREE.Color(COLOR_TACTICAL_GREEN);
      } else {
        lMat.opacity = 0.05;
      }
    }
  }, [selectedId]);

  const handleResetCamera = () => {
    if (sceneRef.current) {
      sceneRef.current.controls.reset();
      sceneRef.current.camera.position.set(0, 0.6, 2.8);
    }
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full select-none" />

      {/* Top-Left Globe Controls Strip */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 font-mono text-xs">
        <button
          onClick={onToggleAutoRotate}
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-bold transition-all shadow-lg backdrop-blur-md ${
            autoRotate
              ? 'border-[#00ff88]/60 bg-[#00ff88]/15 text-[#00ff88] hover:bg-[#00ff88]/25'
              : 'border-[#143a22] bg-[#040806]/90 text-[#87a894] hover:text-white'
          }`}
          title="Toggle Auto-Rotation (Spacebar)"
        >
          <span>{autoRotate ? '⏸ PAUSE ROTATION' : '⏵ AUTO-ROTATE'}</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="flex items-center gap-1 rounded border border-[#143a22] bg-[#040806]/90 px-3 py-1.5 text-[#87a894] hover:border-[#00ff88]/50 hover:text-white transition-all shadow-lg backdrop-blur-md"
          title="Reset Camera Angle and Zoom"
        >
          <span>RESET VIEW</span>
        </button>
      </div>

      {/* Floating Tactical HUD Tooltip */}
      {hoverInfo && (
        <div
          className="pointer-events-none fixed z-50 rounded border border-[#00ff88]/50 bg-[#040806]/95 px-3.5 py-2.5 text-xs shadow-[0_0_20px_rgba(0,255,136,0.22)] backdrop-blur-md"
          style={{
            left: Math.min(window.innerWidth - 250, hoverInfo.x + 16),
            top: Math.min(window.innerHeight - 150, hoverInfo.y + 16),
          }}
        >
          <div className="flex items-center gap-2 border-b border-[#143a22] pb-1.5 font-mono font-bold text-[#e6f7ec]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-sm">{hoverInfo.name}</span>
          </div>

          <div className="mt-2 space-y-1 font-mono text-[11px] text-[#87a894]">
            {hoverInfo.country && (
              <div className="flex justify-between gap-4">
                <span className="text-[#4e6e58]">Region:</span>
                <span className="text-[#d1fae5]">{hoverInfo.country}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-[#4e6e58]">Stress Level:</span>
              <span
                className={
                  hoverInfo.stress_level > 0.6
                    ? 'text-red-400 font-bold'
                    : hoverInfo.stress_level > 0.4
                    ? 'text-amber-400 font-bold'
                    : 'text-[#00ff88] font-bold'
                }
              >
                {Math.round(hoverInfo.stress_level * 100)}%
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#4e6e58]">Criticality:</span>
              <span className="text-[#d1fae5]">{Math.round(hoverInfo.criticality * 100)}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#4e6e58]">Active Disruption Arcs:</span>
              <span className="text-[#00ff88] font-bold">{hoverInfo.connectedCount} Links</span>
            </div>
          </div>
          <div className="mt-2 border-t border-[#143a22] pt-1.5 flex flex-col gap-0.5 text-[9px] text-[#00ff88] font-mono">
            <div>&bull; CLICK TO ACTIVATE BLAST RADIUS</div>
            <div className="text-[#38bdf8]">&bull; DOUBLE-CLICK FOR 2D SATELLITE DRILL-DOWN</div>
          </div>
        </div>
      )}

      {/* Active Selected Chokepoint Banner */}
      {selectedId && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded border border-[#00ff88]/60 bg-[#040806]/95 px-4 py-2 font-mono text-xs text-[#00ff88] shadow-[0_0_16px_rgba(0,255,136,0.25)] backdrop-blur-md">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ff88] animate-ping" />
          <span>
            BLAST RADIUS SURVEILLANCE:{' '}
            <strong className="text-white uppercase">
              {cascadeData?.chokepoints.find((c) => c.id === selectedId)?.name || selectedId}
            </strong>
          </span>
          <button
            onClick={() => {
              const cp = cascadeData?.chokepoints.find((c) => c.id === selectedId);
              if (cp && onDrillDown) {
                onDrillDown({
                  lat: cp.latitude,
                  lon: cp.longitude,
                  title: cp.name,
                  category: cp.category,
                  stress: cp.stress_level,
                });
              }
            }}
            className="rounded border border-[#06b6d4]/50 bg-[#06b6d4]/15 px-2.5 py-1 text-[10px] text-[#38bdf8] hover:bg-[#06b6d4]/25 transition"
          >
            SATELLITE DRILL-DOWN
          </button>
          <button
            onClick={() => setSelectedId(null)}
            className="rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-2.5 py-1 text-[10px] text-[#44ffa2] hover:bg-[#00ff88]/25 transition"
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
}
