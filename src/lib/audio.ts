let ctx: AudioContext | null = null;

function ac(): AudioContext {
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
