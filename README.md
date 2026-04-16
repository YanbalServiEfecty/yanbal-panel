# Yanbal Panel — Versión reconstruida

## Cambios principales frente a la versión anterior

### 1. Extracción del catálogo ahora sí funciona
El problema: el código llamaba a un modelo llamado `claude-opus-4-5` que **no existe** (da 404). Por eso veías "0 productos".

Cambios:
- **Modelo correcto**: `claude-sonnet-4-5` (más rápido y barato, más que suficiente para esta tarea).
- **Arquitectura nueva**:
  1. pdf.js extrae el texto nativo de cada página (gratis, sin tokens).
  2. Un regex detecta precios + códigos (en el PDF que probé: 72 productos candidatos).
  3. La IA (una sola llamada cada 8 páginas) limpia nombres, categoriza y descarta falsos positivos.
  4. Solo se rasterizan las páginas que TIENEN productos (no las 126), y se suben a Vercel Blob una sola vez.
- **Fallback sin IA**: si la llamada a Claude falla o no hay API key, el sistema sigue funcionando con categorización por heurística de nombre. No bloquea.

### 2. Generador de paquetes automático (sin IA, determinístico)
Antes le pedías a la IA que armara paquetes, lo cual era lento, costoso y frecuentemente inexacto en las sumas. Ahora:

- Algoritmo de **subset-sum con variedad de categorías** cubre automáticamente los 8 niveles:
  - Escala 25% ($225k) · Nivel Especial ($320k) · Nivel 1 ($435k)
  - Escala 30% ($680k) · Nivel 2 ($910k)
  - Escala 35% ($1.36M) · Nivel 3 ($1.82M) · Nivel 4 ($3.64M)
- Genera 15 paquetes por defecto con variaciones (1.0x, 1.15x, 1.35x, etc. del mínimo del nivel).
- Para niveles altos prioriza productos caros; para niveles bajos combina variedad.
- **Antes de generar pregunta** si hay producto gratis especial del ciclo — queda como "regalo del ciclo" en todos los paquetes del flyer.

### 3. Imágenes de productos
Cada producto guarda la URL de la página donde aparece. No es un crop perfecto (las páginas Yanbal tienen muchos productos por página con layouts complejos), pero:
- Se sube UNA vez a Vercel Blob y queda almacenada.
- En el próximo ciclo, las páginas se re-generan por hash del archivo — no se re-procesan si es el mismo PDF.
- En el flyer se muestra la página completa como imagen del producto.

### 4. Flyer
El canvas del flyer ahora:
- 720x1080 (proporción Instagram Stories, perfecto para WhatsApp).
- Grid de 3x3 productos máximo con imágenes.
- Badge de tipo de oferta (50%, 2x1, Oferta Top, etc).
- Badge de cantidad si hay x2+.
- Sección "Recibes gratis" resaltada con el gratis del ciclo + cualquier gratis incluido en productos.
- Precio público tachado + gran precio final CON flete.

### 5. Resto de páginas
Clientas, Mensajes (plantillas WhatsApp), Cobros, Rifas con sorteo, Premios por nivel, Recordatorios — todas funcionan igual que antes pero pulidas.

## Cómo probar

1. **Desplegar** como estaba (Vercel). Los endpoints API existentes (`/api/claude`, `/api/upload-image`, `/api/state-load`, `/api/state-save`) no cambiaron, sólo `index.html`.
2. **Abrir la app** y subir `COL_2026_C04.pdf`.
3. Llenar datos del ciclo (nombre, fecha, si hay gratis especial).
4. "Procesar catálogo" → ~1-3 min (depende de las páginas con productos y velocidad de Blob uploads).
5. Deberías ver ~60-80 productos cargados con categorías.
6. "Generar paquetes automáticos" → se crean 15 paquetes instantáneamente.
7. Abrir cualquier paquete en "Paquetes guardados" → "🖼️ Flyer" → descargar.

## Variables de entorno necesarias en Vercel

Las mismas que ya tenías:
- `ANTHROPIC_API_KEY` — para llamadas de IA sin pedir key a la usuaria.
- `BLOB_READ_WRITE_TOKEN` — para `@vercel/blob`.
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) — para el estado compartido.

## Limitaciones conocidas

- La IA puede tardar 30-90 segundos procesando el catálogo por primera vez (8 páginas por lote, ~10-15 lotes).
- El recorte de imagen del producto está a nivel página (no por producto individual). Las páginas con 3 productos muestran los 3 en la miniatura del flyer — es visualmente OK pero no es un crop perfecto. Mejorarlo requeriría detección de objetos por página y no vale el costo extra de IA.
- Si el PDF no tiene texto nativo (es un escaneo), la extracción fallará. El catálogo oficial Yanbal siempre tiene texto nativo, así que esto no debería pasar en producción.
