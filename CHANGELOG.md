# CHANGELOG

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
