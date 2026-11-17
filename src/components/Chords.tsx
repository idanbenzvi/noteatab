import { useMemo, useState } from 'react';
import { LETTER_PC, SCALES, STRINGS, mod, pcOf, pitchName, scaleNotes, type Pitch, type ScaleType } from '../lib/music';
import { pluck } from '../lib/audio';
import SpotlightCard from './reactbits/SpotlightCard';

/* ------------------------------ chord model ------------------------------ */

export interface Chord {
  root: Pitch; pitches: Pitch[]; pcs: number[]; offs: number[];      // pcs[0] = root pc; offs = semitones above root
  symbol: string; roman: string; names: string[];  // chord-tone names, root first
  seventh: boolean;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR_OFFS = [0, 2, 4, 5, 7, 9, 11];
const spell = (pc: number, l: number): Pitch => ({ l, acc: mod(pc - LETTER_PC[l] + 6, 12) - 6 });

const TRIADS: Record<string, [string, boolean]> = {   // "third,fifth" → [suffix, isMinorish]
  '4,7': ['', false], '3,7': ['m', true], '3,6': ['dim', true], '4,8': ['+', false],
};
const SEVENTHS: Record<string, [string, boolean]> = {
  '4,7,11': ['maj7', false], '4,7,10': ['7', false], '3,7,10': ['m7', true], '3,6,10': ['m7♭5', true],
  '3,6,9': ['dim7', true], '3,7,11': ['m(maj7)', true], '4,8,11': ['+maj7', false], '4,8,10': ['+7', false],
};
const ROMAN_SUFFIX: Record<string, string> = {
  '': '', m: '', dim: '°', '+': '+', maj7: 'maj7', '7': '7', m7: '7', 'm7♭5': 'ø7', dim7: '°7', 'm(maj7)': 'maj7', '+maj7': '+maj7', '+7': '+7',
};

type Override = 'dom7' | 'maj' | undefined;
export interface Step { d: number; seventh?: boolean; ov?: Override }

/** Stack thirds on scale degree d (0‑based) of a 7-note scale. */
export function buildChord(scale: ReturnType<typeof scaleNotes>, st: Step, wantSeventh: boolean): Chord {
  const rootN = scale[st.d];
  const rootPc = rootN.pc;
  let offs: number[];
  if (st.ov === 'dom7') offs = [0, 4, 7, 10];
  else if (st.ov === 'maj') offs = [0, 4, 7];
  else {
    offs = [0, 2, 4, 6].map((k) => mod(scale[(st.d + k) % 7].pc - rootPc, 12));
    if (!wantSeventh && !st.seventh) offs = offs.slice(0, 3);
  }
  const key = offs.slice(1).join(',');
  const [suffix, minorish] = (offs.length === 4 ? SEVENTHS[key] : TRIADS[key]) ?? ['?', false];
  const pcs = offs.map((o) => mod(rootPc + o, 12));
  const pitches = pcs.map((pc, k) => spell(pc, (rootN.l + k * 2) % 7));
  const names = pitches.map(pitchName);
  const alt = MAJOR_OFFS[st.d] - mod(rootPc - scale[0].pc, 12);
  const prefix = alt > 0 ? '♭' : alt < 0 ? '♯' : '';
  const numeral = minorish ? ROMAN[st.d].toLowerCase() : ROMAN[st.d];
  return {
    root: { l: rootN.l, acc: rootN.acc }, pitches, pcs, offs, symbol: pitchName(rootN) + suffix,
    roman: prefix + numeral + (ROMAN_SUFFIX[suffix] ?? ''), names, seventh: offs.length === 4,
  };
}

/* ------------------------------ voicing finder ------------------------------ */

type Voicing = number[];                     // fret per string (low E → high e), -1 = muted
const cache = new Map<string, Voicing[]>();

export function findVoicings(c: Chord): Voicing[] {
  const key = c.pcs[0] + ':' + c.offs.join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const want = new Set(c.pcs);
  const needed = new Set(c.pcs.filter((_, k) => !(c.seventh && k === 2)));   // 7th chords may drop the 5th
  const root = c.pcs[0];
  const found: { v: Voicing; score: number; lo: number }[] = [];
  for (let lo = 0; lo <= 12; lo++) {
    const opts = STRINGS.map((s) => {
      const o: number[] = [-1];
      if (lo === 0) o.push(0);
      for (let f = Math.max(lo, 1); f <= lo + 3; f++) o.push(f);
      return o.filter((f) => f < 0 || want.has((s.midi + f) % 12));
    });
    const cur: number[] = [];
    const rec = (i: number) => {
      if (i === 6) {
        const snd = cur.map((f, s) => (f >= 0 ? s : -1)).filter((s) => s >= 0);
        if (snd.length < 4) return;
        for (let k = snd[0]; k <= snd[snd.length - 1]; k++) if (cur[k] < 0) return;       // no inner mutes
        if ((STRINGS[snd[0]].midi + cur[snd[0]]) % 12 !== root) return;                   // root in the bass
        const have = new Set(snd.map((s) => (STRINGS[s].midi + cur[s]) % 12));
        for (const p of needed) if (!have.has(p)) return;
        const fretted = snd.filter((s) => cur[s] > 0);
        const opens = snd.length - fretted.length;
        const minF = Math.min(...fretted.map((s) => cur[s]), 99);
        const atMin = fretted.filter((s) => cur[s] === minF).length;
        const fingers = opens === 0 && atMin >= 2 ? 1 + fretted.length - atMin : fretted.length;
        if (fingers > 4) return;
        const missing = want.size - have.size;
        const score = (6 - snd.length) * 2.2 + (minF === 99 ? 0 : minF) * 0.5 + missing * 1.1 + fingers * 0.3 - opens * 0.4;
        found.push({ v: [...cur], score, lo });
      } else for (const f of opts[i]) { cur[i] = f; rec(i + 1); }
    };
    rec(0);
  }
  found.sort((a, b) => a.score - b.score);
  const out: { v: Voicing; lo: number }[] = [];
  for (const f of found) {
    if (out.some((o) => o.v.join() === f.v.join())) continue;
    if (out.some((o) => Math.abs(o.lo - f.lo) < 3 && Math.abs(Math.min(...o.v.filter((x) => x > 0), 0) - Math.min(...f.v.filter((x) => x > 0), 0)) < 2)) continue;
    out.push(f);
    if (out.length === 3) break;
  }
  const res = out.map((o) => o.v);
  cache.set(key, res);
  return res;
}

/* ------------------------------ audio ------------------------------ */

export function strum(v: Voicing, delay = 0) {
  let k = 0;
  v.forEach((f, s) => { if (f >= 0) pluck(STRINGS[s].midi + f, delay + k++ * 0.045, 2.2); });
}

/* ------------------------------ diagram ------------------------------ */

const SX = (s: number) => 20 + s * 12.4, FY0 = 34, FH = 17;

function ChordBox({ chord, v, onClick }: { chord: Chord; v: Voicing | undefined; onClick?: () => void }) {
  const names = new Map(chord.pcs.map((pc, k) => [pc, chord.names[k]]));
  const fr = v ? v.filter((f) => f > 0) : [];
  const minF = fr.length ? Math.min(...fr) : 1, maxF = fr.length ? Math.max(...fr) : 1;
  const start = maxF <= 4 ? 1 : minF;
  const row = (f: number) => FY0 + (f - start + 0.5) * FH;
  const barre = v && v.every((f) => f !== 0) && fr.length ? v.map((f, s) => (f === minF ? s : -1)).filter((s) => s >= 0) : [];
  return (
    <button className="chord-box" onClick={onClick} disabled={!v} title={v ? `Strum ${chord.symbol}` : 'No easy shape found'}>
      <svg viewBox="0 0 100 136" role="img" aria-label={`${chord.symbol} chord shape`}>
        {start > 1 && <text x={2} y={row(start) + 4} className="cb-fr">{start}fr</text>}
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1={start > 1 ? 24 + i * 11.8 : SX(i)} x2={start > 1 ? 24 + i * 11.8 : SX(i)} y1={FY0} y2={FY0 + 5 * FH} className="cb-line" />)}
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1={start > 1 ? 24 : SX(0)} x2={start > 1 ? 24 + 5 * 11.8 : SX(5)} y1={FY0 + i * FH} y2={FY0 + i * FH} className={i === 0 && start === 1 ? 'cb-nut' : 'cb-line'} />)}
        {v && v.map((f, s) => {
          const x = start > 1 ? 24 + s * 11.8 : SX(s);
          if (f < 0) return <text key={s} x={x} y={FY0 - 9} textAnchor="middle" className="cb-mute">×</text>;
          if (f === 0) return <circle key={s} cx={x} cy={FY0 - 12} r={3.6} className="cb-open" />;
          return null;
        })}
        {barre.length >= 2 && start >= 1 && (() => {
          const xa = start > 1 ? 24 + barre[0] * 11.8 : SX(barre[0]), xb = start > 1 ? 24 + barre[barre.length - 1] * 11.8 : SX(barre[barre.length - 1]);
          return <rect x={xa - 4.6} y={row(minF) - 4.6} width={xb - xa + 9.2} height={9.2} rx={4.6} className="cb-barre" />;
        })()}
        {v && v.map((f, s) => {
          if (f <= 0) return null;
          const x = start > 1 ? 24 + s * 11.8 : SX(s);
          const pc = (STRINGS[s].midi + f) % 12;
          const isRoot = pc === chord.pcs[0];
          return (
            <g key={s}>
              <circle cx={x} cy={row(f)} r={6.2} className={isRoot ? 'cb-dot root' : 'cb-dot'} />
              <text x={x} y={row(f) + 2.8} textAnchor="middle" className="cb-note">{names.get(pc)}</text>
            </g>
          );
        })}
        {!v && <text x={50} y={80} textAnchor="middle" className="cb-mute">no shape</text>}
      </svg>
    </button>
  );
}

/* ------------------------------ progressions ------------------------------ */

export type Base = 'major' | 'minor' | 'dorian';
export interface Prog { style: string; icon: string; steps: Step[]; why: string }
export const PROGS: Record<Base, Prog[]> = {
  major: [
    { style: 'Jazz', icon: '🎷', steps: [{ d: 0 }, { d: 5 }, { d: 1 }, { d: 4 }, { d: 0 }].map((s) => ({ ...s, seventh: true })),
      why: 'The “turnaround”: tonic → relative minor → ii → V7 → home. Seventh chords on every step give the smooth, colourful jazz sound, and the V7 pulls hard back to I.' },
    { style: 'Rock', icon: '🎸', steps: [{ d: 0 }, { d: 4 }, { d: 5 }, { d: 3 }],
      why: 'I – V – vi – IV: four big open triads. Easy to strum, anthemic, and the loop behind countless rock and pop hits.' },
    { style: 'NeoClassical', icon: '🎻', steps: [{ d: 0 }, { d: 4 }, { d: 5 }, { d: 2 }, { d: 3 }],
      why: 'The Baroque “Canon” sequence: the bass walks down by steps and each chord leans on the next. Rock guitarists lift this pattern for arpeggiated, Bach‑style playing.' },
  ],
  minor: [
    { style: 'Jazz', icon: '🎷', steps: [{ d: 1, seventh: true }, { d: 4, seventh: true, ov: 'dom7' }, { d: 0, seventh: true }, { d: 5, seventh: true }],
      why: 'The minor ii–V–i: half‑diminished ii, a dominant V7 (raised 7th, borrowed from harmonic minor) and a minor‑7 tonic, then a ♭VImaj7 for a wistful turn.' },
    { style: 'Rock', icon: '🎸', steps: [{ d: 0 }, { d: 5 }, { d: 2 }, { d: 6 }],
      why: 'i – ♭VI – ♭III – ♭VII: every chord is built from the natural minor scale. Big, epic and very easy to play with power‑chord shapes.' },
    { style: 'NeoClassical', icon: '🎻', steps: [{ d: 0 }, { d: 5 }, { d: 3 }, { d: 4, seventh: true, ov: 'dom7' }, { d: 0 }],
      why: 'i – ♭VI – iv – V7 – i. The major V7 comes from harmonic minor and creates the strong, dramatic pull to the tonic that classical and neoclassical‑metal players love.' },
  ],
  dorian: [
    { style: 'Jazz', icon: '🎷', steps: [{ d: 0 }, { d: 3 }, { d: 6 }, { d: 0 }].map((s) => ({ ...s, seventh: true })),
      why: 'Modal jazz vamp: the raised 6th makes the IV chord a dominant 7th. Hold each chord for a long time and let the Dorian colour do the work.' },
    { style: 'Rock', icon: '🎸', steps: [{ d: 0 }, { d: 6 }, { d: 3 }, { d: 0 }],
      why: 'i – ♭VII – IV – i: a minor riff with a bright major IV. It sounds modal and hopeful, a staple of folk‑rock and funk‑rock.' },
    { style: 'NeoClassical', icon: '🎻', steps: [{ d: 0 }, { d: 1 }, { d: 2 }, { d: 3 }, { d: 0 }],
      why: 'A stepwise rise: i – ii – ♭III – IV – i. Because the notes climb by step, it reads like a church‑mode sequence and works nicely played as arpeggios.' },
  ],
};

/* ------------------------------ component ------------------------------ */

export default function Chords({ root, type }: { root: Pitch; type: ScaleType }) {
  const [sevenths, setSevenths] = useState(false);
  const [variant, setVariant] = useState<Record<string, number>>({});

  const base: Base = type === 'majorPent' ? 'major' : type === 'minorPent' ? 'minor' : (type as Base);
  const scale = useMemo(() => scaleNotes(root, base), [root, base]);
  const diatonic = useMemo(() => scale.map((_, d) => buildChord(scale, { d }, sevenths)), [scale, sevenths]);
  const progs = useMemo(() => PROGS[base].map((p) => ({
    ...p, chords: p.steps.map((s) => buildChord(scale, s, false)),
  })), [scale, base]);

  const pick = (c: Chord, tag: string) => {
    const vs = findVoicings(c);
    return { vs, v: vs[(variant[tag + c.symbol] ?? 0) % Math.max(vs.length, 1)] as Voicing | undefined };
  };
  const cycle = (c: Chord, tag: string) => setVariant((m) => ({ ...m, [tag + c.symbol]: (m[tag + c.symbol] ?? 0) + 1 }));

  const playProg = (chords: Chord[], tag: string) => chords.forEach((c, i) => { const { v } = pick(c, tag); if (v) strum(v, i * 1.25); });

  const pent = type === 'majorPent' || type === 'minorPent';

  return (
    <SpotlightCard className="card chords" spotlight="rgba(255,122,89,0.08)">
      <header className="card-head">
        <div>
          <p className="eyebrow">6 · The chords</p>
          <h2>Chords of {pitchName(root)} {SCALES[base].label.toLowerCase()}</h2>
        </div>
        <div className="seg" role="radiogroup" aria-label="Chord size">
          <button className={!sevenths ? 'on' : ''} onClick={() => setSevenths(false)}>Triads</button>
          <button className={sevenths ? 'on' : ''} onClick={() => setSevenths(true)}>7th chords</button>
        </div>
      </header>
      <p className="hint small">
        Each chord stacks every other note of the scale (1‑3‑5{sevenths ? '‑7' : ''}) on one degree.
        {pent && <> A pentatonic scale has only five notes, so it borrows the chords of its parent {SCALES[base].label.toLowerCase()} scale.</>}
        {' '}Click a shape to strum it, ↻ cycles through other positions. <span className="cb-key"><i className="cb-dot root" /> root</span>
      </p>

      <div className="chord-grid">
        {diatonic.map((c, d) => {
          const { vs, v } = pick(c, 'd');
          return (
            <div key={d} className="chord-cell">
              <div className="chord-title"><b>{c.symbol}</b><span>{c.roman}</span></div>
              <ChordBox chord={c} v={v} onClick={() => v && strum(v)} />
              <div className="chord-notes">{c.names.join(' · ')}</div>
              {vs.length > 1 && <button className="chord-cycle" onClick={() => cycle(c, 'd')} title="Another position">↻ {(variant['d' + c.symbol] ?? 0) % vs.length + 1}/{vs.length}</button>}
            </div>
          );
        })}
      </div>

      <h3 className="tx-h3">Progression ideas in {pitchName(root)} {SCALES[base].label.toLowerCase()}</h3>
      <div className="prog-list">
        {progs.map((p) => (
          <div key={p.style} className="prog">
            <div className="prog-head">
              <b>{p.icon} {p.style}</b>
              <span className="prog-romans">{p.chords.map((c) => c.roman).join(' – ')}</span>
              <button className="pill accent" onClick={() => playProg(p.chords, p.style)}>▶ Play</button>
            </div>
            <div className="prog-chords">
              {p.chords.map((c, i) => {
                const { v } = pick(c, p.style);
                return (
                  <div key={i} className="chord-cell small">
                    <div className="chord-title"><b>{c.symbol}</b><span>{c.roman}</span></div>
                    <ChordBox chord={c} v={v} onClick={() => v && strum(v)} />
                  </div>
                );
              })}
            </div>
            <p className="hint small">{p.why}</p>
          </div>
        ))}
      </div>
    </SpotlightCard>
  );
}
