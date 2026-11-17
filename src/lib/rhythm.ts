// Rhythm model. Time is counted in sixteenth-note "units" (a quarter note = 4 units).
export type Base = 'w' | 'h' | 'q' | 'e' | 's';
export interface REvent { base: Base; dot: boolean; rest: boolean; u: number }

export const BASE_UNITS: Record<Base, number> = { w: 16, h: 8, q: 4, e: 2, s: 1 };
export const BASE_INFO: Record<Base, { name: string; restName: string; beats: string; fraction: string }> = {
  w: { name: 'Whole note', restName: 'Whole rest', beats: '4 beats', fraction: '1' },
  h: { name: 'Half note', restName: 'Half rest', beats: '2 beats', fraction: '1/2' },
  q: { name: 'Quarter note', restName: 'Quarter rest', beats: '1 beat', fraction: '1/4' },
  e: { name: 'Eighth note', restName: 'Eighth rest', beats: '½ beat', fraction: '1/8' },
  s: { name: 'Sixteenth note', restName: 'Sixteenth rest', beats: '¼ beat', fraction: '1/16' },
};
export const BASES: Base[] = ['w', 'h', 'q', 'e', 's'];

export const ev = (base: Base, o: { dot?: boolean; rest?: boolean } = {}): REvent => {
  const dot = !!o.dot;
  const u = BASE_UNITS[base] * (dot ? 1.5 : 1);
  return { base, dot, rest: !!o.rest, u };
};

export interface TimeSig { id: string; top: number; bottom: number; units: number; group: number; label: string; feel: string; strong: number[] }
export const TIME_SIGS: TimeSig[] = [
  { id: '4/4', top: 4, bottom: 4, units: 16, group: 4, label: '4/4', feel: 'Four quarter-note beats per bar: the default of pop, rock and blues. Beat 1 is strongest, beat 3 is medium.', strong: [0, 8] },
  { id: '3/4', top: 3, bottom: 4, units: 12, group: 4, label: '3/4', feel: 'Three beats per bar: a waltz. “ONE two three, ONE two three”.', strong: [0] },
  { id: '2/4', top: 2, bottom: 4, units: 8, group: 4, label: '2/4', feel: 'Two beats per bar: marches and polkas. “ONE two, ONE two”.', strong: [0] },
  { id: '6/8', top: 6, bottom: 8, units: 12, group: 6, label: '6/8', feel: 'Six eighth-notes grouped in two dotted-quarter beats: a rolling “ONE-two-three FOUR-five-six” lilt (jigs, ballads).', strong: [0, 6] },
  { id: '5/4', top: 5, bottom: 4, units: 20, group: 4, label: '5/4', feel: 'Five beats per bar, usually felt as 3 + 2 or 2 + 3: asymmetrical and off-balance (“Take Five”).', strong: [0, 12] },
];

/** Counting syllables for the unit positions in a bar (4/4-style subdivisions). */
export function countLabel(u: number, sig: TimeSig): string {
  if (sig.group === 6) {                        // compound: 1 la li 2 la li (per eighth) — use numbers on eighths
    const k = u / 2;
    if (u % 2) return 'a';
    return k % 3 === 0 ? String(k / 3 + 1) : k % 3 === 1 ? 'la' : 'li';
  }
  const beat = Math.floor(u / 4) + 1, off = u % 4;
  return off === 0 ? String(beat) : off === 2 ? '&' : off === 1 ? 'e' : 'a';
}

export const unitsOf = (events: REvent[]) => events.reduce((a, e) => a + e.u, 0);

/* ------------------------------ generation ------------------------------ */

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[rnd(a.length)];
type Cell = REvent[];
const q = (rest = false) => ev('q', { rest });
const e = (rest = false) => ev('e', { rest });
const s = (rest = false) => ev('s', { rest });

// one beat (4 units) of each flavour
const SIMPLE_CELLS: Record<number, Cell[]> = {
  1: [[q()], [e(), e()]],
  2: [[q()], [e(), e()], [q(true)], [e(), e()], [e(), e(true)], [e(true), e()]],
  3: [[q()], [e(), e()], [s(), s(), s(), s()], [e(), s(), s()], [s(), s(), e()], [ev('e', { dot: true }), s()], [q(true)], [e(), e(true)], [e(true), e()]],
};
const COMPOUND_CELLS: Record<number, Cell[]> = {   // one beat of 6/8 (6 units)
  1: [[ev('q', { dot: true })], [e(), e(), e()]],
  2: [[ev('q', { dot: true })], [e(), e(), e()], [q(), e()], [e(), q()], [ev('q', { dot: true, rest: true })]],
  3: [[ev('q', { dot: true })], [e(), e(), e()], [q(), e()], [e(), q()], [e(), e(), e(true)], [e(true), e(), e()], [ev('q', { dot: true, rest: true })]],
};

/** A random bar. level 1: simple, 2: adds rests, 3: adds sixteenths and dotted figures. */
export function randomBar(sig: TimeSig, level: 1 | 2 | 3): REvent[] {
  const beats = sig.units / sig.group;
  const cells = sig.group === 6 ? COMPOUND_CELLS[level] : SIMPLE_CELLS[level];
  let bar: REvent[] = [];
  for (let b = 0; b < beats; b++) bar.push(...pick(cells));
  if (sig.group === 4) bar = mergeHalves(bar, sig);
  // never an entirely silent bar
  if (bar.every((x) => x.rest)) bar[0] = { ...bar[0], rest: false };
  // always start on a sounding note so the bar has a clear pulse
  if (bar[0].rest) bar[0] = { ...bar[0], rest: false };
  return bar;
}

/** Join two adjacent beat-long notes (or rests) into a half note where they sit on beats 1+2 or 3+4. */
function mergeHalves(bar: REvent[], sig: TimeSig): REvent[] {
  const out: REvent[] = [];
  let pos = 0;
  for (let i = 0; i < bar.length; i++) {
    const a = bar[i], b = bar[i + 1];
    if (b && a.base === 'q' && b.base === 'q' && !a.dot && !b.dot && a.rest === b.rest && pos % 8 === 0 && Math.random() < 0.45 && pos + 8 <= sig.units) {
      out.push(ev('h', { rest: a.rest })); i++; pos += 8;
    } else { out.push(a); pos += a.u; }
  }
  return out;
}

export const rhythmKey = (events: REvent[]) => events.map((x) => `${x.base}${x.dot ? '.' : ''}${x.rest ? 'r' : ''}`).join(' ');

/** A plausible wrong answer: change one beat's worth of the bar. */
export function variation(bar: REvent[], sig: TimeSig, level: 1 | 2 | 3): REvent[] {
  for (let tries = 0; tries < 20; tries++) {
    const other = randomBar(sig, level);
    // keep the first half the same when possible so differences are subtle
    const half = Math.floor(sig.units / 2);
    let pos = 0; const keep: REvent[] = [];
    for (const x of bar) { if (pos + x.u <= half) { keep.push(x); pos += x.u; } else break; }
    let p2 = 0; const tail: REvent[] = [];
    for (const x of other) { if (p2 >= pos) tail.push(x); p2 += x.u; }
    if (p2 - pos < 0) continue;
    const cand = [...keep, ...tail];
    if (unitsOf(cand) === sig.units && rhythmKey(cand) !== rhythmKey(bar)) return cand;
  }
  return randomBar(sig, level);
}

/* ------------------------------ timing ------------------------------ */

export interface Onset { index: number; unit: number; rest: boolean; units: number }
export function onsets(events: REvent[]): Onset[] {
  let u = 0;
  return events.map((x, index) => { const o = { index, unit: u, rest: x.rest, units: x.u }; u += x.u; return o; });
}
/** Seconds per unit when a beat (quarter or dotted-quarter group) lasts 60/bpm seconds. */
export const unitSeconds = (bpm: number, sig: TimeSig) => (60 / bpm) / (sig.group);
