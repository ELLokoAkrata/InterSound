# InterSound - DJ Mixer Web Application

## Idioma
- Siempre responder en **español**, acento neutro.
- Código y nombres técnicos en inglés (variables, funciones, comentarios inline).
- Mensajes al usuario, explicaciones y planes siempre en español.

## Architecture
- **Backend**: FastAPI (Python 3.10+) on port 8000 — single file `backend/main.py`
- **Frontend**: React 18 + Vite on port 5173 (proxies `/api/*` to backend)
- **State**: Zustand (frontend), JSON-persisted dict (backend)
- **Audio**: Web Audio API with EQ + FX chain per deck, loops via rAF
- **Storage**: `backend/tracks/` (audio files + `tracks_db.json`)

## Directory Structure
```
intersound/
├── backend/
│   ├── main.py              # FastAPI server, all routes, download/upload logic
│   ├── requirements.txt     # Python deps (fastapi, yt-dlp, python-multipart)
│   └── tracks/              # Audio files + tracks_db.json (gitignored)
└── frontend/
    ├── vite.config.js        # Dev server config, API proxy
    └── src/
        ├── App.jsx           # Root layout (sidebar + mixer)
        ├── components/
        │   ├── Sidebar.jsx   # Download form, upload button, track library
        │   ├── Deck.jsx      # Deck A/B controls, waveform, EQ
        │   └── Crossfader.jsx
        ├── hooks/
        │   └── useAudioDeck.js # Web Audio API hook (EQ, gain, analyser)
        └── store/
            └── useStore.js   # Zustand global state
```

## API Endpoints
- `POST /api/download` — Start yt-dlp download `{url, format, quality}`
- `POST /api/upload` — Upload local audio file (multipart, .mp3/.wav/.ogg/.flac)
- `GET /api/tracks` — List all tracks
- `GET /api/tracks/{id}` — Track metadata
- `GET /api/tracks/{id}/audio` — Stream audio file (supports HTTP Range requests)
- `DELETE /api/tracks/{id}` — Delete track + file
- `GET /api/health` — Health check

## Running
```bash
# Backend
cd backend && pip install -r requirements.txt && python main.py  # :8000

# Frontend
cd frontend && npm install && npm run dev  # :5173
```

## Key Behaviors
- `TRACKS_DIR` resolves relative to `main.py` via `Path(__file__).parent / "tracks"`
- Track metadata persists in `tracks_db.json` — survives server restarts
- On startup: loads JSON, picks up orphan files on disk, cleans stale entries
- Downloads run as BackgroundTasks; frontend polls every 2s
- `--no-playlist` enforced on both metadata and download commands
- Upload uses ffprobe for duration extraction (optional, graceful fallback)
- Audio endpoint soporta Range requests (HTTP 206) — requerido para seek y loops
- Audio chain: Source → EQ(Lo/Mid/Hi) → Echo → Reverb → Filter → Flanger → Gain → Analyser → Dest
- Loops via `requestAnimationFrame` (~60fps), toggle manejado en componente (no en hook)
- Efectos usan routing dry/wet (nodos siempre conectados, solo cambian gains)
- Knobs: sensibilidad proporcional al rango, Shift = control fino (÷5)

## Coding Conventions
- Frontend: JSX with inline styles, functional components + hooks
- State: Zustand for shared state, local state for UI-only
- Backend: Single-file FastAPI, async endpoints
- Fonts: Space Mono (mono), Instrument Sans (sans)
- Theme: Dark (#0a0a0a), accent colors per component
- Formats: MP3 (192kbps, max 100MB), WAV (max 200MB), OGG, FLAC (upload only)
