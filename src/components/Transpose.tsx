import { useState } from 'react';
import {
  ACC_SYMBOL, LETTERS, LETTER_PC, MAJOR_KEYS, mod, midiOf, noteFromStep, noteName, pcOf, pitchName,
  scaleNotes, spellMidi, stepOf, type Note, type Pitch,
} from '../lib/music';
import SpotlightCard from './reactbits/SpotlightCard';

/* How far ABOVE the sounding note each part is written. */
const PARTS = [
  { id: 'score', name: 'Concert score', sub: 'piano · flute read this as is', steps: 0, semis: 0 },
  { id: 'guitar', name: 'Guitar part', sub: 'up an octave', steps: 7, semis: 12 },
  { id: 'alto', name: 'Alto sax part', sub: 'up a major 6th', steps: 5, semis: 9 },
  { id: 'tenor', name: 'Tenor sax part', sub: 'up a major 9th', steps: 8, semis: 14 },
] as const;

const writtenOf = (c: Note, steps: number, semis: number): Note => {
  const base = noteFromStep(stepOf(c) + steps, 0);
  return { ...base, acc: midiOf(c) + semis - midiOf(base) };
};
const transposePitch = (p: Pitch, steps: number, semis: number): Pitch => {
  const l = (p.l + steps) % 7;
  return { l, acc: mod(pcOf(p) + semis - LETTER_PC[l] + 6, 12) - 6 };
};
const sigCount = (p: Pitch) => scaleNotes(p, 'major').reduce((n, x) => n + x.acc, 0);

// key signatures on the treble staff: letters in order, and the staff step each glyph sits on
const SHARP_L = [3, 0, 4, 1, 5, 2, 6], SHARP_S = [38, 35, 39, 36, 33, 37, 34];
const FLAT_L = [6, 2, 5, 1, 4, 0, 3], FLAT_S = [34, 37, 33, 36, 32, 35, 31];

const W = 700, SP = 10, H = SP / 2;
const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(mod(m, 12));

export default function Transpose({ midi, flat, keyIdx }: { midi: number; flat: boolean; keyIdx: number }) {
  const [which, setWhich] = useState<'alto' | 'tenor'>('alto');
  const part = PARTS.find((p) => p.id === which)!;

  /* ============ A · count the letters, then fix with semitones ============ */
  const concert = spellMidi(midi, flat);
  const written = writtenOf(concert, part.steps, part.semis);
  const target = midi + part.semis;
  const first = midi - mod(midi, 12);
  const last = target - mod(target, 12) + 12;
  const whites: number[] = [];
  for (let m = first; m <= last; m++) if (!isBlack(m)) whites.push(m);
  const KW = Math.min(30, 640 / whites.length);
  const KX0 = (W - KW * whites.length) / 2;
  const widx = (m: number) => whites.filter((w) => w < m).length;
  const kx = (m: number) => KX0 + widx(m) * KW + (isBlack(m) ? 0 : KW / 2);
  const KY = 84, KHT = 84, BK = 52;
  const letterSteps = Array.from({ length: part.steps + 1 }, (_, i) => stepOf(concert) + i);
  const letterKeys = letterSteps.map((s) => midiOf(noteFromStep(s, 0)));
  const letters = letterSteps.map((s) => LETTERS[mod(s, 7)]);
  const xa = kx(midi), xb = kx(target);
  const interval = part.id === 'alto' ? 'major 6th' : 'major 9th';

  /* ============ B · score → parts ============ */
  const root = MAJOR_KEYS[keyIdx];
  const root4: Note = { l: root.l, acc: root.acc, oct: 4 };
  const OFFS = [0, 2, 4, 5, 7, 9, 11, 12];
  const melody: Note[] = OFFS.map((o, i) => {
    const base = noteFromStep(stepOf(root4) + i, 0);
    return { ...base, acc: midiOf(root4) + o - midiOf(base) };
  });
  const padT = 12, padB = 12, GAP = 10, NX0 = 300, NDX = 44;
  const lay = PARTS.map((p) => {
    const notes = melody.map((n) => writtenOf(n, p.steps, p.semis));
    const key = transposePitch(root, p.steps, p.semis);
    const count = sigCount(key);
    const useSig = Math.abs(count) <= 7;
    let lo = 29, hi = 41;
    notes.forEach((n) => { lo = Math.min(lo, stepOf(n) - 1); hi = Math.max(hi, stepOf(n) + 1); });
    return { p, notes, key, count, useSig, lo, hi, h: padT + padB + (hi - lo) * H };
  });
  const tops: number[] = [];
  lay.reduce((t, r, i) => { tops[i] = t; return t + r.h + GAP; }, 0);
  const totalB = tops[tops.length - 1] + lay[lay.length - 1].h + 4;

  const staffHead = (n: Note, x: number, y: (s: number) => number, implied: number | null) => {
    const st = stepOf(n), cy = y(st), down = st >= 34;
    const ledgers: number[] = [];
    if (st < 30) for (let s = 28; s >= st; s -= 2) ledgers.push(s);
    if (st > 38) for (let s = 40; s <= st; s += 2) ledgers.push(s);
    const showAcc = implied === null ? n.acc !== 0 : n.acc !== implied;
    return (
      <g className="note selected">
        {ledgers.map((s) => <line key={s} x1={x - 13} x2={x + 13} y1={y(s)} y2={y(s)} className="staff-line ledger" />)}
        {showAcc && <text x={x - 19} y={cy + 5} className="acc" textAnchor="middle" style={{ fontSize: 20 }}>{n.acc === 0 ? '♮' : ACC_SYMBOL[n.acc]}</text>}
        <line x1={down ? x - 5.8 : x + 5.8} x2={down ? x - 5.8 : x + 5.8} y1={cy} y2={down ? cy + SP * 3.3 : cy - SP * 3.3} className="stem" />
        <ellipse cx={x} cy={cy} rx="7" ry="5" transform={`rotate(-20 ${x} ${cy})`} className="head" />
      </g>
    );
  };

  return (
    <SpotlightCard className="card" spotlight="rgba(255,122,89,0.08)">
      <p className="eyebrow">4 · How to transpose</p>
      <h2>From concert score to a player’s part</h2>

      {/* ---------- A ---------- */}
      <div className="tx-head">
        <h3>① Find one note: count letters, then check semitones</h3>
        <div className="seg" role="radiogroup" aria-label="Transposing instrument">
          <button className={which === 'alto' ? 'on' : ''} onClick={() => setWhich('alto')}>Alto · major 6th</button>
          <button className={which === 'tenor' ? 'on' : ''} onClick={() => setWhich('tenor')}>Tenor · major 9th</button>
        </div>
      </div>
      <p className="hint small">Uses the concert note picked on the keyboard above (<b>{noteName(concert, true)}</b>).</p>

      <svg viewBox={`0 0 ${W} ${KY + KHT + 44}`} className="tx-keys" role="img"
        aria-label={`${noteName(concert, true)} up a ${interval} is ${noteName(written, true)}`}>
        {/* arc */}
        <path d={`M ${xa} 40 C ${xa} 6, ${xb} 6, ${xb} 40`} className="tx-arc" />
        <polygon points={`${xb - 5},35 ${xb + 5},35 ${xb},44`} className="tx-arrow" />
        <text x={(xa + xb) / 2} y={14} textAnchor="middle" className="tx-arc-label">up a {interval} · {part.semis} semitones</text>

        {/* keyboard */}
        {whites.map((m) => (
          <rect key={m} x={KX0 + widx(m) * KW + 0.5} y={KY} width={KW - 1} height={KHT} rx={3}
            className={`kb-white ${m === midi ? 'on' : m === target ? 'on-b' : ''}`} />
        ))}
        {Array.from({ length: last - first + 1 }, (_, i) => first + i).filter(isBlack).map((m) => (
          <rect key={m} x={kx(m) - KW * 0.3} y={KY} width={KW * 0.6} height={BK} rx={2}
            className={`kb-black ${m === midi ? 'on' : m === target ? 'on-b' : ''}`} />
        ))}
        {whites.filter((m) => mod(m, 12) === 0).map((m) => (
          <text key={m} x={kx(m)} y={KY + KHT - 7} textAnchor="middle" className="kb-label">C{Math.floor(m / 12) - 1}</text>
        ))}

        {/* letter count */}
        {letterKeys.map((m, i) => (
          <g key={i}>
            <circle cx={kx(m)} cy={64} r={9} className={`tx-dot ${i === 0 ? 'a' : i === letterKeys.length - 1 ? 'b' : ''}`} />
            <text x={kx(m)} y={68} textAnchor="middle" className="tx-dot-n">{i + 1}</text>
          </g>
        ))}

        {/* semitone count */}
        <text x={KX0 - 4} y={KY + KHT + 18} textAnchor="end" className="inst-sub">semitones</text>
        {Array.from({ length: part.semis + 1 }, (_, i) => midi + i).map((m, i) => (
          <text key={m} x={kx(m)} y={KY + KHT + 18 + (isBlack(m) ? 12 : 0)} textAnchor="middle" className={`tx-semi ${isBlack(m) ? 'bk' : ''}`}>{i}</text>
        ))}
      </svg>

      <ol className="tx-steps">
        <li><b>Count letters</b> up from <b>{pitchName(concert)}</b>, counting the starting letter as 1:{' '}
          <span className="tx-letters">{letters.map((l, i) => <i key={i} className={i === 0 ? 'a' : i === letters.length - 1 ? 'b' : ''}>{l}</i>)}</span> → land on <b>{LETTERS[written.l]}</b>.</li>
        <li><b>Check the distance:</b> from {noteName(concert, true)}, {part.semis} semitones up sounds like <b>{noteName(spellMidi(target, written.acc < 0), true)}</b>.
          {written.acc === 0
            ? <> That is exactly {LETTERS[written.l]}, no accidental needed.</>
            : <> The letter {LETTERS[written.l]} on its own is one step off, so it gets a <b>{written.acc > 0 ? 'sharp' : 'flat'}</b> to match.</>}</li>
        <li><b>Result:</b> a concert <b>{noteName(concert, true)}</b> is written <b className="tx-result">{noteName(written, true)}</b> for {which} sax.</li>
      </ol>

      {/* ---------- B ---------- */}
      <h3 className="tx-h3">② Do it for every note: score in, parts out</h3>
      <p className="hint small">
        Here is the <b>{pitchName(root)} major</b> scale (the key picked in card 3) as it sits in the concert score, and the same scale written for each part.
        Each note moves up by the same interval, so the whole key signature moves with it.
      </p>

      <svg viewBox={`0 0 ${W} ${totalB}`} className="tx-score" role="img" aria-label="The concert score and the transposed parts">
        {lay.map(({ p, notes, key, count, useSig, lo, hi, h }, idx) => {
          const t = tops[idx];
          const y = (s: number) => t + padT + (hi - s) * H;
          const sigL = count > 0 ? SHARP_L : FLAT_L, sigS = count > 0 ? SHARP_S : FLAT_S;
          const sig = useSig ? Math.abs(count) : 0;
          const impliedMap = new Map<number, number>();
          for (let k = 0; k < sig; k++) impliedMap.set(sigL[k], count > 0 ? 1 : -1);
          return (
            <g key={p.id}>
              <rect x={0} y={t} width={W} height={h} rx={10} className="inst-row" />
              {idx > 0 && <text x={W - 16} y={t + 18} textAnchor="end" className="tx-delta">↑ {p.sub.replace('up ', '')}</text>}
              <text x={12} y={t + 22} className="inst-name">{p.name}</text>
              <text x={12} y={t + 38} className="inst-key">{pitchName(key)} major · {count === 0 ? 'no ♯ ♭' : `${Math.abs(count)}${count > 0 ? '♯' : '♭'}`}</text>
              <text x={12} y={t + 54} className="inst-sub">{p.sub}</text>
              {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={150} x2={W - 14} y1={y(30 + k * 2)} y2={y(30 + k * 2)} className="staff-line" />)}
              <line x1={150} x2={150} y1={y(38)} y2={y(30)} className="staff-line bar" />
              <text x={156} y={y(32) + 3.5 * SP * 0.38} className="clef" style={{ fontSize: SP * 6.6 }}>𝄞</text>
              {Array.from({ length: sig }, (_, k) => (
                <text key={k} x={198 + k * 11} y={y(sigS[k]) + 6} className="acc" textAnchor="middle" style={{ fontSize: 22 }}>{count > 0 ? '♯' : '♭'}</text>
              ))}
              {!useSig && <text x={198} y={t + h - 6} className="inst-sub">key too exotic to print: accidentals written note by note</text>}
              {notes.map((n, i) => <g key={i}>{staffHead(n, NX0 + i * NDX, y, useSig ? impliedMap.get(n.l) ?? 0 : null)}</g>)}
            </g>
          );
        })}
      </svg>
      <p className="hint small">That is the whole job of a copyist: <b>keep one concert score</b>, then run every note, and the key signature, through each instrument’s interval to print <b>a part per player</b>. Everyone reads a different page, and the room hears one tune.</p>
    </SpotlightCard>
  );
}
