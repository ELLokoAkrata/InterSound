"""
MixDeck Backend — FastAPI + yt-dlp
Descarga audio de YouTube/SoundCloud, sirve archivos al frontend mixer.
"""

import os
import uuid
import asyncio
import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="InterSound Backend", version="0.1.0")

# CORS para dev local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio de tracks — relativo al script, no al CWD
TRACKS_DIR = Path(__file__).parent / "tracks"
TRACKS_DIR.mkdir(exist_ok=True)

TRACKS_DB_FILE = TRACKS_DIR / "tracks_db.json"

# Metadata persistida en JSON
tracks_db: dict = {}
download_queue: dict = {}  # track_id -> status

ALLOWED_UPLOAD_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac"}


# ── Persistence helpers ─────────────────────────────────────────────

def save_db():
    """Serializa tracks_db a JSON en disco."""
    with open(TRACKS_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(tracks_db, f, ensure_ascii=False, indent=2)


def load_db():
    """Carga tracks_db desde JSON y escanea archivos huérfanos."""
    global tracks_db

    # 1. Cargar desde JSON si existe
    if TRACKS_DB_FILE.exists():
        try:
            with open(TRACKS_DB_FILE, "r", encoding="utf-8") as f:
                tracks_db = json.load(f)
        except (json.JSONDecodeError, IOError):
            tracks_db = {}

    # 2. Escanear archivos huérfanos en disco (no registrados en DB)
    known_files = {t["filename"] for t in tracks_db.values() if t.get("filename")}
    for filepath in TRACKS_DIR.iterdir():
        if filepath.name == "tracks_db.json":
            continue
        if not filepath.is_file():
            continue
        if filepath.name in known_files:
            continue
        # Archivo huérfano — registrar en DB
        ext = filepath.suffix.lstrip(".")
        track_id = str(uuid.uuid4())[:8]
        tracks_db[track_id] = {
            "id": track_id,
            "title": filepath.stem,
            "artist": None,
            "duration": None,
            "bpm": None,
            "format": ext,
            "filename": filepath.name,
            "url_source": "local",
            "status": "ready",
            "error": None,
        }

    # 3. Limpiar entradas cuyo archivo ya no existe
    to_remove = []
    for tid, track in tracks_db.items():
        if track.get("status") != "ready":
            continue
        if track.get("filename") and not (TRACKS_DIR / track["filename"]).exists():
            to_remove.append(tid)
    for tid in to_remove:
        del tracks_db[tid]

    save_db()


@app.on_event("startup")
async def startup():
    load_db()


# ── Models ───────────────────────────────────────────────────────────

class DownloadRequest(BaseModel):
    url: str
    format: str = "mp3"  # mp3 o wav
    quality: str = "192"  # kbps para mp3


class TrackMetadata(BaseModel):
    id: str
    title: str
    artist: Optional[str] = None
    duration: Optional[float] = None
    bpm: Optional[float] = None
    format: str
    filename: str
    url_source: str
    status: str  # downloading, ready, error
    error: Optional[str] = None


def get_tracks_list():
    """Retorna lista de tracks disponibles."""
    return [t for t in tracks_db.values() if t["status"] == "ready"]


async def download_track(track_id: str, url: str, fmt: str, quality: str):
    """Descarga un track usando yt-dlp en background."""
    output_path = TRACKS_DIR / f"{track_id}"

    try:
        tracks_db[track_id]["status"] = "downloading"

        # Primero extraer metadata sin descargar
        info_cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-playlist",
            url,
        ]

        proc = await asyncio.create_subprocess_exec(
            *info_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode == 0:
            # Tomar solo la primera línea JSON (por si --no-playlist no filtra todo)
            first_line = stdout.decode().strip().split("\n")[0]
            info = json.loads(first_line)
            tracks_db[track_id]["title"] = info.get("title", "Unknown")
            tracks_db[track_id]["artist"] = info.get("uploader", info.get("artist", "Unknown"))
            tracks_db[track_id]["duration"] = info.get("duration", 0)

        # Descargar audio
        if fmt == "mp3":
            dl_cmd = [
                "yt-dlp",
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", f"{quality}K",
                "-o", str(output_path) + ".%(ext)s",
                "--no-playlist",
                "--max-filesize", "100M",
                url,
            ]
        else:
            dl_cmd = [
                "yt-dlp",
                "-x",
                "--audio-format", "wav",
                "-o", str(output_path) + ".%(ext)s",
                "--no-playlist",
                "--max-filesize", "200M",
                url,
            ]

        proc = await asyncio.create_subprocess_exec(
            *dl_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode()[-200:]  # últimos 200 chars del error
            tracks_db[track_id]["status"] = "error"
            tracks_db[track_id]["error"] = error_msg
            save_db()
            return

        # Buscar el archivo generado
        expected_file = output_path.with_suffix(f".{fmt}")
        if not expected_file.exists():
            # yt-dlp a veces genera con extensión diferente
            candidates = list(TRACKS_DIR.glob(f"{track_id}.*"))
            if candidates:
                expected_file = candidates[0]
            else:
                tracks_db[track_id]["status"] = "error"
                tracks_db[track_id]["error"] = "File not found after download"
                save_db()
                return

        tracks_db[track_id]["filename"] = expected_file.name
        tracks_db[track_id]["format"] = expected_file.suffix.lstrip(".")
        tracks_db[track_id]["status"] = "ready"
        save_db()

    except Exception as e:
        tracks_db[track_id]["status"] = "error"
        tracks_db[track_id]["error"] = str(e)
        save_db()


# ── Routes ───────────────────────────────────────────────────────────

@app.post("/api/download")
async def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    """Inicia descarga de un track."""
    track_id = str(uuid.uuid4())[:8]

    tracks_db[track_id] = {
        "id": track_id,
        "title": "Downloading...",
        "artist": None,
        "duration": None,
        "bpm": None,
        "format": req.format,
        "filename": "",
        "url_source": req.url,
        "status": "downloading",
        "error": None,
    }
    save_db()

    background_tasks.add_task(download_track, track_id, req.url, req.format, req.quality)

    return {"track_id": track_id, "status": "downloading"}


@app.post("/api/upload")
async def upload_track(file: UploadFile = File(...)):
    """Sube un archivo de audio local."""
    # Validar extensión
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado: {ext}. Usa: {', '.join(ALLOWED_UPLOAD_EXTENSIONS)}",
        )

    track_id = str(uuid.uuid4())[:8]
    safe_name = f"{track_id}{ext}"
    dest = TRACKS_DIR / safe_name

    # Guardar archivo
    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)

    file_size = len(contents)
    title = Path(file.filename).stem

    # Intentar extraer duración con ffprobe
    duration = None
    try:
        probe_cmd = [
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "json",
            str(dest),
        ]
        proc = await asyncio.create_subprocess_exec(
            *probe_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode == 0:
            probe_data = json.loads(stdout.decode())
            duration = float(probe_data.get("format", {}).get("duration", 0))
    except Exception:
        pass  # ffprobe no disponible, duración queda en None

    tracks_db[track_id] = {
        "id": track_id,
        "title": title,
        "artist": None,
        "duration": duration,
        "bpm": None,
        "format": ext.lstrip("."),
        "filename": safe_name,
        "url_source": "upload",
        "status": "ready",
        "error": None,
    }
    save_db()

    return {"track_id": track_id, "status": "ready", "title": title}


@app.get("/api/tracks")
async def list_tracks():
    """Lista todos los tracks."""
    return list(tracks_db.values())


@app.get("/api/tracks/{track_id}")
async def get_track_info(track_id: str):
    """Info de un track específico."""
    if track_id not in tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")
    return tracks_db[track_id]


@app.get("/api/tracks/{track_id}/audio")
async def get_track_audio(track_id: str, request: Request):
    """Sirve el archivo de audio con soporte de Range requests para seeking."""
    if track_id not in tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")

    track = tracks_db[track_id]
    if track["status"] != "ready":
        raise HTTPException(status_code=400, detail=f"Track not ready: {track['status']}")

    filepath = TRACKS_DIR / track["filename"]
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    media_types = {
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
        "flac": "audio/flac",
    }
    media_type = media_types.get(track["format"], "application/octet-stream")
    file_size = filepath.stat().st_size

    range_header = request.headers.get("range")

    if range_header:
        # Parse "bytes=START-END"
        range_spec = range_header.replace("bytes=", "")
        parts = range_spec.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        content_length = end - start + 1

        def iter_file():
            with open(filepath, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk = f.read(min(8192, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            iter_file(),
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
            },
        )

    # Sin Range header → archivo completo
    return FileResponse(
        filepath,
        media_type=media_type,
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )


@app.delete("/api/tracks/{track_id}")
async def delete_track(track_id: str):
    """Elimina un track."""
    if track_id not in tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")

    track = tracks_db[track_id]
    filepath = TRACKS_DIR / track.get("filename", "")
    if filepath.exists():
        filepath.unlink()

    del tracks_db[track_id]
    save_db()
    return {"deleted": track_id}


@app.get("/api/health")
async def health():
    return {"status": "ok", "tracks_count": len(tracks_db)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
