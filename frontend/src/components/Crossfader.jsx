import React from 'react';
import { useStore } from '../store/useStore';

export default function Crossfader() {
  const crossfader = useStore(s => s.crossfader);
  const setCrossfader = useStore(s => s.setCrossfader);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      padding: '12px 0',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '400px',
        padding: '0 4px',
      }}>
        <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: '#ff3366', fontWeight: 700 }}>A</span>
        <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: '#666' }}>CROSSFADER</span>
        <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: '#00ccff', fontWeight: 700 }}>B</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={crossfader}
        onChange={e => setCrossfader(parseFloat(e.target.value))}
        onDoubleClick={() => setCrossfader(0.5)}
        style={{
          width: '100%',
          maxWidth: '400px',
          accentColor: '#888',
          height: '24px',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}
