# Guía de deploy — v6 (Edición de imagen + Validación doble Opus)

## Qué hay nuevo en esta versión (v6)

### Cambios mayores
1. **`vercel.json` nuevo** — indica a Vercel cómo desplegar las funciones `/api/*` (antes fallaba con 404 en algunos casos)
2. **Validación doble con Opus 4.7** — antes era Opus vs Sonnet; ahora son 2 pasadas INDEPENDIENTES del mismo modelo (Opus 4.7) con prompts distintos. Ambas pasadas tienen la máxima precisión.
3. **Extracción automática de imágenes** — el prompt ahora pide `bbox` a la IA; al terminar la extracción, cada producto queda con su foto recortada automáticamente desde la página del catálogo. **Este era el bug grande: antes todos los productos quedaban sin imagen.**
4. **Editor de imagen completo** — tipo Photoshop: recortar, rotar 90°, voltear H/V, brillo/contraste, quitar fondo con IA (remove.bg) y quitar fondo local (chroma key).
5. **Fix del bug `Cannot set properties of null`** al subir imagen manual — el editor viejo se reemplazó completamente.
6. **Validación manual** — nuevo botón 🔒 en cada producto; modal comparativo lado a lado; badge visible.
7. **Envío masivo de WhatsApp** — desde Base de clientas (a todas) y desde Historial de paquetes (flyers a todas las clientas con paquete asignado).
8. **Borrado seguro** — todas las acciones destructivas ahora tienen doble confirmación con cuenta atrás de 2-3 segundos + palabra de confirmación.
9. **Sincronización mejor** — al sincronizar base de clientas desde Seguimiento, extrae UN solo celular válido (antes copiaba `"8541599 - 3137483656"` completo y el envío masivo fallaba).
10. **Excel sin decimales espurios** — `raw: true` en vez de `raw: false`. Normalización por tipo de columna.
11. **Headers de Excel con más variantes** — tolera mayúsculas, tildes y espacios extra.
12. **Seguimiento** — botones ocultar/mostrar filas, agregar fila manualmente.
13. **Scrollbars visibles** — 14px en general, 18px en tablas grandes (antes eran 5px casi invisibles).

---

## Variables de entorno obligatorias en Vercel

Ve a tu proyecto en Vercel → **Settings → Environment Variables** y agrega:

### Obligatorias (ya las tenías)
| Variable | Para qué sirve | Dónde obtenerla |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Subir imágenes de productos y páginas del catálogo | Vercel → Storage → Blob → Connect (se crea sola) |
| `KV_REST_API_URL` | Guardar estado del panel (ciclos, productos, paquetes) | Vercel → Storage → KV (Upstash) → Connect |
| `KV_REST_API_TOKEN` | Token de autenticación para la KV | Vercel → Storage → KV (Upstash) → Connect |

### Opcional (nueva en v6)
| Variable | Para qué sirve | Dónde obtenerla |
|---|---|---|
| `REMOVE_BG_API_KEY` | Quitar fondo con IA precisa | [remove.bg/api](https://www.remove.bg/api) — gratis 50 imágenes/mes |

> Si no configuras `REMOVE_BG_API_KEY`, el editor de imagen sigue funcionando pero el "✨ Quitar fondo con IA" hace fallback automático al "⚡ Quitar fondo simple" (algoritmo local en el navegador, funciona bien con fondos blancos/uniformes).

---

## Pasos para subir v6

### 1. Copiar archivos al repo

Descomprime el ZIP. Estructura:
```
yanbal-panel/
├── vercel.json            ← NUEVO (crítico — sin esto los /api/* dan 404)
├── CHANGELOG.md
├── DEPLOY.md              ← este archivo
├── README.md
├── index.html             ← cambios grandes
├── package.json
└── api/
    ├── claude.js
    ├── claude-vision.js
    ├── remove-bg.js       ← NUEVO
    ├── state-load.js
    ├── state-save.js
    ├── upload-image.js
    ├── whatsapp-send.js
    └── whatsapp-test.js
```

Copia TODO a la raíz de tu repo sobrescribiendo.

### 2. Commit y push

```bash
git add .
git commit -m "v6: doble Opus + imagen automatica + editor completo + envio masivo"
git push
```

### 3. Verifica las variables de entorno en Vercel
(Si ya tenías v5 funcionando, las 3 primeras ya están. Solo falta `REMOVE_BG_API_KEY` si quieres quitar fondo con IA.)

### 4. Espera el deploy (~1-2 min)

---

## Probar que todo funciona después del deploy

### Check 1 — Subir catálogo y ver imágenes automáticas
1. Entra al panel → **Catálogo**
2. Sube un PDF del catálogo Yanbal
3. Al terminar la extracción verás que cada producto queda con su **foto recortada automáticamente** (badge 🖼️ Auto)
4. Si algún producto quedó con la página entera en vez de la foto, abre el editor (🖼️) y recorta manualmente.

### Check 2 — Editor de imagen
1. En cualquier producto → clic en **🖼️**
2. Prueba las herramientas: recortar libre, cuadrado, rotar, voltear, brillo, contraste
3. **Subir archivo propio** — debería funcionar SIN error (antes daba `Cannot set properties of null`)
4. **Quitar fondo con IA** — si tienes `REMOVE_BG_API_KEY` configurada, deja la imagen transparente
5. **Quitar fondo simple** — funciona siempre (chroma key local)
6. **Guardar cambios** — sube la imagen procesada al Blob

### Check 3 — Validación manual
1. En cualquier producto → clic en **🔒**
2. Modal con página del catálogo a la izquierda y datos a la derecha
3. Marca la checkbox de confirmación → clic en "🔒 Marcar como validado"
4. Producto queda con badge 🔒 Validado

### Check 4 — Envío masivo de WhatsApp
1. Ve a **Base de clientas**
2. Clic en **📨 Enviar a todas**
3. Escribe mensaje (usa `{nombre}` para personalizar)
4. Clic en enviar → confirmación doble con cuenta atrás de 2s
5. Se abre pestaña de WhatsApp Web por cada clienta (o se manda vía API si tienes WABA configurado)

### Check 5 — Borrado seguro
1. **Base de clientas → 🗑 Borrar todas** → cuenta atrás 3s + palabra "BORRAR TODAS LAS CLIENTAS"
2. **Historial → 🗑 Limpiar todos** → cuenta atrás 2s + "BORRAR PAQUETES"
3. **Seguimiento → 🗑 Limpiar todo** → cuenta atrás 2s + "BORRAR SEGUIMIENTO"

### Check 6 — Excel sin decimales
1. **Seguimiento → Re-importar Excel**
2. Verifica que las ventas aparezcan como `$914` (no `$914,000.00` o `$914.000`)
3. Verifica que columnas que antes salían vacías (Inactividad, Crédito) ahora aparezcan llenas

### Check 7 — Teléfonos limpios al sincronizar
1. **Seguimiento → 🔗 Sincronizar con Base de clientas**
2. Ve a Base de clientas → verifica que el teléfono sea **solo UN número** de 10 dígitos empezando por 3
3. Antes aparecía `"8541599 - 3137483656"` (2 números concatenados) → ahora solo `"3137483656"`

---

## Rollback si algo falla

Desde Vercel:
1. **Deployments** → busca el commit anterior (v5)
2. Clic en los 3 puntos → **Redeploy**

Desde GitHub:
```bash
git revert HEAD
git push
```

---

## Archivos modificados respecto a v5

| Archivo | Cambio |
|---|---|
| `vercel.json` | **NUEVO** — configuración de runtime para API functions |
| `api/remove-bg.js` | **NUEVO** — proxy a remove.bg para quitar fondo con IA |
| `index.html` | Cambios grandes: editor de imagen reescrito, doble pasada Opus, auto-extracción con bbox, validación manual, envío masivo WhatsApp, confirmarDestructivo, extraerCelularCO, Excel normalizado |
| `api/*` restantes | Sin cambios |
| `package.json` | Sin cambios |
