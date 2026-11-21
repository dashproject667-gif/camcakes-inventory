export function parseMonthValue(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function buildPeriodList(startValue, endValue) {
  const start = parseMonthValue(startValue);
  const end = parseMonthValue(endValue);
  if (!start || !end) throw new Error('Selecciona una fecha inicial y final válidas.');
  const startNumber = start.year * 12 + start.month - 1;
  const endNumber = end.year * 12 + end.month - 1;
  if (endNumber < startNumber) throw new Error('El periodo final no puede ser anterior al periodo inicial.');
  if (endNumber - startNumber + 1 > 240) throw new Error('Selecciona un rango máximo de 240 meses.');

  const periods = [];
  for (let value = startNumber; value <= endNumber; value++) {
    const year = Math.floor(value / 12);
    const month = value % 12 + 1;
    periods.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return periods;
}
