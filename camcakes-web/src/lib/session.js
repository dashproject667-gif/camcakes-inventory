const SESSION_KEY = 'camcakes-monitor-session';
const SESSION_VERSION = 1;

function encodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function decodeBuffer(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function loadSession() {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (!stored) return { data: null, error: '' };

    const saved = JSON.parse(stored);
    if (
      saved.version !== SESSION_VERSION
      || !saved.model
      || !saved.original
      || typeof saved.buffer !== 'string'
      || !saved.salesState
      || !Array.isArray(saved.salesState.ignored)
      || !Array.isArray(saved.excluded)
    ) {
      return { data: null, error: 'No se pudieron recuperar los datos de la sesión. Vuelve a cargar tu Monitor.' };
    }

    return {
      data: { ...saved, buffer: decodeBuffer(saved.buffer) },
      error: '',
    };
  } catch {
    return { data: null, error: 'No se pudieron recuperar los datos temporales de esta pestaña. Vuelve a cargar tu Monitor.' };
  }
}

export function saveSession(data) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      version: SESSION_VERSION,
      monitorName: data.monitorName,
      original: data.original,
      model: data.model,
      buffer: encodeBuffer(data.buffer),
      doc: data.doc,
      docName: data.docName,
      section: data.section,
      salesState: { ...data.salesState, ignored: [...data.salesState.ignored] },
      counts: data.counts,
      excluded: [...data.excluded],
    }));
    return { ok: true, error: '' };
  } catch {
    return {
      ok: false,
      error: 'No se pudieron guardar todos los cambios temporales. El almacenamiento de esta pestaña puede estar lleno; exporta tu Monitor antes de recargar.',
    };
  }
}
