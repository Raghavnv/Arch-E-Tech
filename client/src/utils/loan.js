/* Home loan maths, shared by the loan planner and the options comparison. Amounts are rupees. */
export const lakh = (v) => {
  const n = Math.round(Number(v) || 0);
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};
export const rupees = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
export const emiOf = (P, ratePct, years) => {
  const r = ratePct / 1200, n = Math.round(years * 12);
  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / n;
  const k = (1 + r) ** n;
  return (P * r * k) / (k - 1);
};
export const loanFor = (emi, ratePct, years) => {
  const r = ratePct / 1200, n = Math.round(years * 12);
  if (emi <= 0 || n <= 0) return 0;
  if (r === 0) return emi * n;
  const k = (1 + r) ** n;
  return (emi * (k - 1)) / (r * k);
};
// RBI's loan-to-value limits for home loans
export const ltvCap = (cost) => (cost <= 30e5 ? 0.9 : cost <= 75e5 ? 0.8 : 0.75);

/** The loan settings the owner last used in the loan planner for this project (rate, years, savings, land). */
export function loanSettings(projectId) {
  try { return JSON.parse(localStorage.getItem(`loan_${projectId || 'draft'}`) || '{}'); } catch { return {}; }
}

/** Monthly EMI for a house costing `cost` rupees, with the owner's own loan settings (or 25 % down, 8.5 %, 20 years). */
export function emiForCost(cost, settings = {}) {
  const land = Math.max(0, Number(settings.land) || 0);
  const savings = settings.savings != null ? Math.max(0, Number(settings.savings) || 0) : cost * 0.25;
  const rate = Number(settings.rate) || 8.5, years = Math.min(30, Math.max(1, Number(settings.years) || 20));
  const total = cost + land;
  const loan = Math.min(Math.max(0, total - savings), total * ltvCap(total));
  return emiOf(loan, rate, years);
}
