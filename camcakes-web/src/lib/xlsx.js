// Lector / parchador mínimo de .xlsx (sin dependencias de hoja de cálculo).
// - readXlsx: lee valores y fórmulas de todas las hojas.
// - patchXlsx: cambia SOLO celdas de captura y deja intactos estilos, fórmulas,
//   validaciones y formatos condicionales del libro original.
import JSZip from 'jszip';

let _DOMParser = typeof DOMParser !== 'undefined' ? DOMParser : null;
let _XMLSerializer = typeof XMLSerializer !== 'undefined' ? XMLSerializer : null;
/** Para pruebas en Node (xmldom). */
export function setXmlImpl(P, S) { _DOMParser = P; _XMLSerializer = S; }

const parse = (xml) => new _DOMParser().parseFromString(xml, 'application/xml');
const kids = (el, tag) => Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.nodeName === tag);

function colToNum(col) { let n = 0; for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
export function numToCol(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
export function splitRef(ref) { const m = /^([A-Z]+)(\d+)$/.exec(ref); return { col: m[1], row: +m[2], colN: colToNum(m[1]) }; }

function textOf(node) {
  // concatena <t> (incluye runs enriquecidos <r><t>)
  let out = '';
  const walk = (n) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType !== 1) continue;
      if (c.nodeName === 't') out += c.textContent;
      else if (c.nodeName === 'rPh') continue; // fonética
      else walk(c);
    }
  };
  walk(node);
  return out;
}

async function loadParts(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const wbDoc = parse(wbXml); const relDoc = parse(relsXml);
  const rels = {};
  for (const r of Array.from(relDoc.getElementsByTagName('Relationship'))) rels[r.getAttribute('Id')] = r.getAttribute('Target');
  const sheets = [];
  for (const s of Array.from(wbDoc.getElementsByTagName('sheet'))) {
    const rid = s.getAttribute('r:id');
    let target = rels[rid];
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    sheets.push({ name: s.getAttribute('name'), path: target });
  }
  return { zip, sheets };
}

export async function readXlsx(buffer) {
  const { zip, sheets } = await loadParts(buffer);
  let shared = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const doc = parse(await ssFile.async('string'));
    shared = Array.from(doc.getElementsByTagName('si')).map((si) => textOf(si));
  }
  const out = {};
  for (const sh of sheets) {
    const doc = parse(await zip.file(sh.path).async('string'));
    const cells = new Map();
    for (const c of Array.from(doc.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r'); const t = c.getAttribute('t');
      const vEl = kids(c, 'v')[0]; const fEl = kids(c, 'f')[0]; const isEl = kids(c, 'is')[0];
      let v = null;
      if (t === 'inlineStr' && isEl) v = textOf(isEl);
      else if (vEl) {
        const raw = vEl.textContent;
        if (t === 's') v = shared[+raw];
        else if (t === 'str') v = raw;
        else if (t === 'b') v = raw === '1';
        else if (t === 'e') v = { error: raw };
        else v = raw === '' ? null : Number(raw);
      }
      if (v === null && !fEl) continue;
      cells.set(ref, { v, f: !!fEl });
    }
    out[sh.name] = { cells, get: (ref) => (cells.get(ref) ? cells.get(ref).v : null) };
  }
  return out;
}

/**
 * ops: { [sheetName]: Array<{ref, value}> }  value: number | string | null (vaciar)
 * opts.clearRanges: { [sheetName]: Array<{rows:[a,b], cols:[ 'A','S' ]}> } celdas de captura a vaciar
 * Devuelve Uint8Array del nuevo .xlsx.
 */
export async function patchXlsx(buffer, ops, opts = {}) {
  const { zip, sheets } = await loadParts(buffer);
  const byName = Object.fromEntries(sheets.map((s) => [s.name, s]));
  const ser = new _XMLSerializer();
  const formulaSheets = new Set(opts.formulaTransformSheets || []);
  const touched = new Set([...Object.keys(ops), ...Object.keys(opts.clearRanges || {}), ...formulaSheets]);
  const log = { written: 0, skippedFormula: [], transformedFormulas: 0 };

  const setCell = (doc, sheetData, ref, value, sheetName) => {
    const { row, colN } = splitRef(ref);
    let rowEl = null;
    for (const r of kids(sheetData, 'row')) {
      const rn = +r.getAttribute('r');
      if (rn === row) { rowEl = r; break; }
      if (rn > row) { rowEl = doc.createElementNS(sheetData.namespaceURI, 'row'); rowEl.setAttribute('r', String(row)); sheetData.insertBefore(rowEl, r); break; }
    }
    if (!rowEl) { rowEl = doc.createElementNS(sheetData.namespaceURI, 'row'); rowEl.setAttribute('r', String(row)); sheetData.appendChild(rowEl); }
    let cEl = null;
    for (const c of kids(rowEl, 'c')) {
      const cn = splitRef(c.getAttribute('r')).colN;
      if (cn === colN) { cEl = c; break; }
      if (cn > colN) { cEl = doc.createElementNS(sheetData.namespaceURI, 'c'); cEl.setAttribute('r', ref); rowEl.insertBefore(cEl, c); break; }
    }
    if (!cEl) { cEl = doc.createElementNS(sheetData.namespaceURI, 'c'); cEl.setAttribute('r', ref); rowEl.appendChild(cEl); }
    if (kids(cEl, 'f').length) { log.skippedFormula.push(`${sheetName}!${ref}`); return; }
    for (const ch of Array.from(cEl.childNodes)) cEl.removeChild(ch);
    cEl.removeAttribute('t');
    if (value === null || value === undefined || value === '') { log.written++; return; }
    if (typeof value === 'number') {
      const v = doc.createElementNS(sheetData.namespaceURI, 'v'); v.appendChild(doc.createTextNode(String(value))); cEl.appendChild(v);
    } else {
      cEl.setAttribute('t', 'inlineStr');
      const is = doc.createElementNS(sheetData.namespaceURI, 'is'); const t = doc.createElementNS(sheetData.namespaceURI, 't');
      t.setAttribute('xml:space', 'preserve'); t.appendChild(doc.createTextNode(String(value))); is.appendChild(t); cEl.appendChild(is);
    }
    log.written++;
  };

  for (const sh of sheets) {
    const doc = parse(await zip.file(sh.path).async('string'));
    const sheetData = doc.getElementsByTagName('sheetData')[0];
    // 1) vaciados y escrituras; las fórmulas y sus resultados guardados se conservan.
    if (touched.has(sh.name)) {
      for (const rg of (opts.clearRanges || {})[sh.name] || []) {
        for (let r = rg.rows[0]; r <= rg.rows[1]; r++) for (let cn = colToNum(rg.cols[0]); cn <= colToNum(rg.cols[1]); cn++) setCell(doc, sheetData, numToCol(cn) + r, null, sh.name);
      }
      for (const op of ops[sh.name] || []) setCell(doc, sheetData, op.ref, op.value, sh.name);
      if (formulaSheets.has(sh.name) && typeof opts.transformFormula === 'function') {
        for (const cell of Array.from(doc.getElementsByTagName('c'))) {
          const formula = kids(cell, 'f')[0];
          if (!formula) continue;
          const current = formula.textContent || '';
          const next = opts.transformFormula(sh.name, cell.getAttribute('r'), current);
          if (typeof next === 'string' && next !== current) {
            formula.textContent = next;
            log.transformedFormulas++;
          }
        }
      }
    }
    zip.file(sh.path, ser.serializeToString(doc));
  }
  // 2) conservar los resultados visibles y pedir a Excel que recalcule los valores afectados.
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const wbDoc = parse(wbXml);
  let calc = wbDoc.getElementsByTagName('calcPr')[0];
  if (!calc) { calc = wbDoc.createElementNS(wbDoc.documentElement.namespaceURI, 'calcPr'); wbDoc.documentElement.appendChild(calc); }
  calc.setAttribute('calcMode', 'auto');
  calc.setAttribute('fullCalcOnLoad', '1');
  calc.setAttribute('forceFullCalc', '1');
  zip.file('xl/workbook.xml', ser.serializeToString(wbDoc));
  if (zip.file('xl/calcChain.xml')) {
    zip.remove('xl/calcChain.xml');
    const ctFile = zip.file('[Content_Types].xml');
    if (ctFile) {
      const ct = await ctFile.async('string');
      zip.file('[Content_Types].xml', ct.replace(/<Override[^>]*calcChain[^>]*\/>/, ''));
    }
    const relsFile = zip.file('xl/_rels/workbook.xml.rels');
    if (relsFile) {
      const rels = await relsFile.async('string');
      zip.file('xl/_rels/workbook.xml.rels', rels.replace(/<Relationship[^>]*calcChain[^>]*\/>/, ''));
    }
  }
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, log };
}
