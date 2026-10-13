# Vídeo showcase

Genera el vídeo showcase de la app en dos formatos, los dos de unos 50 s a 60 fps y sin audio:

- `docs/showcase/lazyfood-showcase.mp4`: horizontal, 1920×1080.
- `docs/showcase/lazyfood-showcase-vertical.mp4`: vertical, 1080×1920, para reels y stories.

Recorre la app de verdad, con la interfaz en inglés y los textos del vídeo también en inglés: inicio, caducidades, escáner de tickets, Inspírame, raciones con IA, chat de antojos, menú semanal, compra, gastos y temas.

Todo sale de la app real. Se arranca con un **backend simulado**: Playwright intercepta las llamadas al Worker y contesta con los datos de prueba de `src/data/seed.en.js` y con respuestas de IA preparadas. No hace falta Worker, D1 ni clave de Gemini. La cámara del escáner es una cámara falsa de Chromium que enseña un ticket generado desde `receipt.html`.

## Requisitos

- Node 18 o posterior y `ffmpeg` en el PATH.
- Playwright con Chromium: `npm i --no-save playwright && npx playwright install chromium`. Si ya lo tienes instalado en otro sitio, indica su ruta con `PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs`.

## Pasos

```bash
# 1. La app apuntando al backend simulado (mismo origen, nada sale a la red)
VITE_API_PROXY_URL=http://localhost:5173/__mock npx vite --port 5173 --strictPort

# 2. En otra terminal: grabar los recorridos y las capturas (unos 3 min)
node scripts/showcase/record.mjs            # o sólo algunos: record.mjs scan chat

# 3. Componer los vídeos (unos 8 min cada uno)
node scripts/showcase/render.mjs                       # horizontal
node scripts/showcase/render.mjs --format vertical     # vertical
node scripts/showcase/render.mjs --preview 4 12.5 30   # fotogramas sueltos para revisar (admite --format)
```

El material intermedio se guarda en `scripts/showcase/.work/` y no se versiona.

## Piezas

| Archivo | Qué hace |
|---|---|
| `mock.mjs` | Backend simulado: rutas del Worker, datos de ejemplo y respuestas de IA. |
| `recorder.mjs` | Abre la app a 780×1600 con `zoom: 2`, que es un móvil de 390×800 a doble resolución, y graba con el screencast de Chrome cada fotograma con su tiempo y los toques. |
| `record.mjs` | El guion de cada recorrido (qué se toca y cuándo) y las capturas de las paletas. |
| `stage.html` / `stage.js` | El montaje: fondo, móvil, textos, tarjetas y transiciones, con una maqueta horizontal y otra vertical (`LAY`). Todo depende del tiempo `t`, así que cada fotograma sale igual siempre. |
| `render.mjs` | Pinta el montaje fotograma a fotograma y lo codifica con ffmpeg. |

Para cambiar textos, duración o el orden de las escenas, edita el array `SC` de `stage.js`. Cada escena indica qué clip usa (`clip`), desde qué segundo (`from`) y a qué velocidad (`rate`). Si cambian las pantallas de la app, puede que haya que retocar coordenadas o textos en `record.mjs`.
