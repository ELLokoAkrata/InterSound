# Loops, Efectos y Range Requests — Notas de Implementacion

## Resumen

Se agregaron tres features al mixer: label SPEED, loops beatmatch y efectos de audio (echo, reverb, filter, flanger). Durante la implementacion se descubrio que el backend no soportaba HTTP Range requests, lo cual rompia cualquier operacion de seeking en el audio.

## Archivos modificados

| Archivo | Cambios |
|---|---|
| `backend/main.py` | Endpoint `/api/tracks/{id}/audio` con soporte Range (HTTP 206) |
| `frontend/src/store/useStore.js` | Estado de loops y efectos por deck, accion `updateEffect` |
| `frontend/src/hooks/useAudioDeck.js` | Cadena de efectos Web Audio, logica de loop con rAF |
| `frontend/src/components/Deck.jsx` | UI de loops, FX, label SPEED, mejora de knobs |
| `CLAUDE.md` | Instruccion de idioma espanol, notas esenciales |

---

## 1. HTTP Range Requests (backend)

### Problema
`FileResponse` de FastAPI no incluia headers `Accept-Ranges` ni manejaba el header `Range` del request. Cuando el frontend hacia `audio.currentTime = X`, el navegador pedia bytes desde esa posicion, pero el servidor mandaba todo el archivo desde cero. Esto causaba que el audio se reiniciara al inicio cada vez que se intentaba hacer seek o loop.

### Solucion
El endpoint ahora parsea el header `Range: bytes=START-END`, lee solo el fragmento solicitado del archivo, y responde con:
- Status `206 Partial Content`
- Header `Content-Range: bytes START-END/TOTAL`
- Header `Accept-Ranges: bytes`

Sin header Range, sigue sirviendo el archivo completo (con `Accept-Ranges: bytes` para que el navegador sepa que puede pedir rangos).

---

## 2. Loops

### Estado (useStore.js)
Cada deck tiene: `loopActive`, `loopStart`, `loopEnd`, `loopBeat`.

### Logica (useAudioDeck.js)
- `setLoop(beatValue)`: calcula duracion como `(60/BPM) * beats` con BPM=120 por defecto, captura `audio.currentTime` como inicio.
- Usa `requestAnimationFrame` (~60fps) para verificar si `currentTime >= loopEnd` y hacer seek a `loopStart`. Se eligio rAF sobre `timeupdate` del HTML Audio porque este ultimo solo dispara ~4 veces por segundo, insuficiente para loops cortos.
- `clearLoop()`: cancela el rAF y resetea el estado.

### Toggle (Deck.jsx)
La logica de toggle (click en boton activo = desactivar) se maneja en el componente, NO en el hook. Esto evita problemas de closures stale con `useCallback`. El componente lee `deck.loopActive` y `deck.loopBeat` directamente del store de Zustand (siempre fresco en cada render).

### Lecciones aprendidas
- No poner `clearLoop` como dependencia de `loadTrack` en `useCallback` — crea una cadena de dependencias inestable que hace que el `useEffect` de carga de track se re-dispare, creando un nuevo `Audio()` que arranca en `currentTime = 0`.
- `loadTrack` limpia el loop inline (accediendo las refs directamente) en vez de llamar a `clearLoop`.

---

## 3. Efectos de Audio

### Cadena
```
Source -> EQ Low -> EQ Mid -> EQ High -> Echo -> Reverb -> Filter -> Flanger -> Gain -> Analyser -> Dest
```

### Routing dry/wet
Cada efecto tiene nodos `dryGain` y `wetGain`. La senal de entrada se divide en dos caminos:
- Dry: input -> dryGain -> output (bypass)
- Wet: input -> effectNode -> wetGain -> output (procesado)

Desactivado: `dry=1, wet=0`. Activado: `dry=1-mix, wet=mix`. Los nodos siempre estan conectados; solo se ajustan los gains. Esto evita clicks por reconexion.

### Nodos por efecto
- **Echo**: `DelayNode(0.375s)` + `GainNode(feedback=0.4)` en loop
- **Reverb**: `ConvolverNode` con impulse response generado (ruido blanco * decay exponencial, 2s)
- **Filter**: `BiquadFilter` lowpass, frecuencia 20-20000Hz con escala logaritmica
- **Flanger**: `DelayNode(0.005s)` modulado por `OscillatorNode` LFO (sine, 0.5Hz)

### UI
- Grid de 4 columnas, cada una con boton toggle + knob de mix
- Filter tiene knob extra de frecuencia con conversion logaritmica (`freqToKnob`/`knobToFreq`)

---

## 4. Mejoras de Knobs

- **Sensibilidad proporcional**: `sensitivity = (max - min) / 150`, todos los knobs necesitan ~150px para recorrer todo el rango
- **Control fino**: mantener `Shift` reduce sensibilidad a 1/5
- **Cursor**: cambia a `grabbing` mientras se arrastra
- **Reset personalizable**: prop `resetValue` para doble-click (antes siempre reseteaba a 0)
