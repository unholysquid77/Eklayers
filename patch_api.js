const fs = require('fs');
let content = fs.readFileSync('frontend/src/lib/api.ts', 'utf8');

// Insert mock import
content = content.replace("from './contracts';", "from './contracts';\nimport { MOCK_CASCADE, MOCK_ALERTS, MOCK_SHIPPING } from './mock';");

// Patch getAlerts
content = content.replace(
  "export const getAlerts = () => _get<AlertCard[]>('/v1/alerts/active');",
  "export const getAlerts = () => _get<AlertCard[]>('/v1/alerts/active').catch(() => MOCK_ALERTS);"
);

// Patch getGlobeCascadeMap
content = content.replace(
  "export const getGlobeCascadeMap = () =>\n  fetch(`${BASE}/v1/globe/cascade/map`, { cache: 'no-store' })\n    .then(r => r.json()) as Promise<CascadeMap>;",
  "export const getGlobeCascadeMap = () =>\n  fetch(`${BASE}/v1/globe/cascade/map`, { cache: 'no-store' })\n    .then(r => r.json())\n    .catch(() => MOCK_CASCADE) as Promise<CascadeMap>;"
);

// Patch getGlobeShippingLanes
content = content.replace(
  "export const getGlobeShippingLanes = () => _get<ShippingLanesResponse>('/v1/globe/shipping_lanes');",
  "export const getGlobeShippingLanes = () => _get<ShippingLanesResponse>('/v1/globe/shipping_lanes').catch(() => MOCK_SHIPPING);"
);

fs.writeFileSync('frontend/src/lib/api.ts', content);
