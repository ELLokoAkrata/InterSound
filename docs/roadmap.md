# InterSound — Roadmap

Items del README del repo con estado actual + ideas nuevas.

## Pendiente

### BPM detection
- Detectar BPM de cada track (librosa en backend)
- Mostrar BPM en la biblioteca y en cada deck

### Beat sync
- Sincronizar BPM entre deck A y B
- Ajustar playbackRate automáticamente para match de beats

### Mix export
- Grabar la salida del mixer como archivo de audio
- Descargar el mix resultante (.mp3/.wav)

### Hot cues
- Permitir al DJ marcar múltiples puntos de cue por deck
- Saltar a cualquier punto marcado con un click
- Indicador visual en el waveform

### CUE point configurable
- Actualmente CUE regresa al segundo 0 y pausa
- Mejora: CUE regresa a un punto marcado por el DJ (como Virtual DJ)
- Indicador visual en el waveform del punto de cue

---

## Completado

### Waveform con Wavesurfer.js
- Ya implementado en v0.1

### Loops beatmatch
- 1/4, 1/2, 1, 2, 4, 8 beats
- Toggle on/off, requestAnimationFrame para precisión

### Efectos de audio
- Echo, reverb, filter (lowpass), flanger
- Dry/wet mix por efecto, frecuencia controlable en filter

### v0.1 — Release inicial
- Descarga de audio desde YouTube/SoundCloud (yt-dlp)
- Upload de archivos locales (.mp3, .wav, .ogg, .flac)
- Mixer con 2 decks (A/B) + crossfader
- EQ de 3 bandas (low, mid, high) por deck
- Control de volumen y velocidad por deck
- HTTP Range requests para seeking correcto
- Biblioteca de tracks persistente (JSON)
