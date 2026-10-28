export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const getToken = () => localStorage.getItem('token');

// a user's own Groq key (Settings → API Integrations) is sent with AI requests and wins over the server's
export const getGroqKey = () => {
  try { return localStorage.getItem('groq_api_key') || ''; } catch { return ''; }
};

export function apiHeaders(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  const key = getGroqKey();
  if (key) h['X-Groq-Key'] = key;
  return h;
}

/** fetch + JSON; throws an Error carrying the server's `detail` on a non-2xx response. */
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: apiHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && getToken()) {
      localStorage.removeItem('token');
      window.location.assign('/auth');
    }
    throw new Error((data && data.detail) || `Request failed (${res.status})`);
  }
  return data;
}

/** Floor area (m²) of a plan: the sum of its room elements. */
export function planArea(elements) {
  return (elements || []).filter(el => el && el.type === 'room')
    .reduce((s, el) => s + (Number(el.area) || ((el.width || 0) * (el.height || 0)) / 400), 0);
}

export function formatArea(m2, measurement = localStorage.getItem('pref_measurement') || 'metric') {
  if (!m2) return '—';
  return measurement === 'imperial'
    ? `${Math.round(m2 * 10.7639).toLocaleString()} sq ft`
    : `${Math.round(m2).toLocaleString()} m²`;
}

export const CURRENCY = {
  INR: { symbol: '₹', rate: 83 },
  USD: { symbol: '$', rate: 1 },
  EUR: { symbol: '€', rate: 0.9 },
};

export function currencyPref() {
  const code = localStorage.getItem('pref_currency') || 'INR';
  return { code, ...(CURRENCY[code] || CURRENCY.INR) };
}
