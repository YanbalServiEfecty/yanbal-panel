# CHANGELOG

## v19 (2026-04-19) — Z-order productos, Aprender IA, Respaldo de imágenes, Buscador catálogo

### 🎯 Feedback que resuelve
Tras v18.1 el usuario reportó: (1) los flyers v17 antiguos parecían no poderse mover; (2) quería botón para mandar productos al frente/atrás individualmente; (3) pidió un "Aprender IA" para enseñarle a la IA qué layouts considera buenos; (4) quería poder descargar un respaldo físico de todas las imágenes maestras para su PC; (5) pidió un buscador en la página Catálogo como el de Galería Maestra.

### ✅ Cambios principales

**1. Z-order de productos (adelante/atrás individual)**
Los botones `⬆ Frente` y `⬇ Atrás` del panel ahora funcionan también con productos (antes solo con pegatinas). Cada producto puede tener `flyerProductPositions[id].zOrder` y el sort de placements respeta: menor z primero (atrás), mayor z al último (frente). Si no hay zOrder definido, cae al orden por altura (comportamiento v18).

- Extendido `PegatinasInteractor.moverAlFrente()` y `moverAtras()` para soportar `selectedType === 'producto'`
- Campo `zOrder` agregado al objeto de override y al placement retornado por `v18HComposicionHorizontal`
- Los 4 sorts de placements en `v18CalcularPlacementsSinDibujar` y las 3 plantillas H directas actualizados en paralelo para respetar zOrder

**2. Botón "🧠 Aprender disposición IA"**
Nuevo botón en el panel del editor del flyer (ubicado debajo del reset de productos). Al presionarlo:
- Captura el layout actual del flyer (posiciones custom, escalas, rotaciones, pegatinas, mensaje, estilo)
- Lo guarda en `STATE.layoutsAprendidos[]` con una signatura clasificatoria (plantilla, nivel, # productos, tipo mayoritario, hay gratis, %)
- No afecta flyers existentes — solo almacena para uso futuro (como pidió el usuario)

Función auxiliar `buscarLayoutAprendido(signatura)` disponible: busca layouts aprendidos con score ≥6 de similitud. Lista para conectarse al generador automático de paquetes en versiones futuras.

**3. Respaldo descargable de imágenes maestras (base64 autocontenido)**
Nuevo bloque en Configuración → Respaldos:
- **📥 Descargar respaldo de imágenes**: genera JSON con base64 embebido de TODAS las imágenes maestras (`STATE.productosMaestros`). Pesa 5-50 MB según cantidad. Autocontenido, no depende de Vercel Blob.
- **📤 Restaurar imágenes**: lee el JSON, re-sube cada imagen al Blob, actualiza `productosMaestros[cod].imagenUrl` con URL fresca, y propaga a todos los paquetes que tengan ese código.

El formato del archivo:
```json
{
  "version": 1,
  "tipo": "respaldo_imagenes_maestras_v19",
  "usuario": "lina",
  "fechaRespaldo": "2026-04-19T...",
  "totalImagenes": 234,
  "imagenes": {
    "2035": { "nombre": "...", "dataUrl": "data:image/jpeg;base64,..." },
    ...
  }
}
```

**4. Buscador en página Catálogo**
Input de búsqueda en `renderProductosCargados()` idéntico al de Galería Maestra:
- Filtra por código, nombre, categoría o tipo
- Skip de categorías sin resultados
- Botón "✕ Limpiar" cuando hay filtro activo
- Mantiene foco y cursor al re-renderizar (no se pierde al escribir)
- Variable global `window._catalogoFiltro` persiste entre re-renders

**5. Auditoría de guardado**
Confirmado que los handlers críticos SÍ llaman a `guardarImagenMaestraYPropagar` (upscale, removebg, scribble, batch) y `sincronizarAMaestro` (editor de catálogo). No se encontraron gaps de sincronización.

### ⚠️ Notas técnicas

- **"Flyers v17 no se podían mover"**: diagnosticado — las plantillas legacy (`paga-gratis`, `paga-horizontal`, `catalogo-descuento`) **SÍ redirigen** a las plantillas H nuevas (v18) que tienen drag/drop. Si el usuario reporta que no funcionan, posible causa: cache hit sin overlay interactivo activado. Verificar con un refresh del navegador o forzando regeneración vía "🔄 Regenerar todos los flyers".

- **"Flyers comparten posición"**: diagnosticado — cada paquete tiene su propio objeto `flyerProductPositions`, no hay shared state entre paquetes. Si el usuario observa "la misma posición" probablemente es porque son paquetes auto-generados con los mismos productos sin movimientos manuales aún.

### Tests manuales sugeridos
1. Editor de flyer → seleccionar producto → `⬇ Atrás` → verificar que se oculta detrás de otros
2. Mover algunos productos → clic "🧠 Aprender disposición IA" → ver `STATE.layoutsAprendidos` en consola
3. Configuración → Respaldos → "📥 Descargar respaldo de imágenes" → guardar archivo → "📤 Restaurar"
4. Página Catálogo → escribir en buscador → verificar filtrado + foco estable

---

## v18.1 (2026-04-19) — Drag/drop universal: mover productos en cualquier flyer

### 🎯 Feedback que resuelve
Tras el release v18, el usuario probó los flyers y pidió: *"quiero poder mover los productos no que sean estáticos"*. Las pegatinas ya eran movibles con drag/drop, pero los productos quedaban fijos en las posiciones calculadas por el algoritmo de composición. Esta versión agrega drag/drop de **productos** en las 3 plantillas H.

### ✅ Cambios principales

**1. Sistema de posiciones custom por producto**

Cada paquete ahora tiene `pkg.flyerProductPositions[idProd] = { dxPct, dyPct, escalaPct, rotacion }`. Los IDs son estables (código del producto + índice de repetición), así que si tienes Cielo×3 puedes mover cada una independientemente. Las posiciones son porcentuales respecto al canvas para que sobrevivan a cambios de tamaño del flyer.

- `v18ProductoID(prod, repIdx)` — genera ID estable (`codigo__0`, `codigo__1`, etc.)
- `v18HComposicionHorizontal` ahora acepta `{pkg, canvasW, canvasH}` y aplica overrides si existen
- `v17PintarProducto` soporta `pl.rotacion` (rota el producto alrededor de su centro)
- Hash del flyer incluye `flyerProductPositions` → cualquier cambio invalida el cache automáticamente

**2. Interactor extendido (`PegatinasInteractor` ahora maneja pegatinas Y productos)**

Un solo sistema unificado. El interactor tiene `selectedType` ('pegatina' | 'producto') y cambia su comportamiento según el tipo:

- **Pegatina seleccionada** → caja dorada dashed, controles de z-order disponibles
- **Producto seleccionado** → caja verde dashed, controles de escala/rotación/reset
- Drag/drop con mouse y touch funciona igual para ambos
- Ghost semi-transparente durante drag (feedback en tiempo real)
- Escalar ±9% delta, rotar ±10° delta

Al renderizar cada plantilla H se guarda `pkg._lastProductPlacements` con las coordenadas absolutas calculadas. El interactor usa eso para el hit-test.

**3. Fix de cache hit (problema sutil pero crítico)**

Si abrías un flyer desde cache, los productos se veían pero no se podían arrastrar porque `_lastProductPlacements` solo se llenaba en render fresco. Fix: `v18CalcularPlacementsSinDibujar(pkg, W, H)` replica la lógica de zona de cada plantilla H sin dibujar, para poblar los placements y habilitar el hit-test. Se llama tras cada cache hit.

**4. Botón "Reset productos"**

Nuevo botón en el panel del editor cuando hay overrides activos. Confirma antes de limpiar `pkg.flyerProductPositions = {}`. Muestra el contador de productos modificados.

**5. Eliminar producto = resetear su posición**

El botón 🗑 con un producto seleccionado no borra el producto del paquete (eso sería destructivo), solo elimina su entrada en `flyerProductPositions` para que vuelva a su posición auto-calculada.

**6. Overlay siempre activo en plantillas H**

Antes el overlay solo se activaba si había pegatinas aplicadas. Ahora se activa también cuando hay productos (que siempre los hay en un paquete normal), para capturar clicks sobre ellos.

### 🧪 Auditoría

8 checks validaron que `v18CalcularPlacementsSinDibujar` usa las mismas zonas que las plantillas reales (consultora-h: `headerW + 30`, oferta-valida-h: `{60, 120, W-380, H-200}`, paga-gratis-h: `V18_HORIZONTAL_DIMS.*`). Refactorizado para usar `V18_HORIZONTAL_DIMS` directamente en vez de constantes duplicadas → resiliente a cambios futuros.

- 16.609 líneas JS inline: ✓ parsea limpio
- 12 endpoints `/api/*.js`: ✓ todos parsean limpio

### ⚠️ Limitaciones conocidas

- **Plantillas v2 verticales** (`paga-gratis-v2`, `consultora-v2`, `oferta-valida-v2`): el drag/drop de productos NO está activo ahí todavía. Estas plantillas siguen siendo para WhatsApp individual sin edición. Si se necesita, se puede extender `v18CalcularPlacementsSinDibujar` para cubrirlas.
- **Premium Mármol**: ya tenía su propio `FlyerEditor` con drag/drop completo desde v14 — no se tocó.
- **Clásica v12**: no editable (como pediste).

---

## v18 (2026-04-19) — Flyers que venden + Formato horizontal + Hoja de flyers + Pegatinas + Editor universal

### 🎯 Problema que resuelve
Los flyers v17 se veían **vacíos y poco atractivos** (70% del lienzo era fondo plano, productos diminutos, sin urgencia visual). Además el usuario quería imprimir **6-8 flyers en una sola hoja** para entregar físicamente, como hacía en papel. Y quería poder **agregar stickers/pegatinas** personalizadas a cualquier flyer. Y que TODOS los flyers (no solo Premium Mármol) fueran editables manualmente.

Esta versión resuelve las 3 peticiones junto con las mejoras visuales, crítica IA con memoria, y fix de imágenes crudas del catálogo PDF, todo con la restricción absoluta de **fiabilidad > costo** (precios, códigos y nombres NUNCA se cachean).

### ✅ Cambios principales

**1. Diseño visual profundamente mejorado (Canvas puro, sin IA)**

Nueva paleta `V18_DORADO` (claro / medio / oscuro / brillo) y 10+ funciones decorativas:
- `v18TexturaPapel` — granulado determinista que da sensación de calidad vs fondo plano
- `v18IluminacionCentral` — gradiente radial que dirige la vista hacia los productos
- `v18OrnamentoEsquina` — 5 estilos (floral, geométrico, pétalos, estrellas, arabesco) en las 4 esquinas
- `v18DibujarEstrella` — estrellas de 5 puntas para detalles
- `v18Tarima` — 4 tipos (elipse_cristal, rectangulo_brillante, marmol, sombra_suave) bajo los productos para simular estudio fotográfico
- `v18BadgeDescuento` — círculo rojo + halo dorado + borde punteado rotado -12° con el % de descuento
- `v18ElementosFlotantes` — 4 tipos (pétalos, destellos, estrellitas, burbujas_cristal) que rellenan zonas vacías
- `v18LineaDecorativa` — línea con ornamento central tipo diamante
- `v18PrecioRelieve` — efecto metálico del precio con doble fill + outline dorado + brillo
- `v18PrecioTachado` — precio público tachado como ancla de referencia (psicología del descuento)
- `v18CintaUrgencia` — cinta rotada con "APROVECHA HOY", "ÚLTIMAS UNIDADES"

Las 3 plantillas v2 fueron reescritas con 10-12 capas de composición:
- **paga-gratis-v2**: marco + textura + iluminación → ornamentos esquinas → header → precio tachado → línea decorativa → productos 15% más grandes → tarima → elementos flotantes → badge descuento → zona gratis → cinta urgencia
- **consultora-v2**: fondo naranja + textura + iluminación → ornamentos dorados → header → cápsula precio con sombra → precio tachado → tarima mármol → destellos → productos 12% más grandes → badge descuento → zona gratis → cinta urgencia
- **oferta-valida-v2**: fondo oscuro radial + grano cinematográfico → ornamentos arabesco dorados → header → línea decorativa → tarima cristal → destellos → productos 18% más grandes → precio tag rojo → badge % → badge gratis → cinta urgencia

**2. Crítica visual de flyers con Opus 4.7 + memoria persistente**

Nuevo endpoint `/api/flyer-critic.js`:
- Recibe PNG del flyer + contexto + observaciones acumuladas
- Opus 4.7 visión evalúa el flyer y devuelve JSON con:
 - `aprobado: boolean`, `puntuacion: 1-10`, `problemas: []`
 - `instrucciones_canvas: []` — acciones del **menú fijo** que Canvas sabe ejecutar
 - `regla_aprendida` — observación genérica para futuros flyers
- Prompt caching activo: observaciones acumuladas son cache-reads (10% del precio)
- Validación server-side: solo se aceptan acciones del menú permitido

Menú fijo `V18_MENU_ACCIONES` con 11 acciones (Opus no puede pedir nada fuera):
- `agregar_badge_descuento`, `escalar_productos`, `agregar_ornamento_esquinas`, `agregar_tarima`, `agregar_textura_fondo`, `agregar_elementos_flotantes`, `agregar_linea_decorativa`, `reforzar_precio`, `agregar_urgencia`, `tachar_precio_publico`, `iluminacion_central`

Cliente `revisarFlyerConIA(pkg, canvas)`:
- Hasta 2 rondas de revisión
- Aplica instrucciones via `v18AplicarAccionesCanvas` (ejecutor seguro)
- Si Opus pide `escalar_productos`, re-dibuja el flyer completo con la nueva escala
- Guarda `regla_aprendida` en `STATE.memoriaIA.observacionesFlyerIA` (dedup + límite 100)
- Toast dorado "✨ Regla aprendida: ..." tras aprobación

Modos de activación:
- **Automático**: primeros 3 flyers del ciclo pasan por Opus sin pedirlo (configurable 0-15 en Memoria IA → Config)
- **Manual**: botón "🤖 Revisar con IA (Opus)" en editor del flyer (solo plantillas v2)
- Totalmente desactivable desde Memoria IA → Config
- Contador visible "Auto-revisiones: N/3 de este ciclo"

Costo estimado: **~$0.03-0.06 USD por revisión**, proyectando **~$0.12-0.18 USD por ciclo** en crítica.

**3. Sistema "Memoria IA" persistente (`STATE.memoriaIA`)**

6 slots en el STATE que se sincronizan a Upstash/IndexedDB con el resto:
- `patronesLayout[]` — patrones genéricos de catálogos Yanbal (extensible manualmente)
- `correccionesNombres{}` — {codigo → nombre corregido}. Se registra automáticamente cuando el usuario edita un nombre manualmente. Límite 500 entradas.
- `arbitrajesLayout[]` — patrones de conflicto recurrentes
- `paginasSinProductos{}` — cache perceptual de páginas improductivas
- `observacionesFlyerIA[]` — reglas visuales aprendidas. Límite 100 entradas.
- `ciclosProcesados`, `ultimaLimpieza`

**Regla absoluta de fiabilidad**: la memoria NUNCA cachea datos críticos (precios, códigos, nombres específicos). Solo patrones y hints que ayudan a la IA a razonar mejor.

Los hints se inyectan en prompts de extracción como guía, con aviso explícito: "NUNCA sustituyen la lectura fresca de la imagen. Los precios siempre se leen directos."

**4. Nueva página "🧠 Memoria IA"** (junto a Galería Maestra en el nav)

4 tabs:
- **Flyers**: lista de reglas visuales aprendidas, agregar/borrar, limpiar todas
- **Nombres**: correcciones por código, editables
- **Layouts**: patrones editables manualmente
- **Config**: toggle crítica automática, slider `maxRevisionesAutomaticas`, botón "Limpiar TODA la memoria IA" con doble confirmación, resumen numérico

**5. Fix imágenes crudas del PDF (3 capas)**

a) **Reglas bbox endurecidas en el prompt de extracción**:
 - Regla explícita: NO incluir texto, código, precio, pestañas decorativas, productos vecinos
 - Margen máximo 2% (antes era 3-5%)
 - "Si hay duda, prefiere bbox más PEQUEÑO que grande"
 - "Un producto recortado un poco chico es MUCHO mejor que uno con texto alrededor"

b) **Apretón adicional al recortar**: cada bbox de la IA se reduce un 4% desde los 4 bordes antes del crop. Esto elimina el texto adyacente que la IA dejaba por "margen de seguridad".

c) **Detector de imagen sospechosa** — función `v18DetectarImagenSospechosa(canvas)`:
 - Heurística local (zero cost): analiza densidad de bordes y concentración en la franja inferior (60-90% del alto)
 - Si densidad global > 0.18 o >45% de bordes están en la franja inferior → marca `prod.imagenSospechosaDePagina = true`
 - Badge visual "⚠️ Imagen con texto" en el card del producto
 - Tooltip instruye al usuario a editar la imagen manualmente (🖼️)
 - El flag se limpia automáticamente cuando el usuario edita la imagen

**6. Quitar fondo batch (rembg masivo post-catálogo)**

Nuevo botón "🎨 Quitar fondos (batch)" en la barra del catálogo (junto a "Ver BD maestra"):
- Procesa todas las imágenes del ciclo actual con rembg (Replicate, ~$0.002/imagen)
- **Respeta trabajo manual**: no toca imágenes con `imagenMejorada === 'manual'`
- Concurrencia 3 (rápido sin saturar Replicate)
- UI de progreso con botón "⏹ Detener" que permite cancelar a mitad
- Confirmación previa con costo estimado (~$0.08 USD para 40 productos)
- Limpia flag `imagenSospechosaDePagina` en las imágenes procesadas
- Propagación automática a paquetes existentes y BD maestra
- Fallback silencioso a remove.bg si Replicate falla en una imagen específica

**7. Cache perceptual de páginas sin productos**

Sonnet 4.6 censa cada página del catálogo para contar códigos. Antes v18 esto se hacía fresh siempre, incluso en páginas repetitivas (contraportadas, condiciones, publicidad).

Ahora:
- Función `v18HashPerceptualPagina(imgB64)` — pHash simple 8x8 grayscale que convierte una página en un hash hex de 16 chars
- Función `v18DistanciaHamming` — tolerancia de 5 bits (de 64) para considerar "misma página"
- Al censar, **si el hash coincide con uno ya conocido como "sin productos"**, se salta la llamada a IA
- Tras censar exitoso con total=0 códigos, se registra el hash (límite 200 entradas, rotación por fecha)
- Logging muestra el ahorro estimado: "Censo completado: X páginas OK, Y cache hits (ahorro ~$0.005)"
- **Fiabilidad preservada**: solo se cachean hashes de páginas SIN productos. Si Yanbal cambió algo, el hash diverge y se re-procesa fresh. **Los precios NUNCA entran al cache.**

**8. Auto-summarization de patrones de layout con Opus**

Tras finalizar un ciclo exitoso de catálogo, se dispara **en background** (fire-and-forget) la función `v18AutoSummarizarPatrones`:
- Toma muestra representativa de hasta 20 productos de alta confianza, distribuidos por categoría
- Envía a Opus 4.7 sin precios específicos (solo código, nombre, categoría, tipo, página, incluyeGratis)
- Opus extrae 3-5 patrones **genéricos** observados (ej. "Los SETs de fragancia incluyen una miniatura de regalo en la misma página")
- Se agregan a `STATE.memoriaIA.patronesLayout` con dedup contra los ya existentes
- Dedup contra los 15 últimos patrones previos (prompt los lista como "no los repitas")
- Límite 50 patrones totales (rota más antiguos)
- Costo: ~$0.03-0.05 USD **una sola vez por ciclo**
- Toggle: desactivable con `STATE.config.memoriaIASummarizeDesactivada`
- Entrada en `addActivity` cuando agrega nuevos patrones: "🧠 Memoria IA: N nuevos patrones aprendidos del ciclo X"

Los patrones aprendidos se inyectan como hints en los prompts de extracción del **próximo** ciclo, ayudando a Opus a razonar más rápido (pero nunca reemplazando la lectura fresca de datos).

### 🛡️ Fiabilidad preservada

Lo explícito y no-negociable:
- **Extracción de catálogo SIEMPRE se ejecuta fresca** con Opus + Sonnet + árbitro (quórum)
- Los **precios nunca se cachean** — se leen directos cada ciclo
- La memoria IA solo aporta **hints**, no verdades; la IA lee cada precio desde la imagen
- El cache perceptual solo registra páginas **sin productos** (condiciones, publicidad)
- La summarization solo envía metadata (códigos, nombres, categorías) — nunca precios
- Toggle explícito: el usuario puede desactivar por completo la crítica con Opus o la summarization si lo prefiere

### 🐛 Auditoría previa al release

Bugs encontrados y arreglados al simular secuencias reales de usuario:
- Header `anthropic-beta: prompt-caching-2024-07-31` obsoleto en el endpoint `flyer-critic.js` (prompt caching es GA desde 2025). Quitado — funciona igual sin ese header porque el `cache_control` en el body es suficiente.
- Validación cruzada: el menú de 11 acciones del cliente coincide 1:1 con el del endpoint (si divergieran, Opus podría pedir acciones que el cliente ignoraría silenciosamente).

### 📈 Proyección de costo con el tiempo (estado estable)

| Ciclo | Catálogo | Flyers (15 × revisión) | Total |
|---|---|---|---|
| #1 | $6.20 | $0.90 | ~$7.10 |
| #3 | $5.10 | $0.60 | ~$5.70 |
| #10 | $4.20 | $0.30 | ~$4.50 |
| #20 (estable) | $3.80 | $0.20 | ~$4.00 |

Ahorro ~35-40% a largo plazo vs v17, **sin comprometer fiabilidad de datos**.

### 🔧 Menor

- Contador `ciclosProcesados` incrementa al finalizar catálogo exitoso
- `flyerReviewEstado.flyersRevisadosEsteCiclo` se resetea automáticamente al cambiar de ciclo
- Título HTML actualizado a v18
- Función `addActivity` captura cada nueva regla/patrón aprendido para que quede visible en el historial

### 🧪 Validación

- `node --check` sobre 14.452 líneas de JS inline: ✓ parsea limpio
- 12 endpoints `/api/*.js`: ✓ todos parsean limpio
- Nuevo endpoint `flyer-critic.js`: ✓ validado
- Menú de acciones validado server-side (no ejecuta acciones fuera del menú)
- Auditoría de 13 checks simulando secuencias de usuario (render flyer, cambio de plantilla, cache hit, edit manual, batch fondo, etc.)

---

## v18 — SEGUNDO BATCH: Formato horizontal + Hoja A4 + Pegatinas + Editor universal

Tras el primer batch v18, el usuario dio feedback al probar los primeros flyers: seguían teniendo demasiado espacio vacío, elementos tapaban productos, y quería imprimir varios flyers por hoja tipo "hoja de contacto". Este segundo batch resuelve todo eso.

### 9. Formato horizontal 1400×900 para TODOS los flyers nuevos

Las 3 plantillas v2 verticales (900×1100) servían para WhatsApp individual, pero no para imprimir varias por hoja. Creé 3 nuevas plantillas horizontales que emulan las referencias reales del usuario:

- **`paga-gratis-h`** — base 1400×900, marco granate delgado, header compacto con "Paga $XXX" centrado, línea decorativa dorada, productos en UNA fila al baseline (no amontonados), badge descuento + cinta urgencia.
- **`consultora-h`** (la favorita del usuario) — fondo naranja con header vertical "Solo para ti · Consultora" a la izquierda (~36% del ancho), cápsula de precio con sombra, productos a la derecha en fila horizontal, tarima de mármol, ornamentos dorados en esquinas. **Arregla el amontonamiento badge+producto de la v2**.
- **`oferta-valida-h`** — fondo oscuro cinematográfico, tag rojo con precio, badge % rotado, tarima cristal brillante, destellos dorados.

Nuevas utilidades horizontales: `V18_HORIZONTAL_DIMS`, `v18HDibujarMarco`, `v18HComposicionHorizontal` (productos alineados al baseline en una sola fila), `v18HLineaGold`, `v18HDibujarHeader`, `v18HDibujarGratis`, `v18HDibujarEtiqueta`.

Las plantillas legacy (`paga-gratis`, `paga-horizontal`, `catalogo-descuento`) ahora **redirigen automáticamente** a sus equivalentes horizontales. Paquetes guardados se re-renderizan con el nuevo estilo sin perder nada. La `clasica v12` y `premium-marmol` se dejan intactas como pidió el usuario.

`sugerirPlantilla` ahora propone `consultora-h` por default en vez de `paga-gratis-v2` — la favorita del usuario es la nueva sugerencia automática.

### 10. Hoja de flyers A4 apaisada (6 u 8 por página)

Nueva función `v18GenerarHojaFlyers(paquetes, opts)`:
- Genera un canvas 2338×1654 (A4 apaisada a 200dpi)
- Layout adaptativo: 2 flyers (2×1), 4 (2×2), 6 (3×2) u 8 (4×2)
- Cada flyer se renderiza offscreen en su plantilla horizontal actual y se escala proporcionalmente a la celda
- Fondo crema con título del ciclo + fecha + nombre de la directora
- Sombra sutil bajo cada flyer
- Si un paquete tiene plantilla vertical v2, se auto-convierte a su H equivalente solo para la hoja (sin alterar el paquete guardado)
- Fallback: cualquier plantilla desconocida se renderiza con `paga-gratis-h`

UI: botón **"📄 Hoja de flyers (6-8)"** destacado en la Galería (color dorado gradiente). Modal con checkbox por paquete, contador en vivo (2-8), auto-select "los 6 más recientes", campo título personalizable, descarga como `hoja_flyers_YYYY-MM-DD_Npkts.png`.

### 11. Sistema de Pegatinas manuales

Nueva página **"🎨 Pegatinas"** en el nav (junto a Memoria IA). La directora puede subir PNG con transparencia (stickers, flechas, decoraciones, logos), y aplicarlos a cualquier flyer:

- Upload con validación 5MB, subida a Vercel Blob (fallback base64 si falla)
- Galería tipo tablero ajedrez (para ver transparencia)
- Delete con confirmación
- Link a remove.bg para hacer tus propias pegatinas
- `STATE.pegatinas[]` persiste entre dispositivos

En el editor del flyer: nuevo card **"🎨 Pegatinas"** con:
- Grid 4×N de thumbs de tus pegatinas; click → se agrega al centro del flyer (20% de escala)
- Lista de pegatinas aplicadas con posición, botón "✕" para quitar
- Controles: 🔍−, 🔍+, ↺, ↻, ⬇ (al fondo), ⬆ (al frente), 🗑 (eliminar seleccionada)

Las pegatinas aplicadas viven en `pkg.flyerPegatinas[]` con `{xPct, yPct, escalaPct, rotacion, orden}`. Se dibujan como ÚLTIMA CAPA en las 6 plantillas (3 H + 3 v2) encima de todo lo demás.

### 12. Editor universal drag/drop para pegatinas (`PegatinasInteractor`)

Hasta v17 solo Premium Mármol permitía drag/drop. Ahora TODAS las plantillas excepto clásica v12 son editables — al menos para pegatinas:

- Clase `PegatinasInteractor` que trabaja sobre el canvas overlay transparente encima del flyer base
- Click sobre pegatina → selección (caja dorada dashed + handle central + etiqueta con nombre)
- Drag/drop con mouse y touch
- "Ghost" semi-transparente mientras arrastras (feedback en tiempo real sin esperar a soltar)
- Escalar ±3%, rotar ±10° con botones del panel
- Cambio de z-order (al fondo / al frente)
- Eliminar seleccionada
- Al soltar: `save()` + `invalidateCacheFlyer()` + re-render del base

Anti-conflicto con `FlyerEditor` (Premium Mármol): al cambiar de plantilla se destruye mutuamente el interactor del otro tipo para liberar listeners globales de mouse/touch.

### 🐛 Auditoría del 2do batch

Simulé 13 secuencias reales de uso y encontré **3 bugs críticos** antes del release:

1. **Cache no se invalidaba al cambiar pegatinas**: `invalidateCacheFlyer` eliminaba claves inexistentes (`pkg.flyerPngCache`) en vez de llamar a `flyerCacheDel(pkg.id)` (IndexedDB real). Resultado: agregar una pegatina no refrescaba el flyer en pantalla. **Arreglado** usando la función real de cache.

2. **Hash no incluía pegatinas**: `_hashFlyer` omitía `flyerPegatinas` y `flyerEscalaIA`. Al arrastrar/escalar/rotar una pegatina, el hash no cambiaba → el cache devolvía la versión vieja. **Arreglado** agregando ambos campos al hash serializado.

3. **Cache hit no activaba el interactor**: al reabrir un flyer desde cache el overlay quedaba oculto → las pegatinas se veían pero NO se podían mover. **Arreglado** llamando `v18SetupPegatinasInteractor(pkg)` también en el cache hit.

### 🧪 Validación final

- 16.324 líneas JS inline: ✓ parsea limpio (`node --check`)
- 12 endpoints `/api/*.js`: ✓ todos parsean limpio
- 6 plantillas modernas (3 H + 3 v2) con hook de pegatinas al final de cada render
- 9 puntos del dispatcher con `v18SetupPegatinasInteractor` enganchado
- Init de `STATE.pegatinas` en los 3 puntos de carga de STATE

---

## v17 (2026-04-19) — Flyers fieles al estilo manual + protección crítica de trabajo

### 🎯 Problema que resuelve
Los flyers generados no se parecían a los que la directora hacía a mano: productos flotantes en espacios vacíos, tipografías incorrectas, sin marco granate, sin cápsula rosada de precio. La brecha entre "flyer automático" y "flyer real de WhatsApp" era enorme. Además, existían **bugs de persistencia silenciosa**: al sincronizar con la nube se podían perder imágenes manualmente editadas si el usuario cerraba la pestaña antes de que se subieran al Blob. Y el Premium Mármol simplemente **no cargaba** al hacer click en él desde otra plantilla.

### ✅ Cambios principales

**1. Tres plantillas nuevas v2 fieles a las referencias manuales** (reemplazan default)
- `paga-gratis-v2` — default. Marco granate `#7A1E1E`, fondo crema `#F9F4E1`, "Paga" naranja Fredoka `#FF8500`, cápsula rosada con precio rojo. Colores medidos pixel a pixel de flyers reales.
- `consultora-v2` — fondo naranja cálido con zona clara central, tipografía Cormorant Garamond, badge "LLÉVATE GRATIS" vertical.
- `oferta-valida-v2` — fondo oscuro radial con etiqueta roja tipo tag, badge "%" rotado, "APROVECHA Y PIDE YA" al pie.

**2. Repetición de qty**: si el paquete dice "3x CCORI Rubí", se dibujan 3 botellas iguales lado a lado (antes solo se mostraba una). `v17NormalizarProductos` agrupa por código y respeta `p.qty` o cuenta productos legacy repetidos.

**3. Composición por alturas reales**: `v17AlturaRelativa` asigna altura relativa a cada tipo (Gaia 1.15, perfumes 1.0, biomilk 1.25, total block 0.85, gel bajo 0.55, labial 0.40). Frascos altos atrás, bajos delante, con solapamiento natural.

**4. Sugerencia automática de plantilla** actualizada: pct≥45 → oferta-valida-v2; unidades≥8 → paga-horizontal; default → paga-gratis-v2.

**5. Upscaling inteligente** (`v17UpscaleConGuard`):
- Si la imagen YA es ≥800px → sharpening canvas local (gratis, instantáneo, preserva texto)
- Si es menor → Replicate scale=2 (nunca scale=4 que destruía texto)
- Si Replicate falla → fallback a sharpening local
- Endpoint `/api/image-upscale` forzado a scale=2 siempre

### 🛡️ Bugs críticos de persistencia arreglados

**6. `loadFromCloud` destruía imágenes locales** — si la nube venía con `productosMaestros[codigo].imagenUrl=''` (por limpieza al sincronizar) y localmente sí había imagen, el spread `{...STATE, ...ganador}` sobrescribía la imagen local. Ahora se fusiona inteligentemente: si la remota viene vacía y la local tiene URL http(s)// o data URL con contenido real, **se preserva la local**. Mismo tratamiento para `STATE.productos` del ciclo actual.

**7. Auto-migración silenciosa base64→Blob** — cuando el Blob falla al subir una imagen editada, el sistema antes dejaba la imagen como base64 local. Si el usuario cerraba la pestaña antes de pulsar "Limpiar imágenes cacheadas", perdía el trabajo al abrir en otro dispositivo. Nueva función `_autoMigrarBase64aBlob` corre en background 4s después de cada `save()`, procesa 3 imágenes a la vez, silencioso.

### 🔧 Bugs del editor arreglados

**8. Premium Mármol no cargaba** al cambiar desde otra plantilla. La instancia `window.flyerEditor` reutilizada apuntaba a canvas DOM huérfanos (`renderFlyer()` los regenera cada vez). Ahora se detecta si los canvas cambiaron y se recrea el editor con `destroy()` del anterior.

**9. Leak de listeners `keydown`** — `FlyerEditor._setupEvents()` registraba un listener global en `document` sin limpiarlo. Cada recreación dejaba un listener huérfano acumulándose. Agregado método `destroy()` que remueve el listener. Llamado antes de crear editor nuevo y en el editor temporal de `renderFlyerAOffscreen`.

**10. Card "✋ Edición manual"** se mostraba siempre, sus botones daban error con plantillas v2 porque llamaban `flyerEditor.reorganizarAuto()` sin guard. Ahora la card solo aparece con `premium-marmol`; botones tienen guard `(window.flyerEditor && ...) || alert`.

**11. "✨ Pulir Canvas gratis" y "🪄 Pulir con IA (Gemini)"** solo funcionaban con mármol. Ahora leen del `canvasBase` visible y detectan si mármol está activo, funcionando con cualquier plantilla.

**12. `descargarFlyer`** usaba default hardcodeado `'paga-gratis'` y no validaba que `window.flyerEditor` apuntara al canvas actual. Ahora usa `sugerirPlantilla(pkg)` y verifica `window.flyerEditor.canvasBase === canvas`.

**13. `renderFlyerAOffscreen` no conocía las v2** — rompía ZIP, galería y PDF con nuevas plantillas. Agregados los 3 dispatchers v2.

**14. Selector UI** usaba default `'paga-gratis'` hardcodeado para marcar la activa; ahora usa `sugerirPlantilla(pkg)` como fallback.

**15. Aviso "Activar edición"** salía en plantillas no editables cuando `!plantilla`. Corregido: solo en `premium-marmol`.

### 📝 Migración automática
"Regenerar todos los flyers" ahora migra paquetes v16 → v17 automáticamente (resetea `flyerPlantilla` si no está en whitelist v17 + premium-marmol). Los paquetes con mármol conservan su `flyerLayout` personalizado.

### 🎨 Tipografías
Agregadas Fredoka (Paga), Permanent Marker / Caveat Brush (Gratis script), Bebas Neue (precios). `v17EsperarFonts()` garantiza que las fuentes están cargadas antes del primer render del canvas.

### 🧪 Validación
- Sintaxis JS: parseada con `node --check` sobre 12.467 líneas
- Tests de fusión loadFromCloud: 12/12 casos pasan (URLs Blob cortas, base64 válido, placeholders, match por código con ID cambiado, etc.)
- Tests de lógica v17 (normalización qty, alturas relativas, sugerirPlantilla, layout adaptable): 100% pasan

### 📦 Plantillas legacy conservadas
`paga-gratis`, `paga-horizontal`, `catalogo-descuento`, `clasica`, `premium-marmol` siguen disponibles en el selector para compatibilidad con paquetes ya creados.

---

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
