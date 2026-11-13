/**
 * Sound effects, synthesised with the Web Audio API (no audio files): interface clicks, coins, hits, knock-outs with the
 * crowd, level-ups, fanfares… Display only — never touches the game. The volume is a viewer preference (settings
 * store); the audio context starts on the first click (browsers forbid sound before a gesture).
 */
import { useSettings } from '../i18n/index.ts';

export type Sfx =
  | 'click' | 'open' | 'coin' | 'whoosh' | 'hit' | 'crit' | 'miss' | 'heal' | 'magic' | 'ko' | 'crowd' | 'whistle'
  | 'levelUp' | 'medal' | 'fanfare' | 'victory' | 'defeat' | 'sad' | 'clash' | 'discover';

/** Sounds are switched off for now (too cheap): flip to true to bring them back with the volume setting. */
export const SOUND_ENABLED = false;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
/** Recent sounds, to keep a busy round from turning into noise. */
const recent: number[] = [];

function volume(): number {
  return useSettings.getState().volume;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      // A gentle compressor keeps stacked sounds from clipping.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      master.connect(comp).connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
      return null;
    }
  }
  return ctx;
}

/** Called on the first user gesture: browsers only let audio start then. */
export function unlockAudio() {
  if (!SOUND_ENABLED) return;
  const a = audio();
  if (a && a.state === 'suspended') void a.resume();
}

interface Tone {
  f: number;
  /** Frequency at the end (slide). */
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  at?: number;
  attack?: number;
  /** Low-pass cut-off (softens saw / square). */
  lp?: number;
}

function tone(a: AudioContext, t: Tone) {
  const t0 = a.currentTime + (t.at ?? 0);
  const osc = a.createOscillator();
  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.f, t0);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, t.to), t0 + t.dur);
  const g = a.createGain();
  const peak = (t.gain ?? 0.3) * volume();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + (t.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.dur);
  let node: AudioNode = osc;
  if (t.lp) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = t.lp;
    node = osc.connect(f);
  }
  node.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + t.dur + 0.05);
}

interface Noise {
  dur: number;
  type?: BiquadFilterType;
  f: number;
  to?: number;
  q?: number;
  gain?: number;
  at?: number;
  attack?: number;
}

function noise(a: AudioContext, n: Noise) {
  const t0 = a.currentTime + (n.at ?? 0);
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = n.type ?? 'bandpass';
  f.frequency.setValueAtTime(n.f, t0);
  if (n.to) f.frequency.exponentialRampToValueAtTime(n.to, t0 + n.dur);
  f.Q.value = n.q ?? 1;
  const g = a.createGain();
  const peak = (n.gain ?? 0.3) * volume();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + (n.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t0, Math.random());
  src.stop(t0 + n.dur + 0.05);
}

const NOTE = (semitones: number) => 261.63 * 2 ** (semitones / 12); // from middle C

const SOUNDS: Record<Sfx, (a: AudioContext) => void> = {
  click: (a) => tone(a, { f: 1400, to: 900, dur: 0.045, type: 'triangle', gain: 0.12 }),
  open: (a) => noise(a, { dur: 0.18, f: 600, to: 2400, q: 2, gain: 0.08 }),
  coin: (a) => {
    tone(a, { f: 1318, dur: 0.12, type: 'square', gain: 0.07, lp: 4000 });
    tone(a, { f: 1976, dur: 0.3, type: 'square', gain: 0.07, at: 0.07, lp: 4000 });
  },
  whoosh: (a) => noise(a, { dur: 0.22, f: 400, to: 1800, q: 1.5, gain: 0.12 }),
  hit: (a) => {
    noise(a, { dur: 0.12, type: 'lowpass', f: 1800, to: 300, gain: 0.35 });
    tone(a, { f: 150, to: 55, dur: 0.16, gain: 0.4 });
  },
  crit: (a) => {
    noise(a, { dur: 0.18, type: 'lowpass', f: 3000, to: 300, gain: 0.45 });
    tone(a, { f: 120, to: 40, dur: 0.25, gain: 0.5 });
    tone(a, { f: 2400, to: 1800, dur: 0.35, type: 'triangle', gain: 0.08, at: 0.02 });
  },
  miss: (a) => noise(a, { dur: 0.16, f: 1500, to: 500, q: 3, gain: 0.08 }),
  heal: (a) => [0, 4, 7, 12].forEach((s, i) => tone(a, { f: NOTE(s + 12), dur: 0.35, type: 'sine', gain: 0.07, at: i * 0.05 })),
  magic: (a) => {
    tone(a, { f: 600, to: 1600, dur: 0.25, type: 'sine', gain: 0.08 });
    noise(a, { dur: 0.25, f: 3000, q: 4, gain: 0.05 });
  },
  ko: (a) => {
    tone(a, { f: 90, to: 30, dur: 0.6, gain: 0.6 });
    noise(a, { dur: 0.35, type: 'lowpass', f: 900, to: 120, gain: 0.5 });
    SOUNDS.crowd(a);
  },
  crowd: (a) => {
    // A roar: several band-passed noises swelling then fading.
    for (const [f, g] of [[500, 0.12], [900, 0.1], [1500, 0.06]] as const) noise(a, { dur: 1.8, f, q: 0.8, gain: g, attack: 0.25, at: 0.05 });
  },
  whistle: (a) => {
    tone(a, { f: 2300, dur: 0.18, type: 'sine', gain: 0.09 });
    tone(a, { f: 2300, dur: 0.4, type: 'sine', gain: 0.09, at: 0.22 });
  },
  levelUp: (a) => [0, 4, 7, 12, 16].forEach((s, i) => tone(a, { f: NOTE(s + 12), dur: 0.22, type: 'triangle', gain: 0.1, at: i * 0.07 })),
  medal: (a) => {
    tone(a, { f: NOTE(19), dur: 0.5, type: 'triangle', gain: 0.1 });
    tone(a, { f: NOTE(24), dur: 0.8, type: 'triangle', gain: 0.1, at: 0.12 });
    tone(a, { f: NOTE(31), dur: 0.9, type: 'sine', gain: 0.05, at: 0.12 });
  },
  discover: (a) => [7, 12, 19].forEach((s, i) => tone(a, { f: NOTE(s + 12), dur: 0.4, type: 'sine', gain: 0.08, at: i * 0.09 })),
  fanfare: (a) => {
    const seq: [number[], number, number][] = [[[0, 7], 0, 0.16], [[0, 7], 0.18, 0.16], [[4, 12], 0.36, 0.16], [[7, 16], 0.54, 0.7]];
    for (const [notes, at, dur] of seq) for (const s of notes) tone(a, { f: NOTE(s), dur, type: 'sawtooth', gain: 0.07, at, lp: 2200, attack: 0.02 });
    SOUNDS.crowd(a);
  },
  victory: (a) => {
    for (const [s, at] of [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36]] as const) tone(a, { f: NOTE(s), dur: 0.5, type: 'sawtooth', gain: 0.06, at, lp: 2500 });
    for (const s of [0, 4, 7, 12]) tone(a, { f: NOTE(s), dur: 1.1, type: 'triangle', gain: 0.05, at: 0.48 });
    SOUNDS.crowd(a);
  },
  defeat: (a) => [7, 3, 0, -5].forEach((s, i) => tone(a, { f: NOTE(s), dur: 0.5, type: 'triangle', gain: 0.08, at: i * 0.2, lp: 1500 })),
  sad: (a) => [0, 3, 7].forEach((s) => tone(a, { f: NOTE(s - 12), dur: 1.6, type: 'sine', gain: 0.07, attack: 0.3 })),
  clash: (a) => {
    noise(a, { dur: 0.5, type: 'highpass', f: 2500, gain: 0.25 });
    tone(a, { f: 1900, to: 1500, dur: 0.9, type: 'triangle', gain: 0.1 });
    tone(a, { f: 2850, to: 2300, dur: 0.7, type: 'sine', gain: 0.06 });
    tone(a, { f: 110, to: 45, dur: 0.5, gain: 0.45 });
  },
};

/** Plays a sound (nothing when muted, before the first click or when too many are already playing). */
export function play(name: Sfx) {
  if (!SOUND_ENABLED || volume() <= 0) return;
  const a = audio();
  if (!a || !master || a.state !== 'running') return;
  const now = performance.now();
  while (recent.length && now - recent[0]! > 120) recent.shift();
  if (recent.length >= 4 && name !== 'ko' && name !== 'victory' && name !== 'defeat') return;
  recent.push(now);
  try {
    SOUNDS[name](a);
  } catch {
    /* audio is a nicety: never break the game for it */
  }
}
