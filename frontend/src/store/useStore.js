import { create } from 'zustand';

const API_BASE = '/api';

export const useStore = create((set, get) => ({
  // ===== LIBRARY =====
  tracks: [],
  downloading: [],

  fetchTracks: async () => {
    try {
      const res = await fetch(`${API_BASE}/tracks`);
      const data = await res.json();
      set({
        tracks: data.filter(t => t.status === 'ready'),
        downloading: data.filter(t => t.status === 'downloading'),
      });
    } catch (e) {
      console.error('Failed to fetch tracks:', e);
    }
  },

  downloadTrack: async (url, format = 'mp3', quality = '192') => {
    try {
      const res = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality }),
      });
      const data = await res.json();
      // Poll for completion
      get().pollTrack(data.track_id);
      set(s => ({ downloading: [...s.downloading, { id: data.track_id, status: 'downloading', title: 'Downloading...' }] }));
      return data.track_id;
    } catch (e) {
      console.error('Download failed:', e);
    }
  },

  pollTrack: (trackId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/tracks/${trackId}`);
        const track = await res.json();
        if (track.status === 'ready' || track.status === 'error') {
          clearInterval(interval);
          get().fetchTracks();
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 2000);
  },

  deleteTrack: async (trackId) => {
    await fetch(`${API_BASE}/tracks/${trackId}`, { method: 'DELETE' });
    get().fetchTracks();
  },

  uploadTrack: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await res.json();
      await get().fetchTracks();
      return data;
    } catch (e) {
      console.error('Upload failed:', e);
      throw e;
    }
  },

  // ===== DECKS =====
  deckA: {
    trackId: null,
    track: null,
    playing: false,
    volume: 0.8,
    speed: 1.0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    loopActive: false,
    loopStart: null,
    loopEnd: null,
    loopBeat: null,
    effects: {
      echo:    { active: false, mix: 0.3 },
      reverb:  { active: false, mix: 0.3 },
      filter:  { active: false, mix: 1.0, frequency: 1000 },
      flanger: { active: false, mix: 0.3 },
    },
  },
  deckB: {
    trackId: null,
    track: null,
    playing: false,
    volume: 0.8,
    speed: 1.0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    loopActive: false,
    loopStart: null,
    loopEnd: null,
    loopBeat: null,
    effects: {
      echo:    { active: false, mix: 0.3 },
      reverb:  { active: false, mix: 0.3 },
      filter:  { active: false, mix: 1.0, frequency: 1000 },
      flanger: { active: false, mix: 0.3 },
    },
  },
  crossfader: 0.5, // 0 = full A, 1 = full B

  loadToDeck: (deckName, track) => {
    set({ [deckName]: { ...get()[deckName], trackId: track.id, track, playing: false } });
  },

  updateDeck: (deckName, updates) => {
    set({ [deckName]: { ...get()[deckName], ...updates } });
  },

  setCrossfader: (value) => set({ crossfader: value }),

  updateEffect: (deckName, effectName, updates) => {
    const deck = get()[deckName];
    set({
      [deckName]: {
        ...deck,
        effects: {
          ...deck.effects,
          [effectName]: { ...deck.effects[effectName], ...updates },
        },
      },
    });
  },

  // ===== UI =====
  sidebarOpen: true,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
}));
