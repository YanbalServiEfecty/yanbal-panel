# CHANGELOG

## v16.1 (2026-04-18) — BD Maestra reforzada + Galería Maestra

### 🎯 Problema que resuelve
Las imágenes de productos NO quedaban fijas al código. Cuando editabas un producto en un paquete (quitar fondo, reescalar, croquis), la mejora solo se aplicaba a ESE paquete — no se guardaba como referencia permanente. Al procesar el siguiente catálogo con el mismo código, se re-extraía la imagen con IA desde cero (costo repetido).

Además, el cache del Premium Mármol estaba **intencionalmente desactivado** ("porque puede cambiar por drag"), lo cual hacía que cambiar de paquete fuera lento incluso cuando el flyer no había cambiado.

### ✅ Cambios principales

**1. Auto-guardado universal en BD Maestra**
Toda edición de imagen de producto (en el editor del catálogo o en el editor del flyer) ahora se guarda automáticamente en `STATE.productosMaestros[codigo].imagenUrl`:
- `sincronizarAMaestro` ampliada: guarda tanto `imagenUrl` como `imagenRecortada`, tipo, categoría, origen
- Nueva `propagarImagenAPaquetes(codigo, nuevaUrl)` — cuando cambia la maestra, actualiza TODOS los paquetes que contengan ese código + invalida cache de sus flyers
- Nueva `guardarImagenMaestraYPropagar(prod)` — one-liner para usar en cualquier handler
- Integrada en 4 handlers del editor de flyer: 🔍 Upscale, ✂ Croquis, 🎨 RemoveBG, guardar edición
- Integrada en `guardarImagenEditor` del editor del catálogo

**2. Carga inteligente del catálogo**
Antes: solo reutilizaba la imagen maestra si `verificadoPor` estaba (requería edición manual explícita).
Ahora: reutiliza **cualquier imagen maestra guardada**, venga de IA o de edición manual. Esto hace que:
- Próximo catálogo con código conocido → usa imagen maestra directamente (0 costo IA)
- Edición en un paquete → se propaga a flyers futuros con el mismo código
- Ahorro estimado: de $10 USD por catálogo a ~$2 USD (solo procesa códigos nuevos)

**3. Nueva página: Galería Maestra** (nav entre "Galería de flyers" y "Paquetes guardados")
Vista completa de `STATE.productosMaestros`:
- Grid responsive 180px+
- Cards con: imagen, código, nombre, categoría, tipo
- Badges automáticos: "✓ VERIFICADA" (editada por usuario), "IA" (extraída por Claude), origen de mejora ("sin fondo", "reescalada", "croquis", "manual")
- Buscador por código/nombre/categoría
- Filtro "Solo sin imagen" para auditar gaps
- Contador: total / con imagen / sin imagen
- Botones por card: 🖼 Cambiar imagen (file picker + upload al Blob + propagación), 🗑 Borrar (requiere confirmación)
- `abrirEditorMaestra` — si el código existe en catálogo actual, abre el editor completo; si no, permite subir archivo directamente

**4. Cache Premium Mármol activado**
- `_hashFlyer` ahora incluye `pkg.flyerLayout` → cualquier drag&drop invalida cache automáticamente
- Premium Mármol ahora se cachea igual que las demás plantillas (combina canvasBase + canvasOverlay)
- Al cargar desde cache, aparece link "⚡ Cargado desde cache · Activar edición" para volver al modo drag&drop cuando se necesite

**5. Fix de carga inicial**
`renderFlyer()` ahora llama `dibujarFlyer(false)` (usa cache si hay) en vez de `dibujarFlyer(true)` (forzaba regeneración). Este era el bug raíz de la lentitud — aunque había cache, nunca se usaba al cambiar de paquete.

**6. Nuevo botón "🔄 Regenerar todos los flyers"** en Configuración → Respaldos
- Borra todo el cache de IndexedDB
- Resetea `flyerPlantilla` y `flyerLayout` de paquetes con plantillas viejas
- Limpia cache de imágenes en memoria
- 0 costo, ~1 segundo

### Técnico
- Archivos modificados: `index.html` (~500 líneas nuevas), `CHANGELOG.md`
- Nuevas funciones: `propagarImagenAPaquetes`, `guardarImagenMaestraYPropagar`, `renderGaleriaMaestra`, `abrirEditorMaestra`, `borrarImagenMaestra`, `regenerarTodosLosFlyers`
- Nuevos campos en `STATE.productosMaestros[codigo]`: `tipo`, `imagenOrigen`
- Sintaxis validada con Node `--check` (script + endpoints)

### Flujo recomendado tras deploy
1. Ir a Configuración → Respaldos → **"🔄 Regenerar todos los flyers"** — aplica plantillas v16 a todos los paquetes existentes
2. Ir a **🎨 Galería Maestra** — ver estado actual de BD maestra (cuántos productos tienen imagen permanente)
3. Filtrar "Solo sin imagen" → editar/subir manualmente los que falten
4. La próxima vez que proceses un catálogo, los productos con código conocido reutilizarán las imágenes permanentes automáticamente

---

## v16 (2026-04-18) — Sistema de plantillas reales + cache IndexedDB

### 🎯 Problema que resuelve
Los flyers se veían vacíos, los productos aparecían diminutos en un lienzo enorme, y cambiar de paquete tardaba varios segundos porque se regeneraba el flyer completo cada vez. Las referencias reales de Yanbal (flyers que la directora ya manda a clientas) tenían un formato muy específico: **productos grandes ocupando 60-70% del lienzo**, con "Paga $XXX" arriba y "Gratis" en esquina.

### 🎨 Sistema de plantillas modular (5 plantillas)
Cada plantilla es una función `dibujarFlyerXxx(pkg, canvas)` independiente. Para agregar una nueva, solo se crea la función y se añade al array `PLANTILLAS_FLYER`. Plantillas disponibles:

1. **`paga-gratis`** (default, inspirado en referencias image 6-8)
   - Vertical 900×1200
   - Header "Paga" naranja + burbuja rosa con precio
   - Productos GRANDES abajo (máximo espacio útil)
   - "Gratis" en esquina inferior izquierda con producto regalo
   - Borde rojo/vino doble característico Yanbal

2. **`paga-horizontal`** (inspirado en image 11)
   - Horizontal 1400×900
   - "Paga $XXX" centrado arriba
   - Productos en fila ocupando todo el ancho
   - Badge "GRATIS" amarillo rotado en esquina derecha

3. **`catalogo-descuento`** (inspirado en image 10)
   - Vertical 900×700
   - "PAGA / PUBLICO" con precios arriba
   - Badge rojo grande con porcentaje de descuento rotado en esquina
   - Productos alineados en línea de base
   - Para descuentos grandes (>50%)

4. **`clasica`** (migrada de v12, oscura)
5. **`premium-marmol`** (migrada de v14-v15, editable con drag&drop)

### 🤖 Auto-selección inteligente
`sugerirPlantilla(pkg)` elige automáticamente según:
- Descuento ≥50% → `catalogo-descuento`
- Tiene regalo → `paga-gratis`
- Paquete grande (≥7 productos) → `paga-horizontal`
- Default → `paga-gratis`

El usuario puede cambiar manualmente con **tarjetas visuales** en el panel lateral (5 botones con emoji + nombre + tooltip descriptivo).

### ⚡ Cache de flyers en IndexedDB
- Al renderizar un flyer, se guarda el PNG + hash del contenido en IndexedDB local
- Al volver a ese paquete, si el hash coincide → se carga instantáneo (<50ms)
- Se invalida automáticamente cuando cambian: productos, precios, plantilla, estilo, mensaje
- **No se sincroniza a Upstash** (demasiado pesado) — solo local
- Store: `yanbal_flyer_cache.pngs`, key = `pkg.id`

### 🎯 Consistencia total
Todas las vistas del flyer ahora usan **el mismo renderer**:
- `renderFlyerAOffscreen(pkg)` → helper unificado que despacha a la plantilla correcta
- Flyer individual, preview en galería, preview en Paquetes guardados, descarga PNG, ZIP, PDF — todo usa el mismo código.
- Ya no hay un "preview simplificado" que se ve distinto al flyer real.

### Refactor técnico
- El antiguo `FlyerEditor` (v14-v15) se mantiene solo para plantilla `premium-marmol` (compat)
- Las nuevas plantillas NO usan clase, solo funciones → más simples y rápidas
- `pkg.flyerPlantilla` nuevo campo (fallback a `sugerirPlantilla`)
- `_hashFlyer(pkg)` → hash djb2 simple del contenido para invalidar cache

### Tests manuales
1. Ir a un paquete → plantilla `paga-gratis` por default (productos grandes visibles)
2. Cambiar plantilla con las tarjetas → cambio instantáneo
3. Volver al paquete → cache (<50ms)
4. Editar producto → flyer se regenera (cache invalidado)
5. Galería → previews consistentes con flyer individual
6. Descargar PDF/ZIP → mismos flyers

---

## v15 (2026-04-17) — Fixes críticos + Galería + Editor IA unificado

### 🔴 Problemas reales reportados (y arreglados)

**Gemini devolvía HTTP 404 "model not found"** — el nombre `gemini-2.5-flash-image-preview` quedó obsoleto. El endpoint `/api/flyer-refine` ahora prueba una **cascada de 4 nombres de modelo** hasta encontrar uno activo:
1. `gemini-3.1-flash-image-preview` (Nano Banana Pro, 2026)
2. `gemini-2.5-flash-image` (estable actual)
3. `gemini-2.5-flash-image-preview` (por si sigue activo)
4. `gemini-2.0-flash-exp-image-generation` (experimental)

Si ninguno funciona devuelve el error real. También agrega `responseModalities: ['TEXT', 'IMAGE']` que es el formato requerido desde 2026.

**Replicate devolvía HTTP 402 "insufficient credit"** — fallback automático implementado. El botón "Quitar fondo" ahora intenta primero Replicate (rembg, ~$0.003); si falla por cualquier motivo, **cae automáticamente a remove.bg/ClipDrop** (endpoint `/api/remove-bg` que ya existía). El usuario ya no necesita recargar saldo para que funcione.

**Los flyers tardaban minutos al cambiar de paquete** — implementado **cache global de imágenes en memoria** (`window._imgCache`, Map con límite de 200 entradas). Cambiar de paquete ya no re-descarga imágenes que ya se habían cargado. También `limpiarImgCache(prefix)` para invalidar selectivamente cuando se edita un producto.

**Productos con imágenes base64 residuales (v12-v13) no funcionaban con los botones IA** — nuevo botón **"🧹 Limpiar imágenes cacheadas"** en Configuración → Respaldos que recorre el STATE buscando `data:image/...`, las re-sube al Blob público, y reemplaza las URLs. Al terminar recarga la página.

### 🎨 Sistema extensible de estilos de fondo (6 estilos)
Dispatcher `switch (estilo)` en `FlyerEditor._drawBase()`. Agregar uno nuevo = añadir 1 `case` + 1 método `_drawFondo{X}`. Estilos disponibles:
- ⚪ **Mármol blanco** (premium, el original v14)
- 🪵 **Madera clara** (vetas horizontales con gradiente beige)
- 🌸 **Rosado pastel** (radial suave con brillo superior izquierdo)
- ⬛ **Negro lujoso** (radial oscuro con partículas doradas)
- ⬜ **Blanco liso** (minimalista, estilo ecommerce)
- 🔲 **Clásico v12** (opción "rápida" — un solo canvas, NO editable pero instantáneo)

La paleta de textos se adapta automáticamente: fondos claros usan textos oscuros (#3A2E20), fondos oscuros usan textos crema (#F0E8E0).

### ⚡ Modo "Flyer clásico" restaurado
Para compatibilidad con v12 y rendimiento máximo. Cuando el usuario elige estilo "clasico", el renderer usa la lógica original v12 (canvas único 720×1080) en lugar del `FlyerEditor` con dos canvases. Se dibuja en milisegundos en vez de segundos. No permite drag&drop pero es útil cuando se quiere generar masivamente.

### 🔓 Auto-aprobación cuando quórum + árbitro están desactivados
Si el usuario confía en el pipeline de una sola pasada y desactiva ambos toggles, el catálogo procesado **salta la pantalla de revisión humana obligatoria** y va directo a "Productos cargados" con todos los productos marcados como `aprobadoPorUsuario: true` + `aprobadoSinRevision: true`. Se muestra un aviso amarillo en la Configuración avisando del comportamiento antes de que procesen.

### ↶ Undo/Redo en editor de imagen (catálogo)
Stack de hasta 15 snapshots (`_imgEditor.historial`) + puntero `historialIdx`. Cada carga de imagen guarda snapshot; cada undo/redo re-carga sin duplicar en historial. Botones arriba del panel con estados disabled correctos.

### 🔍 Reescalado + ✂ Croquis disponibles también en editor del catálogo
Antes solo estaban en el editor del flyer. Ahora aparecen como botones dorados en la sección "Mejorar con IA (v15)" del editor de imagen del catálogo. El modal de croquis se reutiliza con un callback opcional para devolver la URL al editor en vez de asignarla a un paquete.

### 🖼 Nueva pestaña "Galería de flyers"
Vista tipo catálogo premium con **grilla 2×3**, paginación numérica, fondo blanco y cards elegantes. Cada card muestra:
- Preview miniatura del flyer (600×400) generado con `_renderPreviewFlyer()` simplificado
- Número de paquete, nombre/nivel, precio final, badge de descuento
- Cantidad de productos + clienta asignada
- Botones "✏ Editar" (va al editor completo) y "⬇ PNG" (descarga individual)

**Descarga masiva** con dos botones:
- 📦 **ZIP** (JSZip CDN lazy-loaded) — genera un ZIP con los 6 PNG de la página actual
- 📄 **PDF** (jsPDF CDN lazy-loaded) — PDF multi-página 1440×960 landscape

Registrada en nav lateral entre "Generar flyer" y "Paquetes guardados".

### 📦 Preview de flyer en Paquetes guardados
Cada card ahora muestra una miniatura del flyer arriba (600×400, aspecto 3:2) usando el mismo renderer simplificado que la galería. **Lazy-loaded** con `IntersectionObserver` — solo se renderizan cuando scrollean a la vista, evitando bloquear la UI con 50+ paquetes.

Click en la preview = abre el editor de flyer (atajo útil).

### Archivos nuevos/modificados
- `api/flyer-refine.js` — cascada de 4 modelos Gemini
- `api/image-upscale.js` — sin cambios (solo se usa mejor desde el cliente)
- `api/image-segment.js` — sin cambios (se añade fallback en el cliente)
- `index.html` — ~2000 líneas nuevas, ~150 modificadas

### CDNs externos cargados bajo demanda
- `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js` (galería ZIP)
- `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` (galería PDF)

Se cargan solo al hacer click en "Descargar ZIP/PDF", no en cada carga de la app.

### Tests manuales recomendados (modo admin)
1. Configuración → 🤖 IA Avanzada → click "Probar Gemini" — debería retornar un modelo funcionando
2. Flyer → click "Quitar fondo" con saldo agotado en Replicate — debería caer automáticamente a remove.bg
3. Desactivar Quórum Y Árbitro → procesar catálogo → debería ir directo sin revisión humana
4. Editor de imagen catálogo → click 🔍 Reescalar → ↶ Deshacer → debería volver
5. Galería → Descargar ZIP — debería bajar 6 PNGs
6. Paquetes guardados — cada card debería mostrar su preview del flyer

---

## v14.1 (2026-04-17) — Consolidación de endpoints para Vercel Hobby

### 🔧 Fix de despliegue
Vercel Hobby limita a 12 funciones serverless por proyecto. La v14 tenía 13. Se consolidaron endpoints redundantes sin perder funcionalidad:

- `blob-diagnostico.js` + `state-check.js` → fusionados en `diagnostics.js` (usa `?type=blob` o `?type=state`)
- `whatsapp-send.js` + `whatsapp-test.js` → fusionados en `whatsapp.js` (usa `?action=send` o `?action=test`)

Total: **13 → 11 funciones** (con 1 de margen).

Actualizaciones en el frontend: 8 llamadas `fetch()` apuntando a los nuevos paths.

---

## v14 (2026-04-17) — Editor de flyer premium con IA integrada

### 🎨 Nuevo sistema de flyer
Reemplazo completo del generador de flyer v12 por un editor interactivo con dos canvases superpuestos: un **canvas base** con fondo y textos fijos, y un **canvas overlay** con productos manipulables. El estilo por defecto es **mármol blanco** al estilo catálogo premium Yanbal (el de la imagen de Nivel 1 de referencia), con opción de volver al estilo oscuro v12 desde el selector.

Elementos del layout premium:
- Título "NIVEL X" centrado en Cormorant Garamond dorado
- "Valor Público: $XXX" tachado en beige oscuro
- "Precio con Descuento: $XXX" destacado en dorado
- Banda dorada diagonal con "XX% DESCUENTO" en blanco
- Recuadro GRATIS a la derecha con cinta naranja/terracota arriba
- Textura de mármol generada programáticamente (vetas claras y medias)
- Superficie pulida con gradiente de reflejo
- Info de flete + ciclo abajo-izquierda, branding YANBAL abajo-derecha

### ✋ Edición manual directa sobre el lienzo
Clase `FlyerEditor` que maneja interacción completa:
- **Arrastrar y soltar** cada producto con el mouse (o táctil)
- **Rueda del mouse** cambia tamaño (mantiene proporciones)
- **Doble click** trae el producto al frente (z-order)
- **Delete/Backspace** oculta/muestra el producto seleccionado
- **Selección visual** con marco punteado dorado
- **Sombras suaves** automáticas bajo cada producto (para que queden "apoyados" sobre la superficie de mármol)
- **Layout persistente** por paquete: cada cambio se guarda en `pkg.flyerLayout` y se restaura al volver a abrir

Botones del panel:
- 🔄 **Reorganizar auto** — descarta layout manual y vuelve al automático
- ↺ **Reset** — idem
- 🪄 **Pulir con IA** — manda el lienzo actual a Gemini 2.5 Flash Image

### 🔍 Reescalado de imágenes por producto (Real-ESRGAN)
Botón 🔍 en cada producto del paquete. Toma la imagen recortada del catálogo (que suele estar pixelada) y la sube a 2x con **Real-ESRGAN** vía Replicate (~$0.002/imagen, 2-8s). El resultado se sube al Blob público y se asigna como nueva `imagenUrl` del producto. Nuevo endpoint `/api/image-upscale.js`.

### ✂️ Individualización asistida por croquis
Botón ✂ abre un modal con la imagen original del producto y un canvas transparente encima para **dibujar a mano alzada** con el mouse/táctil. El grosor del trazo se ajusta con un slider (4–30px). Al procesar:
1. La imagen completa se envía a `rembg` vía Replicate para remoción de fondo base
2. Se calcula el bounding box del croquis del usuario (con padding 20%)
3. El resultado se recorta a esa zona aplicando alpha=0 fuera del bbox
4. La imagen refinada se sube al Blob y reemplaza la del producto

Esto da control preciso al usuario: si el producto está al lado de otro en la foto original, el croquis le dice a la IA "solo esto, ignora lo demás". Nuevo endpoint `/api/image-segment.js`.

### 🎨 Remoción de fondo automática
Botón 🎨 en cada producto — alternativa rápida sin croquis. Ejecuta `rembg` puro y actualiza la imagen. Útil para productos aislados sobre fondos limpios.

### 🪄 Pulido con IA del flyer completo (Gemini 2.5 Flash Image)
Botón 🪄 en el panel. Exporta el lienzo actual (base + overlay) como PNG y lo envía a **Gemini 2.5 Flash Image** con un prompt que pide conservar la composición exactamente pero refinar:
- Iluminación tipo softbox lateral
- Sombras suaves coherentes
- Reflejos sutiles en la superficie
- Acabados dorados/metálicos premium
- Limpieza de bordes de recortes

El resultado se dibuja sobre el canvas base y los items del overlay se ocultan. Nuevo endpoint `/api/flyer-refine.js`. Costo: ~$0.04/flyer.

### 🧪 Diagnóstico de IAs nuevas
Nueva pestaña **🤖 IA Avanzada** en Configuración con:
- Instrucciones paso-a-paso para obtener `REPLICATE_API_TOKEN` y `GOOGLE_AI_API_KEY`
- Botón "🧪 Probar Replicate" — hace upscale de un PNG 1×1 y reporta éxito/fallo
- Botón "🧪 Probar Gemini" — hace roundtrip de una imagen y reporta
- Muestra errores exactos si falla (token faltante, cuota, modelo inválido, etc.)

### Variables de entorno nuevas
Opcionales — si no se configuran, los botones IA fallan con mensaje claro pero el flyer funciona igual en modo Canvas.

- `REPLICATE_API_TOKEN` — para upscale y rembg. Obtener en https://replicate.com/account/api-tokens
- `GOOGLE_AI_API_KEY` — para Gemini refine. Obtener GRATIS en https://aistudio.google.com/apikey

### Archivos nuevos
- `api/image-upscale.js`
- `api/image-segment.js`
- `api/flyer-refine.js`

### Clases/funciones frontend nuevas
- `FlyerEditor` — clase principal del editor
- `flyerProductoAccion(accion, idx)` — enruta upscale/scribble/removebg
- `abrirModalCroquis(prod, idx)` + `procesarCroquis(idx)` + `aplicarMascaraDeCroquis(segB64, data)`
- `ajustarConIA()` — pulido con Gemini
- `imgUrlToBase64(url)` + `reSubirAlBlob(externalUrl, name)` — utilidades
- `cambiarEstiloFlyer(estilo)` — alterna entre mármol y oscuro
- `probarReplicate()` + `probarGemini()` — diagnósticos

### Impacto
Antes: flyer rígido estilo oscuro, zero posibilidad de ajuste, imágenes pixeladas directamente del PDF.
Ahora: flyer editable en tiempo real con la misma estética que los catálogos profesionales de Yanbal, con herramientas opcionales de IA que elevan la calidad de las imágenes de cada producto.

---

## v13 (2026-04-17) — Blindaje total contra pérdida de catálogos

### 🔴 Problema real detectado
En producción se perdió un catálogo completo de 126 páginas (costo ~$10 USD de API) al reiniciar el PC. Diagnóstico:
1. **Vercel Blob estaba privado** — todas las subidas de imágenes fallaban silenciosamente y caían al fallback `data:image/jpeg;base64,...`.
2. **El `STATE` terminaba con decenas de MB en base64** dentro de `paginasUrls` y `prod.imagenUrl`.
3. **Upstash Redis rechazaba el payload** por exceder su límite, pero el frontend solo detectaba errores de red con `fetch().catch()` — **un error HTTP 413/500 pasaba como "✓ Guardado en la nube"**.
4. **`localStorage` también se llenaba** (límite ~5–10 MB) y el `catch` silencioso dejaba el estado solo en RAM.
5. Al reiniciar: RAM borrada, localStorage vacío, nube vacía → catálogo perdido.

### 🛡 Cambios en el backend (`/api`)

#### `state-save.js` — validación y errores explícitos
- Mide el tamaño del estado antes de enviar a Upstash.
- Si supera **900 KB**, devuelve **HTTP 413** con mensaje claro (en lugar de intentar guardar algo que Upstash rechazará).
- Si Upstash responde no-OK, devuelve **HTTP 500** con el status y mensaje reales.
- Responde con `sizeKB` en cada éxito para auditabilidad.

#### `state-check.js` (nuevo) — diagnóstico de la nube
- `GET /api/state-check?userId=...` devuelve: existe/no existe, tamaño guardado, último timestamp, conteos (`productos`, `clientas`, `paquetes`, etc.).
- Usado por el panel de Configuración → Respaldos → "Verificar nube".

#### `blob-diagnostico.js` (nuevo) — verificación del Blob
- `POST /api/blob-diagnostico` sube un PNG 1×1 de prueba y verifica que sea accesible por HTTP.
- Detecta el caso "store privado" y devuelve instrucciones concretas.
- Usado desde Configuración → Respaldos → "Probar Blob".

### 🛡 Cambios en el frontend (`index.html`)

#### Sistema de sync blindado
- **`ejecutarSyncReal()`** reemplaza el sync ingenuo de v12. Chequea `response.ok` de verdad (no solo `catch`) y distingue entre error HTTP y error de red.
- **`limpiarEstadoParaNube(state)`** (nueva) — filtra cualquier base64 residual antes de mandar a Upstash. Reemplaza `data:image/...` por cadena vacía (si está en el Blob, la próxima carga completa la URL real).
- **`saveInmediato(razon)`** (nueva) — sync sin debounce para momentos críticos.
- **`showSyncStatus(msg, tipo)`** — soporta 3 tipos: `ok`, `warn`, `error` con colores distintos.

#### Triple respaldo de datos
- **Nivel 1 — localStorage** (rápido, síncrono, ~5 MB). Se sigue usando.
- **Nivel 2 — IndexedDB** (nuevo, varios GB de capacidad). `idbGuardar()` en cada `save()`, `idbLeer()` en `loadFromCloud()`.
- **Nivel 3 — Upstash** (en la nube, compartido entre dispositivos).
- **Nivel 4 — respaldo manual .json** (nuevo, descarga en PC del usuario).

#### Banner rojo global persistente
- `actualizarBannerSync()` muestra un banner fijo arriba de la pantalla cuando:
  - Hay un error de sync en los últimos 5 minutos, o
  - Hay >10 cambios pendientes sin sync hace >30 s.
- Click en el banner → descarga automática de respaldo.
- Se refresca cada 5 s para detectar cambios.

#### Sync inmediato en momentos críticos
- **Al terminar de procesar un catálogo**: `saveInmediato('fin_procesamiento_catalogo')` tras `STATE.productos = productos`. Si falla, alerta bloqueante ofreciendo descarga inmediata de respaldo.
- **Cada 5 aprobaciones de producto**: previene pérdida de progreso durante revisión larga.
- **Al aprobar el último producto**: `saveInmediato('aprobacion_final')`.

#### sendBeacon al cerrar pestaña
- `beforeunload` dispara `navigator.sendBeacon('/api/state-save', ...)` con el estado limpio si hay cambios pendientes. Última línea de defensa ante cierres inesperados.

#### Respaldos manuales (.json)
- **`descargarRespaldo()`** — genera `yanbal_respaldo_{userId}_{fecha}_{hora}.json` con versión, fecha y `state` completo. Descarga inmediata al PC.
- **`importarRespaldo(file)`** — lee un .json y reemplaza el estado (con confirmación y recuento previo).
- **Toast de oferta post-catálogo** — al terminar de procesar un catálogo exitosamente, aparece un toast sutil en esquina inferior derecha ofreciendo descarga de respaldo (auto-desaparece en 30 s).

#### Panel de Configuración → Respaldos
Nueva pestaña con:
- Botón "📥 Descargar respaldo ahora"
- Botón "📤 Seleccionar archivo .json" para importar
- Botones de diagnóstico: "☁ Verificar nube", "🖼 Probar Blob", "📊 Ver estado sync"
- Cada diagnóstico muestra resultado en un cuadro monoespaciado con detalles técnicos.

#### Carga inicial mejorada
- `loadFromCloud()` ahora compara timestamps de 3 fuentes (nube / IndexedDB / localStorage) y usa la más reciente.
- Si la nube falla pero hay datos en IndexedDB más recientes, los restaura automáticamente.
- Al recargar la página (no solo al login), se ejecuta `loadFromCloud()` para detectar actualizaciones.

### 📊 Variables globales de diagnóstico
`window._syncEstado` expone: `ultimoIntento`, `ultimoExito`, `ultimoError`, `guardadosPendientes`, `tamanoUltimo`. Se puede inspeccionar desde la consola del navegador.

### Impacto esperado
- Si el Blob falla: **el catálogo NO se pierde**. IndexedDB lo conserva y el banner rojo avisa.
- Si Upstash rechaza por tamaño: **el frontend lo detecta explícitamente** y ofrece descarga inmediata de respaldo.
- Si el usuario cierra la pestaña: **sendBeacon** intenta un último guardado.
- Si reinicia el PC: el estado sigue en IndexedDB y localStorage. Al volver, `loadFromCloud()` lo restaura.

---

## v6.7 (2026-04-18) — Parser JSON resiliente + prompts anti-conversacional

### 🔍 Problema diagnosticado desde log admin real
En el log de la corrida v11 se detectaron páginas densas (47, 49, 56) donde Sonnet respondía con preámbulo conversacional tipo *"I'll carefully analyze..."* o *"I need to..."* antes del JSON. El `JSON.parse()` fallaba con `Unexpected token 'I'` y se gastaban tokens en retries innecesarios. La página 49 (16 códigos) falló 5 veces seguidas.

### 🛡 Parser JSON resiliente
Nuevo helper `parseJsonResiliente(texto)` que rescata respuestas con preámbulo conversacional usando 3 estrategias en cascada:
1. **Parse directo** tras quitar markdown fences.
2. **Extraer entre `{` inicial y `}` final** de todo el texto.
3. **Regex `/\{[\s\S]*\}/`** como último recurso.

Solo lanza error si las 3 estrategias fallan. Validado con 8/8 casos reales del log.

### 💬 Prompts reforzados anti-conversacional
- **Censo**: reescrito con reglas absolutas ("Tu PRIMER carácter DEBE ser `{`", prohibición explícita de "I'll analyze", "Let me", "Looking at", "I need to") y ejemplos concretos incluyendo un caso con 16 códigos para no truncar cartas de tonos densas.
- **Extracción principal**: mismas reglas absolutas añadidas al formato de salida.
- **Árbitro**: mismas reglas absolutas.

### 🔄 Aplicado a 4 puntos de parseo en todo el código
- Censo (páginas del catálogo)
- Extracción principal (Opus + Sonnet)
- Árbitro Opus (veredictos)
- Validación manual de nombre (pantalla de revisión)

### Resultado esperado
Páginas que antes fallaban 5 veces consecutivas y quemaban tokens sin rescate:
- **v11**: ~4 retries × 4 intentos = 16 llamadas perdidas por página densa.
- **v12**: parse directo al 1er intento aun con preámbulo conversacional.

Ahorra tokens significativos en un tier 1 donde cada llamada cuenta.

## v6.6 (2026-04-18) — Optimizado para Anthropic Tier 1 (rate limits estrictos)

### 🔧 Rediseño completo del pipeline de extracción para Tier 1
Tras diagnosticar un log admin real, se detectó que el Tier 1 de Anthropic (50 req/min, 30K tokens-in/min por modelo) hacía que el pipeline paralelo anterior fallara en el 81% de las páginas por 429.

**Cambios estructurales**:
- **Censo ahora secuencial** (1 página a la vez en lugar de 4 en paralelo) con 3.5s de espera base entre páginas.
- **Extracción Opus/Sonnet también secuencial** con 2.5s de espera base por modelo.
- **Pausa de recuperación de 30s** entre censo y extracción principal para permitir que el token bucket se recargue.
- **Retry con backoff exponencial** en TODAS las fases (censo, extracción, árbitro): 5s → 10s → 20s → 40s → 60s con máximo 4 intentos.
- **Detección de 429 por texto** en el mensaje de error (no solo por status code).

### 🕒 Confirmación previa de duración
- Al iniciar el procesamiento, un aviso explica que tomará 40-60 minutos y detalla cada fase con su tiempo estimado.
- Instrucciones claras: **NO cerrar la pestaña**, backup automático en caso de falla.

### 🎚 Toggles arreglados (Quórum y Árbitro)
- **Problema anterior**: al hacer clic en los toggles, recreaban el modal completo causando flicker y sensación de que no funcionaban.
- **Ahora**: actualizan la UI inline (classList.toggle + textContent) sin recrear el DOM. Cambio visual instantáneo.
- Se agregaron IDs (`lbl-arbitro`, `lbl-quorum`) a las etiquetas para actualización dinámica.

### ℹ Banner informativo Tier 1
- Nuevo texto en Configuración → General explicando los límites del tier 1 y ofreciendo opción de subir a tier 2 en Anthropic Console (~$40 USD) para procesamiento más rápido.

### 🔎 Árbitro Opus con retry
- Antes, el árbitro tenía un `throw new Error('HTTP 429')` que lo hacía fallar ante el primer 429.
- Ahora usa el mismo sistema de retry con backoff que las demás fases.

### Resultado esperado
- **Fiabilidad**: cobertura del 100% de las páginas (antes: 19% en censo por 429).
- **Duración**: 40-60 min por catálogo de 126 páginas (antes: fallaba en 5 min dejando ~60 productos detectados).
- **Detección esperada**: 150-220 productos (antes: ~60).

## v6.5 (2026-04-17) — Modo admin + Toggle quórum + Backup + Retry rate limits

### 🔧 Modo administrador con consola de debug
- **Nuevo badge "ADMIN"** en la sidebar — clic en el nombre de usuario lo activa/desactiva.
- **Consola flotante** en esquina inferior derecha con logs en tiempo real del flujo de extracción.
- **Filtros** por nivel (error/warn/success/debug) y por categoría (censo/opus/sonnet/árbitro/quórum/rate-limit/set-expand/general).
- **Botón "📋 Copiar"** exporta todos los logs al portapapeles para análisis externo (ej: pegar en un chat con Claude para diagnosticar problemas).
- **Logger centralizado** `adminLog(level, category, message, data)` usado en todas las fases críticas: censo página por página, extracción por modelo/página/pasada, conflictos del quórum, decisiones del árbitro, rate limits 429.
- **Persistencia** del modo admin entre sesiones vía `STATE.config.modoAdmin`.
- 5000 entradas máximo en memoria con rotación FIFO.

### 🔀 Toggle de Capa 3 (Quórum Opus + Sonnet)
- Nuevo switch en **Configuración → General** al lado del toggle del árbitro.
- Cuando está desactivado, **solo corre Opus 4.7** — útil para diagnosticar si Sonnet está aportando cobertura o no, o para ahorrar API calls cuando Opus solo sea suficiente.
- Por defecto: activo.

### 💾 Backup automático no destructivo del catálogo anterior
- **Problema anterior**: al procesar un catálogo nuevo se perdía el anterior irreversiblemente si algo fallaba.
- **Ahora**: antes de limpiar, el catálogo, paquetes y páginas del ciclo anterior se guardan en `STATE._backupCatalogo` con timestamp.
- **Banner visible** en la página de Catálogo cuando existe un backup disponible, con dos botones:
  - **"↺ Restaurar catálogo anterior"** devuelve todo al estado previo.
  - **"🗑 Descartar backup"** lo elimina cuando ya no sea necesario.

### 🔁 Retry automático para páginas fallidas
- **Problema anterior**: cuando una página devolvía error 429 (rate limit) durante la extracción paralela, esa página se quedaba con 0 productos silenciosamente, reduciendo la cobertura total.
- **Ahora**: las páginas que fallan en el batch paralelo se reintentan **secuencialmente** al final con espera de 1.5s entre cada una. Cada retry queda registrado en la consola admin con `success` o `error`.
- **Nuevo helper `fetchConRetry`** con backoff exponencial (2s → 4s → 8s → 16s) para casos extremos de 429.

### 🛠 Diagnóstico del problema de "60 productos detectados"
Con los logs admin ahora puedes ver exactamente en qué se está perdiendo la detección:
- ¿El censo detectó todos los códigos pero la extracción no los devolvió? → problema en el prompt o rate limit.
- ¿Opus devuelve mucho menos que Sonnet por página? → rate limit de Opus, ya mitigado con retry.
- ¿Ciertas páginas consistentemente vacías? → verificarlas visualmente.
- Copia los logs con el botón "📋" y pégalos en chat para análisis preciso.

## v6.4 (2026-04-16) — SETs con componentes + productos multi-variante

### Nueva regla para productos MULTI-VARIANTE (colores/tonos/tallas)
- **Problema resuelto**: productos como el Corrector Líquido con tonos 1C, 2C, 3C, 4C al mismo precio se contaban como 4 productos separados cuando en realidad son 1 solo producto con 4 SKUs.
- **Ahora**: el prompt de extracción instruye a la IA a devolver UN producto con un array `codigosHermanos` que contiene los códigos adicionales. El código principal queda en `codigo`.
- **UI de revisión**: cuando un producto tiene hermanos, aparece un bloque dorado "🎨 Variantes del mismo producto" con los códigos editables (puedes agregar/quitar variantes antes de aprobar).
- **BD maestra**: al aprobar, todos los códigos quedan vinculados al mismo producto maestro — cada código hermano apunta al `codigoPrincipal` para reutilización en ciclos futuros.
- **Tarjetas de producto**: muestran un badge dorado "+N" al lado del código cuando el producto tiene variantes, con tooltip listando los códigos.

### Nueva regla para SETs con componentes individuales
- **Problema resuelto**: un SET como "Set Collares Gyra Jade" (CÓD. 43475 a $179.900) que contiene "Collar Gyra" (CÓD. 43476 a $99.900) y "Cadena Jade" (CÓD. 43477 a $89.900) solo se registraba como 1 producto. Ahora también quedan disponibles los productos individuales por separado.
- **Ahora**: el prompt pide identificar los componentes con sus precios individuales en `componentesSet[]`.
- **Nuevo paso 4.8 en el flujo**: función `expandirProductosSet` que tras el árbitro genera los productos individuales adicionales, conservando el SET original. Cada producto individual queda trazable con `_fuenteSet` apuntando al código del SET padre.
- **UI de revisión**: bloque azul "📦 SET — Productos individuales que lo componen" muestra cada componente con su precio. Los productos generados como componentes muestran "creado desde SET CÓD. XXXX".
- **BD maestra**: los componentes guardan el atributo `fuenteSet` para trazabilidad permanente.

### Validaciones ejecutadas
- ✅ Sintaxis JavaScript limpia en todos los archivos
- ✅ 5/5 tests unitarios de `expandirProductosSet` (SET con componentes, sin precios, duplicados, producto normal, no toca productos no-SET)
- ✅ 6/6 tests de normalización de `codigosHermanos` (dedup, exclusión del principal, filtro de basura, limpieza de caracteres no-dígito)

## v6.3.2 (2026-04-16) — Ocultar columnas en Seguimiento

### Nueva funcionalidad
- **Ocultar columnas de la tabla de Seguimiento**: ahora puedes simplificar la vista ocultando columnas que no uses en un momento dado.
- **Tres formas de ocultar/mostrar**:
  - Al pasar el mouse sobre un encabezado aparece un botón ✕ sutil para ocultar esa columna directamente.
  - Nuevo botón "📋 Columnas" en la barra superior muestra contador de columnas ocultas y abre un modal para gestionarlas.
  - Modal con dos secciones: columnas ocultas (clic para restaurar) y columnas visibles (clic para ocultar).
- **Persistencia**: la configuración se guarda en `STATE.seguimientoColsOcultas` y se mantiene entre sesiones.
- **Protección**: no se pueden ocultar todas las columnas — se exige mantener al menos 2 visibles.
- **Exportación conserva todo**: al exportar a Excel, se exportan las 32 columnas originales independientemente de cuáles estén ocultas en la UI. Esto preserva compatibilidad con el formato oficial Yanbal y evita pérdida accidental de datos.
- **Botón "Restaurar todas"** en el modal para volver a la vista completa de un clic.

## v6.3.1 (2026-04-16) — HOTFIX deployment Vercel

### Fixes críticos de deployment
- **Eliminado bloque `functions` de `vercel.json`** que causaba el error `The pattern "api/*.js" defined in functions doesn't match any Serverless Functions`. Vercel autodetecta las funciones en `api/` sin necesidad de ese patrón, y en proyectos vanilla (no-Next.js) el patrón falla intermitentemente — bug conocido de Vercel.
- **`maxDuration` movido dentro de cada función** como propiedad top-level del `export const config`. Esto es más robusto que declararlo en `vercel.json` porque la config viaja con el código:
  - `claude-vision.js`, `claude.js`, `remove-bg.js`: 60 segundos (llamadas a Anthropic)
  - `upload-image.js`, `whatsapp-send.js`: 30 segundos
  - `state-load.js`, `state-save.js`, `whatsapp-test.js`: 10 segundos
- **`engines.node` eliminado de `package.json`**. Ahora Vercel usa la versión de Node configurada en Project Settings, evitando conflictos con "Production Overrides". Se recomienda cambiar Project Settings → Node.js Version a 22.x (la 20.x está marcada como obsoleta por Vercel).

## v6.3 (2026-04-16) — Capa 0 (Censo) + Toggle árbitro

### Nueva Capa 0 — Censo de códigos previo a la extracción
- **Problema resuelto**: en catálogos densos (cartas de tonos, joyería en grid) los modelos a veces reportaban solo el producto principal y no los SKUs individuales. Por ejemplo, una página con 6 tonos de corrector se devolvía como 1 producto en lugar de 6.
- **Solución**: antes de la extracción completa con Opus+Sonnet, se ejecuta una **pasada rápida con Sonnet** que solo cuenta los códigos "CÓD. XXXX" visibles en cada página. Este número actúa como guía explícita en el prompt de extracción: *"en esta página debes encontrar N productos con código, si ves menos mira otra vez"*.
- **Costo adicional**: 1 llamada a Sonnet por página (rápida y barata). Para un catálogo de 126 páginas son ~126 llamadas extra — totalmente asumible.
- **Detector de cobertura**: después de la extracción, compara los códigos del censo contra los realmente extraídos por ambos modelos. Si hay códigos faltantes, queda registrado en el log de actividad con el mensaje "X códigos del censo no fueron extraídos — posible cobertura incompleta".
- **Progreso visible**: el usuario ve un nuevo "Paso 2.5/5" en la pantalla de procesamiento.

### Toggle activar/desactivar árbitro Opus (Capa 3.5)
- Añadido en **Configuración → General** un switch que permite desactivar el árbitro Opus cuando ya se tenga confianza en que Capa 0 + Capa 3 están detectando todo correctamente.
- Por defecto está **activo**. Al desactivarlo, los productos con conflicto o solo_uno van directo a revisión humana sin la tercera pasada de Opus.
- Ahorra llamadas a la API una vez el sistema esté estabilizado.
- Queda registro en el log de actividad cuando el árbitro está desactivado: "Árbitro Opus desactivado: X productos van directo a revisión humana".

### Impacto esperado
- **Detección de productos** debería subir de ~60 a ~150–200 en catálogos Yanbal de 126 páginas (acorde con la densidad real de SKUs).
- **Carga de revisión manual** debería reducirse porque el censo captura cartas de tonos que antes se perdían silenciosamente.

## v6.2 (2026-04-16) — Capa 3.5 (Árbitro Opus) + Aviso cambio de campaña

### Nueva capa de seguridad — Capa 3.5: Árbitro Opus 4.7
- Después del quórum Opus vs Sonnet (Capa 3), los productos marcados como `conflicto` o `solo_uno` pasan por una **tercera lectura independiente de Opus 4.7** que relee la página desde cero.
- **Regla estricta**: el árbitro solo aprueba automáticamente si su lectura **coincide con la primera pasada de Opus**. Si coincide con Sonnet (contradiciendo al primer Opus) → revisión humana. Si da un tercer precio distinto → triple conflicto → revisión humana con advertencia visual.
- Para productos `solo_uno`: solo se aprueban automáticamente si el árbitro confirma el mismo precio. Si el árbitro no encuentra el producto en la página → se marca como probable falso positivo.
- Llamadas al árbitro **agrupadas por página** para minimizar consumo de API (si hay 5 productos conflictivos en la misma página, es UNA sola llamada).
- Veredictos visibles en la pantalla de revisión humana: `confirma_opus`, `coincide_sonnet_no_opus`, `triple_conflicto`, `confirmado_arbitro`, `arbitro_discrepa`, `no_encontrado`.

### Aviso de cambio de campaña
- Al procesar un nuevo catálogo cuando ya hay uno cargado, el sistema **advierte explícitamente** antes de reemplazar productos y paquetes del ciclo anterior.
- El aviso aclara qué se conserva (nombres, imágenes, categorías — BD maestra) y qué se reemplaza (precios, ofertas, productos ofertados — cambian cada ciclo).
- Se confirma que **los precios NO se persisten en la BD maestra** — solo nombres e imágenes verificadas. Los precios siempre se toman frescos del catálogo nuevo.
- Texto informativo actualizado en el modal de BD maestra para reflejar este comportamiento.

## v6.1 (2026-04-16) — HOTFIX imagen + cobertura

### Fixes críticos
- **Blob privado detectado automáticamente**: si tu Vercel Blob Store está configurado como privado, ya no revienta. El API devuelve un error explicativo con instrucciones.
- **Fallback de imágenes**: si el Blob falla (privado, cuota, red), las imágenes ahora se usan como **data URLs base64** directamente en la UI. Esto garantiza que las imágenes de productos y páginas SIEMPRE se muestren, aunque no se persistan entre sesiones.
- **Aviso claro al usuario**: cuando el Blob está privado, aparece una alerta con la solución ("Vercel → Storage → Blob → Settings → Public").
- **Node 20 forzado** en package.json (engines) — evita el error "invalid Node.js Version 24.x".
- **vercel.json sin runtime forzado** — Vercel usa la versión de Node de Project Settings.

### Cambios en extracción
- **Opus + Sonnet de nuevo** (antes eran 2 pasadas de Opus). Opus da precisión máxima, Sonnet da cobertura extra. Entre los dos detectan ~95% de los productos vs ~40% de Opus solo.
- **Auto-aprobación inteligente**: cuando ambos modelos coinciden en precio y código → producto aprobado automáticamente, SIN pedir revisión manual. Solo pide revisión para conflictos o "solo uno detectó".

### v6.0 (cambios previos)
- Editor de imagen tipo Photoshop: recortar, rotar, voltear, brillo/contraste, quitar fondo IA + local
- Validación manual (botón 🔒) con modal comparativo
- Envío masivo de WhatsApp desde clientas e historial
- Helper confirmarDestructivo con cuenta atrás
- extraerCelularCO para sincronizar teléfonos limpios
- Excel sin decimales (raw: true)
- Seguimiento: ocultar/agregar filas, scrollbars gruesas
- api/remove-bg.js para quitar fondo con IA

## v5.0
- Flyer dinámico, pestaña Seguimiento

## v4.0
- Generador automático, doble usuario

## v3.0
- KV persistente, visión IA

## v2.0
- Clientas, cartera, cobros

## v1.0
- Panel inicial
