import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';

/**
 * useAudioDeck — Hook para manejar un deck con Web Audio API
 * Maneja: load, play, pause, volume, speed, EQ, crossfader, loops, effects
 */

// Beat values in fraction form
const BEAT_VALUES = { '1/4': 0.25, '1/2': 0.5, '1': 1, '2': 2, '4': 4, '8': 8 };
const DEFAULT_BPM = 120;

// Generate reverb impulse response
function createReverbIR(ctx, duration = 2, decay = 2) {
  const length = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function useAudioDeck(deckName) {
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const eqLowRef = useRef(null);
  const eqMidRef = useRef(null);
  const eqHighRef = useRef(null);
  const audioElementRef = useRef(null);
  const analyserRef = useRef(null);

  // Effects refs
  const fxRef = useRef(null); // holds all effect nodes

  // Loop refs
  const loopRef = useRef({ active: false, start: null, end: null, beat: null });
  const loopRafRef = useRef(null);

  const deck = useStore(s => s[deckName]);
  const crossfader = useStore(s => s.crossfader);
  const updateDeck = useStore(s => s.updateDeck);
  const updateEffect = useStore(s => s.updateEffect);

  // Create dry/wet routing for an effect
  const createDryWet = (ctx, effectNode) => {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();

    dryGain.gain.value = 1;
    wetGain.gain.value = 0;

    input.connect(dryGain);
    input.connect(effectNode);
    effectNode.connect(wetGain);
    dryGain.connect(output);
    wetGain.connect(output);

    return { input, output, dryGain, wetGain, effectNode };
  };

  // Initialize audio context and nodes
  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    // EQ filters
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    eqLow.gain.value = 0;
    eqLowRef.current = eqLow;

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 0.5;
    eqMid.gain.value = 0;
    eqMidRef.current = eqMid;

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    eqHigh.gain.value = 0;
    eqHighRef.current = eqHigh;

    // Gain node
    const gain = ctx.createGain();
    gain.gain.value = deck.volume;
    gainRef.current = gain;

    // Analyser for waveform
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // === EFFECTS ===

    // Echo: DelayNode + feedback loop
    const echoDelay = ctx.createDelay(5);
    echoDelay.delayTime.value = 0.375;
    const echoFeedback = ctx.createGain();
    echoFeedback.gain.value = 0.4;
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);
    const echo = createDryWet(ctx, echoDelay);
    echo.feedback = echoFeedback;

    // Reverb: ConvolverNode with generated IR
    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbIR(ctx, 2, 2);
    const reverb = createDryWet(ctx, convolver);

    // Filter: BiquadFilter lowpass
    const filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 1000;
    filterNode.Q.value = 1;
    const filter = createDryWet(ctx, filterNode);
    filter.biquad = filterNode;

    // Flanger: DelayNode modulated by LFO
    const flangerDelay = ctx.createDelay(1);
    flangerDelay.delayTime.value = 0.005;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.003;
    lfo.connect(lfoGain);
    lfoGain.connect(flangerDelay.delayTime);
    lfo.start();
    const flanger = createDryWet(ctx, flangerDelay);
    flanger.lfo = lfo;
    flanger.lfoGain = lfoGain;

    fxRef.current = { echo, reverb, filter, flanger };

    // Chain: source -> eqLow -> eqMid -> eqHigh -> echo -> reverb -> filter -> flanger -> gain -> analyser -> destination
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(echo.input);
    echo.output.connect(reverb.input);
    reverb.output.connect(filter.input);
    filter.output.connect(flanger.input);
    flanger.output.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
  }, []);

  // === LOOP (requestAnimationFrame, ~60fps) ===
  const stopLoopRaf = useCallback(() => {
    if (loopRafRef.current) {
      cancelAnimationFrame(loopRafRef.current);
      loopRafRef.current = null;
    }
  }, []);

  const startLoopRaf = useCallback(() => {
    stopLoopRaf();
    const tick = () => {
      const audio = audioElementRef.current;
      const loop = loopRef.current;
      if (!loop.active || !audio) return;
      if (audio.currentTime >= loop.end) {
        audio.currentTime = loop.start;
      }
      loopRafRef.current = requestAnimationFrame(tick);
    };
    loopRafRef.current = requestAnimationFrame(tick);
  }, [stopLoopRaf]);

  const clearLoop = useCallback(() => {
    stopLoopRaf();
    loopRef.current = { active: false, start: null, end: null, beat: null };
    updateDeck(deckName, { loopActive: false, loopStart: null, loopEnd: null, loopBeat: null });
  }, [deckName, updateDeck, stopLoopRaf]);

  const setLoop = useCallback((beatValue) => {
    const audio = audioElementRef.current;
    if (!audio) return;

    // Always clear previous loop first
    stopLoopRaf();

    const beats = BEAT_VALUES[beatValue];
    const duration = (60 / DEFAULT_BPM) * beats;
    const start = audio.currentTime;
    const end = start + duration;

    loopRef.current = { active: true, start, end, beat: beatValue };
    startLoopRaf();

    updateDeck(deckName, { loopActive: true, loopStart: start, loopEnd: end, loopBeat: beatValue });
  }, [deckName, updateDeck, stopLoopRaf, startLoopRaf]);

  // Load track into deck
  const loadTrack = useCallback((track) => {
    initAudio();

    // Clean up previous source
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
    }

    // Clear loop on new track (inline to avoid dep on clearLoop)
    if (loopRafRef.current) {
      cancelAnimationFrame(loopRafRef.current);
      loopRafRef.current = null;
    }
    loopRef.current = { active: false, start: null, end: null, beat: null };

    const audio = new Audio(`/api/tracks/${track.id}/audio`);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audioElementRef.current = audio;

    audio.addEventListener('canplay', () => {
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const source = ctx.createMediaElementSource(audio);
      source.connect(eqLowRef.current);
      sourceRef.current = source;
    }, { once: true });

    audio.addEventListener('ended', () => {
      updateDeck(deckName, { playing: false });
    });

    updateDeck(deckName, { loopActive: false, loopStart: null, loopEnd: null, loopBeat: null });
  }, [deckName, initAudio, updateDeck]);

  // Play/Pause
  const play = useCallback(() => {
    const audio = audioElementRef.current;
    const ctx = audioCtxRef.current;
    if (!audio || !ctx) return;

    if (ctx.state === 'suspended') ctx.resume();
    audio.play();
    updateDeck(deckName, { playing: true });
  }, [deckName, updateDeck]);

  const pause = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    audio.pause();
    updateDeck(deckName, { playing: false });
  }, [deckName, updateDeck]);

  const togglePlay = useCallback(() => {
    if (deck.playing) pause();
    else play();
  }, [deck.playing, play, pause]);

  // Cue — vuelve al inicio + clear loop
  const cue = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.pause();
    clearLoop();
    updateDeck(deckName, { playing: false });
  }, [deckName, updateDeck, clearLoop]);

  // Volume
  const setVolume = useCallback((vol) => {
    if (gainRef.current) {
      gainRef.current.gain.value = vol;
    }
    updateDeck(deckName, { volume: vol });
  }, [deckName, updateDeck]);

  // Speed/Pitch
  const setSpeed = useCallback((speed) => {
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed;
    }
    updateDeck(deckName, { speed });
  }, [deckName, updateDeck]);

  // EQ
  const setEQ = useCallback((band, value) => {
    const refs = { low: eqLowRef, mid: eqMidRef, high: eqHighRef };
    if (refs[band]?.current) {
      refs[band].current.gain.value = value;
    }
    updateDeck(deckName, { [`eq${band.charAt(0).toUpperCase() + band.slice(1)}`]: value });
  }, [deckName, updateDeck]);

  // === EFFECTS CONTROLS ===
  const setEffectActive = useCallback((fxName, active) => {
    const fx = fxRef.current?.[fxName];
    if (!fx) return;
    const deckState = useStore.getState()[deckName];
    const mix = deckState.effects[fxName].mix;
    fx.wetGain.gain.value = active ? mix : 0;
    fx.dryGain.gain.value = active ? (1 - mix) : 1;
    updateEffect(deckName, fxName, { active });
  }, [deckName, updateEffect]);

  const setEffectMix = useCallback((fxName, mix) => {
    const fx = fxRef.current?.[fxName];
    if (!fx) return;
    const deckState = useStore.getState()[deckName];
    if (deckState.effects[fxName].active) {
      fx.wetGain.gain.value = mix;
      fx.dryGain.gain.value = 1 - mix;
    }
    updateEffect(deckName, fxName, { mix });
  }, [deckName, updateEffect]);

  const setFilterFrequency = useCallback((hz) => {
    const fx = fxRef.current?.filter;
    if (!fx) return;
    fx.biquad.frequency.value = hz;
    updateEffect(deckName, 'filter', { frequency: hz });
  }, [deckName, updateEffect]);

  // Apply crossfader to volume
  useEffect(() => {
    if (!gainRef.current) return;
    const cfVolume = deckName === 'deckA'
      ? Math.min(1, (1 - crossfader) * 2)
      : Math.min(1, crossfader * 2);
    gainRef.current.gain.value = deck.volume * cfVolume;
  }, [crossfader, deck.volume, deckName]);

  // Seek
  const seek = useCallback((time) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
    }
  }, []);

  // Get current time
  const getCurrentTime = useCallback(() => {
    return audioElementRef.current?.currentTime || 0;
  }, []);

  const getDuration = useCallback(() => {
    return audioElementRef.current?.duration || 0;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopLoopRaf();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [stopLoopRaf]);

  return {
    loadTrack,
    play,
    pause,
    togglePlay,
    cue,
    setVolume,
    setSpeed,
    setEQ,
    seek,
    getCurrentTime,
    getDuration,
    analyserRef,
    audioElementRef,
    // Loop
    setLoop,
    clearLoop,
    // Effects
    setEffectActive,
    setEffectMix,
    setFilterFrequency,
  };
}
