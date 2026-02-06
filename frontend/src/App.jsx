import React from 'react';
import Sidebar from './components/Sidebar';
import Deck from './components/Deck';
import Crossfader from './components/Crossfader';
import { useStore } from './store/useStore';

export default function App() {
  const sidebarOpen = useStore(s => s.sidebarOpen);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#06060a',
      color: '#e0e0e0',
      overflow: 'hidden',
      display: 'flex',
    }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Mixer Area */}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? '290px' : '0',
        transition: 'margin-left 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px',
        gap: '8px',
        minHeight: '100vh',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '8px 0',
        }}>
          <div style={{
            fontFamily: 'Space Mono',
            fontSize: '10px',
            color: '#333',
            letterSpacing: '6px',
            textTransform: 'uppercase',
          }}>
            ◆ MIXER ◆
          </div>
        </div>

        {/* Decks */}
        <div style={{
          display: 'flex',
          gap: '16px',
          flex: 1,
          maxHeight: 'calc(100vh - 120px)',
        }}>
          <Deck deckName="deckA" color="#ff3366" />
          <Deck deckName="deckB" color="#00ccff" />
        </div>

        {/* Crossfader */}
        <Crossfader />
      </div>
    </div>
  );
}
