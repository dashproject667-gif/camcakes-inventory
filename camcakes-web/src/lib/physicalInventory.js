import JSZip from 'jszip';
import { key, norm } from './engine.js';

const columnName = (number) => {
  let result = '';
  while (number) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
};

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export async function buildPhysicalInventoryTemplate(inventory) {
  const zip = new JSZip();
  const rows = [
    ['Insumo', 'Categoría', 'Presentación', 'Cerradas', 'Abierta', 'Observaciones'],
    ...inventory.map(({ ins }) => [ins.name, ins.cat, ins.pres || ins.unit, '', '', '']),
  ];
  const sheetRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, columnIndex) => {
      if (value === '') return '';
      const ref = `${columnName(columnIndex + 1)}${rowNumber}`;
      if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join('');

  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Conteo fisico" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function buildPhysicalInventoryCsv(inventory) {
  const rows = [
    ['Insumo', 'Categoría', 'Presentación', 'Cerradas', 'Abierta', 'Observaciones'],
    ...inventory.map(({ ins }) => [ins.name, ins.cat, ins.pres || ins.unit, '', '', '']),
  ];
  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
}

function parseCsvRows(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiters = [',', ';', '\t'];
  let delimiter = ',';
  let maxCount = -1;
  for (const candidate of delimiters) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') {
        if (quoted && firstLine[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (firstLine[i] === candidate && !quoted) count++;
    }
    if (count > maxCount) {
      delimiter = candidate;
      maxCount = count;
    }
  }

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('El CSV tiene un campo entrecomillado sin cerrar.');
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function parsePhysicalInventoryCsv(text, inventory) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new Error('El archivo CSV está vacío.');
  const cells = new Map();
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    cells.set(`${columnName(columnIndex + 1)}${rowIndex + 1}`, { v: value });
  }));
  const sheet = {
    cells,
    get: (ref) => (cells.has(ref) ? cells.get(ref).v : null),
  };
  return parsePhysicalInventory({ 'Conteo fisico': sheet }, inventory);
}

const cellValue = (sheet, column, row) => sheet.get(`${column}${row}`);

function parseCount(value, sheetName, row, columnNameLabel, errors) {
  if (value == null || (typeof value === 'string' && !value.trim())) return undefined;
  const count = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(count) || count < 0) {
    errors.push(`Fila ${row} (${sheetName}): "${columnNameLabel}" debe ser un número igual o mayor que cero.`);
    return undefined;
  }
  return count;
}

export function parsePhysicalInventory(sheets, inventory) {
  const inventoryByName = new Map(inventory.map(({ ins }) => [key(ins.name), ins]));
  const headers = new Map();
  for (const [name, sheet] of Object.entries(sheets)) {
    for (const [ref] of sheet.cells) {
      const match = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!match || Number(match[2]) > 30) continue;
      const header = norm(sheet.get(ref));
      if (header === 'insumo' || header === 'nombre del insumo' || header === 'nombre insumo') {
        headers.set(name, { sheet, row: Number(match[2]), nameCol: match[1] });
        break;
      }
    }
  }

  let selected = null;
  for (const [name, header] of headers) {
    const columns = new Map();
    for (const [ref] of header.sheet.cells) {
      const match = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!match || Number(match[2]) !== header.row) continue;
      const value = norm(header.sheet.get(ref));
      if (['cerradas', 'cerrados', 'cerradas presentaciones'].includes(value)) columns.set('cerrados', match[1]);
      if (['abierta', 'abierto', 'abierta g ml restantes'].includes(value)) columns.set('abierto', match[1]);
      if (['contado', 'contado g ml', 'contado g ml pza'].includes(value)) columns.set('contado', match[1]);
    }
    if (columns.has('cerrados') || columns.has('abierto') || columns.has('contado')) {
      selected = { name, ...header, columns };
      break;
    }
  }
  if (!selected) {
    throw new Error('No encontré encabezados de conteo válidos. Usa "Insumo" con "Cerradas" y/o "Abierta", o el comparativo con "Contado".');
  }

  const counts = {};
  const unmatched = [];
  const errors = [];
  let matched = 0;
  let rowsWithValues = 0;
  for (const [ref] of selected.sheet.cells) {
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!match || Number(match[2]) <= selected.row || match[1] !== selected.nameCol) continue;
    const row = Number(match[2]);
    const name = String(cellValue(selected.sheet, selected.nameCol, row) ?? '').trim();
    if (!name) continue;
    const rawCerrados = selected.columns.has('cerrados')
      ? cellValue(selected.sheet, selected.columns.get('cerrados'), row)
      : undefined;
    const rawAbierto = selected.columns.has('abierto')
      ? cellValue(selected.sheet, selected.columns.get('abierto'), row)
      : undefined;
    const rawContado = selected.columns.has('contado')
      ? cellValue(selected.sheet, selected.columns.get('contado'), row)
      : undefined;
    if ([rawCerrados, rawAbierto, rawContado].every((value) => value == null || (typeof value === 'string' && !value.trim()))) continue;
    rowsWithValues++;
    const cerrados = selected.columns.has('cerrados')
      ? parseCount(rawCerrados, selected.name, row, 'Cerradas', errors)
      : undefined;
    const abierto = selected.columns.has('abierto')
      ? parseCount(rawAbierto, selected.name, row, 'Abierta', errors)
      : undefined;
    let totalCount = selected.columns.has('contado')
      ? parseCount(rawContado, selected.name, row, 'Contado', errors)
      : undefined;
    const ins = inventoryByName.get(key(name));
    if (!ins) {
      unmatched.push(name);
      continue;
    }
    if (cerrados === undefined && abierto === undefined && totalCount !== undefined) {
      if (typeof ins.gPres === 'number' && Number.isFinite(ins.gPres) && ins.gPres > 0) {
        const closed = Math.floor(totalCount / ins.gPres);
        totalCount = Math.round((totalCount - closed * ins.gPres) * 1e6) / 1e6;
        counts[key(ins.name)] = { cerrados: closed, abierto: totalCount };
      } else {
        counts[key(ins.name)] = { cerrados: 0, abierto: totalCount };
      }
      matched++;
      continue;
    }
    if (cerrados === undefined && abierto === undefined) continue;
    counts[key(ins.name)] = {
      ...(cerrados !== undefined ? { cerrados } : {}),
      ...(abierto !== undefined ? { abierto } : {}),
    };
    matched++;
  }
  if (rowsWithValues === 0) throw new Error('El archivo no contiene cantidades capturadas en las columnas de conteo.');
  if (matched === 0 && errors.length === 0) throw new Error('No encontré insumos del archivo que coincidan con el inventario actual.');
  return { counts, matched, unmatched, errors };
}
