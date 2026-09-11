import type { CascadeMap, AlertCard, GeoFeatureCollection } from "./contracts";

export const MOCK_CASCADE: CascadeMap = {
  "chokepoints": [
    {
      "id": "cp.strait_of_hormuz",
      "name": "Strait of Hormuz",
      "category": "chokepoint",
      "latitude": 26.566,
      "longitude": 56.25,
      "stress_level": 0.777,
      "baseline": 0.15,
      "criticality": 0.916,
      "country": "Iran/Oman"
    },
    {
      "id": "cp.auto_gulf_of_oman",
      "name": "Gulf of Oman",
      "category": "chokepoint",
      "latitude": 24.0,
      "longitude": 58.0,
      "stress_level": 0.701,
      "baseline": 0.15,
      "criticality": 0.82,
      "country": "Oman/Iran"
    },
    {
      "id": "cp.taiwan_strait",
      "name": "Taiwan Strait",
      "category": "chokepoint",
      "latitude": 24.5,
      "longitude": 120.5,
      "stress_level": 0.385,
      "baseline": 0.15,
      "criticality": 0.914,
      "country": "Taiwan/China"
    },
    {
      "id": "cp.auto_gulf_of_aden_shipping_corridor",
      "name": "Gulf of Aden Shipping Corridor",
      "category": "chokepoint",
      "latitude": 12.5,
      "longitude": 45.0,
      "stress_level": 0.697,
      "baseline": 0.15,
      "criticality": 0.7,
      "country": "Yemen/Somalia"
    },
    {
      "id": "cp.auto_gulf_of_aden_maritime_chokepoint",
      "name": "Gulf of Aden Maritime Chokepoint",
      "category": "chokepoint",
      "latitude": 12.0,
      "longitude": 45.0,
      "stress_level": 0.69,
      "baseline": 0.15,
      "criticality": 0.7,
      "country": "Somalia/Yemen"
    },
    {
      "id": "cp.ukraine_grain",
      "name": "Ukraine Grain Export Corridor",
      "category": "chokepoint",
      "latitude": 46.5,
      "longitude": 30.7,
      "stress_level": 0.65,
      "baseline": 0.15,
      "criticality": 0.72,
      "country": "Ukraine"
    },
    {
      "id": "cp.strait_of_malacca",
      "name": "Strait of Malacca",
      "category": "chokepoint",
      "latitude": 2.5,
      "longitude": 101.3,
      "stress_level": 0.453,
      "baseline": 0.15,
      "criticality": 0.846,
      "country": "Malaysia/Indonesia/Singapore"
    },
    {
      "id": "cp.user_fujairah_crude_export_corridor",
      "name": "Fujairah Crude Export Corridor",
      "category": "chokepoint",
      "latitude": 25.1276,
      "longitude": 56.3269,
      "stress_level": 0.584,
      "baseline": 0.15,
      "criticality": 0.723,
      "country": "UAE"
    },
    {
      "id": "cp.asml_veldhoven",
      "name": "ASML Veldhoven (EUV)",
      "category": "chokepoint",
      "latitude": 51.42,
      "longitude": 5.47,
      "stress_level": 0.112,
      "baseline": 0.15,
      "criticality": 0.99,
      "country": "Netherlands"
    },
    {
      "id": "cp.tsmc_hsinchu",
      "name": "TSMC Fabs (Hsinchu + Tainan)",
      "category": "chokepoint",
      "latitude": 24.78,
      "longitude": 121.0,
      "stress_level": 0.11,
      "baseline": 0.15,
      "criticality": 0.98,
      "country": "Taiwan"
    },
    {
      "id": "cp.bab_el_mandeb",
      "name": "Bab-el-Mandeb / Red Sea",
      "category": "chokepoint",
      "latitude": 12.58,
      "longitude": 43.33,
      "stress_level": 0.345,
      "baseline": 0.15,
      "criticality": 0.793,
      "country": "Yemen/Djibouti"
    },
    {
      "id": "cp.panama_canal",
      "name": "Panama Canal",
      "category": "chokepoint",
      "latitude": 9.08,
      "longitude": -79.68,
      "stress_level": 0.435,
      "baseline": 0.15,
      "criticality": 0.72,
      "country": "Panama"
    },
    {
      "id": "cp.suez_canal",
      "name": "Suez Canal",
      "category": "chokepoint",
      "latitude": 30.59,
      "longitude": 32.27,
      "stress_level": 0.32,
      "baseline": 0.15,
      "criticality": 0.79,
      "country": "Egypt"
    },
    {
      "id": "cp.auto_kerch_strait_approaches",
      "name": "Kerch Strait Approaches",
      "category": "chokepoint",
      "latitude": 45.35,
      "longitude": 36.6,
      "stress_level": 0.481,
      "baseline": 0.15,
      "criticality": 0.65,
      "country": "Russia/Ukraine"
    },
    {
      "id": "cp.auto_copper_mining_and_refining",
      "name": "Copper Mining and Refining",
      "category": "chokepoint",
      "latitude": -27.3667,
      "longitude": -70.3333,
      "stress_level": 0.173,
      "baseline": 0.15,
      "criticality": 0.85,
      "country": "Chile"
    },
    {
      "id": "cp.china_ree",
      "name": "China REE (Bayan Obo)",
      "category": "chokepoint",
      "latitude": 41.77,
      "longitude": 109.97,
      "stress_level": 0.09,
      "baseline": 0.15,
      "criticality": 0.9,
      "country": "China"
    },
    {
      "id": "cp.drc_cobalt",
      "name": "DRC Cobalt Belt (Katanga)",
      "category": "chokepoint",
      "latitude": -10.7,
      "longitude": 26.4,
      "stress_level": 0.106,
      "baseline": 0.15,
      "criticality": 0.88,
      "country": "DR Congo"
    },
    {
      "id": "cp.auto_turkish_straits_approaches",
      "name": "Turkish Straits Approaches",
      "category": "chokepoint",
      "latitude": 41.0,
      "longitude": 29.0,
      "stress_level": 0.122,
      "baseline": 0.15,
      "criticality": 0.85,
      "country": "Turkey"
    },
    {
      "id": "cp.user_cpc_novorossiysk_export_terminal",
      "name": "CPC Novorossiysk Export Terminal",
      "category": "chokepoint",
      "latitude": 44.7,
      "longitude": 37.8,
      "stress_level": 0.304,
      "baseline": 0.15,
      "criticality": 0.724,
      "country": "Russia"
    },
    {
      "id": "cp.auto_kharg_island_oil_export_terminal",
      "name": "Kharg Island Oil Export Terminal",
      "category": "chokepoint",
      "latitude": 29.276,
      "longitude": 50.286,
      "stress_level": 0.246,
      "baseline": 0.15,
      "criticality": 0.744,
      "country": "Iran"
    },
    {
      "id": "cp.auto_istanbul_approaches_sea_of_marmara",
      "name": "Istanbul Approaches, Sea of Marmara",
      "category": "chokepoint",
      "latitude": 41.0,
      "longitude": 29.0,
      "stress_level": 0.086,
      "baseline": 0.15,
      "criticality": 0.85,
      "country": "Turkey"
    },
    {
      "id": "cp.auto_siliguri_corridor",
      "name": "Siliguri Corridor",
      "category": "chokepoint",
      "latitude": 26.7,
      "longitude": 88.4,
      "stress_level": 0.235,
      "baseline": 0.15,
      "criticality": 0.75,
      "country": "India"
    },
    {
      "id": "cp.auto_ras_tanura_oil_terminal",
      "name": "Ras Tanura Oil Terminal",
      "category": "chokepoint",
      "latitude": 26.6244,
      "longitude": 50.0389,
      "stress_level": 0.122,
      "baseline": 0.15,
      "criticality": 0.82,
      "country": "Saudi Arabia"
    },
    {
      "id": "cp.user_cape_of_good_hope",
      "name": "Cape of Good Hope",
      "category": "chokepoint",
      "latitude": -34.3568,
      "longitude": 18.474,
      "stress_level": 0.276,
      "baseline": 0.15,
      "criticality": 0.688,
      "country": "South Africa"
    },
    {
      "id": "cp.auto_ceuta_border_fence",
      "name": "Ceuta Border Fence",
      "category": "chokepoint",
      "latitude": 35.8894,
      "longitude": -5.3213,
      "stress_level": 0.398,
      "baseline": 0.15,
      "criticality": 0.6,
      "country": "Spain/Morocco"
    },
    {
      "id": "cp.auto_ceuta_border_crossing",
      "name": "Ceuta Border Crossing",
      "category": "chokepoint",
      "latitude": 35.8894,
      "longitude": -5.3213,
      "stress_level": 0.398,
      "baseline": 0.15,
      "criticality": 0.6,
      "country": "Spain/Morocco"
    },
    {
      "id": "cp.samsung_pyeongtaek",
      "name": "Samsung Pyeongtaek Fab",
      "category": "chokepoint",
      "latitude": 37.05,
      "longitude": 127.04,
      "stress_level": 0.087,
      "baseline": 0.15,
      "criticality": 0.8,
      "country": "South Korea"
    },
    {
      "id": "cp.auto_yanbu_industrial_port",
      "name": "Yanbu Industrial Port",
      "category": "chokepoint",
      "latitude": 24.086,
      "longitude": 38.063,
      "stress_level": 0.13,
      "baseline": 0.15,
      "criticality": 0.764,
      "country": "Saudi Arabia"
    },
    {
      "id": "cp.auto_loudoun_county_data_center_alley",
      "name": "Loudoun County Data Center Alley",
      "category": "chokepoint",
      "latitude": 39.03,
      "longitude": -77.5,
      "stress_level": 0.144,
      "baseline": 0.15,
      "criticality": 0.75,
      "country": "United States"
    },
    {
      "id": "cp.auto_port_of_bandar_abbas",
      "name": "Port of Bandar Abbas",
      "category": "chokepoint",
      "latitude": 27.1833,
      "longitude": 56.2667,
      "stress_level": 0.141,
      "baseline": 0.15,
      "criticality": 0.75,
      "country": "Iran"
    },
    {
      "id": "cp.auto_port_of_fujairah",
      "name": "Port of Fujairah",
      "category": "chokepoint",
      "latitude": 25.127,
      "longitude": 56.326,
      "stress_level": 0.133,
      "baseline": 0.15,
      "criticality": 0.75,
      "country": "UAE"
    },
    {
      "id": "cp.auto_port_of_qingdao",
      "name": "Port of Qingdao",
      "category": "chokepoint",
      "latitude": 36.0671,
      "longitude": 120.3826,
      "stress_level": 0.28,
      "baseline": 0.15,
      "criticality": 0.65,
      "country": "China"
    },
    {
      "id": "cp.user_sumed_pipeline_terminals",
      "name": "SUMED Pipeline Terminals",
      "category": "chokepoint",
      "latitude": 29.87,
      "longitude": 32.27,
      "stress_level": 0.117,
      "baseline": 0.15,
      "criticality": 0.75,
      "country": "Egypt"
    },
    {
      "id": "cp.auto_beirut_port",
      "name": "Beirut Port",
      "category": "chokepoint",
      "latitude": 33.8938,
      "longitude": 35.5018,
      "stress_level": 0.192,
      "baseline": 0.15,
      "criticality": 0.7,
      "country": "Lebanon"
    },
    {
      "id": "cp.auto_kuwait_oil_export_terminals",
      "name": "Kuwait Oil Export Terminals",
      "category": "chokepoint",
      "latitude": 29.3697,
      "longitude": 48.0053,
      "stress_level": 0.116,
      "baseline": 0.15,
      "criticality": 0.75,
      "country": "Kuwait"
    },
    {
      "id": "cp.indonesia_nickel",
      "name": "Indonesia Nickel (Sulawesi + Halmahera)",
      "category": "chokepoint",
      "latitude": -0.8,
      "longitude": 122.0,
      "stress_level": 0.089,
      "baseline": 0.15,
      "criticality": 0.75,
      "country": "Indonesia"
    },
    {
      "id": "cp.auto_volgograd_industrial_facility",
      "name": "Volgograd Industrial Facility",
      "category": "chokepoint",
      "latitude": 48.708,
      "longitude": 44.514,
      "stress_level": 0.312,
      "baseline": 0.15,
      "criticality": 0.6,
      "country": "Russia"
    },
    {
      "id": "cp.gibraltar",
      "name": "Strait of Gibraltar",
      "category": "chokepoint",
      "latitude": 35.95,
      "longitude": -5.6,
      "stress_level": 0.381,
      "baseline": 0.15,
      "criticality": 0.55,
      "country": "Spain/Morocco"
    },
    {
      "id": "cp.intel_arizona",
      "name": "Intel Ocotillo (Arizona)",
      "category": "chokepoint",
      "latitude": 33.32,
      "longitude": -111.86,
      "stress_level": 0.375,
      "baseline": 0.15,
      "criticality": 0.55,
      "country": "United States"
    },
    {
      "id": "cp.auto_great_nicobar_island_infrastructure",
      "name": "Great Nicobar Island Infrastructure",
      "category": "chokepoint",
      "latitude": 7.5,
      "longitude": 93.8,
      "stress_level": 0.293,
      "baseline": 0.15,
      "criticality": 0.6,
      "country": "India"
    },
    {
      "id": "cp.singapore_ix",
      "name": "Singapore Internet Exchange",
      "category": "chokepoint",
      "latitude": 1.35,
      "longitude": 103.82,
      "stress_level": 0.112,
      "baseline": 0.15,
      "criticality": 0.72,
      "country": "Singapore"
    },
    {
      "id": "cp.sk_hynix",
      "name": "SK Hynix (Icheon/Cheongju)",
      "category": "chokepoint",
      "latitude": 37.26,
      "longitude": 127.45,
      "stress_level": 0.111,
      "baseline": 0.15,
      "criticality": 0.72,
      "country": "South Korea"
    },
    {
      "id": "cp.auto_port_of_ain_sokhna",
      "name": "Port of Ain Sokhna",
      "category": "chokepoint",
      "latitude": 29.8667,
      "longitude": 32.2667,
      "stress_level": 0.135,
      "baseline": 0.15,
      "criticality": 0.7,
      "country": "Egypt"
    },
    {
      "id": "cp.red_sea_cables",
      "name": "Red Sea Subsea Cable Corridor",
      "category": "chokepoint",
      "latitude": 20.0,
      "longitude": 38.0,
      "stress_level": 0.102,
      "baseline": 0.15,
      "criticality": 0.72,
      "country": "Red Sea (int'l waters)"
    },
    {
      "id": "cp.auto_port_of_mokha",
      "name": "Port of Mokha",
      "category": "chokepoint",
      "latitude": 13.317,
      "longitude": 43.183,
      "stress_level": 0.273,
      "baseline": 0.15,
      "criticality": 0.6,
      "country": "Yemen"
    },
    {
      "id": "cp.user_port_of_churchill",
      "name": "Port of Churchill",
      "category": "chokepoint",
      "latitude": 58.7689,
      "longitude": -94.1644,
      "stress_level": 0.269,
      "baseline": 0.15,
      "criticality": 0.6,
      "country": "Canada"
    },
    {
      "id": "cp.user_port_of_durban",
      "name": "Port of Durban",
      "category": "chokepoint",
      "latitude": -29.8833,
      "longitude": 31.05,
      "stress_level": 0.16,
      "baseline": 0.15,
      "criticality": 0.668,
      "country": "South Africa"
    },
    {
      "id": "cp.english_channel",
      "name": "English Channel / Dover Strait",
      "category": "chokepoint",
      "latitude": 51.0,
      "longitude": 1.5,
      "stress_level": 0.409,
      "baseline": 0.15,
      "criticality": 0.5,
      "country": "UK/France"
    },
    {
      "id": "cp.auto_new_delhi_diplomatic_hub",
      "name": "New Delhi Diplomatic Hub",
      "category": "chokepoint",
      "latitude": 28.6139,
      "longitude": 77.209,
      "stress_level": 0.319,
      "baseline": 0.15,
      "criticality": 0.55,
      "country": "India"
    },
    {
      "id": "cp.auto_lebanon_israel_maritime_border",
      "name": "Lebanon-Israel Maritime Border",
      "category": "chokepoint",
      "latitude": 33.1,
      "longitude": 35.5,
      "stress_level": 0.314,
      "baseline": 0.15,
      "criticality": 0.55,
      "country": "Lebanon/Israel"
    }
  ],
  "events": [
    {
      "id": "cca6a35e-208f-4977-8b90-e3241373be67",
      "latitude": 13.317,
      "longitude": 43.183,
      "severity": 0.6,
      "domain": "supply_chain",
      "event_category": "news",
      "occurred_at": "2026-09-10T15:19:17",
      "raw_text": "Iran-backed Houthis seize key Red Sea port in blow to Saudi forces. Yemen's Iran-aligned Houthi militants have seized th",
      "title": "published_headline: Iran-backed Houthis seize key Red Sea port in blow",
      "actor": "Times of India",
      "object": "Iran-backed Houthis seize key Red Sea port in blow to Saudi forces",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "wsrc.174fe71267b34e1c26f1",
      "latitude": 24.0,
      "longitude": 58.0,
      "severity": 0.55,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T13:53:48.835658",
      "raw_text": "Oil jumps to $105 a barrel after Middle East tanker attacks escalate - reuters.com. Oil jumps to $105 a barrel after Mid",
      "title": "published_article: Oil jumps to $105 a barrel after Middle East tanke",
      "actor": "watch_feed",
      "object": "Oil jumps to $105 a barrel after Middle East tanker attacks escalate - reuters.com",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "wsrc.96414c7de22ccd081728",
      "latitude": 24.5,
      "longitude": 120.5,
      "severity": 0.55,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T13:22:14.970221",
      "raw_text": "Oil jumps to $105 a barrel after Middle East tanker attacks escalate - Reuters. Oil jumps to $105 a barrel after Middle ",
      "title": "published_article: Oil jumps to $105 a barrel after Middle East tanke",
      "actor": "watch_feed",
      "object": "Oil jumps to $105 a barrel after Middle East tanker attacks escalate - Reuters",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "wsrc.20e1f2d407f7f2a82b8f",
      "latitude": 12.5,
      "longitude": 45.0,
      "severity": 0.55,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T15:53:58.191676",
      "raw_text": "Oil jumps to $105 a barrel after Middle East tanker attacks escalate - The Globe and Mail. Oil jumps to $105 a barrel af",
      "title": "published_article: Oil jumps to $105 a barrel after Middle East tanke",
      "actor": "watch_feed",
      "object": "Oil jumps to $105 a barrel after Middle East tanker attacks escalate - The Globe and Mail",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "9204bdb8-ccb4-4bb8-8ba2-0c3ee1d606e2",
      "latitude": 12.0,
      "longitude": 45.0,
      "severity": 0.6,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-09T17:40:19",
      "raw_text": "Osama bin Laden had Taliban rival assassinated 2 days before 9/11 attack. Ahmad Shah Massoud, the prominent Afghan resis",
      "title": "published_headline: Osama bin Laden had Taliban rival assassinated 2 d",
      "actor": "Times of India",
      "object": "Osama bin Laden had Taliban rival assassinated 2 days before 9/11 attack",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "wsrc.403581c0a6e0cda7adb2",
      "latitude": 46.5,
      "longitude": 30.7,
      "severity": 0.55,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-09T17:02:46.410088",
      "raw_text": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - The Mighty 790 KFGO. Iran attacks US base in Jord",
      "title": "published_article: Iran attacks US base in Jordan, ships near Hormuz ",
      "actor": "watch_feed",
      "object": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - The Mighty 790 KFGO",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "wsrc.9d068e4c88b4509d85a1",
      "latitude": 2.5,
      "longitude": 101.3,
      "severity": 0.55,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-09T05:54:49.178406",
      "raw_text": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - WTVB. Iran attacks US base in Jordan, ships near ",
      "title": "published_article: Iran attacks US base in Jordan, ships near Hormuz ",
      "actor": "watch_feed",
      "object": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - WTVB",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "wsrc.a785c35095da53ee0a2d",
      "latitude": 25.1276,
      "longitude": 56.3269,
      "severity": 0.55,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-09T05:24:40.894681",
      "raw_text": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - wtvbam.com. Iran attacks US base in Jordan, ships",
      "title": "published_article: Iran attacks US base in Jordan, ships near Hormuz ",
      "actor": "watch_feed",
      "object": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - wtvbam.com",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "61d2d0df-97d4-437c-b2a3-453918da9da9",
      "latitude": 51.42,
      "longitude": 5.47,
      "severity": 0.6,
      "domain": "defense",
      "event_category": "news",
      "occurred_at": "2026-09-08T03:38:09",
      "raw_text": "PLA report warns Chinese cities of potential nuclear attacks, flags Japan as \u2018threat\u2019. A new study by China\u00e2\u0080\u0099s People\u00e2\u0080",
      "title": "published_headline: PLA report warns Chinese cities of potential nucle",
      "actor": "Times of India",
      "object": "PLA report warns Chinese cities of potential nuclear attacks, flags Japan as \u2018th",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "c3aacc27-ee64-449a-89a4-9c7d2ac6c3e6",
      "latitude": 24.78,
      "longitude": 121.0,
      "severity": 0.7,
      "domain": "defense",
      "event_category": "news",
      "occurred_at": "2026-09-10T05:59:19",
      "raw_text": "Cash-strapped Pakistan\u2019s jet, missile display exposes reliance on China, Turkey as India boosts defences | India News\nAp",
      "title": "news_event: ",
      "actor": "Balochistan",
      "object": "",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "wsrc.f47b735317942ac213c0",
      "latitude": 12.58,
      "longitude": 43.33,
      "severity": 0.55,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T05:38:20.599968",
      "raw_text": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - kfgo.com. Iran attacks US base in Jordan, ships n",
      "title": "published_article: Iran attacks US base in Jordan, ships near Hormuz ",
      "actor": "watch_feed",
      "object": "Iran attacks US base in Jordan, ships near Hormuz after tankers sunk - kfgo.com",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "368457a7-210d-4674-a3f5-65e155e678e6",
      "latitude": 9.08,
      "longitude": -79.68,
      "severity": 0.7,
      "domain": "macro",
      "event_category": "news",
      "occurred_at": "2026-09-10T05:04:03",
      "raw_text": "Botswana vice president calls on Korean business to invest | UA.NEWS\nBotswana\u2019s Vice President Ndaba Gaolathe called on ",
      "title": "news_event: ",
      "actor": "Intel Feed",
      "object": "",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "47cfc9aa-5ab4-4752-8391-c955f68a99cc",
      "latitude": 30.59,
      "longitude": 32.27,
      "severity": 0.6,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T04:49:26",
      "raw_text": "At Least 5 Dead, More Than 80 Missing After Ferry Fire in the Philippines. The June Aster was sailing from Manila to Cor",
      "title": "published_headline: At Least 5 Dead, More Than 80 Missing After Ferry ",
      "actor": "NY Times International",
      "object": "At Least 5 Dead, More Than 80 Missing After Ferry Fire in the Philippines",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "9f6b7f3a-f6b0-4409-94c9-a7279ddc36a3",
      "latitude": 45.35,
      "longitude": 36.6,
      "severity": 0.7,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T04:04:11",
      "raw_text": "Trump claims he will give $5,000 to every American if Republicans win the midterms as he defends Iran war and tariffs\u2013 a",
      "title": "news_event: ",
      "actor": "Intel Feed",
      "object": "",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "867dda48-58e2-4fba-b233-c617a03c8177",
      "latitude": -27.3667,
      "longitude": -70.3333,
      "severity": 0.6,
      "domain": "defense",
      "event_category": "news",
      "occurred_at": "2026-09-10T03:27:45",
      "raw_text": "US suffered major aircraft losses after Iran strike on Jordan base: Report. Multiple US military aircraft were damaged a",
      "title": "published_headline: US suffered major aircraft losses after Iran strik",
      "actor": "Times of India",
      "object": "US suffered major aircraft losses after Iran strike on Jordan base: Report",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "a7b181a9-0a9b-41bc-9c4e-aed0d47292f4",
      "latitude": 41.77,
      "longitude": 109.97,
      "severity": 0.6,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T03:21:04",
      "raw_text": "Iran war to outlast Trump 2.0? Top aides sound alarm despite his 'quick end' claim. Vice President JD Vance and Secretar",
      "title": "published_headline: Iran war to outlast Trump 2.0? Top aides sound ala",
      "actor": "Times of India",
      "object": "Iran war to outlast Trump 2.0? Top aides sound alarm despite his 'quick end' cla",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "c045707a-1e3f-4acb-ab48-6f26d100ab59",
      "latitude": -10.7,
      "longitude": 26.4,
      "severity": 0.6,
      "domain": "energy",
      "event_category": "news",
      "occurred_at": "2026-09-10T02:53:59",
      "raw_text": "Oil holds above $100 as Iran-US attacks threaten deeper supply disruption. Oil prices extended gains on Thursday, with B",
      "title": "published_headline: Oil holds above $100 as Iran-US attacks threaten d",
      "actor": "Times of India",
      "object": "Oil holds above $100 as Iran-US attacks threaten deeper supply disruption",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "2d82818b-7d96-4d23-8ccc-db37f95ee4f5",
      "latitude": 41.0,
      "longitude": 29.0,
      "severity": 0.7,
      "domain": "energy",
      "event_category": "news",
      "occurred_at": "2026-09-10T05:00:15",
      "raw_text": "Climate solutions most likely to reach \u2018positive tipping points\u2019 revealed by scientists\nGlobal shift towards clean elect",
      "title": "news_event: ",
      "actor": "Intel Feed",
      "object": "",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "84c4932e-867d-4269-8d1f-3882c7e7220d",
      "latitude": 44.7,
      "longitude": 37.8,
      "severity": 0.7,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-10T01:43:07",
      "raw_text": "Ukraine war briefing: Arctic attack extends Kyiv\u2019s strike reach into Russian gas heartland\n\u2018Guess who?\u2019 says Fire Point,",
      "title": "news_event: ",
      "actor": "Intel Feed",
      "object": "",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    },
    {
      "id": "7ac2e392-b4ff-4eb6-a173-61559c6e3aab",
      "latitude": 26.566,
      "longitude": 56.25,
      "severity": 0.7,
      "domain": "geopolitics",
      "event_category": "news",
      "occurred_at": "2026-09-09T16:18:15",
      "raw_text": "Iran claims to have attacked 10 ships near strait of Hormuz after US strikes\nOil price rises above $100 a barrel as Tehr",
      "title": "news_event: ",
      "actor": "Intel Feed",
      "object": "",
      "location": "",
      "source_ids": [
        "paqshi_archive"
      ]
    }
  ],
  "impact_edges": [
    {
      "from_chokepoint": "cp.auto_ceuta_border_crossing",
      "to_entity_id": "cp.auto_ceuta_border_fence",
      "to_entity_name": "Ceuta Border Fence",
      "severity": 1.0,
      "from_lat": 35.8894,
      "from_lon": -5.3213,
      "to_lat": 35.8894,
      "to_lon": -5.3213
    },
    {
      "from_chokepoint": "cp.auto_istanbul_approaches_sea_of_marmara",
      "to_entity_id": "cp.auto_turkish_straits_approaches",
      "to_entity_name": "Turkish Straits Approaches",
      "severity": 1.0,
      "from_lat": 41.0,
      "from_lon": 29.0,
      "to_lat": 41.0,
      "to_lon": 29.0
    },
    {
      "from_chokepoint": "cp.auto_port_of_fujairah",
      "to_entity_id": "cp.user_fujairah_crude_export_corridor",
      "to_entity_name": "Fujairah Crude Export Corridor",
      "severity": 1.0,
      "from_lat": 25.127,
      "from_lon": 56.326,
      "to_lat": 25.1276,
      "to_lon": 56.3269
    },
    {
      "from_chokepoint": "cp.auto_port_of_ain_sokhna",
      "to_entity_id": "cp.user_sumed_pipeline_terminals",
      "to_entity_name": "Sumed Pipeline Terminals",
      "severity": 1.0,
      "from_lat": 29.8667,
      "from_lon": 32.2667,
      "to_lat": 29.87,
      "to_lon": 32.27
    },
    {
      "from_chokepoint": "cp.auto_ceuta_border_crossing",
      "to_entity_id": "cp.gibraltar",
      "to_entity_name": "Gibraltar",
      "severity": 0.97,
      "from_lat": 35.8894,
      "from_lon": -5.3213,
      "to_lat": 35.95,
      "to_lon": -5.6
    },
    {
      "from_chokepoint": "cp.auto_ceuta_border_fence",
      "to_entity_id": "cp.gibraltar",
      "to_entity_name": "Gibraltar",
      "severity": 0.97,
      "from_lat": 35.8894,
      "from_lon": -5.3213,
      "to_lat": 35.95,
      "to_lon": -5.6
    },
    {
      "from_chokepoint": "cp.samsung_pyeongtaek",
      "to_entity_id": "cp.sk_hynix",
      "to_entity_name": "Sk Hynix",
      "severity": 0.95,
      "from_lat": 37.05,
      "from_lon": 127.04,
      "to_lat": 37.26,
      "to_lon": 127.45
    },
    {
      "from_chokepoint": "cp.auto_gulf_of_aden_maritime_chokepoint",
      "to_entity_id": "cp.auto_gulf_of_aden_shipping_corridor",
      "to_entity_name": "Gulf Of Aden Shipping Corridor",
      "severity": 0.93,
      "from_lat": 12.0,
      "from_lon": 45.0,
      "to_lat": 12.5,
      "to_lon": 45.0
    },
    {
      "from_chokepoint": "cp.taiwan_strait",
      "to_entity_id": "cp.tsmc_hsinchu",
      "to_entity_name": "Tsmc Hsinchu",
      "severity": 0.93,
      "from_lat": 24.5,
      "from_lon": 120.5,
      "to_lat": 24.78,
      "to_lon": 121.0
    },
    {
      "from_chokepoint": "cp.auto_port_of_bandar_abbas",
      "to_entity_id": "cp.strait_of_hormuz",
      "to_entity_name": "Strait Of Hormuz",
      "severity": 0.91,
      "from_lat": 27.1833,
      "from_lon": 56.2667,
      "to_lat": 26.566,
      "to_lon": 56.25
    },
    {
      "from_chokepoint": "cp.intel_arizona",
      "to_entity_id": "cp.tsmc_hsinchu",
      "to_entity_name": "Tsmc Hsinchu",
      "severity": 0.9,
      "from_lat": 33.32,
      "from_lon": -111.86,
      "to_lat": 24.78,
      "to_lon": 121.0
    },
    {
      "from_chokepoint": "cp.panama_canal",
      "to_entity_id": "cp.suez_canal",
      "to_entity_name": "Suez Canal",
      "severity": 0.9,
      "from_lat": 9.08,
      "from_lon": -79.68,
      "to_lat": 30.59,
      "to_lon": 32.27
    },
    {
      "from_chokepoint": "cp.samsung_pyeongtaek",
      "to_entity_id": "cp.tsmc_hsinchu",
      "to_entity_name": "Tsmc Hsinchu",
      "severity": 0.9,
      "from_lat": 37.05,
      "from_lon": 127.04,
      "to_lat": 24.78,
      "to_lon": 121.0
    },
    {
      "from_chokepoint": "cp.suez_canal",
      "to_entity_id": "cp.user_sumed_pipeline_terminals",
      "to_entity_name": "Sumed Pipeline Terminals",
      "severity": 0.9,
      "from_lat": 30.59,
      "from_lon": 32.27,
      "to_lat": 29.87,
      "to_lon": 32.27
    },
    {
      "from_chokepoint": "cp.auto_port_of_ain_sokhna",
      "to_entity_id": "cp.suez_canal",
      "to_entity_name": "Suez Canal",
      "severity": 0.9,
      "from_lat": 29.8667,
      "from_lon": 32.2667,
      "to_lat": 30.59,
      "to_lon": 32.27
    },
    {
      "from_chokepoint": "cp.auto_port_of_mokha",
      "to_entity_id": "cp.bab_el_mandeb",
      "to_entity_name": "Bab El Mandeb",
      "severity": 0.9,
      "from_lat": 13.317,
      "from_lon": 43.183,
      "to_lat": 12.58,
      "to_lon": 43.33
    },
    {
      "from_chokepoint": "cp.auto_beirut_port",
      "to_entity_id": "cp.auto_lebanon_israel_maritime_border",
      "to_entity_name": "Lebanon Israel Maritime Border",
      "severity": 0.89,
      "from_lat": 33.8938,
      "from_lon": 35.5018,
      "to_lat": 33.1,
      "to_lon": 35.5
    },
    {
      "from_chokepoint": "cp.auto_kerch_strait_approaches",
      "to_entity_id": "cp.user_cpc_novorossiysk_export_terminal",
      "to_entity_name": "Cpc Novorossiysk Export Terminal",
      "severity": 0.85,
      "from_lat": 45.35,
      "from_lon": 36.6,
      "to_lat": 44.7,
      "to_lon": 37.8
    },
    {
      "from_chokepoint": "cp.strait_of_hormuz",
      "to_entity_id": "cp.user_fujairah_crude_export_corridor",
      "to_entity_name": "Fujairah Crude Export Corridor",
      "severity": 0.8,
      "from_lat": 26.566,
      "from_lon": 56.25,
      "to_lat": 25.1276,
      "to_lon": 56.3269
    },
    {
      "from_chokepoint": "cp.auto_port_of_fujairah",
      "to_entity_id": "cp.strait_of_hormuz",
      "to_entity_name": "Strait Of Hormuz",
      "severity": 0.8,
      "from_lat": 25.127,
      "from_lon": 56.326,
      "to_lat": 26.566,
      "to_lon": 56.25
    },
    {
      "from_chokepoint": "cp.auto_gulf_of_aden_shipping_corridor",
      "to_entity_id": "cp.bab_el_mandeb",
      "to_entity_name": "Bab El Mandeb",
      "severity": 0.77,
      "from_lat": 12.5,
      "from_lon": 45.0,
      "to_lat": 12.58,
      "to_lon": 43.33
    },
    {
      "from_chokepoint": "cp.auto_gulf_of_aden_maritime_chokepoint",
      "to_entity_id": "cp.bab_el_mandeb",
      "to_entity_name": "Bab El Mandeb",
      "severity": 0.76,
      "from_lat": 12.0,
      "from_lon": 45.0,
      "to_lat": 12.58,
      "to_lon": 43.33
    },
    {
      "from_chokepoint": "cp.auto_gulf_of_oman",
      "to_entity_id": "cp.user_fujairah_crude_export_corridor",
      "to_entity_name": "Fujairah Crude Export Corridor",
      "severity": 0.74,
      "from_lat": 24.0,
      "from_lon": 58.0,
      "to_lat": 25.1276,
      "to_lon": 56.3269
    },
    {
      "from_chokepoint": "cp.auto_gulf_of_oman",
      "to_entity_id": "cp.auto_port_of_fujairah",
      "to_entity_name": "Port Of Fujairah",
      "severity": 0.74,
      "from_lat": 24.0,
      "from_lon": 58.0,
      "to_lat": 25.127,
      "to_lon": 56.326
    },
    {
      "from_chokepoint": "cp.auto_gulf_of_aden_shipping_corridor",
      "to_entity_id": "cp.auto_port_of_mokha",
      "to_entity_name": "Port Of Mokha",
      "severity": 0.73,
      "from_lat": 12.5,
      "from_lon": 45.0,
      "to_lat": 13.317,
      "to_lon": 43.183
    },
    {
      "from_chokepoint": "cp.auto_kharg_island_oil_export_terminal",
      "to_entity_id": "cp.auto_kuwait_oil_export_terminals",
      "to_entity_name": "Kuwait Oil Export Terminals",
      "severity": 0.72,
      "from_lat": 29.276,
      "from_lon": 50.286,
      "to_lat": 29.3697,
      "to_lon": 48.0053
    },
    {
      "from_chokepoint": "cp.auto_port_of_bandar_abbas",
      "to_entity_id": "cp.user_fujairah_crude_export_corridor",
      "to_entity_name": "Fujairah Crude Export Corridor",
      "severity": 0.71,
      "from_lat": 27.1833,
      "from_lon": 56.2667,
      "to_lat": 25.1276,
      "to_lon": 56.3269
    },
    {
      "from_chokepoint": "cp.auto_port_of_bandar_abbas",
      "to_entity_id": "cp.auto_port_of_fujairah",
      "to_entity_name": "Port Of Fujairah",
      "severity": 0.71,
      "from_lat": 27.1833,
      "from_lon": 56.2667,
      "to_lat": 25.127,
      "to_lon": 56.326
    },
    {
      "from_chokepoint": "cp.auto_kharg_island_oil_export_terminal",
      "to_entity_id": "cp.auto_ras_tanura_oil_terminal",
      "to_entity_name": "Ras Tanura Oil Terminal",
      "severity": 0.7,
      "from_lat": 29.276,
      "from_lon": 50.286,
      "to_lat": 26.6244,
      "to_lon": 50.0389
    },
    {
      "from_chokepoint": "cp.auto_kharg_island_oil_export_terminal",
      "to_entity_id": "cp.intel_arizona",
      "to_entity_name": "Intel Arizona",
      "severity": 0.7,
      "from_lat": 29.276,
      "from_lon": 50.286,
      "to_lat": 33.32,
      "to_lon": -111.86
    },
    {
      "from_chokepoint": "cp.auto_kharg_island_oil_export_terminal",
      "to_entity_id": "cp.auto_yanbu_industrial_port",
      "to_entity_name": "Yanbu Industrial Port",
      "severity": 0.7,
      "from_lat": 29.276,
      "from_lon": 50.286,
      "to_lat": 24.086,
      "to_lon": 38.063
    },
    {
      "from_chokepoint": "cp.auto_kharg_island_oil_export_terminal",
      "to_entity_id": "cp.auto_loudoun_county_data_center_alley",
      "to_entity_name": "Loudoun County Data Center Alley",
      "severity": 0.7,
      "from_lat": 29.276,
      "from_lon": 50.286,
      "to_lat": 39.03,
      "to_lon": -77.5
    },
    {
      "from_chokepoint": "cp.auto_loudoun_county_data_center_alley",
      "to_entity_id": "cp.china_ree",
      "to_entity_name": "China Ree",
      "severity": 0.7,
      "from_lat": 39.03,
      "from_lon": -77.5,
      "to_lat": 41.77,
      "to_lon": 109.97
    },
    {
      "from_chokepoint": "cp.auto_loudoun_county_data_center_alley",
      "to_entity_id": "cp.auto_volgograd_industrial_facility",
      "to_entity_name": "Volgograd Industrial Facility",
      "severity": 0.7,
      "from_lat": 39.03,
      "from_lon": -77.5,
      "to_lat": 48.708,
      "to_lon": 44.514
    },
    {
      "from_chokepoint": "cp.auto_loudoun_county_data_center_alley",
      "to_entity_id": "cp.user_cpc_novorossiysk_export_terminal",
      "to_entity_name": "Cpc Novorossiysk Export Terminal",
      "severity": 0.7,
      "from_lat": 39.03,
      "from_lon": -77.5,
      "to_lat": 44.7,
      "to_lon": 37.8
    },
    {
      "from_chokepoint": "cp.auto_loudoun_county_data_center_alley",
      "to_entity_id": "cp.auto_port_of_bandar_abbas",
      "to_entity_name": "Port Of Bandar Abbas",
      "severity": 0.7,
      "from_lat": 39.03,
      "from_lon": -77.5,
      "to_lat": 27.1833,
      "to_lon": 56.2667
    },
    {
      "from_chokepoint": "cp.auto_loudoun_county_data_center_alley",
      "to_entity_id": "cp.auto_port_of_qingdao",
      "to_entity_name": "Port Of Qingdao",
      "severity": 0.7,
      "from_lat": 39.03,
      "from_lon": -77.5,
      "to_lat": 36.0671,
      "to_lon": 120.3826
    },
    {
      "from_chokepoint": "cp.auto_port_of_bandar_abbas",
      "to_entity_id": "cp.auto_ras_tanura_oil_terminal",
      "to_entity_name": "Ras Tanura Oil Terminal",
      "severity": 0.7,
      "from_lat": 27.1833,
      "from_lon": 56.2667,
      "to_lat": 26.6244,
      "to_lon": 50.0389
    },
    {
      "from_chokepoint": "cp.auto_port_of_bandar_abbas",
      "to_entity_id": "cp.intel_arizona",
      "to_entity_name": "Intel Arizona",
      "severity": 0.7,
      "from_lat": 27.1833,
      "from_lon": 56.2667,
      "to_lat": 33.32,
      "to_lon": -111.86
    },
    {
      "from_chokepoint": "cp.auto_port_of_bandar_abbas",
      "to_entity_id": "cp.auto_yanbu_industrial_port",
      "to_entity_name": "Yanbu Industrial Port",
      "severity": 0.7,
      "from_lat": 27.1833,
      "from_lon": 56.2667,
      "to_lat": 24.086,
      "to_lon": 38.063
    },
    {
      "from_chokepoint": "cp.auto_port_of_qingdao",
      "to_entity_id": "cp.tsmc_hsinchu",
      "to_entity_name": "Tsmc Hsinchu",
      "severity": 0.7,
      "from_lat": 36.0671,
      "from_lon": 120.3826,
      "to_lat": 24.78,
      "to_lon": 121.0
    },
    {
      "from_chokepoint": "cp.auto_port_of_qingdao",
      "to_entity_id": "cp.intel_arizona",
      "to_entity_name": "Intel Arizona",
      "severity": 0.7,
      "from_lat": 36.0671,
      "from_lon": 120.3826,
      "to_lat": 33.32,
      "to_lon": -111.86
    },
    {
      "from_chokepoint": "cp.auto_volgograd_industrial_facility",
      "to_entity_id": "cp.intel_arizona",
      "to_entity_name": "Intel Arizona",
      "severity": 0.7,
      "from_lat": 48.708,
      "from_lon": 44.514,
      "to_lat": 33.32,
      "to_lon": -111.86
    },
    {
      "from_chokepoint": "cp.china_ree",
      "to_entity_id": "cp.tsmc_hsinchu",
      "to_entity_name": "Tsmc Hsinchu",
      "severity": 0.7,
      "from_lat": 41.77,
      "from_lon": 109.97,
      "to_lat": 24.78,
      "to_lon": 121.0
    },
    {
      "from_chokepoint": "cp.china_ree",
      "to_entity_id": "cp.intel_arizona",
      "to_entity_name": "Intel Arizona",
      "severity": 0.7,
      "from_lat": 41.77,
      "from_lon": 109.97,
      "to_lat": 33.32,
      "to_lon": -111.86
    },
    {
      "from_chokepoint": "cp.intel_arizona",
      "to_entity_id": "cp.user_cpc_novorossiysk_export_terminal",
      "to_entity_name": "Cpc Novorossiysk Export Terminal",
      "severity": 0.7,
      "from_lat": 33.32,
      "from_lon": -111.86,
      "to_lat": 44.7,
      "to_lon": 37.8
    },
    {
      "from_chokepoint": "cp.strait_of_hormuz",
      "to_entity_id": "cp.auto_gulf_of_aden_shipping_corridor",
      "to_entity_name": "Gulf Of Aden Shipping Corridor",
      "severity": 0.88,
      "from_lat": 26.566,
      "from_lon": 56.25,
      "to_lat": 12.5,
      "to_lon": 45.0
    },
    {
      "from_chokepoint": "cp.auto_gulf_of_aden_shipping_corridor",
      "to_entity_id": "cp.taiwan_strait",
      "to_entity_name": "Taiwan Strait",
      "severity": 0.75,
      "from_lat": 12.5,
      "from_lon": 45.0,
      "to_lat": 24.5,
      "to_lon": 120.5
    },
    {
      "from_chokepoint": "cp.taiwan_strait",
      "to_entity_id": "cp.auto_port_of_fujairah",
      "to_entity_name": "Port Of Fujairah",
      "severity": 0.65,
      "from_lat": 24.5,
      "from_lon": 120.5,
      "to_lat": 25.127,
      "to_lon": 56.326
    },
    {
      "from_chokepoint": "cp.auto_port_of_fujairah",
      "to_entity_id": "cp.auto_ceuta_border_crossing",
      "to_entity_name": "Ceuta Border Crossing",
      "severity": 0.7,
      "from_lat": 25.127,
      "from_lon": 56.326,
      "to_lat": 35.8894,
      "to_lon": -5.3213
    },
    {
      "from_chokepoint": "cp.auto_turkish_straits_approaches",
      "to_entity_id": "cp.auto_port_of_ain_sokhna",
      "to_entity_name": "Port Of Ain Sokhna",
      "severity": 0.78,
      "from_lat": 41.0,
      "from_lon": 29.0,
      "to_lat": 29.8667,
      "to_lon": 32.2667
    }
  ]
};

export const MOCK_ALERTS: AlertCard[] = [
  {
    id: "alert-sg-01",
    subject_id: "port-singapore",
    subject_kind: "port",
    alert_type: "port_congestion",
    prior: 0.15,
    posterior: 0.82,
    severity: 88.4,
    p50_days: 9.2,
    p80_days: 14.5,
    p95_days: 21.0,
    sku_count: 3,
    order_count: 5,
    evidence_ledger: [
      { name: "Severe Monsoon Squall", llr: 1.85, weight: 1.0, source: "Open-Meteo", confidence: 0.9, contribution: 32.4 },
      { name: "Container Dwell Spike +4.2d", llr: 1.42, weight: 0.9, source: "AIS Port Telemetry", confidence: 0.85, contribution: 24.8 },
      { name: "Corroborated Maritime Advisory", llr: 0.95, weight: 0.8, source: "GDACS", confidence: 0.88, contribution: 18.2 },
    ],
    as_of: new Date().toISOString(),
    confidence: 0.88,
    provenance: ["live_signals", "bayesian_pipeline"],
  },
  {
    id: "alert-suez-02",
    subject_id: "suez-canal",
    subject_kind: "lane",
    alert_type: "route_disruption",
    prior: 0.10,
    posterior: 0.79,
    severity: 76.2,
    p50_days: 12.0,
    p80_days: 18.5,
    p95_days: 28.0,
    sku_count: 2,
    order_count: 3,
    evidence_ledger: [
      { name: "Red Sea Transit Advisory", llr: 2.1, weight: 1.0, source: "UKMTO Advisory", confidence: 0.95, contribution: 40.0 },
    ],
    as_of: new Date().toISOString(),
    confidence: 0.92,
    provenance: ["live_signals", "bayesian_pipeline"],
  }
];

export const MOCK_SHIPPING: GeoFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [103.840, 1.264],
          [101.500, 2.500],
          [32.300, 30.500],
          [4.479, 51.922],
        ]
      },
      properties: { name: "Asia-Europe Mainline", stress: 0.78, traffic: "Heavy" }
    }
  ]
};

// ---------------------------------------------------------------------------
// Console Mocks
// ---------------------------------------------------------------------------

import type {
  ConsoleSummary, MonteCarloSimulationData, ConsoleChokepoint,
  ChokepointDetails, ConsoleHeadline, ConsoleSignal,
  ConsoleStressForecast, ConsoleSupplyChain, ConsoleAlert,
  StressTestSimulateRes,
} from "./contracts";

export const MOCK_CONSOLE_SUMMARY: ConsoleSummary = {
  chokepoints_count: 124,
  signals_count: 89,
  forecasts_count: 42,
  supply_chains_count: 15,
  max_stress: 0.89,
  average_weighted_stress: 0.45,
};

export const MOCK_MONTE_CARLO: MonteCarloSimulationData = {
  simulations: 10000,
  mean_disruption_days: 12.4,
  percentiles: { p50: 10, p90: 21, p99: 45 },
  histogram_data: [
    { days: 0, count: 50, probability: 0.005 },
    { days: 2, count: 180, probability: 0.018 },
    { days: 4, count: 420, probability: 0.042 },
    { days: 6, count: 850, probability: 0.085 },
    { days: 8, count: 1420, probability: 0.142 },
    { days: 10, count: 1950, probability: 0.195 },
    { days: 12, count: 1720, probability: 0.172 },
    { days: 14, count: 1240, probability: 0.124 },
    { days: 16, count: 780, probability: 0.078 },
    { days: 18, count: 460, probability: 0.046 },
    { days: 20, count: 310, probability: 0.031 },
    { days: 22, count: 210, probability: 0.021 },
    { days: 24, count: 140, probability: 0.014 },
    { days: 26, count: 90, probability: 0.009 },
    { days: 28, count: 65, probability: 0.0065 },
    { days: 30, count: 45, probability: 0.0045 },
    { days: 35, count: 35, probability: 0.0035 },
    { days: 40, count: 20, probability: 0.002 },
    { days: 45, count: 12, probability: 0.0012 },
    { days: 50, count: 8, probability: 0.0008 },
  ],
};

export const MOCK_CONSOLE_CHOKEPOINTS: ConsoleChokepoint[] = [
  { id: "chk_007", name: "Bab-el-Mandeb Strait", current_stress: 0.88, trend: "increasing" },
  { id: "chk_001", name: "Panama Canal", current_stress: 0.85, trend: "increasing" },
  { id: "chk_002", name: "Suez Canal", current_stress: 0.82, trend: "increasing" },
  { id: "chk_003", name: "Strait of Malacca", current_stress: 0.74, trend: "stable" },
  { id: "chk_004", name: "Port of Shanghai", current_stress: 0.68, trend: "decreasing" },
  { id: "chk_005", name: "Strait of Hormuz", current_stress: 0.65, trend: "increasing" },
  { id: "chk_006", name: "Port of Rotterdam", current_stress: 0.58, trend: "stable" },
  { id: "chk_008", name: "Port of Singapore", current_stress: 0.52, trend: "decreasing" },
];

export const MOCK_CHOKEPOINT_DETAILS: Record<string, ChokepointDetails> = {
  chk_001: { id: "chk_001", centrality_score: 0.92, flow_capacity_variance: 0.15, historical_stress_coefficient: 1.24, vulnerability_index: 0.78 },
  chk_002: { id: "chk_002", centrality_score: 0.95, flow_capacity_variance: 0.22, historical_stress_coefficient: 1.45, vulnerability_index: 0.89 },
  chk_003: { id: "chk_003", centrality_score: 0.98, flow_capacity_variance: 0.10, historical_stress_coefficient: 1.12, vulnerability_index: 0.71 },
  chk_007: { id: "chk_007", centrality_score: 0.91, flow_capacity_variance: 0.35, historical_stress_coefficient: 1.82, vulnerability_index: 0.93 },
};

export const MOCK_HEADLINES: ConsoleHeadline[] = [
  { id: "news_123", title: "Port Strike Looms on US East Coast as Labor Negotiations Stagnate", source: "Reuters", timestamp: "2026-09-11T18:45:00Z", related_chokepoints: ["chk_045", "chk_001"], severity: "HIGH", sentiment: -0.65 },
  { id: "news_124", title: "Red Sea Shipping Reroutes via Cape of Good Hope Add 12 Days to Asia-Europe Transit", source: "Bloomberg", timestamp: "2026-09-11T17:15:00Z", related_chokepoints: ["chk_007", "chk_002"], severity: "CRITICAL", sentiment: -0.82 },
  { id: "news_125", title: "Severe Drought Lowers Gatun Lake Levels; Panama Canal Caps Daily Bookings at 24", source: "Lloyd's List", timestamp: "2026-09-11T15:30:00Z", related_chokepoints: ["chk_001"], severity: "HIGH", sentiment: -0.70 },
  { id: "news_126", title: "Super Typhoon Approaches Bashi Channel, Halting Key Taiwan-Bound Air & Sea Freights", source: "Financial Times", timestamp: "2026-09-11T14:10:00Z", related_chokepoints: ["chk_003"], severity: "MEDIUM", sentiment: -0.45 },
  { id: "news_127", title: "Rhine River Low Water Surges Barge Surcharges by 40% Across European Chemical Hubs", source: "Argus Media", timestamp: "2026-09-11T11:05:00Z", related_chokepoints: ["chk_006"], severity: "MEDIUM", sentiment: -0.40 },
];

export const MOCK_SIGNALS: ConsoleSignal[] = [
  { id: "sig_099", type: "WEATHER", severity: "HIGH", description: "Category 4 Typhoon Yagi entering Northern Philippines / Luzon Strait", precision_score: 0.95, timestamp: "2026-09-11T18:00:00Z" },
  { id: "sig_100", type: "PORT_CONGESTION", severity: "HIGH", description: "Anchorage dwell time in Singapore Strait exceeds 74 hours for container vessels", precision_score: 0.91, timestamp: "2026-09-11T17:30:00Z" },
  { id: "sig_101", type: "MARITIME_SECURITY", severity: "CRITICAL", description: "UKMTO Advisory 042: Unmanned surface vessel incident reported near Bab-el-Mandeb", precision_score: 0.88, timestamp: "2026-09-11T16:20:00Z" },
  { id: "sig_102", type: "CUSTOMS_LOGISTICS", severity: "MEDIUM", description: "Automated clearance system outage at Port of Rotterdam Maasvlakte II terminal", precision_score: 0.82, timestamp: "2026-09-11T13:45:00Z" },
  { id: "sig_103", type: "LABOR_UNION", severity: "HIGH", description: "45,000 ILA dockworkers issue strike deadline for Atlantic & Gulf Coast ports", precision_score: 0.94, timestamp: "2026-09-11T12:00:00Z" },
];

export const MOCK_STRESS_FORECAST: ConsoleStressForecast = {
  current_score: 0.65,
  highest_30d_forecast: 0.88,
  peak_date: "2026-09-25",
  disruption_probability: 0.72,
  daily_trend: [
    { day: 1, date: "2026-09-12", predicted_stress: 0.65, p50: 0.65, p90: 0.71 },
    { day: 3, date: "2026-09-14", predicted_stress: 0.68, p50: 0.68, p90: 0.75 },
    { day: 7, date: "2026-09-18", predicted_stress: 0.76, p50: 0.76, p90: 0.84 },
    { day: 11, date: "2026-09-22", predicted_stress: 0.84, p50: 0.84, p90: 0.92 },
    { day: 14, date: "2026-09-25", predicted_stress: 0.88, p50: 0.88, p90: 0.96 },
    { day: 18, date: "2026-09-29", predicted_stress: 0.83, p50: 0.83, p90: 0.91 },
    { day: 22, date: "2026-10-03", predicted_stress: 0.75, p50: 0.75, p90: 0.83 },
    { day: 26, date: "2026-10-07", predicted_stress: 0.69, p50: 0.69, p90: 0.76 },
    { day: 30, date: "2026-10-11", predicted_stress: 0.64, p50: 0.64, p90: 0.72 },
  ],
};

export const MOCK_SUPPLY_CHAINS: ConsoleSupplyChain[] = [
  {
    id: "sc_001",
    name: "Semiconductor Route Alpha (East Asia → NA)",
    chokepoints: ["chk_012", "chk_015", "chk_001"],
    travel_time_days: 45,
    revised_arrival_date: "2026-10-15",
    stress: 0.77,
    criticality: "HIGH",
    disruption_probability: 0.65,
    origin: "Hsinchu / Taipei Hub",
    destination: "Austin, TX Fab Complex",
    bom_trace: [
      { part_id: "P-101", name: "3nm Microcontroller Wafer", supplier: "TSMC Fab 14", tier: 1, lead_time_days: 60, buffer_stock_days: 14, risk_status: "VULNERABLE" },
      { part_id: "P-204", name: "EUV Photoresist Polymer", supplier: "Shin-Etsu Chemical", tier: 2, lead_time_days: 35, buffer_stock_days: 8, risk_status: "CRITICAL" },
      { part_id: "P-309", name: "Ultra-Pure Hydrogen Fluoride", supplier: "Stella Chemifa", tier: 2, lead_time_days: 40, buffer_stock_days: 10, risk_status: "WARNING" },
    ],
  },
  {
    id: "sc_002",
    name: "Automotive Power Electronics (Europe → US Midwest)",
    chokepoints: ["chk_006", "chk_001"],
    travel_time_days: 32,
    revised_arrival_date: "2026-10-04",
    stress: 0.68,
    criticality: "HIGH",
    disruption_probability: 0.58,
    origin: "Stuttgart, DE",
    destination: "Detroit, MI Assembly Hub",
    bom_trace: [
      { part_id: "P-401", name: "SiC Inverter Module", supplier: "Bosch Mobility Solutions", tier: 1, lead_time_days: 45, buffer_stock_days: 20, risk_status: "MONITORED" },
      { part_id: "P-405", name: "IGBT Gate Driver Substrate", supplier: "Infineon Villach", tier: 2, lead_time_days: 50, buffer_stock_days: 12, risk_status: "VULNERABLE" },
    ],
  },
  {
    id: "sc_003",
    name: "Critical Minerals & Battery Cathodes (APAC → EU)",
    chokepoints: ["chk_007", "chk_002"],
    travel_time_days: 52,
    revised_arrival_date: "2026-10-28",
    stress: 0.89,
    criticality: "CRITICAL",
    disruption_probability: 0.84,
    origin: "Ningbo / Busan Maritime Hub",
    destination: "Rotterdam Gateway → Berlin Gigafactory",
    bom_trace: [
      { part_id: "P-501", name: "LFP Prismatic Battery Cells", supplier: "CATL Yibin Facility", tier: 1, lead_time_days: 55, buffer_stock_days: 9, risk_status: "DISRUPTED" },
      { part_id: "P-502", name: "Synthetic Anode Spherical Graphite", supplier: "BTR New Material", tier: 2, lead_time_days: 40, buffer_stock_days: 15, risk_status: "VULNERABLE" },
    ],
  },
  {
    id: "sc_004",
    name: "Aerospace Carbon Composites (Japan → US West Coast)",
    chokepoints: ["chk_003"],
    travel_time_days: 28,
    revised_arrival_date: "2026-09-30",
    stress: 0.44,
    criticality: "MEDIUM",
    disruption_probability: 0.35,
    origin: "Nagoya, JP",
    destination: "Seattle, WA Aerospace Facility",
    bom_trace: [
      { part_id: "P-601", name: "Torayca Carbon Fiber Prepreg", supplier: "Toray Industries", tier: 1, lead_time_days: 30, buffer_stock_days: 25, risk_status: "NORMAL" },
    ],
  },
];

export const MOCK_CONSOLE_ALERTS: ConsoleAlert[] = [
  {
    id: "alt_001",
    severity: "CRITICAL",
    message: "Potential stock-out in 14 days due to Red Sea & Bab-el-Mandeb maritime rerouting.",
    related_chokepoint: "Bab-el-Mandeb (chk_007)",
    confidence: 0.94,
    mitigations: [
      { type: "ALTERNATE_SOURCING", recommendation: "Switch secondary wafer substrate sourcing to European fab partner (Munich)", cost_impact: "+15%", lead_time_reduction_days: 18 },
      { type: "EXPEDITING", recommendation: "Charter dedicated priority Air Freight for critical Tier-2 photoresist lots", cost_impact: "+35%", lead_time_reduction_days: 22 },
      { type: "INVENTORY_REALLOCATION", recommendation: "Draw safety buffer stock from Memphis central distribution hub", cost_impact: "+4%", lead_time_reduction_days: 12 },
    ],
  },
  {
    id: "alt_002",
    severity: "HIGH",
    message: "Panama Canal draft restrictions delaying US East Coast container arrivals by 9-14 days.",
    related_chokepoint: "Panama Canal (chk_001)",
    confidence: 0.89,
    mitigations: [
      { type: "INTERMODAL_TRANSFER", recommendation: "Reroute containers via Long Beach marine terminal to BNSF Transcontinental rail", cost_impact: "+12%", lead_time_reduction_days: 8 },
      { type: "INVENTORY_HOLD", recommendation: "Extend client fulfillment window for non-priority SKU tranches", cost_impact: "0%", lead_time_reduction_days: 5 },
    ],
  },
  {
    id: "alt_003",
    severity: "MEDIUM",
    message: "Port strike authorization on US Atlantic coast threatens 48h terminal embargo.",
    related_chokepoint: "Port of NY/NJ (chk_045)",
    confidence: 0.78,
    mitigations: [
      { type: "ADVANCE_DISPATCH", recommendation: "Accelerate outbound gate pick-ups and off-dock staging prior to strike window", cost_impact: "+3%", lead_time_reduction_days: 6 },
    ],
  },
];

export const MOCK_SIMULATE_RESPONSE: StressTestSimulateRes = {
  simulation_id: "sim_999",
  target_type: "PORT",
  target_id: "port_la",
  target_name: "Port of Los Angeles",
  time_to_stock_out_days: 18,
  cascading_effects: [
    "Depletion of West Coast Inventory Hub A by Day 12",
    "Sub-assembly line starvation at Texas Facility by Day 15",
    "Production halt at Factory C by Day 18",
    "Estimated revenue disruption: $4.2M / day post Day 18",
  ],
};
