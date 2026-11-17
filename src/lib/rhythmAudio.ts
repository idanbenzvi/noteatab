import { ac, click, playAt } from './audio';
import { unitSeconds, type REvent, type TimeSig } from './rhythm';

export interface Scheduled {
  /** audio-clock time each event starts */
  times: number[];
  /** audio-clock time the bar (not counting count-in) ends */
  endAt: number;
  startAt: number;
}

/**
 * Schedule a bar of rhythm on the audio clock.
 * `midis` are sounding pitches for the non-rest events in order; if omitted a single pitch is used.
 */
export function schedulePattern(events: REvent[], sig: TimeSig, bpm: number, o: {
  voice?: 'guitar' | 'piano'; midis?: number[]; pitch?: number; metronome?: boolean; countIn?: boolean; at?: number; silent?: boolean;
} = {}): Scheduled {
  const c = ac();
  const us = unitSeconds(bpm, sig);
  const beats = sig.units / sig.group;
  const lead = o.countIn ? beats * sig.group * us : 0;
  const t0 = (o.at ?? c.currentTime + 0.08);
  const start = t0 + lead;
  if (o.countIn) for (let b = 0; b < beats; b++) click(t0 + b * sig.group * us, b === 0 ? 'accent' : 'beat');
  if (o.metronome) for (let b = 0; b < beats; b++) click(start + b * sig.group * us, b === 0 ? 'accent' : 'beat', 0.45);
  const times: number[] = [];
  let u = 0, k = 0;
  events.forEach((e) => {
    const t = start + u * us;
    times.push(t);
    if (!e.rest && !o.silent) {
      const m = o.midis ? o.midis[k % o.midis.length] : (o.pitch ?? 52);
      playAt(o.voice ?? 'guitar', m, t, Math.min(1.2, e.u * us * 1.1));
      k++;
    }
    u += e.u;
  });
  return { times, endAt: start + u * us, startAt: start };
}

/** Run `fn(i)` as the audio clock reaches each time. Returns a cancel function. */
export function followClock(times: number[], fn: (i: number) => void, done?: () => void, endAt?: number): () => void {
  const c = ac();
  const ids: number[] = [];
  times.forEach((t, i) => ids.push(window.setTimeout(() => fn(i), Math.max(0, (t - c.currentTime) * 1000))));
  if (done && endAt !== undefined) ids.push(window.setTimeout(done, Math.max(0, (endAt - c.currentTime) * 1000)));
  return () => ids.forEach((i) => window.clearTimeout(i));
}
