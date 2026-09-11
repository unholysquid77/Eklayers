# Sarvadarshi Globe API Contract

This document outlines the API endpoints exposed by the backend for the Sarvadarshi Globe (rain_mode.html).

The frontend Next.js application exposes a proxy at /ui/* which points directly to the backend at /v1/globe/*.

## Base URLs
- **Backend:** http://localhost:8000/v1/globe
- **Frontend Proxy:** /ui/* (proxies to http://localhost:8000/v1/globe/*)

---

## 1. Core Ontology State

### GET /cascade/map
Returns the core supply chain state: chokepoints, events, and impact edges.

**Response Schema:**
`json
{
  "chokepoints": [
    {
      "id": "port-singapore",
      "name": "Port of Singapore",
      "category": "port",
      "latitude": 1.26,
      "longitude": 103.84,
      "stress_level": 0.65,
      "baseline": 0.10,
      "criticality": 0.92
    }
  ],
  "events": [
    {
      "id": "evt-001",
      "latitude": 30.58,
      "longitude": 32.34,
      "domain": "corporate",
      "severity": 0.80,
      "event_category": "port_congestion",
      "occurred_at": "2026-09-10T14:00:00Z",
      "raw_text": "Singapore port congestion: 3-5 day delays at PSA terminals",
      "title": "Singapore Congestion",
      "actor": "PSA International",
      "object": "Port operations",
      "location": "Singapore",
      "source_ids": ["freightwaves-001"]
    }
  ],
  "impact_edges": [
    {
      "from_chokepoint": "port-singapore",
      "to_entity_id": "asean-transshipment",
      "to_entity_name": "ASEAN transshipment hub",
      "severity": 0.60
    }
  ]
}
`

---

## 2. Live Transportation Feeds

### GET /flights
Proxies the OpenSky Network for live commercial/military flight data.

**Query Parameters:**
- mil_only (bool): If true, filters for military flights only.
- limit (int): Max number of flights to return (default 4000).

**Response Schema:**
`json
{
  "flights": [
    {
      "icao": "A0B1C2",
      "callsign": "UAL123",
      "lat": 45.3,
      "lon": -30.2,
      "alt_m": 10668,
      "vel_ms": 250,
      "heading": 65,
      "mil": false,
      "country": "US",
      "on_ground": false
    }
  ],
  "stale": false
}
`

### GET /vessels
Returns live AIS tracking data. Currently implemented as a realistic simulation centered around known chokepoints and ports.

**Response Schema:**
`json
{
  "vessels": [
    {
      "mmsi": "311000123",
      "name": "MSC Diana",
      "lat": 30.6,
      "lon": 32.4,
      "speed": 12.5,
      "heading": 180,
      "bucket": "cargo"
    }
  ],
  "connected": true
}
`

---

## 3. Infrastructure and Geopolitical Layers

These endpoints return FeatureCollection GeoJSON payloads for static infrastructure overlays.

### Endpoints
- GET /infrastructure/spaceports
- GET /infrastructure/nuclear_sites
- GET /infrastructure/military_bases
- GET /infrastructure/ai_data_centers
- GET /infrastructure/energy

**Response Schema (GeoJSON):**
`json
{
  "type": "FeatureCollection",
  "features": []
}
`

---

## 4. Live Events Overlay

### GET /events/earthquakes
Proxies the live USGS Earthquake feed (all earthquakes in the past 24 hours).

**Response:** GeoJSON FeatureCollection from USGS.

### GET /events/acled
Placeholder for ACLED or similar global armed conflict event APIs.

**Response:** GeoJSON FeatureCollection.
