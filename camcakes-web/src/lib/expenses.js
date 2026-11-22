const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const num = (value) => (isNum(value) ? value : null);
const text = (value) => (value == null || typeof value === 'object' ? '' : String(value));

export function parsePeriodDays(period) {
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})|(\d{4})-(\d{1,2})-(\d{1,2})/g;
  const dates = [...String(period || '').matchAll(datePattern)].map((match) => {
    const day = Number(match[1] || match[6]);
    const month = Number(match[2] || match[5]);
    const year = Number(match[3] || match[4]);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return timestamp;
  }).filter((timestamp) => timestamp !== null);
  if (!dates.length) return null;
  const first = dates[0], last = dates[dates.length - 1];
  if (last < first) return null;
  return Math.floor((last - first) / 86400000) + 1;
}

export function parseExpenses(sheet) {
  if (!sheet) return null;

  const frequencies = [];
  for (let row = 5; row <= 11; row++) {
    frequencies.push({ row, name: text(sheet.get(`J${row}`)).trim(), payments: num(sheet.get(`K${row}`)) });
  }
  const categories = [];
  for (let row = 15; row <= 21; row++) {
    categories.push({ row, name: text(sheet.get(`J${row}`)).trim() });
  }
  const fixed = [];
  for (let row = 39; row <= 68; row++) {
    fixed.push({
      row,
      name: text(sheet.get(`A${row}`)),
      category: text(sheet.get(`B${row}`)),
      frequency: text(sheet.get(`C${row}`)),
      amount: num(sheet.get(`D${row}`)),
      include: text(sheet.get(`E${row}`)) || 'SI',
      notes: text(sheet.get(`H${row}`)),
    });
  }
  const variable = [];
  for (let row = 73; row <= 82; row++) {
    variable.push({
      row,
      name: text(sheet.get(`A${row}`)),
      rate: num(sheet.get(`B${row}`)),
      include: text(sheet.get(`C${row}`)) || 'SI',
      notes: text(sheet.get(`E${row}`)),
    });
  }
  const scenarios = [];
  for (let row = 30; row <= 35; row++) {
    scenarios.push({ row, factor: num(sheet.get(`B${row}`)) });
  }

  return {
    periodDays: num(sheet.get('B5')) ?? 30,
    source: text(sheet.get('B7')) || 'Hoja Ventas',
    manualSales: num(sheet.get('B8')),
    manualMargin: num(sheet.get('B9')),
    frequencies,
    categories,
    fixed,
    variable,
    scenarios,
  };
}

export function computeExpenses(expenses, costs, sales, posPeriodDays = null) {
  if (!expenses) return null;

  const averageMargin = (() => {
    const margins = costs.prods
      .filter((product) => product.tipo !== 'MYO' && isNum(product.pct))
      .map((product) => 1 - product.pct);
    return margins.length ? margins.reduce((sum, margin) => sum + margin, 0) / margins.length : null;
  })();
  const fromSales = expenses.source === 'Hoja Ventas';
  const revenue = fromSales ? (sales ? sales.totals.sinIva : null) : expenses.manualSales;
  const costOfSales = fromSales
    ? (sales ? sales.costoTotal : null)
    : (isNum(revenue) ? revenue * (1 - (isNum(expenses.manualMargin) ? expenses.manualMargin : averageMargin ?? 0)) : null);
  const grossProfit = isNum(revenue) && isNum(costOfSales) ? revenue - costOfSales : null;
  const grossMargin = isNum(revenue) && revenue > 0
    ? grossProfit / revenue
    : (isNum(expenses.manualMargin) ? expenses.manualMargin : averageMargin);

  const frequencyByName = new Map(expenses.frequencies.map((frequency) => [frequency.name, frequency.payments]));
  const fixed = expenses.fixed.map((item) => {
    const payments = frequencyByName.get(item.frequency);
    const active = Boolean(item.name.trim()) && item.include !== 'NO';
    const monthly = active && isNum(item.amount) && isNum(payments) ? item.amount * payments / 12 : 0;
    return {
      ...item,
      monthly,
      period: monthly * 12 / 365 * expenses.periodDays,
      periodPos: isNum(posPeriodDays) ? monthly * 12 / 365 * posPeriodDays : null,
    };
  });
  const fixedTotal = fixed.reduce((sum, item) => sum + item.period, 0);
  const fixedMonthly = fixed.reduce((sum, item) => sum + item.monthly, 0);
  const fixedPosTotal = isNum(posPeriodDays) ? fixed.reduce((sum, item) => sum + item.periodPos, 0) : null;
  const variable = expenses.variable.map((item) => {
    const active = Boolean(item.name.trim()) && item.include !== 'NO' && isNum(item.rate);
    return { ...item, period: active && isNum(revenue) ? item.rate * revenue : 0 };
  });
  const variableRate = variable.reduce((sum, item) => (
    sum + (item.name.trim() && item.include !== 'NO' && isNum(item.rate) ? item.rate : 0)
  ), 0);
  const variableTotal = variable.reduce((sum, item) => sum + item.period, 0);
  const marginAfterVariable = isNum(grossMargin) ? grossMargin - variableRate : null;
  const breakEven = isNum(marginAfterVariable) && marginAfterVariable > 0 ? fixedTotal / marginAfterVariable : null;
  const categoryTotals = expenses.categories.map(({ name }) => ({
    name,
    monthly: fixed.filter((item) => item.category === name).reduce((sum, item) => sum + item.monthly, 0),
    period: fixed.filter((item) => item.category === name).reduce((sum, item) => sum + item.period, 0),
    periodPos: isNum(posPeriodDays) ? fixed.filter((item) => item.category === name).reduce((sum, item) => sum + item.periodPos, 0) : null,
  }));
  const otherCategory = {
    name: 'Sin categoría / otra',
    monthly: fixedMonthly - categoryTotals.reduce((sum, item) => sum + item.monthly, 0),
    period: fixedTotal - categoryTotals.reduce((sum, item) => sum + item.period, 0),
    periodPos: isNum(posPeriodDays) ? fixedPosTotal - categoryTotals.reduce((sum, item) => sum + item.periodPos, 0) : null,
  };
  categoryTotals.push(otherCategory);

  return {
    revenue,
    costOfSales,
    grossProfit,
    grossMargin,
    averageMargin,
    fixed,
    fixedTotal,
    fixedMonthly,
    fixedPosTotal,
    posPeriodDays: isNum(posPeriodDays) ? posPeriodDays : null,
    variable,
    variableRate,
    variableTotal,
    profitAfterExpenses: isNum(grossProfit) ? grossProfit - fixedTotal - variableTotal : null,
    marginAfterVariable,
    breakEven,
    dailyBreakEven: isNum(breakEven) && expenses.periodDays > 0 ? breakEven / expenses.periodDays : null,
    breakEvenProgress: isNum(breakEven) && breakEven > 0 && isNum(revenue) ? revenue / breakEven : null,
    categoryTotals,
    scenarios: expenses.scenarios.map(({ row, factor }) => ({
      row,
      factor,
      revenue: isNum(breakEven) && isNum(factor) ? factor * breakEven : null,
      grossProfit: isNum(breakEven) && isNum(factor) && isNum(grossMargin) ? factor * breakEven * grossMargin : null,
      fixed: isNum(breakEven) && isNum(factor) ? fixedTotal : null,
      variable: isNum(breakEven) && isNum(factor) ? factor * breakEven * variableRate : null,
      profit: isNum(breakEven) && isNum(factor) && isNum(grossMargin)
        ? factor * breakEven * marginAfterVariable - fixedTotal
        : null,
    })),
  };
}
