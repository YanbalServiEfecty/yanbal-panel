# Yanbal Panel — v4

Panel de gestión para directoras Yanbal con extracción automática de catálogos, generación de paquetes, base de datos maestra de productos, y sistema de recordatorios automáticos por WhatsApp.

---

## 🆕 Novedades v4 — Precios 100% fieles

La v4 ataca el problema más crítico: **nunca vender con un precio incorrecto**. Introduce una arquitectura de 4 capas de seguridad para la carga de catálogos.

### Capa 1 — Extracción visual por IA
La IA ahora **ve** el PDF como un humano en lugar de leer texto plano que puede estar desordenado. Cada página se rasteriza a 150 DPI y se envía como imagen a Claude. Esto elimina el problema donde el extractor de texto mezclaba nombres entre productos contiguos del catálogo.

### Capa 3 — Quórum de 2 modelos
Cada página se procesa **en paralelo** con 2 modelos independientes:
- **Claude Opus 4.7** (modelo primario — máxima precisión)
- **Claude Sonnet 4.6** (verificación cruzada)

Al terminar, se cruzan los resultados por código de producto:
- ✅ **Quórum OK** — ambos modelos coinciden en precio → verde
- ⚠ **Solo un modelo** — solo uno detectó el producto → amarillo
- ❌ **Conflicto** — precios distintos → rojo, bloqueado hasta revisión manual

### Capa 4 — Revisión humana obligatoria
Antes de poder generar paquetes, debes revisar **cada producto** uno por uno viendo la página del catálogo al lado. Los conflictos aparecen primero, luego los sin quórum, y al final los verdes. Sin aprobar el 100%, el botón "Generar paquetes" queda bloqueado.

### Bonus: Edición manual de precio
Nuevo botón 💰 en cada tarjeta de producto que permite editar el precio con **doble confirmación** (debes escribir el nuevo precio para confirmar). Cada edición queda en un log de auditoría.

### Costos y tiempo estimado
- **~$6-8 USD por catálogo** (≈ $25,000-$32,000 COP)
- **~5-7 minutos** de procesamiento (vs 30s del método anterior)
- La seguridad compensa con creces frente al riesgo de vender al precio equivocado

---

## Variables de entorno requeridas (Vercel)

Estas 3 deben estar configuradas en **Settings → Environment Variables**:

| Variable | Para qué | Si falta |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Opus 4.7 + Sonnet 4.6 | No extrae catálogo |
| `BLOB_READ_WRITE_TOKEN` | Guardar imágenes de páginas | Error 500 al subir |
| `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` | Enviar flyers por WA | Opcional |

Además en **Storage**: tener creado un Blob Store conectado al proyecto.

---

## Qué trae la v3 (base)

### 1. Catálogo con IA
- Regex reescrito que captura correctamente los nombres multilínea del formato Yanbal (`"2. Ccori Rubí"` + `"Parfum"` → `"Ccori Rubí Parfum"`).
- **Claude Opus 4.7** para estructuración y verificación visual.
- **BD maestra persistente**: cada producto verificado se guarda por código. En la siguiente campaña solo se procesan productos nuevos (~20%). Costo cae de ~$4.176 COP (primera campaña) a ~$835 COP (siguientes).
- Editor de imagen con recortador drag-to-crop sobre la página del PDF o subida manual.
- Verificación con IA individual (~$80 COP/producto) o masiva de dudosos.

### 2. Paquetes
- "+N más" en el historial ahora es un enlace funcional que abre un modal con el detalle completo (imágenes, códigos, cantidades, precios).
- Botón 👁 Ver rápido junto al flyer.

### 3. Clientas + Cartera
- Vista tabla con KPIs: ventas totales, cartera pendiente, morosas, paquetes.
- Badge de estado: al día / pendiente / moroso (con días).
- Campo de cumpleaños (formato MM-DD).
- **Detalle por clienta** con timeline unificado de paquetes + cobros + mensajes.
- Registro rápido de cobros.
- Marcar pagado en un click.

### 4. Recordatorios automáticos (6 tipos configurables)
| Tipo | Cadencia | Trigger |
|---|---|---|
| 🔴 Morosos días | Cada N días | Cobro vencido <60 días |
| 🔴 Morosos meses | Cada N meses | Cobro vencido ≥60 días |
| ⏰ Pre-cierre | N días antes | Sin pedido + cierre cercano |
| 💰 Pago próximo | N días antes | Cobro por vencer |
| 🌸 Postventa | N días después | Pago recibido |
| 🎂 Cumpleaños | El día exacto | `fechaCumple === hoy` |

**Configuración por clienta:** cada clienta puede tener su propia cadencia (override del default). Modal accesible desde 🔔 Preferencias en el detalle.

**Motor de cola:** calcula automáticamente qué mensajes enviar, evita duplicados (vía `enviosLog`), respeta máximo de intentos. Botón "Enviar todos" o "Enviar los N de este tipo".

### 5. WhatsApp Business Cloud API (multi-número)
- Cada directora guarda sus credenciales independientemente: `accessToken` + `phoneNumberId` + `wabaId`.
- Soporta tanto un WABA compartido con varios números (recomendado) como cuentas separadas.
- Botón "🧪 Probar conexión" valida contra `graph.facebook.com`.
- Fallback automático a WhatsApp Web (`wa.me`) si no hay credenciales.
- Endpoints: envío de texto libre, plantillas aprobadas, e imágenes con caption.

---

## Arquitectura técnica

### Stack
- Frontend: HTML/CSS/JS puro, un solo `index.html` (~4.300 líneas).
- pdf.js para extracción de texto nativo del PDF.
- Canvas API para recorte de imágenes.
- Backend: funciones serverless de Vercel en `/api`.
- Persistencia: Upstash Redis (state por usuario) + Vercel Blob (imágenes).

### Endpoints
| Ruta | Función |
|---|---|
| `/api/claude.js` | IA de texto para estructurar productos |
| `/api/claude-vision.js` | IA visual para verificar nombres |
| `/api/upload-image.js` | Subir imágenes a Vercel Blob |
| `/api/state-save.js` | Persistir STATE en Redis |
| `/api/state-load.js` | Cargar STATE desde Redis |
| `/api/whatsapp-test.js` | Validar credenciales de Meta |
| `/api/whatsapp-send.js` | Enviar mensaje (text/template/image) |

### Variables de entorno en Vercel
```
ANTHROPIC_API_KEY=sk-ant-...       # Para que las usuarias no tengan que pegar su propia key
BLOB_READ_WRITE_TOKEN=vercel_blob_... # Para Vercel Blob
KV_REST_API_URL=https://...         # Upstash Redis (o UPSTASH_REDIS_REST_URL)
KV_REST_API_TOKEN=...               # Upstash Redis (o UPSTASH_REDIS_REST_TOKEN)
```

**No** se guardan credenciales de WhatsApp como env vars — cada directora las ingresa en su propia configuración del panel y se guardan por-usuario en Redis.

---

## Cómo configurar WhatsApp Business API

Para automatizar el envío de mensajes, cada directora necesita credenciales de **Meta Cloud API**.

### Paso 1: Crear Meta Business Account
1. Ir a [business.facebook.com](https://business.facebook.com).
2. Crear una "Meta Business Account" (una sola, compartida para Lina y Laura).
3. Verificar la empresa (puede tardar 1-3 días).

### Paso 2: Agregar WhatsApp Business Account (WABA)
En la cuenta Meta Business → Configuración → WhatsApp → Agregar WABA.

### Paso 3: Agregar los números de WhatsApp
Dentro de la WABA → Phone Numbers → Add phone number.
- Agregar el número de Lina.
- Agregar el número de Laura.
- Cada uno recibe un **Phone Number ID** distinto (ej. `112233445566778`).

### Paso 4: Crear System User y generar token permanente
En Business Settings → System Users → Create → Admin.
- Assign Assets → WhatsApp Account → Full Control.
- Generate Token → seleccionar permisos `whatsapp_business_messaging` + `whatsapp_business_management`.
- **Marcar "Never expire"**. Copiar el token.

### Paso 5: Configurar en el panel
Lina inicia sesión → Configuración → pestaña "📱 WhatsApp":
- Número visible: `+57 300 123 4567`
- Phone Number ID: el de Lina
- WABA ID: el de la cuenta
- Access Token: el permanente
- Click "🧪 Probar conexión" → debe decir ✓ con el display name.

Laura hace lo mismo con **su propio Phone Number ID** pero el **mismo WABA ID y token** (si comparten la cuenta Business).

### Paso 6: Plantillas aprobadas (opcional, para mensajes fuera de la ventana de 24h)
Para poder enviar el primer mensaje a una clienta (o retomar conversación después de 24h de silencio), Meta exige usar una **plantilla aprobada**. Se crean en Business Manager → WhatsApp Manager → Message Templates. Tarda 1-2 horas aprobar.

Categorías permitidas para los recordatorios:
- `UTILITY` — para cobros, pagos próximos, confirmaciones (más barata, ~$0.01-0.03 USD/conversación en Colombia).
- `MARKETING` — para ofertas, cumpleaños, pre-cierre (más cara, ~$0.05 USD).

El endpoint `/api/whatsapp-send.js` ya soporta modo `template` con `templateName` y variables.

---

## Costos reales por catálogo (Opus 4.7)

Con catálogo típico Yanbal (126 páginas, ~170 productos únicos):

| Escenario | USD | COP |
|---|---|---|
| Primera campaña (solo texto) | $0.63 | ~$2.566 |
| Primera campaña + verificación dudosos | $1.03 | ~$4.176 |
| Siguientes campañas (con BD maestra) | $0.21 | ~$835 |
| Verificación individual de 1 producto | $0.02 | ~$80 |

**Proyección anual con 12 campañas:** ~$13.400 COP/año usando BD maestra.

WhatsApp Cloud API: ~$0.01-0.05 USD por conversación iniciada por el negocio.

---

## Cómo probar

### 1. Deploy en Vercel
```bash
git clone <este-repo>
cd yanbal-panel-main
# Configurar env vars en Vercel Dashboard
vercel --prod
```

### 2. Primer login
- Abrir la app → elegir perfil (Lina o Laura).
- Configurar API Key de Claude (opcional si el servidor ya tiene `ANTHROPIC_API_KEY`).
- Configurar credenciales de WhatsApp (opcional al inicio).

### 3. Procesar catálogo
- Catálogo → subir PDF → llenar datos del ciclo → Procesar.
- Tiempo: 1-3 min para 126 páginas.
- Revisar nombres con badges: ✓ BD / ? / ⚠ revisar.
- Click 🤖 Verificar dudosos para corregir masivamente.
- Click 🖼️ en cualquier producto para recortar su imagen real desde la página.

### 4. Generar paquetes
- ✨ Generar paquetes automáticos → se crean 15 paquetes instantáneamente distribuidos en los 8 niveles.

### 5. Clientas y cartera
- Agregar clientas con teléfono + cumpleaños.
- Registrar cobros desde el detalle de clienta.
- Configurar preferencias personalizadas por clienta (🔔 Preferencias).

### 6. Recordatorios
- Ir a Recordatorios.
- Ver la cola pendiente (calculada automáticamente).
- Activar/desactivar cada tipo, ajustar cadencias, editar plantillas.
- "Enviar todos los N" → envía por API si hay credenciales, si no abre WhatsApp Web.

---

## Estructura del estado (STATE)

```javascript
STATE = {
  config: {
    name, apiKey, flete,
    whatsapp: { accessToken, phoneNumberId, wabaId, numeroVisible, verificado },
    recordatorios: {
      morosos: { activo, cadaDias, maxIntentos, horaEnvio },
      morososMeses: { activo, cadaMeses, maxIntentos, horaEnvio },
      preCierre: { activo, diasAntes, horaEnvio },
      pagoProximo: { activo, diasAntes, horaEnvio },
      postventa: { activo, diasDespues, horaEnvio },
      cumpleanos: { activo, horaEnvio },
      plantillas: { morosos, morososMeses, preCierre, pagoProximo, postventa, cumpleanos }
    }
  },
  ciclo: { nombre, fecha, gratis, gratisNombre, gratisPrecio },
  productos: [...],          // del ciclo actual
  productosMaestros: {...},   // BD acumulada entre ciclos, por código
  paginasUrls: { pageIdx: url },
  clientas: [{ id, nombre, telefono, notas, fechaCumple, preferenciasRecordatorios }],
  paquetes: [...],
  cobros: [...],
  enviosLog: [...],           // historial completo de envíos
  envios: { clientaId: timestamp },
  rifas, premios, actividad
}
```

---

## Para próximas fases

Todo está preparado para estas extensiones futuras sin cambios estructurales:

1. **Cron automático de recordatorios**: agregar un endpoint `/api/cron-recordatorios` que llame a `calcularColaRecordatorios()` por cada usuario y envíe automáticamente. Vercel Cron puede dispararlo diariamente a las 9am.

2. **Webhook de respuestas de WhatsApp**: endpoint `/api/whatsapp-webhook` que reciba respuestas de clientas y actualice `paquete.clientaRespondio` o `cobro.respondio`.

3. **Envío de flyer como imagen**: ya soportado en `/api/whatsapp-send.js` modo `image`. Solo falta integrarlo en el botón "Enviar flyer" del paquete.

4. **Reporting**: con `enviosLog` se puede calcular tasa de respuesta por tipo, efectividad de plantillas, etc.
