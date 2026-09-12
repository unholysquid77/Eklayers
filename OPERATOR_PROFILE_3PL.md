# OPERATIONAL PROFILE: NEXIS GLOBAL 3PL & SEMICONDUCTOR LOGISTICS
**Enterprise Supply Chain Architecture, Multi-Tier Dependencies & Crisis Exposure Model**
*Prepared for Hackathon Evaluation & Technical Due Diligence*

---

## 1. Executive Summary & Operator Dossier

| Metric / Attribute | Specification |
|---|---|
| **Enterprise Entity** | **Nexis Global 3PL & Semiconductor Logistics** |
| **Primary Industry** | Tier-1 Automotive Electronics, Powertrain Modules & EV Telematics |
| **Operational Corridor** | Asia-Pacific (Taiwan, Singapore, Japan) $\rightarrow$ Western Europe $\rightarrow$ India (Maharashtra, Karnataka, Tamil Nadu) |
| **Inbound Gateways** | JNPT Nhava Sheva (Port of Mumbai), Mumbai CSMI BOM Air Freight, Chennai Sea Port |
| **Annual Volume** | 540,000 Finished & Sub-Assembly Modules / Year |
| **Base Network Health** | 68.5 / 100 (Under Current Hormuz & Singapore Chokepoint Strain) |
| **Total Revenue at Risk** | **₹5,20,00,000 (₹5.20 Cr)** across 8 Critical Tier-1 OEM Customer Commitments |
| **Active Chokepoint Pressures** | Strait of Malacca (82% Stress), Strait of Hormuz (79% Stress), Port of Singapore (82% P-Disruption) |

Nexis Global operates precision just-in-time (JIT) multi-echelon assembly and logistics for critical automotive sub-systems. High-value semiconductor silicon wafers, microcontrollers (MCUs), and silicon carbide (SiC) power MOSFETs are sourced from East Asia and Europe, funneled through maritime feeder and multimodal air corridors, and assembled across four specialized facilities in India.

---

## 2. Master Assembly & Manufacturing Facilities

| Facility ID | Facility Name | Location | Daily Capacity | Active Production Lines | Status |
|---|---|---|---|---|---|
| **PLANT-01** | **Pune Gigafactory** | Chakan Industrial Zone, Pune | 1,500 units/day | **Line A** (Motor Controllers), **Line B** (HV Inverters) | **THREATENED** (11.0d Runway) |
| **PLANT-02** | **Bengaluru Advanced R&D Hub** | Electronic City, Bengaluru | 300 units/day | **Pilot Line** (Automotive Telematics & Gateways) | **OPERATIONAL** (15.0d Runway) |
| **PLANT-03** | **Chennai Port Assembly** | Sriperumbudur, Tamil Nadu | 800 units/day | **Line C** (EV Powertrain & BMS Integration) | **OPERATIONAL** (13.0d Runway) |
| **PLANT-04** | **Hyderabad Defense Logistics** | Adibatla Aerospace SEZ | 400 units/day | **Secure Line** (Hardened Telematics & Sensors) | **OPERATIONAL** (28.0d Runway) |

---

## 3. Global Tier-1 & Tier-2 Semiconductor Suppliers

| Supplier ID | Supplier Name | Geography | Baseline Lead Time | Single Source? | Critical Component Supplied | Risk Rating |
|---|---|---|---|---|---|---|
| **SUP-001** | **TSMC Sub-Fab 14** | Hsinchu Science Park, Taiwan | 42 Days | **YES (Sole)** | **MCU-441** Microcontroller IC | **CRITICAL (72/100)** |
| **SUP-002** | **Infineon Technologies AG** | Munich / Dresden, Germany | 28 Days | NO (Dual) | **IGBT-312** High-Voltage Gate Drivers | **MEDIUM (38/100)** |
| **SUP-003** | **STMicroelectronics Pte Ltd** | Ang Mo Kio, Singapore | 35 Days | **YES (Sole)** | **SiC Power MOSFET** Substrate & Die | **CRITICAL (74/100)** |
| **SUP-004** | **NXP Semiconductors NV** | Austin, Texas, USA | 21 Days | NO (Dual) | **RF-808** Telematics Baseband Processor | **LOW (24/100)** |
| **SUP-005** | **Murata Manufacturing** | Kyoto / Fukui, Japan | 18 Days | NO (Multi) | **SEN-105** MEMS Diagnostic Sensors | **LOW (18/100)** |
| **SUP-006** | **Samsung Semiconductor** | Giheung / Hwaseong, South Korea | 30 Days | **YES (Sole)** | **BMS-2 ASIC** Power Management IC | **HIGH (58/100)** |

---

## 4. Bill of Materials (BOM) & Inventory Runway Analysis

| SKU ID | Product Description | Critical Silicon Part | Current Stock | Daily Burn | Net Runway | Safety Buffer | Stockout P | Financial Exposure |
|---|---|---|---|---|---|---|---|---|
| **SKU-441** | **Industrial Motor Controller v4** | MCU-441 Microcontroller | 1,420 units | 125 units/d | **11.0 Days** | 21 Days | **78%** | **₹1.42 Cr** |
| **SKU-108** | **SiC Power MOSFET Module** | SiC Substrate & Die | 640 units | 55 units/d | **11.0 Days** | 20 Days | **82%** | **₹2.10 Cr** |
| **SKU-205** | **High-Voltage Power Inverter** | IGBT-312 Gate Driver | 860 units | 45 units/d | **19.0 Days** | 15 Days | **45%** | **₹86.4 L** |
| **SKU-808** | **Automotive Telematics Gateway** | RF-808 Baseband IC | 2,400 units | 160 units/d | **15.0 Days** | 20 Days | **64%** | **₹48.0 L** |
| **SKU-105** | **Smart Grid Diagnostic Sensor** | SEN-105 MEMS Sensor | 3,100 units | 110 units/d | **28.0 Days** | 14 Days | **18%** | **₹18.6 L** |
| **SKU-502** | **Battery Management System BMS-2** | BMS ASIC Manager | 920 units | 70 units/d | **13.0 Days** | 18 Days | **71%** | **₹64.4 L** |

### The "11-Day Cliff":
Both **SKU-441** and **SKU-108** enter stockout in 11.0 days. Because standard maritime feeder transit from Hsinchu and Singapore requires 18–21 days, an uncovered 7–10 day stockout gap exists without proactive physical intervention.

---

## 5. Downstream Customer Order Commitments (OEM Exposure)

| Order ID | Customer OEM | Target SKU | Units | Contract Value (INR) | Promised SLA | Daily Delay Penalty | Priority |
|---|---|---|---|---|---|---|---|
| **ORD-18421** | **Acme Automotive Global** | SKU-441 | 450 | **₹14,20,000** | 24 Sep 2026 | ₹25,000 / day | **CRITICAL** |
| **ORD-18425** | **Siemens Mobility India** | SKU-441 | 300 | **₹9,50,000** | 25 Sep 2026 | ₹18,000 / day | **HIGH** |
| **ORD-18432** | **Schneider Electric Solutions** | SKU-441 | 200 | **₹6,30,000** | 27 Sep 2026 | ₹12,000 / day | **MEDIUM** |
| **ORD-18440** | **ABB Industrial Systems** | SKU-205 | 180 | **₹18,00,000** | 02 Oct 2026 | ₹30,000 / day | **HIGH** |
| **ORD-18451** | **Tata Motors EV Division** | SKU-108 | 350 | **₹21,00,000** | 22 Sep 2026 | ₹45,000 / day | **CRITICAL** |
| **ORD-18458** | **Mahindra Electric Mobility** | SKU-108 | 220 | **₹13,20,000** | 26 Sep 2026 | ₹28,000 / day | **HIGH** |
| **ORD-18464** | **Bosch Mobility Systems** | SKU-808 | 600 | **₹12,00,000** | 29 Sep 2026 | ₹15,000 / day | **MEDIUM** |
| **ORD-18470** | **L&T Transportation Infra** | SKU-502 | 140 | **₹9,80,000** | 05 Oct 2026 | ₹20,000 / day | **MEDIUM** |

**Total Contracted Value Exposed**: ₹1,04,00,000 direct purchase orders.
**Compounded Risk Exposure**: ₹5,20,00,000 including automotive assembly line stoppage liability, cumulative late penalties, and emergency procurement premiums.

---

## 6. Multimodal Freight Corridors & Chokepoint Vulnerability

| Route ID | Corridor Name | Transport Mode | Operating Carrier | Baseline Transit | Chokepoints Traversed | Vulnerability Level |
|---|---|---|---|---|---|---|
| **RTE-001** | **Taiwan Fab $\rightarrow$ JNPT $\rightarrow$ Pune** | Maritime Feeder | Evergreen Marine / Maersk | 18 Days | Taiwan Strait, Strait of Malacca, Arabian Sea | **CRITICAL** |
| **RTE-002** | **Singapore Hub $\rightarrow$ JNPT $\rightarrow$ Pune** | Multimodal Air/Sea | DHL Global Forwarding | 11 Days | Strait of Malacca, Singapore Anchorage | **HIGH** |
| **RTE-003** | **Munich Fab $\rightarrow$ Mumbai BOM $\rightarrow$ Pune** | Dedicated Air Cargo | Lufthansa Cargo / Air India | 4 Days | Middle East Air Corridor | **MEDIUM** |
| **RTE-004** | **Austin Fab $\rightarrow$ Chennai Air $\rightarrow$ Bengaluru** | Air Freight Express | FedEx Express Cargo | 6 Days | Atlantic Trans-Ocean Corridor | **LOW** |
| **RTE-005** | **Kyoto Hub $\rightarrow$ Singapore $\rightarrow$ JNPT** | Ocean Container | Ocean Network Express (ONE) | 21 Days | South China Sea, Strait of Malacca | **LOW** |

---

## 7. The Active Crisis Cascade Scenario

```
[Geopolitical Tension in Strait of Hormuz] + [Naval Drills in Taiwan Strait]
                         │
                         ▼
        [Container Vessel Queuing at Singapore Outer Anchorage]
                         │
                         ▼ (+6.4 Days Queue Dwell Time)
      [Shipment SHP-8821 Delayed at Singapore Gateway]
                         │
                         ▼
      [Inbound Feeder Arrival P50 Slips from Day 14 to Day 21]
                         │
                         ▼
    [Pune Gigafactory MCU-441 Runway Exhausted at Day 11.0]
                         │
                         ▼
  [Line A Halted; ₹5.20 Cr Revenue at Risk; Tata & Acme Orders Breached]
```

---

## 8. Palantir Gotham-Style "Kill-Chain" Physical Mitigation Playbook

Sarvadarshi provides direct quantified mitigation hooks for operators to break the disruption cascade:

### Action 01: Emergency Air Lift Charter (SKU-441 MCU ICs)
- **Physical Action**: Dispatches air charter booking on Air India Cargo flight AI-1944 for 450 units of MCU-441 microcontroller ICs directly to Mumbai CSMI, bypassing the congested feeder maritime lane.
- **Protocol**: SITA Type B Air Waybill EDI / Webhook
- **Cost**: ₹8,50,000 INR ($10,200 USD)
- **Operational Delta**: -12.4 Days arrival advance
- **Outcome**: Restores runway from 11.0d to 23.4d; stockout probability plummets from 78% to 12%; protects Acme Automotive & Siemens Mobility lines.

### Action 02: Maritime Feeder Reroute (Shipment SHP-8821)
- **Physical Action**: Transmits EDI 315 instruction to Evergreen Marine port agent to divert container SHP-8821 away from outer anchorage queue into express berth via Sunda Strait alternate corridor.
- **Protocol**: EDI 315 Status / Carrier API Webhook
- **Cost**: ₹4,20,000 INR Bunker Surcharge
- **Operational Delta**: -6.4 Days queue reduction
- **Outcome**: Eliminates port dwell bottleneck; recovers transit buffer before line shutdown.

### Action 03: Dual-Source Volume Split (STMicroelectronics Ang Mo Kio)
- **Physical Action**: Transmits automated purchase order split via SAP Ariba to secondary qualified supplier STMicroelectronics, shifting 40% wafer fabrication volume to activate second source.
- **Protocol**: SAP Ariba cXML / EDI 850 Purchase Order
- **Cost**: ₹6,80,000 INR tooling & qualification
- **Operational Delta**: Establishes parallel 14-day supply pipeline
- **Outcome**: Single-source risk drops from 72/100 to 28/100.

### Return on Investment (ROI):
$$	ext{Total Mitigation Investment} = ₹8.5	ext{L} + ₹4.2	ext{L} + ₹6.8	ext{L} = ₹19,50,000 	ext{ (₹19.5 L)}$$
$$	ext{Preserved Revenue \& Avoided OEM Penalties} = ₹5,20,00,000 	ext{ (₹5.20 Cr)}$$
$$\mathbf{	ext{Return on Mitigation Investment (ROMI)}} = rac{₹5,20,00,000}{₹19,50,000} = \mathbf{26.6	imes}$$

---
*Generated by Sarvadarshi Supply Chain Intelligence System · Real-Time Bayesian Graph Analytics*
