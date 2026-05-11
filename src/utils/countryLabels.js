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
  'malta': 'MT',
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
  return country;
}

const flagImageCache = new Map();

function flagImage(country, redraw) {
  const code = countryCode(country).toLowerCase();
  if (code === '--') return null;

  const url = `https://flagcdn.com/w40/${code}.png`;
  if (flagImageCache.has(url)) return flagImageCache.get(url);

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = redraw;
  image.src = url;
  flagImageCache.set(url, image);
  return image;
}

export function countryFlagPlugin(countries, id) {
  return {
    id: `country-flag-labels-${id}`,
    afterDraw(chart) {
      const yScale = chart.scales.y;
      if (!yScale) return;

      const { ctx } = chart;
      yScale.ticks.forEach((tick) => {
        const index = tick.value;
        const country = countries[index];
        const image = flagImage(country, () => chart.draw());
        if (!image?.complete || image.naturalWidth === 0) return;

        const x = yScale.left + 2;
        const y = yScale.getPixelForValue(index) - 6;
        ctx.save();
        ctx.drawImage(image, x, y, 18, 12);
        ctx.restore();
      });
    },
  };
}
