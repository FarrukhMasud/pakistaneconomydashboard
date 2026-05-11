const COUNTRY_CODE_MAP = {
  'argentina': 'AR',
  'australia': 'AU',
  'austria': 'AT',
  'bahrain': 'BH',
  'bangladesh': 'BD',
  'belgium': 'BE',
  'canada': 'CA',
  'china': 'CN',
  'denmark': 'DK',
  'egypt': 'EG',
  'finland': 'FI',
  'france': 'FR',
  'germany': 'DE',
  'hong kong': 'HK',
  'hongkong': 'HK',
  'hungary': 'HU',
  'indonesia': 'ID',
  'iran': 'IR',
  'ireland': 'IE',
  'italy': 'IT',
  'japan': 'JP',
  'korea': 'KR',
  'korea (south)': 'KR',
  'korea, south': 'KR',
  'kuwait': 'KW',
  'lebanon': 'LB',
  'luxembourg': 'LU',
  'malaysia': 'MY',
  'netherlands': 'NL',
  'new zealand': 'NZ',
  'newzealand': 'NZ',
  'norway': 'NO',
  'oman': 'OM',
  'qatar': 'QA',
  'saudi arabia': 'SA',
  'singapore': 'SG',
  'south africa': 'ZA',
  'spain': 'ES',
  'sweden': 'SE',
  'switzerland': 'CH',
  'thailand': 'TH',
  'turkiye': 'TR',
  'turkey': 'TR',
  'u a e': 'AE',
  'u a e dubai': 'AE',
  'u.a.e': 'AE',
  'uae': 'AE',
  'uae dubai': 'AE',
  'united arab emirates': 'AE',
  'united kingdom': 'GB',
  'united states': 'US',
  'u k': 'GB',
  'uk': 'GB',
  'u s a': 'US',
  'usa': 'US',
  'afghanistan': 'AF',
  'india': 'IN',
  'brazil': 'BR',
  'russia': 'RU',
  'kenya': 'KE',
  'sri lanka': 'LK',
  'vietnam': 'VN',
  'philippines': 'PH',
  'poland': 'PL',
  'czech republic': 'CZ',
  'mexico': 'MX',
  'mauritius': 'MU',
  'tanzania': 'TZ',
  'iraq': 'IQ',
  'taiwan': 'TW',
};

function normalizeCountry(country) {
  return String(country || '')
    .toLowerCase()
    .replace(/\.\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countryCode(country) {
  const normalized = normalizeCountry(country);
  if (COUNTRY_CODE_MAP[normalized]) return COUNTRY_CODE_MAP[normalized];

  for (const [name, code] of Object.entries(COUNTRY_CODE_MAP)) {
    if (normalized.includes(name) || name.includes(normalized)) return code;
  }

  return '--';
}

export function countryLabel(country) {
  return `[${countryCode(country)}] ${country}`;
}
