// Local-only practice tracking: per-item accuracy (with recency weighting) and a day streak.
const KEY = 'noteatab.progress.v1';

export interface Stat { n: number; c: number; t: number }   // decayed attempts, decayed correct, last-seen ms
interface Store { stats: Record<string, Stat>; days: string[]; totals: Record<string, { n: number; c: number }> }

const empty = (): Store => ({ stats: {}, days: [], totals: {} });
let cache: Store | null = null;
const listeners = new Set<() => void>();

function load(): Store {
  if (cache) return cache;
  try { cache = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { cache = empty(); }
  return cache!;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* private mode: keep in memory only */ }
  listeners.forEach((f) => f());
}
export const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

const DECAY = 0.92;   // each new attempt shrinks older evidence, so improvement shows quickly
const today = () => new Date().toISOString().slice(0, 10);

export function record(domain: string, item: string, correct: boolean) {
  const s = load();
  const k = `${domain}|${item}`;
  const prev = s.stats[k] ?? { n: 0, c: 0, t: 0 };
  s.stats[k] = { n: prev.n * DECAY + 1, c: prev.c * DECAY + (correct ? 1 : 0), t: Date.now() };
  const tot = s.totals[domain] ?? { n: 0, c: 0 };
  s.totals[domain] = { n: tot.n + 1, c: tot.c + (correct ? 1 : 0) };
  const d = today();
  if (s.days[s.days.length - 1] !== d) { s.days.push(d); if (s.days.length > 400) s.days.shift(); }
  persist();
}

export const stat = (domain: string, item: string): Stat | undefined => load().stats[`${domain}|${item}`];

/** Smoothed accuracy 0..1, or null if never asked. */
export function accuracy(domain: string, item: string): number | null {
  const s = stat(domain, item);
  return s && s.n > 0.5 ? (s.c + 0.5) / (s.n + 1) : null;
}

/** Sampling weight: unseen items and weak items come up more often. */
export function weight(domain: string, item: string): number {
  const a = accuracy(domain, item);
  if (a === null) return 2;
  return 0.4 + 4 * (1 - a) * (1 - a) + 1.2 * (1 - a);
}

export function pickWeighted<T>(items: T[], key: (t: T) => string, domain: string): T {
  const w = items.map((i) => weight(domain, key(i)));
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

export const totals = () => load().totals;

/** Consecutive days practised, counting back from today (or yesterday if you haven't played yet today). */
export function dayStreak(): number {
  const days = new Set(load().days);
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const daysPracticed = () => load().days.length;

/** The weakest items in a domain that have at least `min` attempts, worst first. */
export function weakest(domain: string, count = 5, min = 2): { item: string; acc: number; n: number }[] {
  const out: { item: string; acc: number; n: number }[] = [];
  const pre = domain + '|';
  for (const [k, s] of Object.entries(load().stats)) {
    if (!k.startsWith(pre) || s.n < min) continue;
    out.push({ item: k.slice(pre.length), acc: (s.c + 0.5) / (s.n + 1), n: s.n });
  }
  return out.sort((a, b) => a.acc - b.acc).slice(0, count);
}

export function resetProgress() { cache = empty(); persist(); }
