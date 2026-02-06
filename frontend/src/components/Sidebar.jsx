import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

function DownloadForm() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp3');
  const downloadTrack = useStore(s => s.downloadTrack);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    downloadTrack(url.trim(), format);
    setUrl('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        type="text"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="YouTube or SoundCloud URL..."
        style={{
          background: '#111114',
          border: '1px solid #2a2a2e',
          color: '#e0e0e0',
          fontFamily: 'Instrument Sans',
          fontSize: '13px',
          padding: '10px 12px',
          borderRadius: '4px',
          outline: 'none',
          transition: 'border 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = '#ff336644'}
        onBlur={e => e.target.style.borderColor = '#2a2a2e'}
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <select
          value={format}
          onChange={e => setFormat(e.target.value)}
          style={{
            background: '#111114',
            border: '1px solid #2a2a2e',
            color: '#999',
            fontFamily: 'Space Mono',
            fontSize: '11px',
            padding: '6px 8px',
            borderRadius: '4px',
            flex: 1,
          }}
        >
          <option value="mp3">MP3 192k</option>
          <option value="wav">WAV</option>
        </select>
        <button
          type="submit"
          style={{
            background: '#ff3366',
            border: 'none',
            color: '#000',
            fontFamily: 'Space Mono',
            fontSize: '11px',
            fontWeight: 700,
            padding: '6px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            flex: 2,
            transition: 'opacity 0.15s',
          }}
          onMouseOver={e => e.target.style.opacity = '0.85'}
          onMouseOut={e => e.target.style.opacity = '1'}
        >
          ↓ DOWNLOAD
        </button>
      </div>
    </form>
  );
}

function TrackItem({ track, onDelete }) {
  const loadToDeck = useStore(s => s.loadToDeck);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(track));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const fmtDuration = (s) => {
    if (!s) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        background: '#0e0e11',
        border: '1px solid #1a1a1e',
        borderRadius: '4px',
        padding: '10px 12px',
        cursor: 'grab',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
      onMouseOver={e => {
        e.currentTarget.style.borderColor = '#ff336633';
        e.currentTarget.style.background = '#111114';
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = '#1a1a1e';
        e.currentTarget.style.background = '#0e0e11';
      }}
    >
      <div style={{
        fontFamily: 'Instrument Sans',
        fontSize: '13px',
        color: '#e0e0e0',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {track.title}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: '#666' }}>
          {track.artist || 'Unknown'} · {fmtDuration(track.duration)} · {track.format?.toUpperCase()}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => loadToDeck('deckA', track)}
            title="Load to Deck A"
            style={{
              background: '#ff336622',
              border: '1px solid #ff336644',
              color: '#ff3366',
              fontFamily: 'Space Mono',
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          >
            A
          </button>
          <button
            onClick={() => loadToDeck('deckB', track)}
            title="Load to Deck B"
            style={{
              background: '#00ccff22',
              border: '1px solid #00ccff44',
              color: '#00ccff',
              fontFamily: 'Space Mono',
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          >
            B
          </button>
          <button
            onClick={() => onDelete(track.id)}
            title="Delete"
            style={{
              background: 'transparent',
              border: '1px solid #333',
              color: '#666',
              fontFamily: 'Space Mono',
              fontSize: '9px',
              padding: '2px 6px',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadButton() {
  const [uploading, setUploading] = useState(false);
  const uploadTrack = useStore(s => s.uploadTrack);
  const fileInputRef = React.useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadTrack(file);
    } catch (err) {
      // error already logged in store
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.flac"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          width: '100%',
          background: uploading ? '#1a1a1e' : '#111114',
          border: '1px solid #2a2a2e',
          color: uploading ? '#666' : '#999',
          fontFamily: 'Space Mono',
          fontSize: '11px',
          fontWeight: 700,
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseOver={e => { if (!uploading) e.target.style.borderColor = '#ff336644'; }}
        onMouseOut={e => e.target.style.borderColor = '#2a2a2e'}
      >
        {uploading ? '↑ UPLOADING...' : '↑ UPLOAD FILE'}
      </button>
    </div>
  );
}

function DownloadingItem({ track }) {
  return (
    <div style={{
      background: '#0e0e11',
      border: '1px solid #ffaa0033',
      borderRadius: '4px',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <div style={{
        width: '12px',
        height: '12px',
        border: '2px solid #ffaa00',
        borderTop: '2px solid transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <span style={{ fontFamily: 'Instrument Sans', fontSize: '12px', color: '#ffaa00' }}>
        {track.title || 'Downloading...'}
      </span>
    </div>
  );
}

export default function Sidebar() {
  const tracks = useStore(s => s.tracks);
  const downloading = useStore(s => s.downloading);
  const fetchTracks = useStore(s => s.fetchTracks);
  const deleteTrack = useStore(s => s.deleteTrack);
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const toggleSidebar = useStore(s => s.toggleSidebar);

  useEffect(() => {
    fetchTracks();
    const interval = setInterval(fetchTracks, 5000);
    return () => clearInterval(interval);
  }, [fetchTracks]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        style={{
          position: 'fixed',
          top: '12px',
          left: sidebarOpen ? '295px' : '12px',
          zIndex: 1001,
          background: '#1a1a1e',
          border: '1px solid #2a2a2e',
          color: '#999',
          fontFamily: 'Space Mono',
          fontSize: '14px',
          width: '32px',
          height: '32px',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'left 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sidebarOpen ? '◁' : '▷'}
      </button>

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '290px',
        height: '100vh',
        background: '#08080a',
        borderRight: '1px solid #1a1a1e',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #1a1a1e',
        }}>
          <h1 style={{
            fontFamily: 'Space Mono',
            fontSize: '18px',
            fontWeight: 700,
            color: '#ff3366',
            margin: 0,
            letterSpacing: '4px',
          }}>
            INTERSOUND
          </h1>
          <p style={{
            fontFamily: 'Instrument Sans',
            fontSize: '11px',
            color: '#555',
            margin: '4px 0 0',
          }}>
            Download · Mix · Play
          </p>
        </div>

        {/* Download Section */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1e' }}>
          <h2 style={{
            fontFamily: 'Space Mono',
            fontSize: '10px',
            color: '#666',
            letterSpacing: '2px',
            margin: '0 0 10px',
          }}>
            ↓ DOWNLOAD
          </h2>
          <DownloadForm />
          <UploadButton />
        </div>

        {/* Downloading */}
        {downloading.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1e' }}>
            <h2 style={{
              fontFamily: 'Space Mono',
              fontSize: '10px',
              color: '#ffaa00',
              letterSpacing: '2px',
              margin: '0 0 8px',
            }}>
              ◌ IN PROGRESS ({downloading.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {downloading.map(t => <DownloadingItem key={t.id} track={t} />)}
            </div>
          </div>
        )}

        {/* Library */}
        <div style={{
          padding: '12px 16px',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          <h2 style={{
            fontFamily: 'Space Mono',
            fontSize: '10px',
            color: '#666',
            letterSpacing: '2px',
            margin: '0 0 10px',
          }}>
            ♫ LIBRARY ({tracks.length})
          </h2>
          {tracks.length === 0 ? (
            <p style={{
              fontFamily: 'Instrument Sans',
              fontSize: '12px',
              color: '#444',
              textAlign: 'center',
              padding: '20px 0',
            }}>
              No tracks yet. Download something!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tracks.map(t => (
                <TrackItem key={t.id} track={t} onDelete={deleteTrack} />
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid #1a1a1e',
          fontFamily: 'Instrument Sans',
          fontSize: '10px',
          color: '#444',
          textAlign: 'center',
        }}>
          Drag tracks to decks · Double-click knobs to reset
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
