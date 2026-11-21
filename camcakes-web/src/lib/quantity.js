export function parseQuantityExpression(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const text = String(value).trim().replace(/,/g, '.');
  if (!text) return null;
  if (!/^\s*\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)*\s*$/.test(text)) return null;
  const total = text.split('+').reduce((sum, part) => sum + Number(part.trim()), 0);
  return Number.isFinite(total) ? total : null;
}

export function normalizeInitialStock(closed, open, presentationSize) {
  const closedValue = parseQuantityExpression(closed) ?? 0;
  const openValue = parseQuantityExpression(open) ?? 0;
  if (!Number.isFinite(presentationSize) || presentationSize <= 0) {
    return { cerradas: Math.max(0, closedValue), abierta: Math.max(0, openValue), presentaciones: closedValue + openValue, original: closedValue + openValue };
  }
  let cerradas = Math.max(0, closedValue);
  let abierta = Math.max(0, openValue);
  if (abierta >= presentationSize) {
    cerradas += Math.floor(abierta / presentationSize);
    abierta = abierta - Math.floor(abierta / presentationSize) * presentationSize;
  }
  const presentaciones = cerradas + abierta / presentationSize;
  return {
    cerradas,
    abierta: Math.round(abierta * 1e6) / 1e6,
    presentaciones: Math.round(presentaciones * 1e6) / 1e6,
    original: cerradas * presentationSize + abierta,
  };
}
