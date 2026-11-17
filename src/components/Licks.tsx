import { useMemo, useState } from 'react';
import {
  ACC_SYMBOL, LETTER_PC, SCALES, STRINGS, WRITTEN_OFFSET, mod, noteFromStep, noteName, parentMajor, pitchName,
  scaleNotes, signatureCount, spellMidi, stepOf, type Note, type Pitch, type ScaleType,
} from '../lib/music';
import { pluck } from '../lib/audio';
import SpotlightCard from './reactbits/SpotlightCard';
import { PROGS, buildChord, findVoicings, strum, type Base, type Chord } from './Chords';

/* ------------------------------ lick model ------------------------------ */

type Item = number | [number, number];          // index into the chord's note stack, optional semitone offset
type Tech = 'h' | 'p' | '/' | '\\' | undefined;
interface LNote { midi: number; pitch: Pitch; written: Note; s: number; f: number; tech: Tech; chord: number }
interface Lick { title: string; blurb: string; notes: LNote[]; chords: Chord[]; dur: 8 | 16 }

type StyleId = 'Jazz' | 'Rock' | 'NeoClassical';
const STYLES: { id: StyleId; icon: string }[] = [
  { id: 'Jazz', icon: '🎷' }, { id: 'Rock', icon: '🎸' }, { id: 'NeoClassical', icon: '🎻' },
];

// Four-note figures. Numbers walk up a stack of chord tones (jazz, neoclassical) or of the
// chord's pentatonic scale (rock); [n, -1] means "that note approached from a semitone below".
const POOLS: Record<StyleId, Record<string, Item[]>> = {
  Jazz: {
    A: [0, 1, 2, 3], B: [3, 2, 1, 0], C: [[1, -1], 1, 2, 3], D: [1, 2, 3, 4], E: [4, 3, 2, 1], F: [[0, -1], 0, 2, 1],
  },
  Rock: {
    A: [0, 1, 2, 3], B: [3, 2, 1, 0], C: [0, 2, 1, 3], D: [3, 4, 3, 2], E: [4, 2, 1, 0], F: [1, 0, 2, 1],
  },
  NeoClassical: {
    A: [0, 1, 2, 3], B: [3, 2, 1, 0], C: [0, 2, 1, 2], D: [0, 1, 2, 1], E: [2, 1, 0, 1], F: [2, 3, 2, 1],
  },
};

interface Preset { title: string; blurb: string; plan: string }
const PRESETS: Record<StyleId, Preset[]> = {
  Jazz: [
    { title: 'Arpeggio ladder', plan: 'ABABA', blurb: 'Climb each 7th chord 1‑3‑5‑7, then fall back down on the next one. The notes themselves spell the harmony.' },
    { title: 'Chromatic approach', plan: 'CCCCF', blurb: 'Each line steps up to the 3rd from a semitone below, a bebop habit that makes the chord change audible.' },
    { title: 'Bebop descent', plan: 'EEEEB', blurb: 'Start on the root an octave up and fall through 7‑5‑3, landing on the next chord’s tones.' },
  ],
  Rock: [
    { title: 'Pentatonic climb', plan: 'AAAAA', blurb: 'Four rising pentatonic notes per chord, played with hammer‑ons. Easy to fret and always sounds right.' },
    { title: 'Pull‑off cascade', plan: 'BBBBB', blurb: 'The same notes falling: pick the first, then pull off down the string for a fast, fluid run.' },
    { title: 'Call and response', plan: 'CEFBA', blurb: 'Zig‑zag shapes and a jump‑and‑fall figure keep the line from sounding like a scale exercise.' },
  ],
  NeoClassical: [
    { title: 'Arpeggio sweep', plan: 'ABABA', blurb: 'Sixteenth‑note arpeggios up and down. The direction flips with each chord, like a Baroque violin line.' },
    { title: 'Alberti figure', plan: 'CCCCC', blurb: 'Root – 5th – 3rd – 5th: the broken‑chord accompaniment of Mozart and Haydn, played at guitar speed.' },
    { title: 'Rising waves', plan: 'DEDED', blurb: 'Waves that crest and dip on each chord, a sequence that can be moved to any chord.' },
  ],
};

/* ------------------------------ generation ------------------------------ */

const rng = (seed: number) => () => {            // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MAJ_PENT = [0, 2, 4, 7, 9], MIN_PENT = [0, 3, 5, 7, 10];
const LOW = 45, HIGH = 79;

interface Ctx { scaleMap: Map<number, Pitch>; flat: boolean }

function realize(style: StyleId, chords: Chord[], plan: string[], ctx: Ctx): { midi: number; pitch: Pitch; chord: number }[] {
  const out: { midi: number; pitch: Pitch; chord: number }[] = [];
  let prev = 60;
  chords.forEach((c, ci) => {
    const items = POOLS[style][plan[ci % plan.length]];
    const stack = style === 'Rock' ? (c.offs[1] === 4 ? MAJ_PENT : MIN_PENT) : c.offs;
    const n = stack.length;
    const semi = (t: number) => stack[mod(t, n)] + 12 * Math.floor(t / n);
    const rel = items.map((it) => (typeof it === 'number' ? semi(it) : semi(it[0]) + it[1]));
    const chordMap = new Map(c.pcs.map((pc, k) => [pc, c.pitches[k]]));
    const r0 = 53 + mod(c.pcs[0] - 53, 12);
    let best = r0, bestCost = Infinity;
    for (const shift of [-12, 0, 12]) {
      const r = r0 + shift;
      const lo = r + Math.min(...rel), hi = r + Math.max(...rel);
      const cost = Math.abs(r + rel[0] - prev) + (lo < LOW ? 100 + (LOW - lo) : 0) + (hi > HIGH ? 100 + (hi - HIGH) : 0);
      if (cost < bestCost) { bestCost = cost; best = r; }
    }
    items.forEach((it, k) => {
      const midi = best + rel[k];
      const pure = typeof it === 'number' && style !== 'Rock';
      const pitch = (pure ? c.pitches[mod(it as number, n)] : undefined)
        ?? chordMap.get(mod(midi, 12)) ?? ctx.scaleMap.get(mod(midi, 12))
        ?? (() => { const sp = spellMidi(midi, ctx.flat); return { l: sp.l, acc: sp.acc }; })();
      out.push({ midi, pitch, chord: ci });
    });
    prev = best + rel[rel.length - 1];
  });
  return out;
}

/** Choose a string/fret for every note, keeping the hand in one place (dynamic programming). */
function fret(midis: number[], legato: boolean): { s: number; f: number }[] {
  const cands = midis.map((m) => STRINGS.map((st, s) => ({ s, f: m - st.midi })).filter((p) => p.f >= 0 && p.f <= 17));
  const cost: number[][] = [], back: number[][] = [];
  cands.forEach((cs, i) => {
    cost[i] = []; back[i] = [];
    cs.forEach((c, j) => {
      const own = (c.f > 12 ? 1 : 0) + (c.f > 14 ? 1 : 0);
      if (i === 0) { cost[i][j] = own + Math.abs(c.f - 5) * 0.3; back[i][j] = -1; return; }
      let bc = Infinity, bk = 0;
      cands[i - 1].forEach((p, k) => {
        let t = cost[i - 1][k] + Math.abs(c.f - p.f) + Math.abs(c.s - p.s) * 0.6;
        if (legato && c.s === p.s && Math.abs(c.f - p.f) <= 4 && c.f !== p.f) t -= 0.9;
        if (t < bc) { bc = t; bk = k; }
      });
      cost[i][j] = bc + own; back[i][j] = bk;
    });
  });
  const last = cost.length - 1;
  let j = cost[last].indexOf(Math.min(...cost[last]));
  const res: { s: number; f: number }[] = [];
  for (let i = last; i >= 0; i--) { res[i] = cands[i][j]; j = back[i][j]; }
  return res;
}

export function build(style: StyleId, root: Pitch, base: Base, title: string, blurb: string, plan: string[]): Lick {
  const scale = scaleNotes(root, base);
  const prog = PROGS[base].find((p) => p.style === style)!;
  const chords = prog.steps.map((s) => buildChord(scale, s, false));
  const flat = signatureCount(parentMajor(root, base)) < 0;
  const ctx: Ctx = { scaleMap: new Map(scale.map((n) => [n.pc, { l: n.l, acc: n.acc }])), flat };
  const raw = realize(style, chords, plan, ctx);
  const pos = fret(raw.map((r) => r.midi), style !== 'Jazz');
  const notes: LNote[] = raw.map((r, i) => {
    const wm = r.midi + WRITTEN_OFFSET;
    const oct = (wm - LETTER_PC[r.pitch.l] - r.pitch.acc) / 12 - 1;
    const p = pos[i], q = pos[i - 1];
    let tech: Tech;
    if (style !== 'Jazz' && q && q.s === p.s && q.f !== p.f) {
      const d = p.f - q.f;
      tech = Math.abs(d) <= 4 ? (d > 0 ? 'h' : 'p') : style === 'Rock' ? (d > 0 ? '/' : '\\') : undefined;
    }
    return { midi: r.midi, pitch: r.pitch, written: { l: r.pitch.l, acc: r.pitch.acc, oct }, s: p.s, f: p.f, tech, chord: r.chord };
  });
  return { title, blurb, notes, chords, dur: style === 'NeoClassical' ? 16 : 8 };
}

/* ------------------------------ notation ------------------------------ */

const SHARP_L = [3, 0, 4, 1, 5, 2, 6], SHARP_S = [38, 35, 39, 36, 33, 37, 34];
const FLAT_L = [6, 2, 5, 1, 4, 0, 3], FLAT_S = [34, 37, 33, 36, 32, 35, 31];
const W = 900, SP = 10, H = 5, PER = 4;

export function LickSheet({ lick, sigCount }: { lick: Lick; sigCount: number }) {
  const useSig = Math.abs(sigCount) <= 7;
  const nSig = useSig ? Math.abs(sigCount) : 0;
  const sharps = sigCount > 0;
  const implied = new Map<number, number>();
  for (let k = 0; k < nSig; k++) implied.set((sharps ? SHARP_L : FLAT_L)[k], sharps ? 1 : -1);

  const steps = lick.notes.map((n) => stepOf(n.written));
  const lo = Math.min(29, Math.min(...steps) - 1), hi = Math.max(41, Math.max(...steps) + 1);
  const staffTop = 50;
  const ys = (st: number) => staffTop + 8 + (hi - st) * H;
  const staffBottom = staffTop + 8 + (hi - lo) * H + 38;
  const tabTop = staffBottom + 20, TL = 11;
  const tabY = (s: number) => tabTop + (5 - s) * TL;
  const total = tabTop + 5 * TL + 18;

  const timeX = 92 + nSig * 11 + 14, x0 = timeX + 34, GAP = 10;
  const nC = lick.chords.length, N = lick.notes.length;
  const dx = Math.min(40, (W - 26 - x0 - nC * GAP) / N);
  const x = (i: number) => x0 + i * dx + Math.floor(i / PER) * GAP;
  const barEvery = lick.dur === 8 ? 2 : 4;

  const groups = lick.chords.map((_, g) => {
    const idx = Array.from({ length: PER }, (_, k) => g * PER + k);
    const avg = idx.reduce((a, i) => a + steps[i], 0) / PER;
    const down = avg >= 34;
    const heads = idx.map((i) => ys(steps[i]));
    const beamY = down ? Math.max(...heads) + SP * 3.3 : Math.min(...heads) - SP * 3.3;
    return { idx, down, beamY };
  });

  return (
    <svg viewBox={`0 0 ${W} ${total}`} className="lick-sheet" role="img" aria-label={`${lick.title}: notation and guitar tab`}>
      {/* staff */}
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={14} x2={W - 14} y1={ys(30 + i * 2)} y2={ys(30 + i * 2)} className="staff-line" />)}
      <line x1={14} x2={14} y1={ys(38)} y2={ys(30)} className="staff-line bar" />
      <text x={20} y={ys(32) + 3.5 * SP * 0.38} className="clef" style={{ fontSize: SP * 6.6 }}>𝄞</text>
      <text x={22} y={ys(38) - 12} className="inst-sub">8vb</text>
      {Array.from({ length: nSig }, (_, k) => (
        <text key={k} x={86 + k * 11} y={ys((sharps ? SHARP_S : FLAT_S)[k]) + 6} className="acc" textAnchor="middle" style={{ fontSize: 22 }}>{sharps ? '♯' : '♭'}</text>
      ))}
      <text x={timeX} y={ys(36) + 5} className="lick-time">4</text>
      <text x={timeX} y={ys(32) + 5} className="lick-time">4</text>

      {/* bar lines (staff + tab) */}
      {lick.chords.map((_, g) => {
        const last = g === nC - 1;
        if (!last && (g + 1) % barEvery !== 0) return null;
        const bx = last ? W - 18 : (x((g + 1) * PER - 1) + x((g + 1) * PER)) / 2;
        return (
          <g key={g}>
            <line x1={bx} x2={bx} y1={ys(38)} y2={ys(30)} className="staff-line bar" />
            <line x1={bx} x2={bx} y1={tabY(5)} y2={tabY(0)} className="staff-line bar" />
            {last && <line x1={bx + 4} x2={bx + 4} y1={ys(38)} y2={ys(30)} className="staff-line" />}
          </g>
        );
      })}

      {/* chord names */}
      {lick.chords.map((c, g) => (
        <text key={g} x={x(g * PER) - 8} y={22} className="lick-chord">{c.symbol}<tspan className="lick-roman" dx={6}>{c.roman}</tspan></text>
      ))}

      {/* notes with beams */}
      {groups.map(({ idx, down, beamY }, g) => (
        <g key={g} className="note selected">
          {idx.map((i) => {
            const n = lick.notes[i], st = steps[i], cy = ys(st), cx = x(i);
            const sx = down ? cx - 6 : cx + 6;
            const ledgers: number[] = [];
            if (st < 30) for (let s = 28; s >= st; s -= 2) ledgers.push(s);
            if (st > 38) for (let s = 40; s <= st; s += 2) ledgers.push(s);
            const imp = implied.get(n.written.l) ?? 0;
            const showAcc = useSig ? n.written.acc !== imp : n.written.acc !== 0;
            return (
              <g key={i}>
                {ledgers.map((s) => <line key={s} x1={cx - 13} x2={cx + 13} y1={ys(s)} y2={ys(s)} className="staff-line ledger" />)}
                {showAcc && <text x={cx - 17} y={cy + 5} className="acc" textAnchor="middle" style={{ fontSize: 20 }}>{n.written.acc === 0 ? '♮' : ACC_SYMBOL[n.written.acc]}</text>}
                <line x1={sx} x2={sx} y1={cy} y2={beamY} className="stem" />
                <ellipse cx={cx} cy={cy} rx="7" ry="5" transform={`rotate(-20 ${cx} ${cy})`} className="head" />
              </g>
            );
          })}
          {(() => {
            const xa = x(idx[0]) + (down ? -6 : 6), xb = x(idx[PER - 1]) + (down ? -6 : 6);
            const lines = lick.dur === 16 ? 2 : 1;
            return Array.from({ length: lines }, (_, k) => {
              const by = beamY + (down ? -k * 5 : k * 5);
              return <line key={k} x1={xa - 0.7} x2={xb + 0.7} y1={by} y2={by} className="lick-beam" />;
            });
          })()}
        </g>
      ))}

      {/* tab */}
      <text x={20} y={tabY(3) + 4} className="tab-word">T</text>
      <text x={20} y={tabY(2) + 4} className="tab-word">A</text>
      <text x={20} y={tabY(1) + 4} className="tab-word">B</text>
      {STRINGS.map((_, s) => <line key={s} x1={44} x2={W - 14} y1={tabY(s)} y2={tabY(s)} className="staff-line" />)}
      <line x1={44} x2={44} y1={tabY(5)} y2={tabY(0)} className="staff-line bar" />
      {lick.notes.map((n, i) => {
        const cx = x(i), cy = tabY(n.s);
        const q = lick.notes[i - 1];
        return (
          <g key={i}>
            {n.tech && q && q.s === n.s && (
              <text x={(x(i - 1) + cx) / 2} y={cy - 7} textAnchor="middle" className="lick-tech">{n.tech}</text>
            )}
            <rect x={cx - 8} y={cy - 7} width={16} height={14} rx={3} className="lick-fret-bg" />
            <text x={cx} y={cy + 4} textAnchor="middle" className="lick-fret">{n.f}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------ component ------------------------------ */

export default function Licks({ root, type }: { root: Pitch; type: ScaleType }) {
  const [style, setStyle] = useState<StyleId>('Jazz');
  const [seed, setSeed] = useState(1);
  const [withChords, setWithChords] = useState(true);

  const base: Base = type === 'majorPent' ? 'major' : type === 'minorPent' ? 'minor' : (type as Base);
  const sigCount = signatureCount(parentMajor(root, base));

  const licks = useMemo(() => {
    const presets = PRESETS[style].map((p) => build(style, root, base, p.title, p.blurb, p.plan.split('')));
    const r = rng(seed * 7919 + style.length);
    const keys = Object.keys(POOLS[style]);
    let last = '';
    const plan = Array.from({ length: 5 }, () => {
      let k = keys[Math.floor(r() * keys.length)];
      if (k === last) k = keys[(keys.indexOf(k) + 1) % keys.length];
      last = k; return k;
    });
    const mine = build(style, root, base, '🎲 Your variation', 'A new mix of figures from the same style, one per chord. Press the button for another.', plan);
    return { presets, mine };
  }, [style, root, base, seed]);

  const play = (l: Lick) => {
    const dt = l.dur === 16 ? 0.15 : 0.26;
    l.notes.forEach((n, i) => pluck(n.midi, i * dt, 1.1));
    if (withChords) l.chords.forEach((c, g) => { const v = findVoicings(c)[0]; if (v) strum(v, g * PER * dt); });
  };

  const prog = PROGS[base].find((p) => p.style === style)!;
  const chords = licks.presets[0].chords;

  return (
    <SpotlightCard className="card licks" spotlight="rgba(79,209,197,0.08)">
      <header className="card-head">
        <div>
          <p className="eyebrow">7 · Licks</p>
          <h2>Small licks over the {pitchName(root)} {SCALES[base].label.toLowerCase()} progressions</h2>
        </div>
        <div className="seg" role="radiogroup" aria-label="Style">
          {STYLES.map((s) => (
            <button key={s.id} className={style === s.id ? 'on' : ''} onClick={() => setStyle(s.id)}>{s.icon} {s.id}</button>
          ))}
        </div>
      </header>
      <p className="hint small">
        Each lick plays four notes over every chord of the <b>{style}</b> progression
        {' '}<span className="prog-romans">{chords.map((c) => c.symbol).join(' – ')}</span>
        {' '}({chords.map((c) => c.roman).join(' – ')}). Notation is written an octave above the sound, as for guitar. In the tab, numbers are frets;
        {' '}<b>h</b> hammer‑on, <b>p</b> pull‑off, <b>/</b> <b>\\</b> slide.
      </p>
      <div className="start-row">
        <label className="muted"><input type="checkbox" checked={withChords} onChange={(e) => setWithChords(e.target.checked)} /> play the chords underneath</label>
        <button className="pill accent" onClick={() => setSeed((s) => s + 1)}>🎲 New variation</button>
      </div>

      <div className="lick-list">
        {[...licks.presets, licks.mine].map((l, i) => (
          <div key={l.title + i} className={`lick ${i === 3 ? 'mine' : ''}`}>
            <div className="prog-head">
              <b>{i < 3 ? `${i + 1} · ` : ''}{l.title}</b>
              <span className="muted lick-blurb">{l.blurb}</span>
              <button className="pill accent" onClick={() => play(l)}>▶ Play</button>
            </div>
            <LickSheet lick={l} sigCount={sigCount} />
          </div>
        ))}
      </div>
      <p className="hint small">{prog.why}</p>
    </SpotlightCard>
  );
}
