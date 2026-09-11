'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  CascadeMap, Vessel, Flight, RelationArc,
  ShippingLane, GeoFeatureCollection, LayerVisibility,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const R = 1.0; // Globe radius
const CDN = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets';
const BORDERS_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const ARC_LABEL_COLORS: Record<string, number> = {
  disrupts:     0xff3333,
  blocks:       0xff8800,
  affects:      0xffcc00,
  amplifies:    0xff00ff,
  supplies:     0x00ccff,
  corroborates: 0x88ff88,
};
const VESSEL_COLORS: Record<string, number> = {
  cargo:     0x4488ff,
  tanker:    0xffaa00,
  passenger: 0x44ff88,
  fishing:   0xffffff,
  mil:       0xff4444,
};
const INFRA_COLORS: Record<string, number> = {
  port:              0x00ccff,
  airport:           0xffffff,
  warehouse:         0xffcc44,
  refinery:          0xff8800,
  lng_terminal:      0x00ffcc,
  storage:           0xaaaaaa,
  economic_center:   0xffd700,
  data_center:       0x44ffff,
  nuclear_site:      0xff44ff,
  military_base:     0xff4444,
  spaceport:         0xccccff,
};
const LINE_COLORS: Record<string, number> = {
  pipeline:      0xffaa00,
  power_line:    0xffff00,
  undersea_cable:0x00ccff,
  land_route:    0x88ff44,
};

// ---------------------------------------------------------------------------
// Helpers
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
  if (stress < 0.3) return new THREE.Color(0x44ff88);
  if (stress < 0.6) return new THREE.Color(0xffcc00);
  return new THREE.Color(0xff3333);
}

function buildArcPoints(src: THREE.Vector3, tgt: THREE.Vector3, height = 0.35): THREE.Vector3[] {
  const mid = src.clone().add(tgt).multiplyScalar(0.5).normalize().multiplyScalar(R + height);
  const curve = new THREE.QuadraticBezierCurve3(src, mid, tgt);
  return curve.getPoints(48);
}

function buildLineFromCoords(coords: [number, number][], r = R): THREE.BufferGeometry {
  const pts = coords.map(([lon, lat]) => latLonToVec3(lat, lon, r * 1.002));
  return new THREE.BufferGeometry().setFromPoints(pts);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
}

type LayerKey = keyof typeof EMPTY_GROUPS;
const EMPTY_GROUPS = {
  borders: null as THREE.Group | null,
  chokepoints: null as THREE.Group | null,
  events: null as THREE.Group | null,
  cascadeArcs: null as THREE.Group | null,
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SarvadarshiGlobe({
  cascadeData, vessels = [], flights = [], earthquakes,
  infraLayers = {}, shippingLanes, bomArcs = [],
  activeLayers, onFeatureClick,
}: SarvadarshiGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    globe: THREE.Mesh;
    groups: typeof EMPTY_GROUPS;
    clickables: { mesh: THREE.Object3D; data: unknown }[];
    animId: number;
  } | null>(null);

  // ------------------------------------------------------------------
  // Init Three.js scene
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020408);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 1000);
    camera.position.set(0, 0, 2.8);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(5, 3, 5);
    scene.add(sun);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    for (let i = 0; i < 1800; i++) {
      const r = 80 + Math.random() * 40;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPositions.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }));
    scene.add(stars);

    // Earth
    const texLoader = new THREE.TextureLoader();
    const earthGeo = new THREE.SphereGeometry(R, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: texLoader.load(`${CDN}/earth_atmos_2048.jpg`),
      specularMap: texLoader.load(`${CDN}/earth_specular_2048.jpg`),
      normalMap: texLoader.load(`${CDN}/earth_normal_2048.jpg`),
      specular: new THREE.Color(0x112244),
      shininess: 18,
    });
    const globe = new THREE.Mesh(earthGeo, earthMat);
    scene.add(globe);

    // Atmosphere
    const atmMat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float d = abs(dot(vNormal, vec3(0,0,1)));
          float ring = pow(1.0 - d, 4.0);
          gl_FragColor = vec4(0.1,0.4,1.0,ring * 0.5);
        }`,
    });
    const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 64, 64), atmMat);
    scene.add(atm);

    // Latitude rings
    const latRings = new THREE.Group();
    for (const lat of [0, 23.5, -23.5, 66.5, -66.5]) {
      const pts: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 2) pts.push(latLonToVec3(lat, lon - 180, R * 1.001));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: lat === 0 ? 0x334455 : 0x223344, opacity: 0.3, transparent: true });
      latRings.add(new THREE.Line(geo, mat));
    }
    scene.add(latRings);

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
    (groups as Record<string, unknown>).latRings = latRings;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const clickables: { mesh: THREE.Object3D; data: unknown }[] = [];
    renderer.domElement.addEventListener('click', (e) => {
      if (!onFeatureClick) return;
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickables.map(c => c.mesh), true);
      if (hits.length > 0) {
        const hit = hits[0];
        const entry = clickables.find(c => c.mesh === hit.object || c.mesh.getObjectById(hit.object.id));
        if (entry) onFeatureClick(entry.data as Parameters<NonNullable<typeof onFeatureClick>>[0]);
      }
    });

    // Animation loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = { renderer, scene, camera, controls, globe, groups, clickables, animId };

    // Country borders
    fetch(BORDERS_URL)
      .then(r => r.json())
      .then((gj) => {
        if (!sceneRef.current) return;
        const g = sceneRef.current.groups.borders as THREE.Group;
        const mat = new THREE.LineBasicMaterial({ color: 0x334455, opacity: 0.5, transparent: true });
        for (const feat of (gj as { features: { geometry: { type: string; coordinates: unknown[] } }[] }).features) {
          const geom = feat.geometry;
          const rings = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
          for (const poly of rings as number[][][][]) {
            for (const ring of poly) {
              const pts = ring.map(([lon, lat]: number[]) => latLonToVec3(lat, lon, R * 1.001));
              g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
            }
          }
        }
      }).catch(() => { /* CDN may fail silently */ });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  // Layer visibility effect
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { groups } = ref;
    const g = groups as Record<string, THREE.Object3D | null>;
    if (g.borders)      g.borders.visible      = activeLayers.countryBorders;
    if (g.chokepoints)  g.chokepoints.visible  = activeLayers.chokepointPins;
    if (g.events)       g.events.visible       = activeLayers.eventDots;
    if (g.cascadeArcs)  g.cascadeArcs.visible  = activeLayers.cascadeArcs;
    if (g.vessels)      g.vessels.visible      = activeLayers.vessels;
    if (g.flights)      g.flights.visible      = activeLayers.flights;
    if (g.shippingLanes) g.shippingLanes.visible = activeLayers.shippingLanes;
    if (g.landRoutes)   g.landRoutes.visible   = activeLayers.landRoutes;
    if (g.bomArcs)      g.bomArcs.visible      = activeLayers.bomArcs;
    if (g.earthquakes)  g.earthquakes.visible  = activeLayers.earthquakes;
    // infraPoints/infraLines toggled individually via feature kind
  }, [activeLayers]);

  // ------------------------------------------------------------------
  // Cascade data (chokepoints + events + impact arcs)
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !cascadeData) return;
    const { groups, clickables } = ref;
    const cpGroup = groups.chokepoints as THREE.Group;
    const evGroup = groups.events as THREE.Group;
    const arcGroup = groups.cascadeArcs as THREE.Group;
    cpGroup.clear(); evGroup.clear(); arcGroup.clear();
    clickables.length = 0;

    // Chokepoints
    for (const cp of cascadeData.chokepoints) {
      if (!cp.latitude && !cp.longitude) continue;
      const pos = latLonToVec3(cp.latitude, cp.longitude, R * 1.003);
      const color = stressColor(cp.stress_level);
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.002, 0.022, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
      pin.position.copy(pos);
      pin.lookAt(new THREE.Vector3(0,0,0));
      pin.rotateX(Math.PI / 2);
      cpGroup.add(pin);
      clickables.push({ mesh: pin, data: { id: cp.id, name: cp.name, kind: 'chokepoint', data: cp } });

      // Halo for high stress
      if (cp.stress_level > 0.5) {
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.01, 0.018, 16),
          new THREE.MeshBasicMaterial({ color, opacity: 0.35, transparent: true, side: THREE.DoubleSide }),
        );
        halo.position.copy(pos.clone().multiplyScalar(1.002));
        halo.lookAt(new THREE.Vector3(0,0,0));
        cpGroup.add(halo);
      }
    }

    // Events
    for (const ev of cascadeData.events) {
      const pos = latLonToVec3(ev.latitude, ev.longitude, R * 1.003);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.004, 6, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(ev.severity * 0.3, 1, 0.6) }),
      );
      dot.position.copy(pos);
      evGroup.add(dot);
    }

    // Impact arcs
    const cpById = Object.fromEntries(cascadeData.chokepoints.map(c => [c.id, c]));
    for (const edge of cascadeData.impact_edges) {
      const src = cpById[edge.from_chokepoint];
      if (!src) continue;
      const tgt = cascadeData.chokepoints.find(c => c.id === edge.to_entity_id)
        || cascadeData.events.find(e => e.id === edge.to_entity_id);
      if (!tgt) continue;
      const tgtLat = 'latitude' in tgt ? tgt.latitude : 0;
      const tgtLon = 'longitude' in tgt ? tgt.longitude : 0;
      const pts = buildArcPoints(
        latLonToVec3(src.latitude, src.longitude),
        latLonToVec3(tgtLat, tgtLon),
        0.3 + edge.severity * 0.2,
      );
      const color = stressColor(edge.severity);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, opacity: 0.5 + edge.severity * 0.4, transparent: true }),
      );
      arcGroup.add(line);
    }
  }, [cascadeData]);

  // ------------------------------------------------------------------
  // Vessels
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const g = groups_of(ref, 'vessels');
    g.clear();
    for (const v of vessels) {
      const pos = latLonToVec3(v.lat, v.lon, R * 1.003);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.003, 4, 4),
        new THREE.MeshBasicMaterial({ color: VESSEL_COLORS[v.bucket] ?? 0xffffff }),
      );
      dot.position.copy(pos);
      g.add(dot);
    }
  }, [vessels]);

  // ------------------------------------------------------------------
  // Flights
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const g = groups_of(ref, 'flights');
    g.clear();
    const positions: number[] = [];
    for (const f of flights) {
      if (f.on_ground) continue;
      const pos = latLonToVec3(f.lat, f.lon, R * 1.006 + (f.alt_m / 40000) * 0.04);
      positions.push(pos.x, pos.y, pos.z);
    }
    if (positions.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.003 })));
    }
  }, [flights]);

  // ------------------------------------------------------------------
  // Shipping lanes
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !shippingLanes) return;
    const g = groups_of(ref, 'shippingLanes');
    g.clear();
    for (const feat of shippingLanes.features) {
      const stress = feat.properties.stress ?? feat.properties.baseline_stress ?? 0.2;
      const geo = buildLineFromCoords(feat.geometry.coordinates);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: stressColor(stress as number),
        opacity: 0.55,
        transparent: true,
      }));
      g.add(line);
    }
  }, [shippingLanes]);

  // ------------------------------------------------------------------
  // Infrastructure layers (points + lines)
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const ptGroup = groups_of(ref, 'infraPoints');
    const lnGroup = groups_of(ref, 'infraLines');
    ptGroup.clear();
    lnGroup.clear();

    const pointKinds = new Set(['port','airport','warehouse','refinery','lng_terminal','storage','economic_center','data_center','nuclear_site','military_base','spaceport']);
    const lineKinds  = new Set(['pipeline','power_line','undersea_cable','land_route']);

    for (const [layerName, fc] of Object.entries(infraLayers)) {
      if (!fc) continue;
      for (const feat of fc.features) {
        const props = feat.properties as Record<string, unknown>;
        const kind  = (props.kind as string) || layerName;
        const geomType = feat.geometry.type;

        if (geomType === 'Point' && pointKinds.has(kind)) {
          const [lon, lat] = feat.geometry.coordinates as [number, number];
          const pos = latLonToVec3(lat, lon, R * 1.003);
          const color = INFRA_COLORS[kind] ?? 0xffffff;
          // Visible toggle by kind
          const visible = isInfraVisible(kind, activeLayers);
          const dot = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.006, 0),
            new THREE.MeshBasicMaterial({ color }),
          );
          dot.position.copy(pos);
          dot.visible = visible;
          dot.userData = { kind };
          ptGroup.add(dot);
          ref.clickables.push({ mesh: dot, data: { id: props.id as string, name: props.name as string, kind, data: props } });
        }

        if ((geomType === 'LineString') && lineKinds.has(kind)) {
          const coords = feat.geometry.coordinates as [number, number][];
          const color = LINE_COLORS[kind] ?? 0xffffff;
          const visible = isInfraVisible(kind, activeLayers);
          const line = new THREE.Line(
            buildLineFromCoords(coords),
            new THREE.LineBasicMaterial({ color, opacity: 0.5, transparent: true }),
          );
          line.userData = { kind };
          line.visible = visible;
          lnGroup.add(line);
        }
      }
    }
  }, [infraLayers]);

  // Update infra visibility when activeLayers changes
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const update = (g: THREE.Group) => {
      g.traverse(obj => {
        const kind = obj.userData?.kind as string;
        if (kind) obj.visible = isInfraVisible(kind, activeLayers);
      });
    };
    update(groups_of(ref, 'infraPoints'));
    update(groups_of(ref, 'infraLines'));
  }, [activeLayers]);

  // ------------------------------------------------------------------
  // BOM / ontology arcs
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const g = groups_of(ref, 'bomArcs');
    g.clear();
    for (const arc of bomArcs) {
      const src = latLonToVec3(arc.source.lat, arc.source.lon);
      const tgt = latLonToVec3(arc.target.lat, arc.target.lon);
      const pts = buildArcPoints(src, tgt, 0.25 + arc.severity * 0.15);
      const color = ARC_LABEL_COLORS[arc.label] ?? 0x88aaff;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, opacity: 0.35 + arc.severity * 0.5, transparent: true }),
      );
      g.add(line);
    }
  }, [bomArcs]);

  // ------------------------------------------------------------------
  // Earthquakes
  // ------------------------------------------------------------------
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || !earthquakes) return;
    const g = groups_of(ref, 'earthquakes');
    g.clear();
    for (const feat of earthquakes.features) {
      const coords = feat.geometry.coordinates as [number, number, number];
      const mag = (feat.properties as Record<string, number>).mag ?? 1;
      const pos = latLonToVec3(coords[1], coords[0], R * 1.002);
      const size = Math.max(0.003, Math.min(0.02, mag * 0.003));
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 5, 5),
        new THREE.MeshBasicMaterial({ color: 0xff44aa, opacity: 0.7, transparent: true }),
      );
      dot.position.copy(pos);
      g.add(dot);
    }
  }, [earthquakes]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function groups_of(ref: { groups: unknown }, key: string): THREE.Group {
  return (ref.groups as Record<string, THREE.Group>)[key]!;
}

function isInfraVisible(kind: string, lv: LayerVisibility): boolean {
  const map: Record<string, keyof LayerVisibility> = {
    port:           'ports',
    airport:        'airports',
    warehouse:      'warehouses',
    refinery:       'refineries',
    lng_terminal:   'lngTerminals',
    storage:        'storageFacilities',
    economic_center:'economicCenters',
    data_center:    'dataCenters',
    nuclear_site:   'nuclearSites',
    military_base:  'militaryBases',
    spaceport:      'spaceports',
    pipeline:       'pipelines',
    power_line:     'powerLines',
    undersea_cable: 'underseaCables',
    land_route:     'landRoutes',
  };
  const key = map[kind];
  return key ? lv[key] as boolean : true;
}
