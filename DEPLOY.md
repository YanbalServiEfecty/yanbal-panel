# Guía de deploy — v6.1

## ⚠ Lo más importante: configurar Vercel Blob como PÚBLICO

Si tu Blob Store está como "privado" (el default cuando se crea), las imágenes que subas NO se podrán mostrar con `<img src="...">` en el navegador. La app funciona igual con fallback base64, pero las imágenes no se guardan entre sesiones.

**Solución** (1 minuto):
1. Ve a Vercel Dashboard → Storage → tu Blob Store
2. Settings → cambia el tipo a **"Public"**
3. Reinicia el deployment (Settings → Deployments → Redeploy)

Después de esto las imágenes sí se persisten permanentemente.

---

## Variables de entorno obligatorias

| Variable | Para qué | Cómo obtenerla |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Subir imágenes | Vercel → Storage → Blob → Connect |
| `KV_REST_API_URL` | Guardar estado | Vercel → Storage → KV → Connect |
| `KV_REST_API_TOKEN` | Token KV | Vercel → Storage → KV → Connect |
| `REMOVE_BG_API_KEY` (opcional) | Quitar fondo con IA | [remove.bg/api](https://www.remove.bg/api) — 50 gratis/mes |

---

## Pasos para subir v6.1

1. Descomprime el ZIP
2. Copia TODO a tu repo sobrescribiendo (especialmente `vercel.json`, `package.json`, `api/upload-image.js` y `index.html`)
3. ```
   git add .
   git commit -m "v6.1: fix Blob privado + auto-aprobación quórum + Opus+Sonnet"
   git push
   ```
4. Verifica en Vercel que el deploy pasa (ya no debería fallar por Node 24)
5. **Importante**: cambia el Blob Store a público (ver arriba)
6. Prueba subiendo un catálogo

---

## Cómo verificar que todo funciona

1. **Catálogo → subir PDF** → espera 2-3 min.
2. Al terminar deberías ver los productos con sus **imágenes recortadas automáticamente**.
3. Si el Blob es público: badge 🖼️ Auto en cada producto.
4. Si el Blob es privado: igual ves las imágenes pero con `imagenEsBase64: true` internamente (solo duran esta sesión).
5. Los productos donde Opus y Sonnet coincidieron → **auto-aprobados** (badge ✓ Quórum).
6. Los que tengan conflicto o solo uno detectó → aparecen en **Revisión manual**.

---

## Si algo falla

- **404 en /api/upload-image**: el deployment de Vercel no desplegó las API functions. Verifica que `vercel.json` está en el root del repo.
- **"Cannot use public access on a private store"**: tu Blob es privado. Cambia a público O deja la app usando el fallback base64 (no es crítico).
- **"Invalid Node.js Version 24.x"**: ya resuelto en v6.1 con `engines: node 20.x` en package.json.
- **Productos sin imagen**: revisa la consola del navegador. Si dice "Blob upload falló", el fallback ya está activo y las imágenes funcionan localmente.
