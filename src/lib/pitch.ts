// Monophonic pitch detection (YIN) for the tuner.

/** Returns the fundamental in Hz, or null if the signal is too quiet or not clearly pitched. */
export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 60, maxHz = 1000): { hz: number; clarity: number } | null {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.008) return null;

  const maxTau = Math.min(Math.floor(sampleRate / minHz), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const W = buf.length - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; sum += x * x; }
    d[tau] = sum;
  }
  // cumulative mean normalised difference
  const cm = new Float32Array(maxTau + 1);
  cm[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= maxTau; tau++) { run += d[tau]; cm[tau] = run === 0 ? 1 : (d[tau] * tau) / run; }

  const THRESH = 0.15;
  let tau = -1;
  for (let t = minTau; t < maxTau; t++) {
    if (cm[t] < THRESH) { while (t + 1 < maxTau && cm[t + 1] < cm[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  // parabolic interpolation around the minimum
  const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1] ?? cm[tau];
  const denom = a - 2 * b + c;
  const shift = denom === 0 ? 0 : (a - c) / (2 * denom);
  return { hz: sampleRate / (tau + shift), clarity: 1 - b };
}

export const midiFromHz = (hz: number) => 69 + 12 * Math.log2(hz / 440);
