// ============================================================================
// Manejo de evidencias (DRT M5, 8.3): compresión de fotos en cliente, hash de
// integridad y almacenamiento como blob local para subida diferida.
// ============================================================================

// Comprime una imagen a un ancho máximo y calidad JPEG dados, devolviendo un Blob.
export async function compressImage(file, maxWidth = 1280, quality = 0.7) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  );
}

// SHA-256 hex de un Blob/ArrayBuffer (integridad inmutable de la evidencia, 7.3).
export async function hashBlob(blob) {
  const buffer = blob instanceof Blob ? await blob.arrayBuffer() : blob;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Construye un registro de evidencia listo para Dexie a partir de un archivo.
// El binario se guarda localmente (blob); la subida al almacén de objetos es
// diferida (los datos se sincronizan primero, las fotos después — 8.3).
export async function buildEvidence({ tenantId, registroId, file, tipo = 'foto', geopunto = null }) {
  const blob = tipo === 'foto' ? await compressImage(file) : file;
  const hash = await hashBlob(blob);
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto.randomUUID(),
    tenant_id: tenantId,
    registro_id: registroId,
    tipo,
    blob,                       // binario local (no se sube en el push de datos)
    url_objeto: null,           // se completa al subir al almacén (bucket por tenant)
    nombre_archivo: file.name || `evidencia-${tipo}.jpg`,
    mime: blob.type || 'application/octet-stream',
    tamano_bytes: blob.size,
    geopunto,
    tomada_at: now,
    hash,
    updated_at: now,
    sync_status: 'pending_sync'
  };
}
