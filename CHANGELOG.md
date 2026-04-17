# Changelog

## [v5] — Flyer dinámico + pestaña Seguimiento + carga masiva Excel

### Añadido
- **Flyer con altura dinámica** (Problema #3). El canvas se redimensiona según la cantidad de productos del paquete. Con 13+ productos usa grid 4 columnas, con 10-12 usa 3 columnas compactas, con 1-9 usa 3 columnas normales. Ya no hay "+ N productos más" — todos caben. El box "PAGAS SOLO" siempre queda al final sin superponerse.
- **Pestaña "📊 Seguimiento"** en el menú lateral (Problema #5). Reemplaza el Excel manual que usabas antes del panel.
  - Importa el Excel oficial Yanbal "ListaGrupoPersonal" con las 29 columnas originales.
  - Mapeo tolerante a variaciones de espacios ("Venta Pública Personal Campaña  1" con 2 espacios, "Deuda " con espacio final, etc.).
  - Merge inteligente: si una clienta ya existe en el seguimiento, se actualiza; si es nueva, se añade.
  - 3 columnas calculadas en tiempo real desde el panel: paquetes enviados, cartera pendiente, último contacto.
  - Tabla filtrable por nombre/código/distrito/CEM.
  - Filtro por acción (RT / REA).
  - Celdas editables click-a-click (excepto Código y Nombre que son las llaves).
  - Vínculo a ficha completa de Base de clientas si la clienta existe en ambos lados.
  - Exportación de vuelta a Excel con las 29 columnas + las 3 automáticas.
  - KPIs: Venta C3 total, Venta C4 total, Con deuda/inactivas, Reactivadas.
- **Carga masiva de clientas desde Excel** (Problema #5 — botón en "Base de clientas"). Admite Excel simple con columnas Nombre / Teléfono / Dirección / Notas / Distrito / Cumpleaños / Código Yanbal. Deduplica por código Yanbal o por combinación nombre+teléfono.
- **Sincronización seguimiento → Base de clientas** con un clic: las clientas del Excel que no estén en tu base se crean automáticamente, las existentes se respetan.
- Campo `codigoYanbal` en las clientas del panel para vincular ambos sistemas.
- Librería SheetJS (XLSX 0.18.5) desde CDN para leer/escribir Excel en el navegador.

### Cambiado
- `dibujarFlyer` completamente reescrita: pre-calcula altura antes de dibujar.
- `PAGE_TITLES` y `PAGE_ACTIONS` extendidos con la nueva página Seguimiento.
- Dispatcher de `goPage` conecta `seguimiento → renderSeguimiento`.
- Barra superior de Clientas ahora incluye botón "📥 Importar masivo Excel".

### Estado de los 5 problemas reportados
- [x] **#1 Precios fieles** — Resuelto en v4 con Capas 1+3+4 (visión + quórum + revisión humana).
- [x] **#2 Subir imagen falla** — Resuelto en v4 (actualización `@vercel/blob` 0.23 → 2.3.3).
- [x] **#3 Flyer se sobrepone** — Resuelto en v5 (altura dinámica).
- [x] **#4 Editar precio manualmente** — Resuelto en v4 (botón 💰 con doble confirmación).
- [x] **#5 Carga masiva clientas + pestaña Seguimiento** — Resuelto en v5.

---

## [v4] — Precios 100% fieles

### Añadido
- **Capa 1 — Extracción visual por IA.** Rasterización a 150 DPI + envío como imagen a Claude.
- **Capa 3 — Quórum de 2 modelos.** Cada página se procesa en paralelo con Opus 4.7 y Sonnet 4.6.
- **Capa 4 — Revisión humana obligatoria.** Pantalla donde el usuario aprueba cada producto.
- **Edición manual de precio** con doble confirmación y log de auditoría.
- Estados visuales en las tarjetas: ✓ Quórum, ⚠ Solo Opus/Sonnet, ❌ Conflicto, 👤 Aprobado.

### Arreglado
- Bug crítico donde productos contiguos se cruzaban (ej: CÓD. 43445 aparecía como "Ccori Rubí" en vez de "Floralia Blanc").
- Error 500 al subir imágenes por incompatibilidad de `@vercel/blob 0.23` con Node 24.

---

## [v3] — Base previa

- Regex para multilinea en nombres Yanbal.
- Claude Opus 4.7 para estructuración.
- BD maestra persistente por código de producto.
- Editor de imagen con recorte drag-to-crop.
- Timeline unificado por clienta (paquetes + cobros + mensajes).
- 6 tipos de recordatorios automáticos por WhatsApp.
- Integración WhatsApp Business API (multi-usuario Lina/Laura).
