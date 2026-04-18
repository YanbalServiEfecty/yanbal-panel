// Endpoint de diagnóstico del Vercel Blob: sube una imagen de prueba 1x1 y la verifica.
// Se llama desde el Admin para confirmar que el Blob esté funcionando antes de procesar un catálogo caro.
import { put } from '@vercel/blob';

export const config = { maxDuration: 15 };

// Imagen PNG 1x1 píxel roja (base64) — ~70 bytes, suficiente para probar
const TEST_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const diagnostico = {
    paso: 'inicio',
    hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    tokenPreview: process.env.BLOB_READ_WRITE_TOKEN
      ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 20) + '...'
      : null,
    nodeVersion: process.version,
  };

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        ok: false,
        diagnostico,
        error: 'BLOB_READ_WRITE_TOKEN no configurado',
        hint: 'Ve a Vercel > Storage > tu Blob Store > Connect Project, o revisa Settings > Environment Variables.',
      });
    }

    diagnostico.paso = 'subiendo_imagen_prueba';
    const buffer = Buffer.from(TEST_PNG_B64, 'base64');
    const hash = Math.random().toString(36).slice(2, 10);
    const filename = `yanbal/_diagnostico/test_${Date.now()}_${hash}.png`;

    let blob;
    try {
      blob = await put(filename, buffer, {
        access: 'public',
        contentType: 'image/png',
        addRandomSuffix: false,
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('private store') || msg.includes('Cannot use public access')) {
        return res.status(500).json({
          ok: false,
          diagnostico,
          error: 'Tu Vercel Blob Store esta configurado como PRIVADO',
          solucion: 'Las imagenes privadas NO pueden mostrarse en la app. Crea un Blob Store publico nuevo en Vercel > Storage > Create, borra el privado, y haz Redeploy del proyecto.',
          errorOriginal: msg,
        });
      }
      throw err;
    }

    diagnostico.paso = 'verificando_url';
    diagnostico.urlSubida = blob.url;

    // Paso 2: intentar descargar la imagen recién subida (confirma que sea pública)
    let verificacion = { accesible: false };
    try {
      const headResp = await fetch(blob.url, { method: 'HEAD' });
      verificacion = {
        accesible: headResp.ok,
        status: headResp.status,
        contentType: headResp.headers.get('content-type'),
        contentLength: headResp.headers.get('content-length'),
      };
    } catch (e) {
      verificacion = { accesible: false, error: e.message };
    }

    diagnostico.paso = 'completado';

    return res.status(200).json({
      ok: verificacion.accesible,
      diagnostico,
      blobUrl: blob.url,
      verificacion,
      mensaje: verificacion.accesible
        ? 'Blob funcionando correctamente. Puedes procesar catalogos con seguridad.'
        : 'El Blob subio la imagen pero NO es accesible publicamente. Verifica que el store sea publico.',
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      diagnostico,
      error: err.message || String(err),
      stack: err.stack ? err.stack.split('\n').slice(0,4).join(' | ') : null,
    });
  }
}
