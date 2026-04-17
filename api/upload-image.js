import { put } from '@vercel/blob';

export const config = {
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

  // Log de diagnóstico básico (visible en Vercel Logs)
  console.log('[upload-image] start', {
    hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    tokenPreview: process.env.BLOB_READ_WRITE_TOKEN
      ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 15) + '...'
      : 'NO TOKEN',
    nodeVersion: process.version,
  });

  try {
    const { imageB64, filename, mediaType } = req.body || {};

    // Validaciones tempranas con mensajes claros
    if (!imageB64) {
      return res.status(400).json({ error: 'Falta imageB64 en el body' });
    }
    if (!filename) {
      return res.status(400).json({ error: 'Falta filename en el body' });
    }

    // Validar variable de entorno
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'BLOB_READ_WRITE_TOKEN no está configurado en Vercel. Ve a Storage → Blob → Connect.',
      });
    }

    // Convertir base64 a buffer
    let buffer;
    try {
      buffer = Buffer.from(imageB64, 'base64');
    } catch (e) {
      return res.status(400).json({ error: 'base64 inválido: ' + e.message });
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'La imagen está vacía (0 bytes después de decodificar)' });
    }

    // Validar tamaño final
    const MAX_BYTES = 8 * 1024 * 1024; // 8MB reales
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({
        error: `Imagen muy grande: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Máximo ${MAX_BYTES / 1024 / 1024}MB.`,
      });
    }

    // Sanitizar filename
    const safeFilename = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    if (!safeFilename) {
      return res.status(400).json({ error: 'filename inválido después de sanitizar' });
    }

    console.log('[upload-image] uploading', {
      filename: safeFilename,
      size: buffer.length,
      mediaType,
    });

    // CRÍTICO: addRandomSuffix evita error 409 si ya existe un blob con ese nombre
    // En @vercel/blob 2.x hay que pasar access explícito ('public' o 'private')
    const blob = await put(`yanbal/productos/${safeFilename}`, buffer, {
      access: 'public',
      contentType: mediaType || 'image/jpeg',
      addRandomSuffix: true,
    });

    console.log('[upload-image] success', { url: blob.url, size: buffer.length });
    return res.status(200).json({ url: blob.url, size: buffer.length });
  } catch (err) {
    // Exponer el error COMPLETO en los logs (stack trace incluido)
    // para que en el próximo fallo se vea exactamente qué pasó
    console.error('[upload-image] ERROR:', err);
    console.error('[upload-image] STACK:', err?.stack);
    console.error('[upload-image] NAME:', err?.name);
    console.error('[upload-image] CODE:', err?.code);

    const msg = err?.message || String(err) || 'Error desconocido al subir a Blob';
    return res.status(500).json({
      error: msg,
      errorName: err?.name || null,
      errorCode: err?.code || null,
      // Primeras 3 líneas del stack — para diagnóstico en el cliente
      stackPreview: err?.stack ? String(err.stack).split('\n').slice(0, 4).join(' | ') : null,
      hint:
        msg.includes('token') || (err?.name || '').includes('Token')
          ? 'Problema con BLOB_READ_WRITE_TOKEN. Verifica en Vercel → Settings → Environment Variables.'
          : msg.includes('exceeded') || msg.includes('limit') || msg.includes('quota')
          ? 'Excediste la cuota de Vercel Blob (1GB en plan gratis).'
          : msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')
          ? 'Problema de red con el servicio de Blob.'
          : undefined,
    });
  }
}
