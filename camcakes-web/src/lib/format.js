const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mxn0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
export const money = (n) => (isNum(n) ? mxn.format(n) : '—');
export const money0 = (n) => (isNum(n) ? mxn0.format(n) : '—');
export const money4 = (n) => (isNum(n) ? '$' + n.toFixed(4) : '—');
export const num = (n, d = 1) => (isNum(n) ? n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: d }) : '—');
export const pct = (n, d = 0) => (isNum(n) ? (n * 100).toFixed(d) + '%' : '—');
export const today = () => new Date().toISOString().slice(0, 10);
export const longDate = () => new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
/** semáforo de costo sobre precio neto */
export function costTone(p, goal = 0.35) { if (!isNum(p)) return 'none'; if (p <= goal) return 'good'; if (p <= goal + 0.1) return 'warn'; return 'bad'; }
