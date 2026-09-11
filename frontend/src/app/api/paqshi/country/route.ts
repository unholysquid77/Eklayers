import { NextResponse } from 'next/server';

/**
 * PAQSHI — Country live intelligence (R2-16 fusion).
 * The region-dossier panel gives static country facts (Wikidata/Wikipedia).
 * This overlays Paqshi's LIVE view: ongoing/resolved disruptions for that
 * country. The region-dossier reverse-geocode returns a 2-letter code (cca2);
 * Paqshi keys its country intel on ISO3, so we translate here.
 */
const PAQSHI_API = process.env.PAQSHI_API_URL || 'http://127.0.0.1:8000';

// cca2 -> iso3 for the sovereign states Paqshi tracks. Not exhaustive of every
// dependent territory, but covers the countries that carry disruption intel.
const ISO2_TO_ISO3: Record<string, string> = {
  AF: 'AFG', AL: 'ALB', DZ: 'DZA', AO: 'AGO', AR: 'ARG', AM: 'ARM', AU: 'AUS',
  AT: 'AUT', AZ: 'AZE', BH: 'BHR', BD: 'BGD', BY: 'BLR', BE: 'BEL', BJ: 'BEN',
  BO: 'BOL', BA: 'BIH', BW: 'BWA', BR: 'BRA', BN: 'BRN', BG: 'BGR', BF: 'BFA',
  BI: 'BDI', KH: 'KHM', CM: 'CMR', CA: 'CAN', CF: 'CAF', TD: 'TCD', CL: 'CHL',
  CN: 'CHN', CO: 'COL', CG: 'COG', CD: 'COD', CR: 'CRI', CI: 'CIV', HR: 'HRV',
  CU: 'CUB', CY: 'CYP', CZ: 'CZE', DK: 'DNK', DJ: 'DJI', DO: 'DOM', EC: 'ECU',
  EG: 'EGY', SV: 'SLV', GQ: 'GNQ', ER: 'ERI', EE: 'EST', ET: 'ETH', FI: 'FIN',
  FR: 'FRA', GA: 'GAB', GM: 'GMB', GE: 'GEO', DE: 'DEU', GH: 'GHA', GR: 'GRC',
  GT: 'GTM', GN: 'GIN', GW: 'GNB', GY: 'GUY', HT: 'HTI', HN: 'HND', HU: 'HUN',
  IS: 'ISL', IN: 'IND', ID: 'IDN', IR: 'IRN', IQ: 'IRQ', IE: 'IRL', IL: 'ISR',
  IT: 'ITA', JM: 'JAM', JP: 'JPN', JO: 'JOR', KZ: 'KAZ', KE: 'KEN', KP: 'PRK',
  KR: 'KOR', KW: 'KWT', KG: 'KGZ', LA: 'LAO', LV: 'LVA', LB: 'LBN', LS: 'LSO',
  LR: 'LBR', LY: 'LBY', LT: 'LTU', LU: 'LUX', MG: 'MDG', MW: 'MWI', MY: 'MYS',
  ML: 'MLI', MT: 'MLT', MR: 'MRT', MX: 'MEX', MD: 'MDA', MN: 'MNG', ME: 'MNE',
  MA: 'MAR', MZ: 'MOZ', MM: 'MMR', NA: 'NAM', NP: 'NPL', NL: 'NLD', NZ: 'NZL',
  NI: 'NIC', NE: 'NER', NG: 'NGA', MK: 'MKD', NO: 'NOR', OM: 'OMN', PK: 'PAK',
  PS: 'PSE', PA: 'PAN', PG: 'PNG', PY: 'PRY', PE: 'PER', PH: 'PHL', PL: 'POL',
  PT: 'PRT', QA: 'QAT', RO: 'ROU', RU: 'RUS', RW: 'RWA', SA: 'SAU', SN: 'SEN',
  RS: 'SRB', SL: 'SLE', SG: 'SGP', SK: 'SVK', SI: 'SVN', SO: 'SOM', ZA: 'ZAF',
  SS: 'SSD', ES: 'ESP', LK: 'LKA', SD: 'SDN', SE: 'SWE', CH: 'CHE', SY: 'SYR',
  TW: 'TWN', TJ: 'TJK', TZ: 'TZA', TH: 'THA', TG: 'TGO', TN: 'TUN', TR: 'TUR',
  TM: 'TKM', UG: 'UGA', UA: 'UKR', AE: 'ARE', GB: 'GBR', US: 'USA', UY: 'URY',
  UZ: 'UZB', VE: 'VEN', VN: 'VNM', YE: 'YEM', ZM: 'ZMB', ZW: 'ZWE',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('cc') || searchParams.get('iso') || '').trim().toUpperCase();
  if (!raw) return NextResponse.json({ error: 'missing cc' }, { status: 400 });
  const iso3 = raw.length === 3 ? raw : (ISO2_TO_ISO3[raw] || '');
  if (!iso3) return NextResponse.json({ iso3: '', ongoing: [], resolved: [], counts: { ongoing: 0, resolved: 0 } });
  try {
    const res = await fetch(`${PAQSHI_API}/ui/country/${iso3}/disruptions`, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 45 },
    });
    if (!res.ok) return NextResponse.json({ iso3, ongoing: [], resolved: [], counts: { ongoing: 0, resolved: 0 }, error: `paqshi ${res.status}` });
    const d = await res.json();
    const norm = (x: any) => ({
      title: x.title || x.name || x.headline || '',
      summary: x.summary || x.read || x.description || '',
      severity: Number(x.severity ?? x.stress ?? x.score ?? 0) || 0,
      category: x.category || x.domain || '',
    });
    const ongoing = (d.ongoing || []).map(norm).filter((x: any) => x.title);
    const resolved = (d.resolved || []).map(norm).filter((x: any) => x.title);
    return NextResponse.json({
      iso3,
      ongoing,
      resolved,
      counts: d.counts || { ongoing: ongoing.length, resolved: resolved.length },
    });
  } catch (e: any) {
    return NextResponse.json({ iso3, ongoing: [], resolved: [], counts: { ongoing: 0, resolved: 0 }, error: String(e?.message || e) });
  }
}
