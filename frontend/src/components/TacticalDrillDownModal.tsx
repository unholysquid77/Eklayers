'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, ShieldAlert, Navigation, Layers, ZoomIn, ZoomOut, Compass } from 'lucide-react';

interface TacticalDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lon: number;
  title: string;
  category?: string;
  stress?: number;
  details?: Record<string, unknown>;
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
}: TacticalDrillDownModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapType, setMapType] = useState<'satellite' | 'dark'>('satellite');
  const [zoomLevel, setZoomLevel] = useState<number>(13);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Load Leaflet dynamically via CDN for instant high-res interactive satellite view
    let isCancelled = false;

    const initMap = async () => {
      // Ensure Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Ensure Leaflet JS
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
        zoom: 13,
        minZoom: 3,
        maxZoom: 18,
        zoomControl: false,
      });

      // Layer providers: ESRI World Imagery (Literal high-res satellite) and CartoDB Dark Matter
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 18,
        }
      );

      const darkLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 18,
        }
      );

      if (mapType === 'satellite') {
        satelliteLayer.addTo(map);
      } else {
        darkLayer.addTo(map);
      }

      // Add a tactical pulsating targeting reticle marker
      const markerIcon = L.divIcon({
        className: 'tactical-drilldown-marker',
        html: `
          <div style="position:relative; width:48px; height:48px; transform:translate(-50%, -50%); pointer-events:none;">
            <div style="position:absolute; inset:0; border:2px solid #00ff88; border-radius:50%; animation:ping 2s cubic-bezier(0,0,0.2,1) infinite; opacity:0.75;"></div>
            <div style="position:absolute; inset:8px; border:2px solid #00ff88; border-radius:50%; background:rgba(0,255,136,0.25);"></div>
            <div style="position:absolute; top:22px; left:0; right:0; height:2px; background:#00ff88;"></div>
            <div style="position:absolute; left:22px; top:0; bottom:0; width:2px; background:#00ff88;"></div>
          </div>
        `,
        iconSize: [48, 48],
      });

      L.marker([lat, lon], { icon: markerIcon }).addTo(map);

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
  }, [isOpen, lat, lon, mapType]);

  if (!isOpen) return null;

  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      const cur = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setZoom(cur + delta);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#040806] font-mono text-white select-none">
      {/* Top Tactical HUD Bar */}
      <div className="flex h-14 items-center justify-between border-b border-[#143a22] bg-[#07140b]/95 px-6 backdrop-blur-md z-10">
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
            </div>
            <div className="text-[10px] text-[#87a894]">
              LAT: {lat.toFixed(4)}&deg; &middot; LON: {lon.toFixed(4)}&deg; &middot; HIGH-RES SATELLITE TACTICAL DRILL-DOWN
            </div>
          </div>
        </div>

        {/* Controls & Layer Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded border border-[#143a22] bg-[#040806] p-0.5 text-xs">
            <button
              onClick={() => setMapType('satellite')}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'satellite' ? 'bg-[#00ff88] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              SATELLITE
            </button>
            <button
              onClick={() => setMapType('dark')}
              className={`rounded px-3 py-1 text-[11px] font-bold transition-colors ${
                mapType === 'dark' ? 'bg-[#00ff88] text-black' : 'text-[#87a894] hover:text-white'
              }`}
            >
              TACTICAL DARK
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

      {/* Map Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-black">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Reticle Readout HUD */}
        <div className="absolute bottom-6 left-6 z-10 rounded-lg border border-[#00ff88]/40 bg-[#040806]/90 p-4 backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[#00ff88]">
            <Compass className="h-4 w-4 animate-spin" />
            <span>GEO-SPATIAL TARGET ACQUISITION</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-[#87a894]">
            <div>COORDINATES:</div>
            <div className="font-bold text-white">{lat.toFixed(5)}&deg;N, {lon.toFixed(5)}&deg;E</div>
            <div>CURRENT ZOOM:</div>
            <div className="font-bold text-[#00ff88]">LEVEL {zoomLevel} (SUB-METER RESOLUTION)</div>
            <div>ESTIMATED STRESS:</div>
            <div className={`font-bold ${stress > 0.6 ? 'text-red-400' : stress > 0.4 ? 'text-amber-400' : 'text-[#00ff88]'}`}>
              {Math.round(stress * 100)}%
            </div>
            <div>IMPACT RADIUS:</div>
            <div className="font-bold text-white">45 km TACTICAL BUFFER</div>
          </div>
        </div>

        {/* Zoom Hint HUD */}
        <div className="absolute bottom-6 right-6 z-10 rounded border border-[#143a22] bg-[#040806]/85 px-3 py-1.5 text-[10px] text-[#87a894] backdrop-blur-md">
          SCROLL TO ZOOM DEEP INTO HARBOR BERTHS & ANCHORAGES
        </div>
      </div>
    </div>
  );
}
