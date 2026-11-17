let ctx: AudioContext | null = null;

export function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A soft plucked-string voice. `soundingMidi` is the real pitch (guitar sounds an octave below written). */
export function pluck(soundingMidi: number, delay = 0, dur = 1.8) {
  const c = ac();
  const t = c.currentTime + delay;
  const f = 440 * Math.pow(2, (soundingMidi - 69) / 12);
  const out = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(f * 9, 9000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 300), t + dur * 0.8);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.35, t + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  [['triangle', 0], ['sawtooth', 4]].forEach(([type, detune]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type as OscillatorType;
    o.frequency.value = f;
    o.detune.value = detune as number;
    g.gain.value = type === 'sawtooth' ? 0.25 : 0.8;
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
  lp.connect(out).connect(c.destination);
}

/**
 * A simple piano voice: a few decaying sine partials (higher partials die faster, and slightly
 * stretched like a real string), a soft hammer thump, and a gentle low-pass. `midi` is the real pitch.
 */
export function piano(midi: number, delay = 0, dur = 2.4) {
  const c = ac();
  const t = c.currentTime + delay;
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const len = dur * (midi < 60 ? 1.3 : midi > 84 ? 0.6 : 1);
  const out = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(f * 12, 11000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, 600), t + len * 0.7);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.42, t + 0.004);
  out.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const amps = [1, 0.55, 0.32, 0.2, 0.12, 0.07, 0.04];
  amps.forEach((a, i) => {
    const n = i + 1;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f * n * Math.sqrt(1 + 0.0004 * n * n);
    g.gain.setValueAtTime(a * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len / (1 + i * 0.55));
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + len + 0.05);
  });
  // hammer: a very short burst of filtered noise
  const nb = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const ns = c.createBufferSource();
  const bp = c.createBiquadFilter();
  const ng = c.createGain();
  ns.buffer = nb;
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(f * 3, 4000);
  ng.gain.value = 0.18;
  ns.connect(bp).connect(ng).connect(out);
  ns.start(t);
  lp.connect(out).connect(c.destination);
}

/* ------------------------------ clocks & clicks ------------------------------ */

/** Audio-clock time in seconds (use this, not Date.now(), for anything that must line up with sound). */
export const audioNow = () => ac().currentTime;
export const hzOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** A short percussive tick for the metronome. `at` is an absolute audio-clock time. */
export function click(at: number, level: 'accent' | 'beat' | 'sub' = 'beat', volume = 0.6) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = level === 'accent' ? 1500 : level === 'beat' ? 1000 : 700;
  const peak = volume * (level === 'accent' ? 0.5 : level === 'beat' ? 0.38 : 0.22);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + 0.06);
}

/** Play a voiced note at an absolute audio-clock time. */
export function playAt(voice: 'guitar' | 'piano', soundingMidi: number, at: number, dur = 1.2) {
  const delay = Math.max(0, at - ac().currentTime);
  if (voice === 'piano') piano(soundingMidi, delay, dur + 0.8);
  else pluck(soundingMidi, delay, dur + 0.4);
}

/** Play a chord (block or strummed) on the chosen voice. */
export function playChord(voice: 'guitar' | 'piano', midis: number[], opts: { delay?: number; spread?: number; dur?: number } = {}) {
  const { delay = 0, spread = voice === 'guitar' ? 0.05 : 0.012, dur = 2.2 } = opts;
  midis.forEach((m, i) => (voice === 'piano' ? piano(m, delay + i * spread, dur) : pluck(m, delay + i * spread, dur)));
}

/** Play a sequence of {midi, at (s from now), dur} on one voice, for melodic examples. */
export function playLine(voice: 'guitar' | 'piano', notes: { midi: number; at: number; dur?: number }[]) {
  notes.forEach((n) => (voice === 'piano' ? piano(n.midi, n.at, (n.dur ?? 0.8) + 0.9) : pluck(n.midi, n.at, (n.dur ?? 0.8) + 0.5)));
}

/* ------------------------------ guitar techniques ------------------------------ */

export type Technique = 'pick' | 'hammer' | 'pull' | 'slide' | 'bend' | 'release' | 'vibrato' | 'mute' | 'harmonic' | 'tap';

/**
 * One guitar note with a playing technique. Frequencies are real (sounding) pitch.
 * `from`/`to` = sounding midi; the note starts at `from` and moves to `to` where the technique says so.
 */
export function techNote(tech: Technique, midi: number, opts: { delay?: number; dur?: number; to?: number } = {}) {
  const c = ac();
  const t = c.currentTime + (opts.delay ?? 0);
  const dur = opts.dur ?? 1.2;
  const f0 = hzOf(midi);
  const to = opts.to ?? midi;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  const bright = tech === 'mute' ? 600 : tech === 'harmonic' ? 6000 : Math.min(f0 * 8, 8000);
  lp.frequency.setValueAtTime(bright, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f0 * 1.4, 300), t + dur);
  const soft = tech === 'hammer' || tech === 'pull' || tech === 'tap';
  const peak = soft ? 0.22 : 0.34;
  const len = tech === 'mute' ? 0.22 : tech === 'harmonic' ? dur * 1.6 : dur;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.type = tech === 'harmonic' ? 'sine' : 'triangle';
  o2.type = tech === 'harmonic' ? 'sine' : 'sawtooth';
  const g2 = c.createGain();
  g2.gain.value = tech === 'harmonic' ? 0.2 : 0.22;
  const setF = (osc: OscillatorNode) => {
    osc.frequency.setValueAtTime(f0, t);
    if (tech === 'slide') { osc.frequency.setValueAtTime(f0, t + 0.12); osc.frequency.exponentialRampToValueAtTime(hzOf(to), t + 0.5); }
    if (tech === 'bend') { osc.frequency.setValueAtTime(f0, t + 0.2); osc.frequency.exponentialRampToValueAtTime(hzOf(to), t + 0.65); }
    if (tech === 'release') { osc.frequency.setValueAtTime(hzOf(to), t); osc.frequency.setValueAtTime(hzOf(to), t + 0.2); osc.frequency.exponentialRampToValueAtTime(f0, t + 0.65); }
  };
  setF(o); setF(o2);
  if (tech === 'vibrato') {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(28, t + 0.5);       // cents
    lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
    lfo.start(t); lfo.stop(t + len + 0.1);
  }
  o.connect(lp); o2.connect(g2).connect(lp);
  lp.connect(g).connect(c.destination);
  o.start(t); o2.start(t);
  o.stop(t + len + 0.1); o2.stop(t + len + 0.1);
}

/* ------------------------------ tuner reference ------------------------------ */

/** A sustained reference tone for tuning by ear. Returns a stop function. */
export function holdTone(midi: number): () => void {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.value = hzOf(midi);
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
  o.connect(g).connect(c.destination);
  o.start(t);
  return () => {
    const n = c.currentTime;
    g.gain.cancelScheduledValues(n);
    g.gain.setValueAtTime(g.gain.value, n);
    g.gain.exponentialRampToValueAtTime(0.0001, n + 0.12);
    o.stop(n + 0.15);
  };
}
