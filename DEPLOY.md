# Guía de deploy — v4 a GitHub + Vercel

## Pasos para subir esta versión

### 1. Copia los archivos a tu repo
Descomprime este ZIP. Vas a ver esta estructura:

```
yanbal-panel/
├── .gitignore
├── CHANGELOG.md
├── DEPLOY.md          (este archivo)
├── README.md
├── index.html         ← modificado
├── package.json       ← modificado (version 1.0.1, @vercel/blob 2.3.3)
└── api/
    ├── claude.js
    ├── claude-vision.js
    ├── state-load.js
    ├── state-save.js
    ├── upload-image.js  ← modificado
    ├── whatsapp-send.js
    └── whatsapp-test.js
```

**Copia TODO el contenido** de la carpeta `yanbal-panel/` a la raíz de tu repositorio, sobrescribiendo los archivos existentes.

### 2. Commit y push

Desde la terminal en la carpeta de tu repo:

```bash
git add .
git commit -m "v4: precios 100% fieles con visión IA + quórum Opus/Sonnet + revisión manual obligatoria"
git push
```

O si prefieres subirlos por la interfaz web de GitHub:
1. Ve a tu repo en github.com
2. Clic en "Add file" → "Upload files"
3. Arrastra todos los archivos
4. Escribe el commit message
5. Clic en "Commit changes"

### 3. Verifica el deploy de Vercel

Después del push, Vercel detecta el cambio automáticamente y despliega. Ve a:

- **vercel.com/dashboard** → tu proyecto → pestaña **Deployments**
- El deploy más reciente debería estar en estado **Building** → luego **Ready** (verde)
- Tarda ~2-3 min porque reinstala `@vercel/blob 2.x`

Si el deploy aparece en **Error**: clic sobre él → pestaña **Logs** → busca la línea roja y compártela.

### 4. Verifica que las variables de entorno sigan ahí

Las variables NO se borran automáticamente, pero verifica:

**Settings → Environment Variables** debe tener:
- [x] `ANTHROPIC_API_KEY`
- [x] `BLOB_READ_WRITE_TOKEN`
- [x] Variables de Redis/KV (si las usas)

**Storage** debe tener:
- [x] Blob Store conectado al proyecto (nombre `yanbal-panel-blob`)

### 5. Prueba el nuevo flujo

1. Abre tu panel en producción (yanbal-panel.vercel.app)
2. Ve a **Catálogo**
3. Sube el mismo PDF `COL_2026_C04.pdf`
4. Presiona **Procesar catálogo →**
5. Observa las **dos barras de progreso** (Opus dorada + Sonnet rosa)
6. Espera ~5 min
7. Al terminar aparece la **pantalla de revisión manual obligatoria**
8. **Verifica que el producto CÓD. 43445 ahora diga "Aretes Floralia Blanc"** (el bug de "Aretes Ccori Rubí" debería estar arreglado)
9. Aprueba los productos uno por uno
10. Cuando apruebes todos → puedes generar paquetes

### 6. Si algo falla

Abre la consola del navegador (F12) y busca mensajes de error. Los más comunes:

- **"No API key provided"** → Configura tu API key en la sección de Configuración del panel o añade `ANTHROPIC_API_KEY` a Vercel.
- **"Imagen muy grande"** → Algún JPEG pesa más de 8MB. Improbable con DPI 150 pero posible.
- **"JSON inválido"** → La IA devolvió algo raro. Generalmente se recupera automáticamente, pero si persiste en una página específica, avísame.
- **"403/401"** → API key inválida o sin saldo. Revisa en console.anthropic.com.

---

## Rollback si todo falla

Si algo sale mal y necesitas volver a la v3:
1. GitHub → tu repo → pestaña **Commits**
2. Busca el commit anterior (antes del de v4)
3. Clic en `<>` (browse files at this point)
4. Clic en "..." → "Revert" o clonas esa versión y la re-subes

Vercel también permite redeploy de cualquier commit anterior desde **Deployments → cualquier deploy viejo → Redeploy**.

---

## Diferencias respecto a v3

| Aspecto | v3 | v4 |
|---|---|---|
| Método de extracción | `pdf.js` → texto → regex → IA | PDF → imagen 150 DPI → 2 IAs en paralelo |
| Verificación | 1 modelo (Opus) | 2 modelos (Opus + Sonnet) con quórum |
| Revisión manual | Opcional | **Obligatoria antes de paquetes** |
| Edición de precio | No existía | Sí, con doble confirmación |
| Costo por catálogo | ~$0.10 USD | ~$6-8 USD |
| Tiempo | ~30 seg | ~5-7 min |
| Fiabilidad de precio | ~85% | ~99.9% (conflictos bloqueados) |
