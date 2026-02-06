# InterSound

**Download + Upload + Mix** — Descarga tracks de YouTube/SoundCloud, sube archivos locales y mezcla en el navegador.

## Arquitectura

```
┌──────────────────────────────────────────────┐
│  Frontend (React + Vite)                     │
│  ┌─────────┐  ┌──────────────────────────┐   │
│  │ Sidebar  │  │  Mixer                   │   │
│  │ Download │  │  ┌────────┐ ┌────────┐   │   │
│  │ Upload   │──│  │ Deck A │ │ Deck B │   │   │
│  │ Library  │  │  └────────┘ └────────┘   │   │
│  └─────────┘  │    [===Crossfader===]     │   │
│               └──────────────────────────┘   │
└──────────────────────────────────────────────┘
        │ HTTP (proxy /api → :8000)
┌──────────────────────────────────────────────┐
│  Backend (FastAPI)                            │
│  • yt-dlp (YouTube/SoundCloud)               │
│  • Upload de archivos locales                │
│  • Persistencia JSON                         │
│  • Sirve audio files                         │
└──────────────────────────────────────────────┘
```

## Setup

### Requisitos
- Python 3.10+
- Node.js 18+
- ffmpeg en PATH (`winget install ffmpeg` / `brew install ffmpeg`)
- yt-dlp (`pip install yt-dlp`)

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
# → http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

El proxy de Vite redirige `/api/*` al backend automaticamente.

## Uso

1. **Abrir** `http://localhost:5173`
2. **Descargar**: pegar URL de YouTube o SoundCloud en el sidebar
3. **Subir**: click en "UPLOAD FILE" para subir audio local (.mp3, .wav, .ogg, .flac)
4. **Drag & drop** track a Deck A o B (o usar botones A/B)
5. **Mezclar**: play, volume, speed, EQ, crossfader

Los tracks persisten entre reinicios del servidor.

## Controles

| Control | Accion |
|---------|--------|
| Play/Stop | Inicia/detiene reproduccion |
| CUE | Vuelve al inicio del track |
| VOL (slider vertical) | Volumen del deck |
| SPEED (slider vertical) | Velocidad 50%-150% |
| HI/MID/LO (knobs) | EQ 3 bandas (-12 a +12 dB) |
| Loop (1/4 - 8 beats) | Loop beatmatch en posicion actual |
| Echo/Reverb/Filter/Flanger | Efectos con mix knob |
| Filter freq knob | Frecuencia del filtro (escala log) |
| Crossfader | Balance entre Deck A y B |
| Double-click knob | Reset al valor por defecto |
| Shift + drag knob | Control fino (1/5 sensibilidad) |
| Double-click crossfader | Reset a centro |

## Stack

- **Backend**: FastAPI + yt-dlp + uvicorn + python-multipart
- **Frontend**: React 18 + Vite + Zustand
- **Audio**: Web Audio API (nativo)
- **Waveforms**: Canvas 2D (frequency visualizer)
- **Persistencia**: JSON file (`backend/tracks/tracks_db.json`)

## Roadmap

- [x] ~~Wavesurfer.js para waveforms reales del audio~~
- [x] ~~Efectos (echo, reverb, filter, flanger)~~
- [x] ~~Loops beatmatch (1/4, 1/2, 1, 2, 4, 8 beats)~~
- [ ] BPM detection (librosa en backend)
- [ ] Beat sync entre decks
- [ ] Exportar mix como audio file
- [ ] Hot cues configurables
