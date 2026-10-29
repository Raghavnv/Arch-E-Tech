// Areas, lengths and money in the units chosen in Settings: square feet and rupees unless changed.

const SQFT_PER_M2 = 10.7639;
const FT_PER_M = 3.28084;

// rough exchange rates; the studio's cost rates are kept in US dollars and converted for display
export const CURRENCY = {
  INR: { symbol: '₹', rate: 83, locale: 'en-IN' },
  USD: { symbol: '$', rate: 1, locale: 'en-US' },
  EUR: { symbol: '€', rate: 0.92, locale: 'de-DE' },
};

const read = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};

export const measurement = () => read('pref_measurement', 'imperial');   // 'imperial' | 'metric'
export const currencyCode = () => (CURRENCY[read('pref_currency', 'INR')] ? read('pref_currency', 'INR') : 'INR');
export const isImperial = () => measurement() !== 'metric';

/** 116 m² -> "1,249 sq ft" (or "116 m²" in metric). */
export function formatArea(m2, { short = false } = {}) {
  const v = Number(m2) || 0;
  if (isImperial()) return `${Math.round(v * SQFT_PER_M2).toLocaleString('en-IN')} ${short ? 'ft²' : 'sq ft'}`;
  return `${Math.round(v).toLocaleString('en-IN')} m²`;
}

/** 4.2 m -> "13.8 ft" (or "4.2 m"). */
export function formatLength(m, digits = 1) {
  const v = Number(m) || 0;
  return isImperial() ? `${(v * FT_PER_M).toFixed(digits)} ft` : `${v.toFixed(digits)} m`;
}

/** Two dimensions in the chosen unit: "13.8 × 16.4 ft". */
export function formatSize(wM, dM, digits = 1) {
  const k = isImperial() ? FT_PER_M : 1;
  return `${((Number(wM) || 0) * k).toFixed(digits)} × ${((Number(dM) || 0) * k).toFixed(digits)} ${isImperial() ? 'ft' : 'm'}`;
}

/** An amount in US dollars shown in the chosen currency, grouped the local way (₹12,34,500). */
export function formatMoney(usd) {
  const c = CURRENCY[currencyCode()];
  return `${c.symbol}${Math.round((Number(usd) || 0) * c.rate).toLocaleString(c.locale)}`;
}

export const currencySymbol = () => CURRENCY[currencyCode()].symbol;
export const currencyRate = () => CURRENCY[currencyCode()].rate;
