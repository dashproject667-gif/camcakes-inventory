import fs from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { setXmlImpl, patchXlsx } from '../src/lib/xlsx.js';
setXmlImpl(DOMParser, XMLSerializer);
const base = '/mnt/user-data/attachments/f8278f82-73d4-5140-a69f-660e8379fa07/';
const buf = fs.readFileSync(base + 'b3efadb4-Monitor_Operacion_CamCakes.xlsx');
const { bytes, log } = await patchXlsx(buf, {
  Insumos: [{ ref: 'F9', value: 800 }, { ref: 'G9', value: 'Real' }, { ref: 'O70', value: 3 }, { ref: 'B70', value: 'Insumo de prueba' }, { ref: 'C70', value: 'g' }, { ref: 'E70', value: 1000 }, { ref: 'F70', value: 100 }],
  Parametros: [{ ref: 'B5', value: 100 }],
}, { clearRanges: { Ventas: [{ rows: [7, 11], cols: ['A', 'S'] }] } });
fs.writeFileSync(process.argv[2], bytes);
console.log(log);
