# Changelog

## [v4] — Precios 100% fieles

### Añadido
- **Capa 1 — Extracción visual por IA.** Rasterización a 150 DPI + envío como imagen a Claude. Elimina los errores de extracción de texto donde se mezclaban nombres de productos contiguos.
- **Capa 3 — Quórum de 2 modelos.** Cada página se procesa en paralelo con Opus 4.7 y Sonnet 4.6. Si los precios no coinciden, el producto queda bloqueado.
- **Capa 4 — Revisión humana obligatoria.** Nueva pantalla donde el usuario aprueba cada producto viendo la página del catálogo al lado. Sin aprobar el 100%, no se puede generar paquetes.
- **Edición manual de precio** con doble confirmación y log de auditoría (nueva función `editarPrecioProducto`).
- Estados visuales en las tarjetas de producto: ✓ Quórum, ⚠ Solo Opus/Sonnet, ❌ Conflicto, 👤 Aprobado.
- Barras de progreso duales (Opus y Sonnet en paralelo).

### Cambiado
- `procesarCatalogo` ahora redirige al nuevo flujo `procesarCatalogoConVision`.
- `renderProductosCargados` ahora bloquea la vista si hay productos sin aprobar y redirige a `renderRevisionObligatoria`.
- `abrirGeneradorAuto` ahora verifica que todos los productos estén aprobados antes de abrir el modal.
- `productCardHTML` incluye los nuevos badges de quórum y el botón 💰 de edición de precio.
- `@vercel/blob` actualizado de `^0.23.0` a `^2.3.3` (compatibilidad con Node 24.x).
- `api/upload-image.js` ahora expone logs detallados (stack trace, errorName, errorCode) en el response cuando falla.

### Arreglado
- Bug crítico donde productos contiguos en el catálogo se cruzaban: ej. CÓD. 43445 aparecía con nombre "Aretes Ccori Rubí" cuando el real es "Aretes Floralia Blanc".
- Error 500 al subir imágenes por incompatibilidad de `@vercel/blob 0.23` con Node 24.

### Estado de los otros problemas reportados
- [x] **#1 Precios fieles** — Resuelto con Capas 1+3+4.
- [x] **#2 Subir imagen falla** — Resuelto (actualización de `@vercel/blob`).
- [x] **#4 Editar precio manualmente** — Resuelto (función `editarPrecioProducto` con doble confirmación).
- [ ] **#3 Flyer se sobrepone con muchos productos** — Pendiente.
- [ ] **#5 Carga masiva de clientas Excel + pestaña Seguimiento** — Pendiente.

---

## [v3] — Base previa

- Regex para multilinea en nombres Yanbal ("2. Ccori Rubí" + "Parfum").
- Claude Opus 4.7 para estructuración.
- BD maestra persistente por código de producto.
- Editor de imagen con recorte drag-to-crop.
- Timeline unificado por clienta (paquetes + cobros + mensajes).
- 6 tipos de recordatorios automáticos por WhatsApp.
- Integración WhatsApp Business API (multi-usuario Lina/Laura).
