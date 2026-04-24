// Endpoint: crítico visual de flyers con Claude Opus 4.7
//
// Toma: PNG del flyer generado + contexto (plantilla, productos, precio) +
//       observaciones acumuladas de flyers anteriores (memoria IA persistente).
// Devuelve: JSON con puntuación, problemas, instrucciones para Canvas (menú fijo),
//           y una "regla aprendida" que se agregará a la memoria persistente si
//           el flyer se aprueba.
//
// IMPORTANTE: Opus solo PUEDE elegir de un menú fijo de acciones. El cliente valida
// que las acciones pedidas estén en el menú. Esto evita que una respuesta
// maliciosa o incorrecta de la IA rompa el flyer.
//
// Costo estimado: ~$0.03-0.06 USD por llamada con caching activo.
// - Prompt sistema (menú + reglas): ~2.5k tokens (cache reads tras primera llamada)
// - Observaciones acumuladas: ~1-3k tokens (cache reads)
// - Imagen del flyer (~1.2 MP): ~1.5k tokens
// - Respuesta JSON: ~600-800 tokens
// Total: ~$0.025 primera llamada, ~$0.015 siguientes con caching.

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '8mb' } }
};

// Menú de acciones permitidas — debe coincidir exactamente con V18_MENU_ACCIONES del cliente.
const MENU_ACCIONES_PERMITIDAS = [
  'agregar_badge_descuento',
  'escalar_productos',
  'agregar_ornamento_esquinas',
  'agregar_tarima',
  'agregar_textura_fondo',
  'agregar_elementos_flotantes',
  'agregar_linea_decorativa',
  'reforzar_precio',
  'agregar_urgencia',
  'tachar_precio_publico',
  'iluminacion_central',
];

// Prompt sistema: instrucciones fijas (cacheables, no cambian entre llamadas)
function construirPromptSistema() {
  return `Eres un crítico experto en diseño de flyers comerciales para venta por WhatsApp de productos Yanbal (cosmética y fragancias) en Colombia. Tu trabajo es evaluar flyers y sugerir mejoras CONCRETAS y EJECUTABLES.

PRINCIPIOS DE FLYERS QUE VENDEN (derivados de investigación de psicología del color):
1. Regla 60-30-10: 60% color base cálido (crema/naranja), 30% acento (granate/vino), 10% detalle (dorado metálico).
2. Rojo aumenta conversiones en CTAs un ~21%. Usar en badges de descuento y cintas de urgencia.
3. El área vacía transmite "producto barato". Los flyers deben tener TEXTURA, ornamentos o elementos flotantes en los espacios vacíos.
4. Los productos deben ocupar al menos 50% del área disponible.
5. Tarima/pedestal bajo los productos simula "estudio fotográfico profesional" y eleva la percepción de valor.
6. Precio tachado como ancla (Antes $X) hace que el precio actual se perciba como ganga.
7. Urgencia ("APROVECHA HOY", "ÚLTIMAS UNIDADES") aumenta decisión de compra.

TU TAREA:
Recibes una imagen de flyer ya generado. Decides si está listo para WhatsApp.

SOLO PUEDES SUGERIR ACCIONES DE ESTE MENÚ EXACTO:
- agregar_badge_descuento { texto?, porcentaje?, posicion: "top_right"|"top_left"|"bottom_right"|"bottom_left" }
- escalar_productos { factor: number 0.8-1.8 }  (el factor se aplica en el próximo re-render)
- agregar_ornamento_esquinas { estilo: "floral"|"geometrico"|"petalos"|"estrellas"|"arabesco" }
- agregar_tarima { tipo: "elipse_cristal"|"rectangulo_brillante"|"marmol"|"sombra_suave" }
- agregar_textura_fondo { intensidad: number 0.03-0.12 }
- agregar_elementos_flotantes { cantidad: number, tipo: "petalos"|"destellos"|"estrellitas"|"burbujas_cristal" }
- agregar_linea_decorativa { y: number, estilo: "ornamento_central"|"simple" }
- reforzar_precio {}
- agregar_urgencia { texto: string (max 20 chars), posicion: "top_right"|"bottom_center"|"middle_left" }
- tachar_precio_publico { precio_anterior: number }
- iluminacion_central { intensidad: number 0.2-0.5 }

Si pides una acción FUERA de este menú, será ignorada. Sé CONSERVADOR: sugiere máximo 3-4 acciones por ronda. Evita sobrecargar el flyer.

FORMATO DE RESPUESTA (JSON ESTRICTO, sin markdown, sin preamble):
{
  "aprobado": boolean,
  "puntuacion": number (1-10),
  "problemas": ["problema 1", "problema 2"],
  "instrucciones_canvas": [
    { "accion": "nombre_accion", "params": { ... } }
  ],
  "regla_aprendida": "Una frase corta (<120 chars) con una observación GENÉRICA aplicable a futuros flyers, NO específica de este paquete. Ej: 'Los flyers con menos de 4 productos necesitan ornamentos para llenar el espacio'. Omitir si no hay nada generalizable. Usar null en ese caso."
}

Reglas:
- Aprobar si puntuacion >= 7.
- Si el flyer está APROBADO, instrucciones_canvas puede estar vacío.
- NUNCA sugieras cambios en precios, productos o textos del header — esos son datos fijos.
- Sé directo y conciso en los problemas. No escribas opiniones vagas.`;
}

function construirPromptUsuario({ contexto, memoriaAcumulada }) {
  const observaciones = (memoriaAcumulada || []).slice(-30); // últimas 30 reglas aprendidas
  let prompt = '';

  if (observaciones.length > 0) {
    prompt += `OBSERVACIONES APRENDIDAS DE FLYERS ANTERIORES (aplícalas si son relevantes):
${observaciones.map((o, i) => `${i+1}. ${o}`).join('\n')}

`;
  }

  prompt += `CONTEXTO DEL FLYER ACTUAL:
- Plantilla: ${contexto.plantilla || 'desconocida'}
- Productos: ${contexto.numProductos || 0} productos (${contexto.unidadesTotales || 0} unidades con qty)
- Precio total: $${(contexto.precio || 0).toLocaleString('es-CO')}
- Descuento: ${contexto.pct || 0}%
- Hay producto gratis: ${contexto.hayGratis ? 'sí' : 'no'}
${contexto.rondaAnterior ? `- Esta es la ronda ${contexto.ronda}/2 de revisión. En la ronda anterior sugeriste: ${JSON.stringify(contexto.rondaAnterior)}` : ''}

Evalúa la imagen del flyer adjunta y responde con el JSON estricto.`;

  return prompt;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { apiKey, imageB64, mediaType = 'image/png', contexto = {}, memoriaAcumulada = [] } = body;

  if (!apiKey) return res.status(400).json({ error: 'Falta apiKey' });
  if (!imageB64) return res.status(400).json({ error: 'Falta imageB64' });

  const promptSistema = construirPromptSistema();
  const promptUsuario = construirPromptUsuario({ contexto, memoriaAcumulada });

  // Construcción del payload con prompt caching activo
  const payload = {
    model: 'claude-opus-4-7',
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: promptSistema,
        cache_control: { type: 'ephemeral' }, // cache 5min — muy ahorrador si se llama varias veces
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageB64 },
          },
          {
            type: 'text',
            text: promptUsuario,
          },
        ],
      },
    ],
  };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    let data;
    try { data = await resp.json(); }
    catch(e) { return res.status(500).json({ error: 'Respuesta no-JSON de Anthropic', status: resp.status }); }

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data.error?.message || 'Error de Anthropic',
        tipo: data.error?.type,
        detalle: data,
      });
    }

    // Extraer texto de la respuesta
    const textoRespuesta = (data.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n')
      .trim();

    // Parsear JSON tolerante (quitar markdown code fences si vinieron)
    let resultado;
    try {
      const limpio = textoRespuesta.replace(/```json\s*|\s*```/g, '').trim();
      resultado = JSON.parse(limpio);
    } catch(e) {
      // Intentar extraer JSON del medio del texto
      const match = textoRespuesta.match(/\{[\s\S]*\}/);
      if (match) {
        try { resultado = JSON.parse(match[0]); }
        catch(e2) {
          return res.status(500).json({
            error: 'No se pudo parsear la respuesta de Opus como JSON',
            textoCrudo: textoRespuesta.slice(0, 500),
          });
        }
      } else {
        return res.status(500).json({
          error: 'Respuesta de Opus no contiene JSON',
          textoCrudo: textoRespuesta.slice(0, 500),
        });
      }
    }

    // Validar y filtrar acciones: solo las del menú
    const instruccionesValidas = (resultado.instrucciones_canvas || []).filter(inst => {
      return inst && typeof inst === 'object'
        && typeof inst.accion === 'string'
        && MENU_ACCIONES_PERMITIDAS.includes(inst.accion);
    });

    // Info de tokens para diagnóstico (permite al cliente estimar costo)
    const usage = data.usage || {};

    return res.status(200).json({
      ok: true,
      aprobado: !!resultado.aprobado,
      puntuacion: Math.max(1, Math.min(10, Number(resultado.puntuacion) || 5)),
      problemas: Array.isArray(resultado.problemas) ? resultado.problemas.slice(0, 6) : [],
      instrucciones_canvas: instruccionesValidas,
      regla_aprendida: resultado.regla_aprendida && typeof resultado.regla_aprendida === 'string'
        ? resultado.regla_aprendida.trim().slice(0, 200) : null,
      tokens: {
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
        cache_creation: usage.cache_creation_input_tokens || 0,
        cache_read: usage.cache_read_input_tokens || 0,
      },
    });
  } catch(e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.split('\n').slice(0,4).join(' | ') });
  }
}
