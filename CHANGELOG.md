# CHANGELOG

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
