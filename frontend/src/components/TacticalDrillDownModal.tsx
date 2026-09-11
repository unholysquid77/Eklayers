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
  
  const [mapType, setMapType] = useState<'carto_dark' | 'osm_bw' | 'satellite'>('carto_dark');
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
        minZoom: 3,
        maxZoom: 18,
        zoomControl: false,
      });

      // Tile layers
      // CartoDB Dark Matter (Tactical Dark - Default)
      const cartoDarkLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
          maxZoom: 18,
          subdomains: 'abcd',
        }
      );

      // OpenStreetMap Black & White / Grayscale
      const osmBwLayer = L.tileLayer(
        'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors, Wikimedia Maps',
          maxZoom: 18,
        }
      );

      // ESRI Satellite
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 18,
        }
      );

      if (mapType === 'carto_dark') cartoDarkLayer.addTo(map);
      else if (mapType === 'osm_bw') osmBwLayer.addTo(map);
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

      // 1. Target Reticle & Tactical Range Rings
      const targetIcon = L.divIcon({
        className: 'drilldown-target-icon',
        html: `
          <div style="position:relative; width:64px; height:64px; transform:translate(-50%, -50%); pointer-events:none;">
            <div style="position:absolute; inset:0; border:2px solid #00ff88; border-radius:50%; animation:ping 2s cubic-bezier(0,0,0.2,1) infinite; opacity:0.8;"></div>
            <div style="position:absolute; inset:12px; border:2px dashed #00ff88; border-radius:50%; background:rgba(0,255,136,0.15);"></div>
            <div style="position:absolute; top:31px; left:0; right:0; height:2px; background:#00ff88; box-shadow:0 0 8px #00ff88;"></div>
            <div style="position:absolute; left:31px; top:0; bottom:0; width:2px; background:#00ff88; box-shadow:0 0 8px #00ff88;"></div>
            <div style="position:absolute; top:36px; left:36px; background:rgba(4,8,6,0.9); border:1px solid #00ff88; color:#00ff88; font-family:monospace; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:3px; white-space:nowrap;">
              PRIMARY TARGET: ${title}
            </div>
          </div>
        `,
        iconSize: [64, 64],
      });
      L.marker([lat, lon], { icon: targetIcon }).addTo(lgTarget);

      // Range Rings (15 km tactical inner buffer, 35 km operational buffer)
      L.circle([lat, lon], {
        radius: 15000,
        color: '#00ff88',
        weight: 1,
        dashArray: '4, 8',
        fillColor: '#00ff88',
        fillOpacity: 0.04,
      }).addTo(lgRings);

      L.circle([lat, lon], {
        radius: 35000,
        color: '#f59e0b',
        weight: 1,
        dashArray: '3, 9',
        fillColor: 'transparent',
      }).addTo(lgRings);

      // 2. Shipping Corridors
      if (shippingLanes && shippingLanes.features) {
        shippingLanes.features.forEach((lane) => {
          if (lane.geometry && lane.geometry.coordinates) {
            const latLngs = lane.geometry.coordinates.map((c: any) => [c[1], c[0]]);
            L.polyline(latLngs, {
              color: '#00ff88',
              weight: 2,
              opacity: 0.5,
              dashArray: '6, 6',
            }).addTo(lgLanes);
          }
        });
      }

      // 3. Custom Supply Chains
      customSupplyChains.forEach((chain) => {
        const pts: [number, number][] = [];
        if (chain.origin && chain.origin.lat) pts.push([chain.origin.lat, chain.origin.lon]);
        if (chain.intermediate_hubs) {
          chain.intermediate_hubs.forEach((h: any) => {
            if (h.lat) pts.push([h.lat, h.lon]);
          });
        }
        if (chain.destination && chain.destination.lat) pts.push([chain.destination.lat, chain.destination.lon]);

        if (pts.length > 1) {
          const poly = L.polyline(pts, {
            color: '#38bdf8',
            weight: 3,
            opacity: 0.85,
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
        }
      });

      // 4. Chokepoints
      if (cascadeData && cascadeData.chokepoints) {
        cascadeData.chokepoints.forEach((cp) => {
          const cpLat = cp.latitude ?? (cp as any).lat ?? 0;
          const cpLon = cp.longitude ?? (cp as any).lon ?? 0;
          const cpId = cp.id ?? (cp as any).node_id ?? cp.name;
          const stressVal = cp.stress_level ?? 0.5;
          const color = stressVal > 0.65 ? '#ef4444' : stressVal > 0.4 ? '#f59e0b' : '#00ff88';

          const cpIcon = L.divIcon({
            className: 'cp-marker',
            html: `
              <div style="position:relative; width:28px; height:28px; transform:translate(-50%, -50%); cursor:pointer;">
                <div style="position:absolute; inset:0; border-radius:50%; background:${color}; opacity:0.3; animation:pulse 2s infinite;"></div>
                <div style="position:absolute; inset:4px; border-radius:50%; background:#040806; border:2px solid ${color}; display:flex; align-items:center; justify-content:center;">
                  <div style="width:6px; height:6px; border-radius:50%; background:${color};"></div>
                </div>
                <div style="position:absolute; top:28px; left:50%; transform:translateX(-50%); background:rgba(4,8,6,0.9); border:1px solid ${color}; color:${color}; font-size:9px; font-family:monospace; padding:1px 4px; border-radius:2px; white-space:nowrap; pointer-events:none;">
                  ${cp.name.split(' ')[0]} ${Math.round(stressVal * 100)}%
                </div>
              </div>
            `,
            iconSize: [28, 28],
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
              status: stressVal > 0.6 ? 'SEVERE CONGESTION' : stressVal > 0.4 ? 'ELEVATED STRESS' : 'NORMAL TRANSIT',
              stress: stressVal,
              metrics: [
                { label: 'Current Stress', value: `${Math.round(stressVal * 100)}%`, highlight: stressVal > 0.5 },
                { label: 'Throughput Pct', value: `${Math.round((cp.throughput_pct || 0.8) * 100)}%` },
                { label: 'Baseline Vessels/day', value: `${cp.baseline_vessels_day || 120} vessels` },
                { label: 'Confidence Score', value: `${Math.round((cp.confidence || 0.9) * 100)}%` },
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
              <div style="transform: rotate(${headingDeg}deg); width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="${col}" stroke="#040806" stroke-width="1.5">
                  <path d="M12 2L4 20L12 17L20 20L12 2Z" />
                </svg>
              </div>
            </div>
          `,
          iconSize: [30, 30],
        });

        const m = L.marker([v.lat, v.lon], { icon: vIcon }).addTo(lgVessels);
        m.on('click', () => {
          setInspectedEntity({
            type: 'vessel',
            id: v.mmsi,
            title: v.name || `Vessel ${v.mmsi}`,
            subtitle: `MMSI: ${v.mmsi} &middot; Class: ${v.bucket.toUpperCase()}`,
            lat: v.lat,
            lon: v.lon,
            status: isAnom ? 'ANOMALOUS BEHAVIOR' : 'UNDERWAY',
            stress: isAnom ? 0.88 : 0.15,
            metrics: [
              { label: 'Speed', value: `${v.speed} kts` },
              { label: 'Heading', value: `${v.heading}&deg;` },
              { label: 'Vessel Type', value: v.bucket.toUpperCase() },
              { label: 'Telemetry Source', value: 'Live AIS Transponder [OBSERVED]' },
            ],
            anomalies: isAnom ? [(v as any).anomaly_desc || 'Unscheduled loitering pattern detected in primary shipping channel'] : undefined,
            raw: v,
          });
        });
      });

      // 6. Aircraft (OpenSky Network)
      flights.forEach((f) => {
        const headingDeg = f.heading || 0;
        const isMil = f.mil;
        const color = isMil ? '#f43f5e' : '#a78bfa';

        const fIcon = L.divIcon({
          className: 'flight-marker',
          html: `
            <div style="position:relative; width:24px; height:24px; transform:translate(-50%, -50%); cursor:pointer;">
              <div style="transform: rotate(${headingDeg}deg); width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="${color}" stroke="#040806" stroke-width="1">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [24, 24],
        });

        const fm = L.marker([f.lat, f.lon], { icon: fIcon }).addTo(lgFlights);
        fm.on('click', () => {
          setInspectedEntity({
            type: 'flight',
            id: f.icao,
            title: f.callsign ? f.callsign.trim() : f.icao,
            subtitle: `ICAO: ${f.icao} &middot; ${f.country || 'International'}`,
            lat: f.lat,
            lon: f.lon,
            status: isMil ? 'MILITARY / STATE MISSION' : 'COMMERCIAL TRANSIT',
            metrics: [
              { label: 'Altitude', value: `${Math.round(f.alt_m * 3.28084)} ft (${f.alt_m} m)` },
              { label: 'True Speed', value: `${Math.round(f.vel_ms * 1.94384)} kts (${f.vel_ms} m/s)` },
              { label: 'Track / Heading', value: `${f.heading}&deg;` },
              { label: 'Category', value: isMil ? 'MILITARY' : 'CIVILIAN AIR' },
            ],
            raw: f,
          });
        });
      });

      // 7. Critical Infrastructure (Refineries, LNG, Data Centers)
      const infraTypes: { key: string; label: string; color: string; icon: string }[] = [
        { key: 'refineries', label: 'Petroleum Refinery', color: '#f97316', icon: '&#9832;' },
        { key: 'lng_terminals', label: 'LNG Liquefaction / Regas Terminal', color: '#06b6d4', icon: '&#9670;' },
        { key: 'data_centers', label: 'Hyperscale Data Center', color: '#10b981', icon: '&#9632;' },
        { key: 'ports', label: 'Commercial Deepwater Port', color: '#3b82f6', icon: '&#9875;' },
        { key: 'airports', label: 'Air Cargo Hub', color: '#8b5cf6', icon: '&#9992;' },
      ];

      infraTypes.forEach((it) => {
        const coll = infraLayers[it.key];
        if (coll && coll.features) {
          coll.features.forEach((feat: any) => {
            if (feat.geometry && feat.geometry.coordinates) {
              const coords = feat.geometry.coordinates;
              const fLat = coords[1];
              const fLon = coords[0];
              const name = feat.properties?.name || feat.properties?.title || it.label;

              const iIcon = L.divIcon({
                className: 'infra-marker',
                html: `
                  <div style="width:16px; height:16px; transform:translate(-50%, -50%); border-radius:3px; background:#040806; border:1.5px solid ${it.color}; display:flex; align-items:center; justify-content:center; color:${it.color}; font-size:10px; cursor:pointer;">
                    ${it.icon}
                  </div>
                `,
                iconSize: [16, 16],
              });

              const im = L.marker([fLat, fLon], { icon: iIcon }).addTo(lgInfra);
              im.on('click', () => {
                setInspectedEntity({
                  type: it.key as any,
                  id: feat.id || name,
                  title: name,
                  subtitle: it.label,
                  lat: fLat,
                  lon: fLon,
                  metrics: [
                    { label: 'Facility Type', value: it.label },
                    { label: 'Capacity / Scale', value: feat.properties?.capacity || 'Tier-1 Critical' },
                    { label: 'Coordinates', value: `${fLat.toFixed(3)}N, ${fLon.toFixed(3)}E` },
                  ],
                  raw: feat,
                });
              });
            }
          });
        }
      });

      map.on('zoomend', () => {
        setZoomLevel(map.getZoom());
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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#040806] font-mono text-white select-none">
      {/* Top Tactical Command Bar */}
      <div className="flex h-14 items-center justify-between border-b border-[#143a22] bg-[#07140b]/95 px-6 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded border border-[#00ff88]/40 bg-[#00ff88]/10 px-3.5 py-1.5 text-xs font-bold text-[#00ff88] transition-all hover:bg-[#00ff88]/20"
          >
            &larr; BACK TO 3D GLOBE
          </button>
          <div className="h-5 w-px bg-[#143a22]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00ff88] animate-pulse" />
              <h2 className="text-sm font-black tracking-wider text-white uppercase">{title}</h2>
              <span className="rounded border border-[#00ff88]/40 bg-[#00ff88]/15 px-2 py-0.5 text-[9px] text-[#00ff88]">
                {category}
              </span>
              {anomalyCount > 0 && (
                <span className="flex items-center gap-1 rounded border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-[9px] text-red-400 animate-pulse font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  {anomalyCount} ANOMALIES DETECTED
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#87a894]">
              TARGET: {lat.toFixed(4)}&deg;N, {lon.toFixed(4)}&deg;E &middot; 2D TACTICAL LAYER INSPECTOR &middot; OSM B&W / CARTO DARK
            </div>
          </div>
        </div>

        {/* Controls & Basemap Switcher */}
        <div className="flex items-center gap-3">
          {/* Basemap Options */}
          <div className="flex items-center rounded border border-[#143a22] bg-[#040806] p-0.5 text-xs">
            <button
              onClick={() => setMapType('carto_dark')}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'carto_dark' ? 'bg-[#00ff88] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              CARTO DARK
            </button>
            <button
              onClick={() => setMapType('osm_bw')}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'osm_bw' ? 'bg-[#00ff88] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              OSM B&W
            </button>
            <button
              onClick={() => setMapType('satellite')}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'satellite' ? 'bg-[#00ff88] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              SATELLITE
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom(1)}
              className="flex h-8 w-8 items-center justify-center rounded border border-[#143a22] bg-[#07140b] text-[#00ff88] hover:bg-[#143a22]"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleZoom(-1)}
              className="flex h-8 w-8 items-center justify-center rounded border border-[#143a22] bg-[#07140b] text-[#00ff88] hover:bg-[#143a22]"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#143a22] bg-[#07140b] text-white hover:border-red-500 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Secondary Layer Filter Strip */}
      <div className="flex items-center justify-between border-b border-[#143a22] bg-[#040806]/90 px-6 py-2 text-[11px] z-10">
        <div className="flex items-center gap-2 text-[#87a894]">
          <Filter className="h-3.5 w-3.5 text-[#00ff88]" />
          <span className="font-bold text-white uppercase">Tactical Overlays:</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => toggleModalLayer('chokepoints')}
            className={`rounded px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.chokepoints ? 'border-[#00ff88] bg-[#00ff88]/15 text-[#00ff88]' : 'border-[#143a22] text-[#87a894]'
            }`}
          >
            Chokepoints ({cascadeData?.chokepoints.length || 0})
          </button>
          <button
            onClick={() => toggleModalLayer('vessels')}
            className={`rounded px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.vessels ? 'border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8]' : 'border-[#143a22] text-[#87a894]'
            }`}
          >
            AIS Vessels ({vessels.length})
          </button>
          <button
            onClick={() => toggleModalLayer('flights')}
            className={`rounded px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.flights ? 'border-[#a78bfa] bg-[#a78bfa]/15 text-[#a78bfa]' : 'border-[#143a22] text-[#87a894]'
            }`}
          >
            Flights ({flights.length})
          </button>
          <button
            onClick={() => toggleModalLayer('infra')}
            className={`rounded px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.infra ? 'border-[#f97316] bg-[#f97316]/15 text-[#f97316]' : 'border-[#143a22] text-[#87a894]'
            }`}
          >
            Refineries & Terminals
          </button>
          <button
            onClick={() => toggleModalLayer('shippingLanes')}
            className={`rounded px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.shippingLanes ? 'border-[#00ff88] bg-[#00ff88]/15 text-[#00ff88]' : 'border-[#143a22] text-[#87a894]'
            }`}
          >
            Corridors
          </button>
          <button
            onClick={() => toggleModalLayer('customChains')}
            className={`rounded px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.customChains ? 'border-[#e879f9] bg-[#e879f9]/15 text-[#e879f9]' : 'border-[#143a22] text-[#87a894]'
            }`}
          >
            Custom 3PL Chains ({customSupplyChains.length})
          </button>
          <button
            onClick={() => toggleModalLayer('rangeRings')}
            className={`rounded px-2.5 py-1 font-bold border transition-colors ${
              visibleLayers.rangeRings ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]' : 'border-[#143a22] text-[#87a894]'
            }`}
          >
            Buffer Rings (15/35km)
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-black">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Reticle Target Coordinates HUD */}
        <div className="absolute bottom-6 left-6 z-10 rounded-lg border border-[#00ff88]/40 bg-[#040806]/90 p-4 backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[#00ff88]">
            <Compass className="h-4 w-4 animate-spin" />
            <span>GEO-SPATIAL TARGET ACQUISITION</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-[#87a894]">
            <div>COORDINATES:</div>
            <div className="font-bold text-white">{lat.toFixed(5)}&deg;N, {lon.toFixed(5)}&deg;E</div>
            <div>ZOOM LEVEL:</div>
            <div className="font-bold text-[#00ff88]">LEVEL {zoomLevel} (SUB-METER VECTOR)</div>
            <div>ESTIMATED STRESS:</div>
            <div className={`font-bold ${stress > 0.6 ? 'text-red-400' : stress > 0.4 ? 'text-amber-400' : 'text-[#00ff88]'}`}>
              {Math.round(stress * 100)}%
            </div>
            <div>STATUS:</div>
            <div className="font-bold text-white">ACTIVE MONITORING</div>
          </div>
        </div>

        {/* Slide-Out Tactical Entity Inspector Drawer */}
        {inspectedEntity && (
          <div className="absolute top-6 right-6 bottom-6 w-96 z-20 flex flex-col rounded-lg border border-[#00ff88]/50 bg-[#07140b]/95 p-5 backdrop-blur-md shadow-2xl overflow-y-auto animate-in slide-in-from-right">
            <div className="flex items-center justify-between border-b border-[#143a22] pb-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-black text-[#00ff88] uppercase">
                <Crosshair className="h-4 w-4 text-[#00ff88]" />
                <span>Entity Telemetry</span>
              </div>
              <button
                onClick={() => setInspectedEntity(null)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3">
              <h3 className="text-base font-bold text-white">{inspectedEntity.title}</h3>
              <p className="text-xs text-[#87a894]">{inspectedEntity.subtitle}</p>
            </div>

            {inspectedEntity.anomalies && inspectedEntity.anomalies.length > 0 && (
              <div className="mb-4 rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-400">
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
              <div className="rounded border border-[#143a22] bg-[#040806]/80 p-3 space-y-2">
                {inspectedEntity.metrics.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-[#87a894]">{m.label}:</span>
                    <span className={`font-bold ${m.highlight ? 'text-[#00ff88]' : 'text-white'}`}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-3 border-t border-[#143a22] text-[10px] text-[#87a894] flex items-center justify-between">
              <span>LAT: {inspectedEntity.lat.toFixed(4)}&deg; &middot; LON: {inspectedEntity.lon.toFixed(4)}&deg;</span>
              <span className="text-[#00ff88]">[OBSERVED]</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
