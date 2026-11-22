import { norm } from './engine.js';

const COLUMNS = 'ABCDEFGHIJKLMNOPQRS';
const clean = (value) => String(value ?? '').trim();
const numeric = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function categoryForMenu(category) {
  const value = norm(category);
  if (value.includes('no coffee')) return 'No coffee';
  if (value.includes('cafe')) return 'Café';
  if (value.includes('malteada')) return 'Malteada';
  if (value.includes('premium')) return 'Premium';
  if (value === 'myo' || value.includes('make your own')) return 'MYO';
  if (value.includes('clasica')) return 'Clásica';
  if (value.includes('crepa') || value.includes('dubai') || value.includes('especial')) return 'Especial';
  return clean(category);
}

function headerMap(sheet, headerRow) {
  const headers = new Map();
  for (const column of COLUMNS) {
    const text = norm(sheet.get(`${column}${headerRow}`));
    if (text) headers.set(text, column);
  }
  const find = (prefix) => [...headers].find(([text]) => text.startsWith(prefix))?.[1] || null;
  return {
    name: find('nombre'),
    price: find('precio'),
    category: find('categoria'),
    productId: find('id de producto'),
    optionNames: [find('opcion1 nombre'), find('opcion2 nombre'), find('opcion3 nombre')],
    optionValues: [find('opcion1 valor'), find('opcion2 valor'), find('opcion3 valor')],
  };
}

export function parseOfficialMenu(sheets) {
  const sheet = Object.values(sheets || {})[0];
  if (!sheet) throw new Error('El archivo no contiene hojas.');

  let columns = null;
  for (let row = 1; row <= 10; row++) {
    const found = headerMap(sheet, row);
    if (found.name && found.price && found.category) { columns = { ...found, row }; break; }
  }
  if (!columns) throw new Error('No encontré las columnas Nombre, Precio y Categoría del menú oficial.');

  const groups = new Map();
  for (let row = columns.row + 1; row <= 10000; row++) {
    const name = clean(sheet.get(`${columns.name}${row}`));
    const productId = clean(columns.productId ? sheet.get(`${columns.productId}${row}`) : '');
    const category = clean(sheet.get(`${columns.category}${row}`));
    const price = numeric(sheet.get(`${columns.price}${row}`));
    if (!name && !productId) {
      if (row > columns.row + 1 && !category && price == null) break;
      continue;
    }

    const id = productId || `${norm(name)}|${norm(category)}`;
    let product = groups.get(id);
    if (!product) {
      product = { id, nombre: name, categoria: category, variantes: [] };
      groups.set(id, product);
    }
    if (!product.nombre && name) product.nombre = name;
    if (!product.categoria && category) product.categoria = category;
    if (price != null) {
      const opciones = columns.optionNames.map((column, index) => {
        const option = column ? clean(sheet.get(`${column}${row}`)) : '';
        const valueColumn = columns.optionValues[index];
        const value = valueColumn ? clean(sheet.get(`${valueColumn}${row}`)) : '';
        return option && value ? `${option}: ${value}` : '';
      }).filter(Boolean);
      product.variantes.push({ precio: price, opciones });
    }
  }

  const products = [...groups.values()].filter((product) => product.nombre && product.variantes.length);
  if (!products.length) throw new Error('No encontré productos con nombre y precio en el menú oficial.');

  return products.map((product) => {
    const standardVariant = product.variantes.find((variant) => variant.opciones.some((option) => norm(option) === 'leche entera'));
    const price = (standardVariant || product.variantes[0]).precio;
    const prices = [...new Set(product.variantes.map((variant) => variant.precio))];
    return {
      ...product,
      precio: price,
      preciosVariantes: prices,
      categoriaModelo: categoryForMenu(product.categoria),
    };
  });
}

function similarity(left, right) {
  const a = norm(left);
  const b = norm(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.85 + 0.15;
  const aWords = new Set(a.split(' '));
  const bWords = new Set(b.split(' '));
  const common = [...aWords].filter((word) => bWords.has(word)).length;
  return common / new Set([...aWords, ...bWords]).size;
}

export function suggestMenuMatches(imported, products) {
  return products.map((product) => {
    const nameSimilarity = similarity(imported.nombre, product.nombre);
    const samePrice = imported.precio === product.precio;
    const sameCategory = norm(imported.categoriaModelo) === norm(product.cat);
    const reasons = [];
    if (nameSimilarity >= 0.35) reasons.push(nameSimilarity === 1 ? 'Nombre igual' : 'Nombre parecido');
    if (samePrice) reasons.push('Mismo precio');
    if (sameCategory) reasons.push('Misma categoría');
    if (nameSimilarity < 0.35 && !samePrice && !sameCategory) return null;

    return {
      product,
      reasons,
      score: nameSimilarity * 3 + (samePrice ? 1.5 : 0) + (sameCategory ? 1 : 0),
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 5);
}

export function defaultProductType(category, name) {
  const value = norm(`${category} ${name}`);
  if (value.includes('myo') || value.includes('make your own')) return 'MYO';
  if (/\b(cafe|coffee|bebida|latte|matcha|chai|malteada|chocolate caliente)\b/.test(value)) return 'Bebida';
  if (norm(category) === 'clasica') return 'Clásica';
  return 'Especial';
}

export function shouldApplyImportedPrice(item, product) {
  return !(product?.tipo === 'MYO' && item?.precio === 0);
}

export { categoryForMenu };
