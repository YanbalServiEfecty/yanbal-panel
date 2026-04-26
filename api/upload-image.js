import { put } from '@vercel/blob';

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '10mb', // JSON con base64 = ~33% más grande que los bytes reales
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[upload-image] start', {
    hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    tokenPreview: process.env.BLOB_READ_WRITE_TOKEN
      ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 15) + '...'
      : 'NO TOKEN',
    nodeVersion: process.version,
  });

  try {
    const { imageB64, filename, mediaType } = req.body || {};

    if (!imageB64) return res.status(400).json({ error: 'Falta imageB64 en el body' });
    if (!filename) return res.status(400).json({ error: 'Falta filename en el body' });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'BLOB_READ_WRITE_TOKEN no está configurado en Vercel. Ve a Storage → Blob → Connect.',
      });
    }

    let buffer;
    try {
      buffer = Buffer.from(imageB64, 'base64');
    } catch (e) {
      return res.status(400).json({ error: 'base64 inválido: ' + e.message });
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'La imagen está vacía (0 bytes)' });
    }

    const MAX_BYTES = 8 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({
        error: `Imagen muy grande: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Máximo ${MAX_BYTES / 1024 / 1024}MB.`,
      });
    }

    const safeFilename = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    if (!safeFilename) {
      return res.status(400).json({ error: 'filename inválido después de sanitizar' });
    }

    const fullPath = `yanbal/productos/${safeFilename}`;
    console.log('[upload-image] uploading', {
      filename: safeFilename,
      size: buffer.length,
      mediaType,
    });

    // CRÍTICO: intentamos PRIMERO con access: 'public' (lo ideal para imágenes de catálogo).
    // Si el Blob Store está configurado como privado, Vercel lanza:
    //   "Cannot use public access on a private store"
    // En ese caso reintentamos SIN especificar access (usa el default del store).
    let blob;
    try {
      blob = await put(fullPath, buffer, {
        access: 'public',
        contentType: mediaType || 'image/jpeg',
        addRandomSuffix: true,
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('private store') || msg.includes('Cannot use public access')) {
        console.log('[upload-image] store es privado — reintentando sin access:public');
        // En stores privados, el SDK espera que no pases access (o pases 'public' solo si el store lo permite).
        // En @vercel/blob v2+ los stores privados requieren leer con token, lo cual no es ideal para <img src>,
        // pero al menos permite subir. Para tu caso, RECOMENDAMOS cambiar el Blob Store a "public" desde Vercel Dashboard.
        try {
          blob = await put(fullPath, buffer, {
            // sin especificar access → usa el default del store
            contentType: mediaType || 'image/jpeg',
            addRandomSuffix: true,
          });
        } catch (err2) {
          return res.status(500).json({
            error: 'Tu Vercel Blob Store está configurado como PRIVADO.',
            detalle: 'Las imágenes privadas NO pueden mostrarse directamente en <img>. Necesitas cambiar el store a público.',
            solucion: 'Ve a Vercel Dashboard → Storage → tu Blob Store → Settings → cambia el tipo a "Public". Luego reintenta subir la imagen.',
            errorOriginal: err2.message,
          });
        }
      } else {
        throw err;
      }
    }

    console.log('[upload-image] success', { url: blob.url, size: buffer.length });
    return res.status(200).json({ url: blob.url, size: buffer.length });
  } catch (err) {
    console.error('[upload-image] ERROR:', err);
    console.error('[upload-image] STACK:', err?.stack);

    const msg = err?.message || String(err) || 'Error desconocido al subir a Blob';
    return res.status(500).json({
      error: msg,
      errorName: err?.name || null,
      errorCode: err?.code || null,
      stackPreview: err?.stack ? String(err.stack).split('\n').slice(0, 4).join(' | ') : null,
      hint:
        msg.includes('private store') || msg.includes('public access')
          ? 'Tu Blob Store es PRIVADO. Ve a Vercel → Storage → tu Blob Store → Settings → cambiar a "Public".'
          : msg.includes('token') || (err?.name || '').includes('Token')
          ? 'Problema con BLOB_READ_WRITE_TOKEN.'
          : msg.includes('exceeded') || msg.includes('limit') || msg.includes('quota')
          ? 'Excediste la cuota de Vercel Blob.'
          : undefined,
    });
  }
}
