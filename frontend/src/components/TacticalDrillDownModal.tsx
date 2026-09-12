'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  X,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Ship,
  Plane,
  AlertTriangle,
  Filter,
  Crosshair,
} from 'lucide-react';
import type {
  CascadeMap,
  Vessel,
  Flight,
  GeoFeatureCollection,
  ShippingLane,
} from '@/lib/contracts';

export interface TacticalDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lon: number;
  title: string;
  category?: string;
  stress?: number;
  details?: Record<string, unknown>;
  cascadeData?: CascadeMap | null;
  vessels?: Vessel[];
  flights?: Flight[];
  infraLayers?: Partial<Record<string, GeoFeatureCollection>>;
  shippingLanes?: { type: string; features: ShippingLane[] } | null;
  customSupplyChains?: any[];
}

interface InspectedEntity {
  type: 'chokepoint' | 'vessel' | 'flight' | 'refinery' | 'lng' | 'datacenter' | 'port' | 'airport' | 'chain';
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lon: number;
  status?: string;
  stress?: number;
  metrics: { label: string; value: string; highlight?: boolean }[];
  anomalies?: string[];
  raw?: any;
}

// Helper to safely split polylines across the international date line (anti-meridian)
// Prevents horizontal wrap-around chords spanning the entire world in 2D Leaflet
function splitAntimeridianSegments(points: [number, number][]): [number, number][][] {
  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (currentSegment.length === 0) {
      currentSegment.push(pt);
      continue;
    }
    const prev = currentSegment[currentSegment.length - 1];
    const lonDiff = pt[1] - prev[1];
    if (Math.abs(lonDiff) > 180) {
      const sign = lonDiff > 0 ? -1 : 1;
      const midLat = (prev[0] + pt[0]) / 2;
      currentSegment.push([midLat, sign > 0 ? 180 : -180]);
      segments.push(currentSegment);
      currentSegment = [[midLat, sign > 0 ? -180 : 180], pt];
    } else {
      currentSegment.push(pt);
    }
  }
  if (currentSegment.length > 0) segments.push(currentSegment);
  return segments;
}

export default function TacticalDrillDownModal({
  isOpen,
  onClose,
  lat,
  lon,
  title,
  category = 'Strategic Maritime Chokepoint',
  stress = 0.5,
  details = {},
  cascadeData,
  vessels = [],
  flights = [],
  infraLayers = {},
  shippingLanes,
  customSupplyChains = [],
}: TacticalDrillDownModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupsRef = useRef<{ [key: string]: any }>({});
  
  // Basemap switcher: ESRI Dark (default, zero watermark), OSM Tactical (inverted dark), ESRI Satellite
  const [mapType, setMapType] = useState<'esri_dark' | 'osm_tactical' | 'satellite'>('esri_dark');
  const [zoomLevel, setZoomLevel] = useState<number>(12);
  const [inspectedEntity, setInspectedEntity] = useState<InspectedEntity | null>(null);

  // In-modal Layer Visibility Toggles
  const [visibleLayers, setVisibleLayers] = useState({
    chokepoints: true,
    vessels: true,
    flights: true,
    infra: true,
    shippingLanes: true,
    customChains: true,
    rangeRings: true,
  });

  const toggleModalLayer = (key: keyof typeof visibleLayers) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Count anomalies
  const anomalyCount = useMemo(() => {
    return vessels.filter((v) => (v as any).is_anomaly).length;
  }, [vessels]);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isCancelled = false;

    const initMap = async () => {
      // 1. Ensure Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // 2. Ensure Leaflet JS
      if (!(window as any).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      if (isCancelled || !mapContainerRef.current) return;
      const L = (window as any).L;
      if (!L) return;

      // Clean up previous instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize map centered on lat, lon
      const map = L.map(mapContainerRef.current, {
        center: [lat, lon],
        zoom: 12,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
      });

      // 100% Watermark-Free & Public Domain Basemaps
      // 1. ESRI World Dark Gray Canvas (Default)
      const esriDarkLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16,
        }
      );

      // 2. OpenStreetMap High-Res Vector with Inverted Dark Tactical Filter
      const osmTacticalLayer = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
          className: 'tactical-osm-tiles',
        }
      );

      // 3. ESRI Satellite
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 18,
        }
      );

      if (mapType === 'esri_dark') esriDarkLayer.addTo(map);
      else if (mapType === 'osm_tactical') osmTacticalLayer.addTo(map);
      else satelliteLayer.addTo(map);

      // Create Layer Groups
      const lgRings = L.layerGroup().addTo(map);
      const lgLanes = L.layerGroup().addTo(map);
      const lgChains = L.layerGroup().addTo(map);
      const lgInfra = L.layerGroup().addTo(map);
      const lgVessels = L.layerGroup().addTo(map);
      const lgFlights = L.layerGroup().addTo(map);
      const lgChokepoints = L.layerGroup().addTo(map);
      const lgTarget = L.layerGroup().addTo(map);

      layerGroupsRef.current = {
        rings: lgRings,
        lanes: lgLanes,
        chains: lgChains,
        infra: lgInfra,
        vessels: lgVessels,
        flights: lgFlights,
        chokepoints: lgChokepoints,
        target: lgTarget,
      };

      // 1. Target Reticle (Brutalist Squared Crosshair)
      const targetIcon = L.divIcon({
        className: 'drilldown-target-icon',
        html: `
          <div style="position:relative; width:56px; height:56px; transform:translate(-50%, -50%); pointer-events:none;">
            <div style="position:absolute; inset:0; border:1.5px solid #00e676; opacity:0.85;"></div>
            <div style="position:absolute; inset:8px; border:1px dashed #00e676; background:rgba(0,230,118,0.06);"></div>
            <div style="position:absolute; top:27px; left:0; right:0; height:1px; background:#00e676;"></div>
            <div style="position:absolute; left:27px; top:0; bottom:0; width:1px; background:#00e676;"></div>
            <div style="position:absolute; top:32px; left:32px; background:#000000; border:1px solid #00e676; color:#00e676; font-family:monospace; font-size:9px; font-weight:bold; padding:1px 5px; white-space:nowrap;">
              TARGET: ${title}
            </div>
          </div>
        `,
        iconSize: [56, 56],
      });
      L.marker([lat, lon], { icon: targetIcon }).addTo(lgTarget);

      // Scale-Adaptive Range Rings Function (15 km harbor buffer, 35 km seaway perimeter)
      // Adapts visual diameter when zoomed out so rings never vanish into sub-pixel specks
      const renderBufferRings = (curZoom: number) => {
        if (lgRings && typeof lgRings.clearLayers === 'function') {
          lgRings.clearLayers();
        }

        const scaleFactor = curZoom >= 8 ? 1 : Math.pow(2, 8 - curZoom);
        const rInner = 15000 * scaleFactor;
        const rMid = 35000 * scaleFactor;
        const rOuter = 75000 * scaleFactor;

        // 15 km Inner Tactical Buffer (Green)
        L.circle([lat, lon], {
          radius: rInner,
          color: '#00e676',
          weight: 1.5,
          dashArray: '4, 8',
          fillColor: '#00e676',
          fillOpacity: 0.05,
        }).addTo(lgRings);

        // 35 km Outer Approach Zone (Amber)
        L.circle([lat, lon], {
          radius: rMid,
          color: '#f59e0b',
          weight: 1.5,
          dashArray: '3, 9',
          fillColor: 'transparent',
        }).addTo(lgRings);

        // 75 km Surveillance Perimeter (Cyan)
        L.circle([lat, lon], {
          radius: rOuter,
          color: '#38bdf8',
          weight: 1,
          dashArray: '2, 10',
          fillColor: 'transparent',
          opacity: 0.45,
        }).addTo(lgRings);

        // Distance Labels
        const latDeltaInner = rInner / 111320;
        const latDeltaMid = rMid / 111320;

        const innerLabelIcon = L.divIcon({
          className: 'tactical-range-label',
          html: `
            <div style="transform:translate(-50%, -50%); background:#000000; border:1px solid #00e676; color:#00e676; font-size:9px; font-family:monospace; font-weight:bold; padding:1px 5px; white-space:nowrap; pointer-events:none;">
              15 KM HARBOR DEFENSE BUFFER ${curZoom < 8 ? '[ADAPTED]' : ''}
            </div>
          `,
          iconSize: [160, 18],
        });
        L.marker([lat + latDeltaInner, lon], { icon: innerLabelIcon }).addTo(lgRings);

        const midLabelIcon = L.divIcon({
          className: 'tactical-range-label',
          html: `
            <div style="transform:translate(-50%, -50%); background:#000000; border:1px solid #f59e0b; color:#f59e0b; font-size:9px; font-family:monospace; font-weight:bold; padding:1px 5px; white-space:nowrap; pointer-events:none;">
              35 KM SEAWAY APPROACH PERIMETER ${curZoom < 8 ? '[ADAPTED]' : ''}
            </div>
          `,
          iconSize: [180, 18],
        });
        L.marker([lat + latDeltaMid, lon], { icon: midLabelIcon }).addTo(lgRings);

        // Cardinal Radar Crosshairs
        const outerDeg = rOuter / 111320;
        const lonDeg = outerDeg / Math.cos((lat * Math.PI) / 180 || 1);
        L.polyline([[lat - outerDeg * 1.2, lon], [lat + outerDeg * 1.2, lon]], {
          color: '#00e676',
          weight: 1,
          opacity: 0.3,
          dashArray: '2, 6',
        }).addTo(lgRings);
        L.polyline([[lat, lon - lonDeg * 1.2], [lat, lon + lonDeg * 1.2]], {
          color: '#00e676',
          weight: 1,
          opacity: 0.3,
          dashArray: '2, 6',
        }).addTo(lgRings);
      };

      renderBufferRings(map.getZoom());

      // 2. Shipping Corridors (Safe multi-segment rendering without dateline cuts)
      if (shippingLanes && shippingLanes.features) {
        shippingLanes.features.forEach((lane) => {
          if (lane.geometry && lane.geometry.coordinates) {
            const rawLatLngs = lane.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
            const safeSegments = splitAntimeridianSegments(rawLatLngs);
            safeSegments.forEach((seg) => {
              L.polyline(seg, {
                color: '#00e676',
                weight: 2,
                opacity: 0.60,
                dashArray: '6, 6',
              }).addTo(lgLanes);
            });
          }
        });
      }

      // 3. Custom Enterprise 3PL Chains (Accurate Maritime Waypoints)
      customSupplyChains.forEach((chain) => {
        const pts: [number, number][] = [];
        if (chain.origin && chain.origin.lat) pts.push([chain.origin.lat, chain.origin.lon]);
        if (chain.intermediate_hubs) {
          chain.intermediate_hubs.forEach((h: any) => {
            if (h.lat && h.lon) pts.push([h.lat, h.lon]);
          });
        }
        if (chain.destination && chain.destination.lat) pts.push([chain.destination.lat, chain.destination.lon]);

        if (pts.length > 1) {
          const segs = splitAntimeridianSegments(pts);
          segs.forEach((seg) => {
            const poly = L.polyline(seg, {
              color: '#38bdf8',
              weight: 3,
              opacity: 0.90,
              dashArray: '8, 8',
            }).addTo(lgChains);

            poly.on('click', () => {
              setInspectedEntity({
                type: 'chain',
                id: chain.id,
                title: chain.name,
                subtitle: `3PL Partner: ${chain.partner_3pl || 'Enterprise Logistics'}`,
                lat: pts[0][0],
                lon: pts[0][1],
                status: chain.status || 'ACTIVE',
                stress: chain.stress_score || 0.5,
                metrics: [
                  { label: 'Priority', value: chain.priority || 'CRITICAL', highlight: true },
                  { label: 'Carrier / 3PL', value: chain.partner_3pl || 'Ocean Network' },
                  { label: 'SKU Carried', value: chain.sku_carried || 'Automotive Controller' },
                  { label: 'Transit Days', value: `${chain.transit_days || 18} days` },
                ],
                raw: chain,
              });
            });
          });

          // Draw clickable Waypoint pins along the custom supply chain
          if (chain.intermediate_hubs) {
            chain.intermediate_hubs.forEach((h: any) => {
              if (!h.lat || !h.lon) return;
              const hubIcon = L.divIcon({
                className: 'hub-marker',
                html: `
                  <div style="width:10px; height:10px; background:#000000; border:1.5px solid #38bdf8; transform:rotate(45deg); cursor:pointer;" title="${h.name}"></div>
                `,
                iconSize: [10, 10],
              });
              const m = L.marker([h.lat, h.lon], { icon: hubIcon }).addTo(lgChains);
              m.bindTooltip(`<b>${h.name}</b><br/><span style="color:#38bdf8; font-family:monospace; font-size:10px;">3PL WAYPOINT: ${chain.partner_3pl || 'Enterprise'}</span>`, {
                direction: 'top',
                className: 'tactical-tooltip',
              });
            });
          }
        }
      });

      // 4. Chokepoints
      if (cascadeData && cascadeData.chokepoints) {
        cascadeData.chokepoints.forEach((cp) => {
          const cpLat = cp.latitude ?? (cp as any).lat ?? 0;
          const cpLon = cp.longitude ?? (cp as any).lon ?? 0;
          const cpId = cp.id ?? (cp as any).node_id ?? cp.name;
          const stressVal = cp.stress_level ?? 0.5;
          const color = stressVal > 0.65 ? '#ef4444' : stressVal > 0.4 ? '#f59e0b' : '#00e676';

          const cpIcon = L.divIcon({
            className: 'cp-marker',
            html: `
              <div style="position:relative; width:24px; height:24px; transform:translate(-50%, -50%); cursor:pointer;">
                <div style="position:absolute; inset:0; background:#000000; border:1.5px solid ${color}; display:flex; align-items:center; justify-content:center;">
                  <div style="width:6px; height:6px; background:${color};"></div>
                </div>
                <div style="position:absolute; top:26px; left:50%; transform:translateX(-50%); background:#000000; border:1px solid ${color}; color:${color}; font-size:9px; font-family:monospace; padding:1px 4px; white-space:nowrap; pointer-events:none;">
                  ${cp.name.split(' ')[0]} ${Math.round(stressVal * 100)}%
                </div>
              </div>
            `,
            iconSize: [24, 24],
          });

          const marker = L.marker([cpLat, cpLon], { icon: cpIcon }).addTo(lgChokepoints);
          marker.on('click', () => {
            setInspectedEntity({
              type: 'chokepoint',
              id: cpId,
              title: cp.name,
              subtitle: 'Maritime Transit Node [STRATEGIC]',
              lat: cpLat,
              lon: cpLon,
              status: cp.epistemic_status || (stressVal > 0.6 ? 'SEVERE CONGESTION' : stressVal > 0.4 ? 'ELEVATED STRESS' : 'NORMAL TRANSIT'),
              stress: stressVal,
              metrics: [
                { label: 'Current Stress', value: `${Math.round(stressVal * 100)}%`, highlight: stressVal > 0.5 },
                { label: 'Throughput Pct', value: `${Math.round((cp.throughput_pct !== undefined ? cp.throughput_pct : Math.max(0.34, 1.0 - stressVal * 0.58)) * 100)}%` },
                { label: 'Baseline Vessels/day', value: `${cp.baseline_vessels_day || Math.round(45 + (cp.criticality || 0.7) * 110)} vessels` },
                { label: 'Confidence Score', value: `${Math.round((cp.confidence || 0.94) * 100)}%` },
              ],
              raw: cp,
            });
          });
        });
      }

      // 5. AIS Vessels (with Anomaly Highlighting)
      vessels.forEach((v) => {
        const isAnom = (v as any).is_anomaly;
        const col = isAnom ? '#ef4444' : v.bucket === 'tanker' ? '#f59e0b' : '#38bdf8';
        const headingDeg = v.heading || 0;

        const vIcon = L.divIcon({
          className: 'vessel-marker',
          html: `
            <div style="position:relative; width:30px; height:30px; transform:translate(-50%, -50%); cursor:pointer;">
              ${isAnom ? `
                <div style="position:absolute; inset:-8px; border:2px solid #ef4444; border-radius:50%; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite; opacity:0.9;"></div>
                <div style="position:absolute; top:-16px; left:50%; transform:translateX(-50%); background:#ef4444; color:black; font-size:8px; font-weight:bold; padding:1px 3px; border-radius:2px; white-space:nowrap;">
                  AIS ANOMALY
                </div>
              ` : ''}
              <div style="transform:rotate(${headingDeg}deg); width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${col}" stroke="#000" stroke-width="1.5">
                  <path d="M12 2L4 20L12 16L20 20L12 2Z" />
                </svg>
              </div>
            </div>
          `,
          iconSize: [30, 30],
        });

        const marker = L.marker([v.lat, v.lon], { icon: vIcon }).addTo(lgVessels);
        marker.on('click', () => {
          setInspectedEntity({
            type: 'vessel',
            id: v.mmsi,
            title: v.name || `Vessel MMSI ${v.mmsi}`,
            subtitle: `${(v as any).type || v.bucket || 'Commercial Carrier'} &middot; Flag: ${(v as any).flag || 'Panama'}`,
            lat: v.lat,
            lon: v.lon,
            status: isAnom ? 'SUSPICIOUS LOITERING / AIS DRIFT' : 'UNDERWAY USING ENGINE',
            stress: isAnom ? 0.88 : 0.25,
            metrics: [
              { label: 'MMSI', value: v.mmsi },
              { label: 'Type / Cargo', value: v.bucket || 'Cargo' },
              { label: 'Speed', value: `${(v.speed ?? (v as any).speed_knots ?? 14.2).toFixed(1)} kn` },
              { label: 'Heading', value: `${v.heading || 0}&deg;` },
              { label: 'Destination', value: (v as any).destination || 'Unreported' },
              { label: 'ETA', value: (v as any).eta || 'N/A' },
            ],
            anomalies: isAnom ? [(v as any).anomaly_reason || 'Speed deceleration < 2kn in strategic maritime channel'] : undefined,
            raw: v,
          });
        });
      });

      // 6. ADSB Flights
      flights.forEach((f) => {
        const fIcon = L.divIcon({
          className: 'flight-marker',
          html: `
            <div style="transform:translate(-50%, -50%) rotate(${f.heading || 0}deg); cursor:pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${f.mil ? '#f43f5e' : '#a78bfa'}" stroke="#000" stroke-width="1.5">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
          `,
          iconSize: [18, 18],
        });

        const marker = L.marker([f.lat, f.lon], { icon: fIcon }).addTo(lgFlights);
        marker.on('click', () => {
          setInspectedEntity({
            type: 'flight',
            id: f.icao || (f as any).icao24 || 'FLIGHT',
            title: f.callsign || `Flight ${f.icao || (f as any).icao24}`,
            subtitle: `${f.country || (f as any).origin_country || 'Commercial'} &middot; Alt: ${Math.round(f.alt_m || 10000)}m`,
            lat: f.lat,
            lon: f.lon,
            metrics: [
              { label: 'Callsign', value: f.callsign || 'N/A' },
              { label: 'Altitude', value: `${Math.round(f.alt_m || 0)} m` },
              { label: 'Velocity', value: `${Math.round(f.vel_ms || (f as any).velocity_ms || 0)} m/s` },
              { label: 'Country', value: f.country || (f as any).origin_country || 'Unknown' },
              { label: 'Military', value: f.mil ? 'YES' : 'NO', highlight: !!f.mil },
            ],
            raw: f,
          });
        });
      });

      // 7. Critical Infrastructure Points & Lines
      if (infraLayers) {
        Object.entries(infraLayers).forEach(([layerName, fc]) => {
          if (!fc || !fc.features) return;
          const isLine = layerName === 'pipelines' || layerName === 'power_lines' || layerName === 'undersea_cables';

          if (isLine) {
            fc.features.forEach((feat: any) => {
              if (feat.geometry?.type === 'LineString') {
                const segs = splitAntimeridianSegments(feat.geometry.coordinates.map((c: any) => [c[1], c[0]]));
                segs.forEach((seg) => {
                  L.polyline(seg, {
                    color: layerName === 'pipelines' ? '#f97316' : layerName === 'undersea_cables' ? '#06b6d4' : '#eab308',
                    weight: 1.5,
                    opacity: 0.6,
                  }).addTo(lgInfra);
                });
              }
            });
          } else {
            fc.features.forEach((feat: any) => {
              if (feat.geometry?.type === 'Point') {
                const [pLon, pLat] = feat.geometry.coordinates;
                const dotIcon = L.divIcon({
                  className: 'infra-dot',
                  html: `
                    <div style="width:8px; height:8px; background:${
                      layerName === 'refineries' ? '#f97316' : layerName === 'lng_terminals' ? '#38bdf8' : '#e879f9'
                    }; border:1px solid black; transform:translate(-50%, -50%); cursor:pointer;"></div>
                  `,
                  iconSize: [8, 8],
                });
                const marker = L.marker([pLat, pLon], { icon: dotIcon }).addTo(lgInfra);
                marker.on('click', () => {
                  setInspectedEntity({
                    type: 'refinery',
                    id: feat.properties?.name || layerName,
                    title: feat.properties?.name || `${layerName.toUpperCase()} Facility`,
                    subtitle: `Critical Infrastructure Asset [${layerName}]`,
                    lat: pLat,
                    lon: pLon,
                    metrics: [
                      { label: 'Type', value: layerName },
                      { label: 'Capacity', value: feat.properties?.capacity || 'Nominal' },
                      { label: 'Sector', value: 'Energy / Petrochem' },
                    ],
                    raw: feat,
                  });
                });
              }
            });
          }
        });
      }

      // Sync zoom updates to state and adaptive range rings
      map.on('zoomend', () => {
        const curZ = map.getZoom();
        setZoomLevel(curZ);
        renderBufferRings(curZ);
      });

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, lat, lon, mapType, cascadeData, vessels, flights, infraLayers, shippingLanes, customSupplyChains, title]);

  // Handle Layer Visibility changes without re-initializing the whole map
  useEffect(() => {
    const lg = layerGroupsRef.current;
    const map = mapInstanceRef.current;
    if (!map || !lg.chokepoints) return;

    if (visibleLayers.chokepoints) map.addLayer(lg.chokepoints);
    else map.removeLayer(lg.chokepoints);

    if (visibleLayers.vessels) map.addLayer(lg.vessels);
    else map.removeLayer(lg.vessels);

    if (visibleLayers.flights) map.addLayer(lg.flights);
    else map.removeLayer(lg.flights);

    if (visibleLayers.infra) map.addLayer(lg.infra);
    else map.removeLayer(lg.infra);

    if (visibleLayers.shippingLanes) map.addLayer(lg.lanes);
    else map.removeLayer(lg.lanes);

    if (visibleLayers.customChains) map.addLayer(lg.chains);
    else map.removeLayer(lg.chains);

    if (visibleLayers.rangeRings) map.addLayer(lg.rings);
    else map.removeLayer(lg.rings);
  }, [visibleLayers]);

  if (!isOpen) return null;

  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      const cur = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setZoom(cur + delta);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#000000] font-mono text-white select-none">
      <style jsx global>{`
        .tactical-osm-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(125%) !important;
        }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.85) !important;
          color: #87a894 !important;
          font-family: monospace !important;
          font-size: 9px !important;
          border-top: 1px solid #112818 !important;
        }
        .leaflet-control-attribution a {
          color: #00e676 !important;
        }
      `}</style>

      {/* Top Tactical Command Bar */}
      <div className="flex h-14 items-center justify-between border-b border-[#112818] bg-[#000000]/95 px-6 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-none border border-[#00e676]/40 bg-[#00e676]/10 px-3.5 py-1.5 text-xs font-bold text-[#00e676] transition-all hover:bg-[#00e676]/20"
          >
            &larr; BACK TO 3D GLOBE
          </button>
          <div className="h-5 w-px bg-[#112818]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-none bg-[#00e676] animate-pulse" />
              <h2 className="text-sm font-black tracking-wider text-white uppercase">{title}</h2>
              <span className="rounded-none border border-[#00e676]/40 bg-[#00e676]/15 px-2 py-0.5 text-[9px] text-[#00e676]">
                {category}
              </span>
              {anomalyCount > 0 && (
                <span className="flex items-center gap-1 rounded-none border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-[9px] text-red-400 animate-pulse font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  {anomalyCount} ANOMALIES DETECTED
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#87a894]">
              TARGET: {lat.toFixed(4)}&deg;N, {lon.toFixed(4)}&deg;E &middot; 2D TACTICAL LAYER INSPECTOR &middot; ESRI DARK / OSM TACTICAL
            </div>
          </div>
        </div>

        {/* Controls & Basemap Switcher */}
        <div className="flex items-center gap-3">
          {/* Basemap Options (Zero-Watermark Free Tier) */}
          <div className="flex items-center rounded-none border border-[#112818] bg-[#000000] p-0.5 text-xs">
            <button
              onClick={() => setMapType('esri_dark')}
              className={`rounded-none px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'esri_dark' ? 'bg-[#00e676] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              ESRI DARK
            </button>
            <button
              onClick={() => setMapType('osm_tactical')}
              className={`rounded-none px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'osm_tactical' ? 'bg-[#00e676] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              OSM TACTICAL
            </button>
            <button
              onClick={() => setMapType('satellite')}
              className={`rounded-none px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'satellite' ? 'bg-[#00e676] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              SATELLITE
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom(1)}
              className="flex h-8 w-8 items-center justify-center rounded-none border border-[#112818] bg-[#000000] text-[#00e676] hover:bg-[#112818]"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleZoom(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-none border border-[#112818] bg-[#000000] text-[#00e676] hover:bg-[#112818]"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-none border border-[#112818] bg-[#000000] text-white hover:border-red-500 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Secondary Layer Filter Strip */}
      <div className="flex items-center justify-between border-b border-[#112818] bg-[#000000]/90 px-6 py-2 text-[11px] z-10">
        <div className="flex items-center gap-2 text-[#87a894]">
          <Filter className="h-3.5 w-3.5 text-[#00e676]" />
          <span className="font-bold text-white uppercase">Tactical Overlays:</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => toggleModalLayer('chokepoints')}
            className={`rounded-none px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.chokepoints ? 'border-[#00e676] bg-[#00e676]/15 text-[#00e676]' : 'border-[#112818] text-[#87a894]'
            }`}
          >
            Chokepoints ({cascadeData?.chokepoints.length || 0})
          </button>
          <button
            onClick={() => toggleModalLayer('vessels')}
            className={`rounded-none px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.vessels ? 'border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8]' : 'border-[#112818] text-[#87a894]'
            }`}
          >
            AIS Vessels ({vessels.length})
          </button>
          <button
            onClick={() => toggleModalLayer('flights')}
            className={`rounded-none px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.flights ? 'border-[#a78bfa] bg-[#a78bfa]/15 text-[#a78bfa]' : 'border-[#112818] text-[#87a894]'
            }`}
          >
            Flights ({flights.length})
          </button>
          <button
            onClick={() => toggleModalLayer('infra')}
            className={`rounded-none px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.infra ? 'border-[#f97316] bg-[#f97316]/15 text-[#f97316]' : 'border-[#112818] text-[#87a894]'
            }`}
          >
            Refineries & Terminals
          </button>
          <button
            onClick={() => toggleModalLayer('shippingLanes')}
            className={`rounded-none px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.shippingLanes ? 'border-[#00e676] bg-[#00e676]/15 text-[#00e676]' : 'border-[#112818] text-[#87a894]'
            }`}
          >
            Corridors
          </button>
          <button
            onClick={() => toggleModalLayer('customChains')}
            className={`rounded-none px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.customChains ? 'border-[#e879f9] bg-[#e879f9]/15 text-[#e879f9]' : 'border-[#112818] text-[#87a894]'
            }`}
          >
            Custom 3PL Chains ({customSupplyChains.length})
          </button>
          <button
            onClick={() => toggleModalLayer('rangeRings')}
            className={`rounded-none px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.rangeRings ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]' : 'border-[#112818] text-[#87a894]'
            }`}
          >
            Buffer Rings (15/35km)
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-black">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Reticle Target Coordinates HUD - Elevated above all Leaflet panes with z-[1000] */}
        <div className="absolute bottom-6 left-6 z-[1000] pointer-events-auto w-84 rounded-none border border-[#00e676] bg-[#000000]/95 p-4 font-mono shadow-[0_0_25px_rgba(0,0,0,0.9)] backdrop-blur-md">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#112818]">
            <div className="flex items-center gap-2 text-xs font-black text-[#00e676] tracking-wider uppercase">
              <Compass className="h-4 w-4 text-[#00e676] animate-spin" />
              <span>GEO-SPATIAL TARGET ACQUISITION</span>
            </div>
            <span className="border border-[#00e676]/60 bg-[#00e676]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#00e676]">
              LOCKED
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[#87a894]">
            <div>TARGET LAT/LON:</div>
            <div className="font-bold text-white text-right">{lat.toFixed(5)}&deg;N, {lon.toFixed(5)}&deg;E</div>

            <div>MGRS SECTOR:</div>
            <div className="font-bold text-white text-right">SEC-{Math.abs(Math.floor(lat * 10))}.{Math.abs(Math.floor(lon * 10))}</div>

            <div>TACTICAL ZOOM:</div>
            <div className="font-bold text-[#00e676] text-right">LVL {zoomLevel} (SUB-METER)</div>

            <div>ESTIMATED STRESS:</div>
            <div className={`font-bold text-right ${stress > 0.6 ? 'text-red-400' : stress > 0.4 ? 'text-amber-400' : 'text-[#00e676]'}`}>
              {Math.round(stress * 100)}% [{stress > 0.6 ? 'CRITICAL' : stress > 0.4 ? 'ELEVATED' : 'NOMINAL'}]
            </div>

            <div>BUFFER STATUS:</div>
            <div className="font-bold text-amber-400 text-right">15KM / 35KM ACTIVE</div>

            <div>RADAR SWEEP:</div>
            <div className="font-bold text-white text-right">CONTINUOUS AIS/ADSB</div>
          </div>
        </div>

        {/* Slide-Out Tactical Entity Inspector Drawer */}
        {inspectedEntity && (
          <div className="absolute top-6 right-6 bottom-6 w-96 z-[1000] pointer-events-auto flex flex-col rounded-none border border-[#00e676]/60 bg-[#000000]/95 p-5 backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.9)] overflow-y-auto animate-in slide-in-from-right">
            <div className="flex items-center justify-between border-b border-[#112818] pb-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-black text-[#00e676] uppercase">
                <Crosshair className="h-4 w-4 text-[#00e676]" />
                <span>Entity Telemetry</span>
              </div>
              <button
                onClick={() => setInspectedEntity(null)}
                className="rounded-none p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3">
              <h3 className="text-base font-bold text-white">{inspectedEntity.title}</h3>
              <p className="text-xs text-[#87a894]">{inspectedEntity.subtitle}</p>
            </div>

            {inspectedEntity.anomalies && inspectedEntity.anomalies.length > 0 && (
              <div className="mb-4 rounded-none border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-400">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />
                  <span>CRITICAL AIS ANOMALY DETECTED</span>
                </div>
                {inspectedEntity.anomalies.map((a, i) => (
                  <p key={i} className="text-[11px] leading-relaxed text-red-300">{a}</p>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-4">
              <div className="text-[10px] font-bold text-[#87a894] uppercase tracking-wider">Live Telemetry</div>
              <div className="rounded-none border border-[#112818] bg-[#000000]/80 p-3 space-y-2">
                {inspectedEntity.metrics.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-[#87a894]">{m.label}:</span>
                    <span className={`font-bold ${m.highlight ? 'text-[#00e676]' : 'text-white'}`}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-3 border-t border-[#112818] text-[10px] text-[#87a894] flex items-center justify-between">
              <span>LAT: {inspectedEntity.lat.toFixed(4)}&deg; &middot; LON: {inspectedEntity.lon.toFixed(4)}&deg;</span>
              <span className="text-[#00e676]">[OBSERVED]</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
