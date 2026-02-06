import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useAudioDeck } from '../hooks/useAudioDeck';

// Logarithmic helpers for filter frequency knob (20Hz - 20000Hz)
const FREQ_MIN = 20;
const FREQ_MAX = 20000;
const freqToKnob = (freq) => Math.log(freq / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN);
const knobToFreq = (knob) => FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, knob);

function WaveformVisualizer({ analyserRef, playing, color }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      if (!analyser) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barW = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barH = (dataArray[i] / 255) * canvas.height * 0.9;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barH);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, `${color}44`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barH, barW - 1, barH);
        x += barW;
      }
    };

    if (playing) draw();
    else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      ctx.fillStyle = 'rgba(10, 10, 12, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw idle bars
      const bufferLength = 64;
      const barW = (canvas.width / bufferLength) * 2.5;
      let xp = 0;
      for (let i = 0; i < bufferLength; i++) {
        const h = Math.random() * 8 + 2;
        ctx.fillStyle = `${color}33`;
        ctx.fillRect(xp, canvas.height - h, barW - 1, h);
        xp += barW;
      }
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyserRef, playing, color]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={80}
      style={{
        width: '100%',
        height: '80px',
        borderRadius: '4px',
        border: `1px solid ${color}22`,
      }}
    />
  );
}

function Knob({ value, onChange, min = -12, max = 12, label, color, resetValue }) {
  const knobRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  // ~150px de recorrido para cubrir todo el rango; Shift = control fino (÷5)
  const range = max - min;
  const sensitivity = range / 150;

  const handleMouseDown = (e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const pixelDelta = startY.current - e.clientY;
    const fine = e.shiftKey ? 0.2 : 1;
    const delta = pixelDelta * sensitivity * fine;
    const newVal = Math.max(min, Math.min(max, startVal.current + delta));
    onChange(newVal);
  }, [min, max, sensitivity, onChange]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const rotation = ((value - min) / (max - min)) * 270 - 135;
  const defaultVal = resetValue !== undefined ? resetValue : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(defaultVal)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: `conic-gradient(from ${rotation}deg, ${color}66, ${color}22)`,
          border: `2px solid ${color}88`,
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        <div style={{
          width: '2px',
          height: '12px',
          background: color,
          position: 'absolute',
          top: '4px',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'bottom center',
          borderRadius: '1px',
        }} />
      </div>
      <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Space Mono', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function TimeDisplay({ audioElementRef, playing }) {
  const [time, setTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');

  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    const fmt = (s) => {
      if (!s || isNaN(s)) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const update = () => {
      setTime(fmt(audio.currentTime));
      setDuration(fmt(audio.duration));
    };

    audio.addEventListener('timeupdate', update);
    audio.addEventListener('loadedmetadata', update);
    return () => {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('loadedmetadata', update);
    };
  }, [audioElementRef, playing]);

  return (
    <div style={{
      fontFamily: 'Space Mono',
      fontSize: '20px',
      color: '#e0e0e0',
      letterSpacing: '2px',
      textAlign: 'center',
      padding: '4px 0',
    }}>
      {time} <span style={{ color: '#555', fontSize: '14px' }}>/</span> {duration}
    </div>
  );
}

const LOOP_BEATS = ['1/4', '1/2', '1', '2', '4', '8'];
const FX_LIST = ['echo', 'reverb', 'filter', 'flanger'];

const DEFAULT_EFFECTS = {
  echo:    { active: false, mix: 0.3 },
  reverb:  { active: false, mix: 0.3 },
  filter:  { active: false, mix: 1.0, frequency: 1000 },
  flanger: { active: false, mix: 0.3 },
};

export default function Deck({ deckName, color = '#ff3366' }) {
  const rawDeck = useStore(s => s[deckName]);
  const deck = { ...rawDeck, effects: rawDeck.effects || DEFAULT_EFFECTS };
  const loadToDeck = useStore(s => s.loadToDeck);
  const {
    loadTrack, togglePlay, cue, setVolume, setSpeed, setEQ,
    analyserRef, audioElementRef,
    setLoop, clearLoop,
    setEffectActive, setEffectMix, setFilterFrequency,
  } = useAudioDeck(deckName);

  // Load track when deck.track changes
  const prevTrackIdRef = useRef(null);
  useEffect(() => {
    if (deck.track && deck.track.id !== prevTrackIdRef.current) {
      prevTrackIdRef.current = deck.track.id;
      loadTrack(deck.track);
    }
  }, [deck.track, loadTrack]);

  const label = deckName === 'deckA' ? 'A' : 'B';

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const trackData = JSON.parse(e.dataTransfer.getData('application/json'));
      loadToDeck(deckName, trackData);
    } catch (err) {
      console.error('Drop failed:', err);
    }
  };

  const btnBase = {
    background: '#1a1a1e',
    fontFamily: 'Space Mono',
    fontSize: '10px',
    padding: '5px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        background: '#0a0a0c',
        border: `1px solid ${color}22`,
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flex: 1,
        minWidth: '320px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          fontFamily: 'Space Mono',
          fontWeight: 700,
          fontSize: '14px',
          color: color,
          background: `${color}11`,
          padding: '2px 10px',
          borderRadius: '4px',
          border: `1px solid ${color}33`,
        }}>
          DECK {label}
        </div>
        <div style={{
          fontFamily: 'Instrument Sans',
          fontSize: '12px',
          color: '#999',
          maxWidth: '200px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {deck.track ? deck.track.title : 'Drop a track here'}
        </div>
      </div>

      {/* Time */}
      <TimeDisplay audioElementRef={audioElementRef} playing={deck.playing} />

      {/* Waveform */}
      <WaveformVisualizer analyserRef={analyserRef} playing={deck.playing} color={color} />

      {/* Transport Controls */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          onClick={cue}
          style={{
            background: '#1a1a1e',
            border: `1px solid ${color}44`,
            color: color,
            fontFamily: 'Space Mono',
            fontSize: '11px',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => e.target.style.background = `${color}22`}
          onMouseOut={e => e.target.style.background = '#1a1a1e'}
        >
          CUE
        </button>
        <button
          onClick={togglePlay}
          disabled={!deck.track}
          style={{
            background: deck.playing ? color : '#1a1a1e',
            border: `1px solid ${color}`,
            color: deck.playing ? '#000' : color,
            fontFamily: 'Space Mono',
            fontSize: '11px',
            fontWeight: 700,
            padding: '8px 24px',
            borderRadius: '4px',
            cursor: deck.track ? 'pointer' : 'not-allowed',
            opacity: deck.track ? 1 : 0.4,
            transition: 'all 0.15s',
          }}
        >
          {deck.playing ? '■ STOP' : '▶ PLAY'}
        </button>
      </div>

      {/* Loop Buttons */}
      <div style={{
        display: 'flex',
        gap: '4px',
        justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '9px',
          color: '#666',
          fontFamily: 'Space Mono',
          alignSelf: 'center',
          marginRight: '4px',
        }}>LOOP</span>
        {LOOP_BEATS.map(beat => {
          const isActive = deck.loopActive && deck.loopBeat === beat;
          return (
            <button
              key={beat}
              onClick={() => {
                if (deck.loopActive && deck.loopBeat === beat) {
                  clearLoop();
                } else {
                  setLoop(beat);
                }
              }}
              style={{
                ...btnBase,
                border: `1px solid ${isActive ? color : color + '33'}`,
                color: isActive ? '#000' : color,
                background: isActive ? color : '#1a1a1e',
                fontWeight: isActive ? 700 : 400,
                minWidth: '32px',
              }}
              onMouseOver={e => { if (!isActive) e.target.style.background = `${color}22`; }}
              onMouseOut={e => { if (!isActive) e.target.style.background = '#1a1a1e'; }}
            >
              {beat}
            </button>
          );
        })}
      </div>

      {/* Controls Row: Volume + Speed + EQ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '16px',
        paddingTop: '8px',
        borderTop: '1px solid #1a1a1e',
      }}>
        {/* Volume */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={deck.volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              height: '80px',
              accentColor: color,
            }}
          />
          <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Space Mono' }}>VOL</span>
        </div>

        {/* Speed */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.01"
            value={deck.speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            onDoubleClick={() => setSpeed(1.0)}
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              height: '80px',
              accentColor: color,
            }}
          />
          <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Space Mono' }}>SPEED</span>
          <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Space Mono' }}>
            {(deck.speed * 100).toFixed(0)}%
          </span>
        </div>

        {/* EQ */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Knob value={deck.eqHigh} onChange={v => setEQ('high', v)} label="HI" color={color} />
          <Knob value={deck.eqMid} onChange={v => setEQ('mid', v)} label="MID" color={color} />
          <Knob value={deck.eqLow} onChange={v => setEQ('low', v)} label="LO" color={color} />
        </div>
      </div>

      {/* FX Section */}
      <div style={{
        paddingTop: '8px',
        borderTop: '1px solid #1a1a1e',
      }}>
        <span style={{
          fontSize: '9px',
          color: '#666',
          fontFamily: 'Space Mono',
          display: 'block',
          marginBottom: '8px',
        }}>FX</span>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
        }}>
          {FX_LIST.map(fxName => {
            const fx = deck.effects[fxName];
            const isActive = fx.active;
            return (
              <div key={fxName} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}>
                {/* Toggle button */}
                <button
                  onClick={() => setEffectActive(fxName, !isActive)}
                  style={{
                    ...btnBase,
                    border: `1px solid ${isActive ? color : color + '33'}`,
                    color: isActive ? '#000' : color,
                    background: isActive ? color : '#1a1a1e',
                    fontWeight: isActive ? 700 : 400,
                    width: '100%',
                    textTransform: 'uppercase',
                    fontSize: '9px',
                    padding: '4px 2px',
                  }}
                  onMouseOver={e => { if (!isActive) e.target.style.background = `${color}22`; }}
                  onMouseOut={e => { if (!isActive) e.target.style.background = '#1a1a1e'; }}
                >
                  {fxName}
                </button>
                {/* Mix knob */}
                <Knob
                  value={fx.mix}
                  onChange={v => setEffectMix(fxName, v)}
                  min={0}
                  max={1}
                  label={`${Math.round(fx.mix * 100)}%`}
                  color={color}
                  resetValue={0.3}
                />
                {/* Filter frequency knob */}
                {fxName === 'filter' && (
                  <Knob
                    value={freqToKnob(fx.frequency)}
                    onChange={v => setFilterFrequency(knobToFreq(v))}
                    min={0}
                    max={1}
                    label={fx.frequency >= 1000 ? `${(fx.frequency / 1000).toFixed(1)}k` : `${Math.round(fx.frequency)}`}
                    color={color}
                    resetValue={freqToKnob(1000)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
