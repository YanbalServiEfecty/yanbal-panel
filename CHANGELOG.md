# CHANGELOG

## v6.0 (2026-04-16)

### Seguridad anti-error de precios
- Quitado Sonnet como modelo secundario — era más débil que Opus en precios chicos.
- Ahora son **2 pasadas independientes de Opus 4.7** con prompts distintos.
- Si ambas pasadas coinciden → badge ✓ Quórum.
- Si discrepan → revisión manual obligatoria.
- Si solo una detectó → badge ⚠ Solo P1/P2 con revisión recomendada.

### Imágenes automáticas
- El prompt ahora pide `bbox` de cada producto (región de la foto en %).
- Nueva función `recortarImagenesAutomaticamente` corta y sube cada imagen al Blob.
- Badge nuevo: 🖼️ Auto para productos con imagen extraída por IA.

### Editor de imagen completo
- Reemplaza el editor viejo que solo permitía recortar desde la página.
- Herramientas: subir propia, recortar libre, cuadrado centrado, rotar 90°, voltear H/V.
- Ajustes: brillo, contraste.
- Quitar fondo: con IA (remove.bg vía API) o local (chroma key por color de esquinas).
- Fix crítico: ya no falla con `Cannot set properties of null` al subir imagen manual.

### Validación manual
- Nuevo botón 🔒 en cada producto.
- Modal comparativo lado a lado: página del catálogo vs datos extraídos.
- Checkbox obligatorio de confirmación antes de marcar como validado.
- Badge 🔒 Validado queda visible.

### Envío masivo de WhatsApp
- Base de clientas → "📨 Enviar a todas" — mensaje con `{nombre}` personalizable.
- Historial → "📨 Enviar a todas" — flyer+mensaje a clientas con paquete asignado.
- Usa WhatsApp Business API si está configurado (`accessToken`/`phoneNumberId` del usuario).
- Fallback: abre WhatsApp Web (wa.me) una pestaña por clienta.
- Barra de progreso + log en tiempo real + botón cancelar.

### Borrado seguro con doble confirmación
- Nuevo helper `confirmarDestructivo(titulo, mensaje, {segundos, textoConfirmacion})`.
- Cuenta atrás visual de 2-3 segundos antes de habilitar el campo de confirmación.
- El usuario debe escribir la palabra exacta (ej. "BORRAR TODAS LAS CLIENTAS").
- Aplicado en: limpiar seguimiento, limpiar paquetes, borrar toda la base de clientas, envíos masivos.

### Excel — parsing mejorado
- `raw: true` en `sheet_to_json` → valores numéricos como números reales, sin decimales espurios.
- Normalización por tipo: moneda, porcentaje, teléfono, código, texto.
- `EXCEL_HEADER_MAP` ampliado con mayúsculas, tildes y espacios finales.

### Sincronización de clientas
- `extraerCelularCO()` — parser de teléfono que solo conserva el celular de 10 dígitos que empieza por 3.
- Evita que el envío masivo falle cuando el Excel trae "fijo - celular" en la misma celda.
- Se conserva el teléfono original en `telefonoOriginal` por si hay que revisarlo.

### Seguimiento
- Botón 🚫/👁‍🗨 para ocultar/mostrar filas individualmente.
- Botón "+ Agregar fila" para crear registros manualmente.
- Botón toggle "Mostrar ocultas" para ver las filas marcadas como ocultas.

### UI
- Scrollbars gruesas y visibles: 14px en general, 18px en tablas grandes (antes eran 5px casi invisibles).
- Badges nuevos: 🖼️ Auto, 🔒 Validado, ✓ Quórum, ⚠ Solo P1/P2.

### Deploy
- Nuevo `vercel.json` — resuelve los 404 en `/api/upload-image` y `/api/state-save` en ciertos setups.
- Nuevo `api/remove-bg.js` — proxy a remove.bg (requiere `REMOVE_BG_API_KEY`).

---

## v5.0 (versión anterior)
- Flyer dinámico
- Pestaña Seguimiento

## v4.0
- Generador automático
- Doble usuario (Lina/Laura)

## v3.0
- Persistencia con KV
- Visión IA para nombres

## v2.0
- Clientas, cartera, cobros

## v1.0
- Panel inicial: catálogo + paquetes
