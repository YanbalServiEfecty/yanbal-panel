# Guía de deploy — v5 a GitHub + Vercel

## Qué hay nuevo en esta versión
v5 resuelve los 2 últimos problemas que quedaban:
- **#3 Flyer se sobrepone** → ahora altura dinámica, todos los productos caben
- **#5 Seguimiento + carga masiva** → nueva pestaña 📊 Seguimiento con tu Excel oficial Yanbal

Con v5 quedan resueltos los 5 problemas iniciales.

---

## Pasos para subir esta versión

### 1. Copia los archivos a tu repo
Descomprime el ZIP. Vas a ver esta estructura:

```
yanbal-panel/
├── .gitignore
├── CHANGELOG.md
├── DEPLOY.md
├── README.md
├── index.html         ← modificado (flyer dinámico + pestaña Seguimiento)
├── package.json       ← sin cambios (sigue en 2.3.3 de v4)
└── api/
    ├── claude.js
    ├── claude-vision.js
    ├── state-load.js
    ├── state-save.js
    ├── upload-image.js
    ├── whatsapp-send.js
    └── whatsapp-test.js
```

**Copia TODO el contenido** de la carpeta `yanbal-panel/` a la raíz de tu repositorio, sobrescribiendo los archivos existentes.

### 2. Commit y push

```bash
git add .
git commit -m "v5: flyer dinámico + pestaña Seguimiento + carga masiva Excel"
git push
```

O por la interfaz web de GitHub arrastrando los archivos y describiendo el commit.

### 3. Verifica el deploy de Vercel

Después del push, Vercel detecta el cambio y despliega. Tarda ~1-2 min (menos que v4 porque ya no reinstala dependencias, sólo HTML).

---

## Cómo probar lo nuevo

### Flyer dinámico (Problema #3)
1. Ve a **Paquetes** → abre un paquete con 10+ productos
2. Genera el flyer → verás que ahora se estira hacia abajo y TODOS los productos caben sin superposición
3. Prueba con un paquete chico (3-5 productos) → el flyer vuelve al tamaño normal

### Pestaña Seguimiento (Problema #5)
1. En el menú lateral, clic en **📊 Seguimiento** (bajo la sección "Clientas")
2. Clic en **📤 Importar mi primer Excel de seguimiento** y sube tu archivo `SEGUIMIENTO_2026_04.xlsx`
3. Verás aparecer las 29 columnas del Excel + 3 columnas automáticas del panel (📦 Paquetes, 💰 Cartera, 📱 Último contacto)
4. Prueba editar una celda haciendo clic sobre ella (las celdas llave Código y Nombre no son editables por seguridad)
5. Clic en **🔗 Sincronizar con Base de clientas** → esto creará en tu base de clientas las que no existan aún
6. Clic en **📥 Exportar a Excel** → descargas de vuelta el archivo con las columnas enriquecidas

### Carga masiva en Base de clientas (Problema #5 parte 2)
1. Ve a **Base de clientas**
2. En la barra superior verás **📥 Importar masivo Excel** (botón nuevo)
3. Sube un Excel con columnas Nombre / Teléfono / Dirección / Notas (las mínimas)
4. Las duplicadas se saltan automáticamente (detecta por código Yanbal o por nombre+teléfono)

---

## Importante: re-importación del Excel de Seguimiento

Cada ciclo/semana puedes re-subir el Excel actualizado desde el portal Yanbal. La lógica es:
- Si el **código** de la clienta ya existe en el seguimiento → **actualiza** sus datos
- Si es un código nuevo → **añade** la clienta al seguimiento
- Las ediciones manuales que hayas hecho por celda **se sobreescriben** con los datos frescos del Excel

Si prefieres conservar tus ediciones manuales, no re-importes ese registro o edita celda por celda después.

---

## Rollback si algo falla
Si después del deploy algo va mal:
1. GitHub → tu repo → pestaña **Commits**
2. Busca el commit anterior (el de v4)
3. Clic en `<>` para browse files at this point
4. O desde Vercel: **Deployments → commit viejo → Redeploy**

---

## Archivos modificados respecto a v4

| Archivo | Cambio |
|---|---|
| `index.html` | Añadido CDN XLSX, nav Seguimiento, 11 funciones nuevas, CSS nuevo, `dibujarFlyer` reescrita |
| `package.json` | Sin cambios |
| `api/*` | Sin cambios |
