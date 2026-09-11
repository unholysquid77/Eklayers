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
const CDN = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets';
const BORDERS_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const COLOR_TACTICAL_GREEN = 0x00ff88;
const COLOR_AMBER = 0xfbbf24;
const COLOR_CRIMSON = 0xff3344;
const COLOR_CYAN = 0x38bdf8;

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

function stressColor(stress: number): THREE.Color {
  if (stress < 0.45) return new THREE.Color(COLOR_TACTICAL_GREEN);
  if (stress < 0.70) return new THREE.Color(COLOR_AMBER);
  return new THREE.Color(COLOR_CRIMSON);
}

function stressHex(stress: number): number {
  if (stress < 0.45) return COLOR_TACTICAL_GREEN;
  if (stress < 0.70) return COLOR_AMBER;
  return COLOR_CRIMSON;
}

/**
 * Builds quadratic bezier arc whose height scales smoothly with distance
 */
function buildArcPoints(src: THREE.Vector3, tgt: THREE.Vector3, severity: number = 0.5): THREE.Vector3[] {
  const dist = src.distanceTo(tgt); // Chord distance (0 to 2.0)
  const arcHeight = Math.min(0.22, Math.max(0.018, dist * 0.18 * (0.6 + severity * 0.4)));
  
  const mid = src.clone().add(tgt).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.025 + arcHeight);
  const curve = new THREE.QuadraticBezierCurve3(src, mid, tgt);
  return curve.getPoints(50);
}

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

export interface HoveredChokepointInfo {
  id: string;
  name: string;
  category: string;
  stress_level: number;
  criticality: number;
  country?: string;
  connectedCount: number;
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
  onFeatureClick?: (feature: { id: string; name: string; kind: string; data: unknown }) => void;
  selectedChokepointId?: string | null;
}

const EMPTY_GROUPS = {
  borders: null as THREE.Group | null,
  chokepoints: null as THREE.Group | null,
  events: null as THREE.Group | null,
  cascadeArcs: null as THREE.Group | null,
  pulseParticles: null as THREE.Points | null,
  vessels: null as THREE.Group | null,
  flights: null as THREE.Group | null,
  shippingLanes: null as THREE.Group | null,
  landRoutes: null as THREE.Group | null,
  infraPoints: null as THREE.Group | null,
  infraLines: null as THREE.Group | null,
  bomArcs: null as THREE.Group | null,
  earthquakes: null as THREE.Group | null,
  stars: null as THREE.Points | null,
  atmosphere: null as THREE.Mesh | null,
  latRings: null as THREE.Group | null,
};

type LayerKey = keyof typeof EMPTY_GROUPS;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SarvadarshiGlobe({
  cascadeData, vessels = [], flights = [], earthquakes,
  infraLayers = {}, shippingLanes, bomArcs = [],
  activeLayers, onFeatureClick, selectedChokepointId: externalSelectedId,
}: SarvadarshiGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<HoveredChokepointInfo | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(externalSelectedId || null);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    globe: THREE.Mesh;
    groups: typeof EMPTY_GROUPS;
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

  // ------------------------------------------------------------------
  // Init Three.js Scene
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020604);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 1000);
    camera.position.set(0, 0, 2.7);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    el.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.15;
    controls.maxDistance = 6.0;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.20;

    // Lights
    scene.add(new THREE.AmbientLight(0xd4f4e2, 0.60));
    const sun = new THREE.DirectionalLight(0xe8faf0, 1.8);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const sun2 = new THREE.DirectionalLight(0x00ff88, 0.4);
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
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x44ffa2, size: 0.12, opacity: 0.6, transparent: true }));
    scene.add(stars);

    // Earth
    const texLoader = new THREE.TextureLoader();
    const earthGeo = new THREE.SphereGeometry(R, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: texLoader.load(`${CDN}/earth_atmos_2048.jpg`),
      specularMap: texLoader.load(`${CDN}/earth_specular_2048.jpg`),
      normalMap: texLoader.load(`${CDN}/earth_normal_2048.jpg`),
      specular: new THREE.Color(0x081a0e),
      shininess: 16,
    });
    const globe = new THREE.Mesh(earthGeo, earthMat);
    scene.add(globe);

    // Atmosphere Glow with depthWrite: false
    const atmMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float d = dot(vNormal, vec3(0.0, 0.0, -1.0));
          float intensity = pow(0.75 - d, 2.5);
          gl_FragColor = vec4(0.0, 1.0, 0.5, intensity * 0.45);
        }`,
    });
    const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 64, 64), atmMat);
    scene.add(atm);

    // Layer groups
    const groups = { ...EMPTY_GROUPS };
    const layerKeys = ['borders','chokepoints','events','cascadeArcs','vessels','flights','shippingLanes','landRoutes','infraPoints','infraLines','bomArcs','earthquakes'] as LayerKey[];
    for (const k of layerKeys) {
      const g = new THREE.Group();
      g.name = k;
      scene.add(g);
      (groups as Record<string, unknown>)[k] = g;
    }
    (groups as Record<string, unknown>).stars = stars;
    (groups as Record<string, unknown>).atmosphere = atm;

    const cpMeshMap = new Map<string, { group: THREE.Group; head: THREE.Mesh; ring: THREE.Mesh; beacon: THREE.Mesh; data: any }>();
    const arcMeshList: { line: THREE.Line; fromId: string; toId: string; severity: number; curve: THREE.QuadraticBezierCurve3 }[] = [];

    // Raycaster for Hover and Click
    const raycaster = new THREE.Raycaster();
    raycaster.params.Mesh = { threshold: 0.02 };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);

      const heads = Array.from(cpMeshMap.values()).map(c => c.head);
      const hits = raycaster.intersectObjects(heads, false);

      if (hits.length > 0) {
        const hit = hits[0];
        for (const [id, entry] of cpMeshMap.entries()) {
          if (entry.head === hit.object) {
            let connected = 0;
            arcMeshList.forEach(a => {
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
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);

      const heads = Array.from(cpMeshMap.values()).map(c => c.head);
      const hits = raycaster.intersectObjects(heads, false);

      if (hits.length > 0) {
        const hit = hits[0];
        for (const [id, entry] of cpMeshMap.entries()) {
          if (entry.head === hit.object) {
            const nextId = selectedId === id ? null : id;
            setSelectedId(nextId);
            if (onFeatureClick) {
              onFeatureClick({ id: entry.data.id, name: entry.data.name, kind: 'chokepoint', data: entry.data });
            }
            return;
          }
        }
      } else {
        setSelectedId(null);
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    const clock = new THREE.Clock();

    // Animation Loop with Pulsating Ring & Particle Flow
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Pulsate Chokepoint Rings
      for (const entry of cpMeshMap.values()) {
        const scale = 1.0 + 0.25 * Math.sin(t * 3.0 + entry.data.stress_level * 5.0);
        entry.ring.scale.set(scale, scale, 1);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = { renderer, scene, camera, controls, globe, groups, cpMeshMap, arcMeshList, animId, clock };

    // Country Borders in Tactical Green
    fetch(BORDERS_URL)
      .then(r => r.json())
      .then((gj) => {
        if (!sceneRef.current) return;
        const g = sceneRef.current.groups.borders as THREE.Group;
        const mat = new THREE.LineBasicMaterial({ color: COLOR_TACTICAL_GREEN, opacity: 0.32, transparent: true });
        for (const feat of (gj as { features: { geometry: { type: string; coordinates: unknown[] } }[] }).features) {
          const geom = feat.geometry;
          const rings = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
          for (const poly of rings as number[][][][]) {
            for (const ring of poly) {
              const pts = ring.map(([lon, lat]: number[]) => latLonToVec3(lat, lon, R * 1.002));
              g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
            }
          }
        }
      }).catch(() => {});

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.dispose();
      el.removeChild(renderer.domElement);
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
    const g = groups as Record<string, THREE.Object3D | null>;
    if (g.borders)       g.borders.visible       = activeLayers.countryBorders;
    if (g.chokepoints)   g.chokepoints.visible   = activeLayers.chokepointPins;
    if (g.events)        g.events.visible        = activeLayers.eventDots;
    if (g.cascadeArcs)   g.cascadeArcs.visible   = activeLayers.cascadeArcs;
    if (g.vessels)       g.vessels.visible       = activeLayers.vessels;
    if (g.flights)       g.flights.visible       = activeLayers.flights;
    if (g.shippingLanes) g.shippingLanes.visible = activeLayers.shippingLanes;
    if (g.landRoutes)    g.landRoutes.visible    = activeLayers.landRoutes;
    if (g.bomArcs)       g.bomArcs.visible       = activeLayers.bomArcs;
    if (g.earthquakes)   g.earthquakes.visible   = activeLayers.earthquakes;
  }, [activeLayers]);

  // ------------------------------------------------------------------
  // Render High-Visibility 3D Pins and Cascade Arcs
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

    // 1. Render Chokepoints (3D Upright Beacon + Glowing Head + Surface Ring)
    for (const cp of data.chokepoints) {
      if (cp.latitude == null || cp.longitude == null) continue;
      
      const posSurface = latLonToVec3(cp.latitude, cp.longitude, R * 1.002);
      const posHead = latLonToVec3(cp.latitude, cp.longitude, R * 1.026);
      const color = stressColor(cp.stress_level);

      const nodeGroup = new THREE.Group();

      // Glowing Head Marker (Radius 0.016)
      const headGeo = new THREE.SphereGeometry(0.016, 12, 12);
      const headMat = new THREE.MeshBasicMaterial({ color, depthTest: true });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.copy(posHead);
      nodeGroup.add(head);

      // Vertical Upright Beacon Pillar from surface to head
      const beaconGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.024, 6);
      const beaconMat = new THREE.MeshBasicMaterial({ color, opacity: 0.85, transparent: true });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.copy(posSurface.clone().add(posHead).multiplyScalar(0.5));
      beacon.lookAt(new THREE.Vector3(0, 0, 0));
      beacon.rotateX(Math.PI / 2);
      nodeGroup.add(beacon);

      // Pulsating Radar Surface Ring (Radius 0.035)
      const ringGeo = new THREE.RingGeometry(0.020, 0.034, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.55,
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

    // 2. Render Events as Pulsing Hazard Dots
    for (const ev of data.events) {
      if (ev.latitude == null || ev.longitude == null) continue;
      const pos = latLonToVec3(ev.latitude, ev.longitude, R * 1.018);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.010, 8, 8),
        new THREE.MeshBasicMaterial({ color: ev.severity > 0.6 ? COLOR_CRIMSON : COLOR_AMBER }),
      );
      dot.position.copy(pos);
      evGroup.add(dot);
    }

    // 3. Render Vibrant Glowing Cascade Arcs
    const cpById = Object.fromEntries(data.chokepoints.map(c => [c.id, c]));
    
    // Normalization helper
    const findCoord = (id: string) => {
      if (cpById[id]) return { lat: cpById[id].latitude, lon: cpById[id].longitude };
      const raw = id.toLowerCase().replace(/^(cp\.|cp\.auto_|cp\.user_)/, '');
      const found = data.chokepoints.find(c => {
        const cRaw = c.id.toLowerCase().replace(/^(cp\.|cp\.auto_|cp\.user_)/, '');
        return cRaw === raw || c.name.toLowerCase().includes(raw);
      });
      if (found) return { lat: found.latitude, lon: found.longitude };
      const foundEv = data.events.find(e => e.id === id);
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

      const srcVec = latLonToVec3(srcLat, srcLon, R * 1.026);
      const tgtVec = latLonToVec3(tgtLat, tgtLon, R * 1.026);

      const pts = buildArcPoints(srcVec, tgtVec, edge.severity);
      const color = stressColor(edge.severity);

      // Arc Line
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
      const arcHeight = Math.min(0.22, Math.max(0.018, dist * 0.18 * (0.6 + edge.severity * 0.4)));
      const mid = srcVec.clone().add(tgtVec).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.026 + arcHeight);
      const curve = new THREE.QuadraticBezierCurve3(srcVec, mid, tgtVec);

      arcMeshList.push({
        line,
        fromId: edge.from_chokepoint,
        toId: edge.to_entity_id,
        severity: edge.severity,
        curve,
      });
    }

    // 4. Render BOM Arcs if available
    if (bomArcs && bomArcs.length > 0) {
      for (const bArc of bomArcs) {
        if (!bArc.source || !bArc.target || bArc.source.lat == null || bArc.source.lon == null || bArc.target.lat == null || bArc.target.lon == null) continue;
        const srcVec = latLonToVec3(bArc.source.lat, bArc.source.lon, R * 1.026);
        const tgtVec = latLonToVec3(bArc.target.lat, bArc.target.lon, R * 1.026);
        const pts = buildArcPoints(srcVec, tgtVec, 0.4);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x00ff88,
          opacity: 0.65,
          transparent: true,
          depthWrite: false,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        arcGroup.add(line);
      }
    }
  }, [cascadeData, bomArcs]);

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
        (entry.head.material as THREE.MeshBasicMaterial).transparent = false;
        (entry.beacon.material as THREE.MeshBasicMaterial).opacity = 0.85;
        (entry.ring.material as THREE.MeshBasicMaterial).opacity = 0.55;
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
      hMat.transparent = true;

      if (isSelected) {
        hMat.opacity = 1.0;
        hMat.color = new THREE.Color(COLOR_TACTICAL_GREEN);
        entry.head.scale.set(2.4, 2.4, 2.4);
        rMat.opacity = 1.0;
        entry.ring.scale.set(1.8, 1.8, 1);
      } else if (isConnected) {
        hMat.opacity = 0.95;
        hMat.color = stressColor(entry.data.stress_level);
        entry.head.scale.set(1.6, 1.6, 1.6);
        rMat.opacity = 0.75;
      } else {
        hMat.opacity = 0.12;
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

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full select-none" />

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
              <span className={hoverInfo.stress_level > 0.6 ? 'text-red-400 font-bold' : hoverInfo.stress_level > 0.4 ? 'text-amber-400 font-bold' : 'text-[#00ff88] font-bold'}>
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
          <div className="mt-1.5 border-t border-[#143a22] pt-1 text-[10px] text-[#00ff88] font-mono">
            CLICK TO ACTIVATE BLAST RADIUS
          </div>
        </div>
      )}

      {/* Active Selected Chokepoint Banner */}
      {selectedId && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3 rounded border border-[#00ff88]/60 bg-[#040806]/95 px-4 py-2 font-mono text-xs text-[#00ff88] shadow-[0_0_16px_rgba(0,255,136,0.25)] backdrop-blur-md">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ff88] animate-ping" />
          <span>BLAST RADIUS SURVEILLANCE: <strong className="text-white uppercase">{cascadeData?.chokepoints.find(c => c.id === selectedId)?.name || selectedId}</strong></span>
          <button
            onClick={() => setSelectedId(null)}
            className="ml-3 rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-2.5 py-1 text-[10px] text-[#44ffa2] hover:bg-[#00ff88]/25 transition"
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
}
