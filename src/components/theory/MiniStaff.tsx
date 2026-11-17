import { useState } from 'react';
import { ACC_SYMBOL, LETTER_PC, noteFromStep, noteName, stepOf, type Note } from '../../lib/music';
import {
  FLAT_ORDER, FLAT_STEPS_BASS, FLAT_STEPS_TREBLE, SHARP_ORDER, SHARP_STEPS_BASS, SHARP_STEPS_TREBLE,
} from '../../lib/theory';

export type Clef = 'treble' | 'bass';
export interface StaffNote {
  n: Note;
  cls?: 'sel' | 'hit' | 'miss' | 'ghost' | 'dim' | 'alt';
  label?: string;           // text under (or above) the note
  stack?: boolean;          // draw at the same x as the previous note (chords / intervals)
  filled?: boolean;         // default true; false draws a whole/half style open head
  stem?: boolean;           // default true
  hideAcc?: boolean;
}
interface Props {
  clef?: Clef;
  keySig?: number;           // +sharps / -flats drawn after the clef
  timeSig?: [number, number];
  notes?: StaffNote[];
  width?: number;
  gap?: number;              // horizontal distance between notes
  sp?: number;               // staff space in px
  names?: boolean;           // letter names under each note
  /** A fixed vertical window (in diatonic steps) so the SVG never resizes while notes change. */
  window?: [number, number];
  onPickStep?: (step: number) => void;
  caption?: string;
  className?: string;
}

const BOTTOM: Record<Clef, number> = { treble: 30, bass: 18 };

/** Which accidental a key signature implies for a letter (+1 sharp, -1 flat, 0 none). */
export function sigAcc(keySig: number, letter: number): number {
  if (keySig > 0 && SHARP_ORDER.slice(0, keySig).includes(letter)) return 1;
  if (keySig < 0 && FLAT_ORDER.slice(0, -keySig).includes(letter)) return -1;
  return 0;
}

export function MiniStaff({ clef = 'treble', keySig = 0, timeSig, notes = [], width = 640, gap = 62, sp = 12, names = false, window: win, onPickStep, caption, className = '' }: Props) {
  const [ghost, setGhost] = useState<number | null>(null);
  const H = sp / 2;
  const bottom = BOTTOM[clef];
  const top = bottom + 8;
  const steps = notes.map((x) => stepOf(x.n));
  // labels hang below up-stem notes (and above down-stem ones), so reserve room for them
  const lowRoom = notes.map((nt, i) => steps[i] - (nt.label && steps[i] < bottom + 4 ? 5 : 2));
  const highRoom = notes.map((nt, i) => steps[i] + (nt.label && steps[i] >= bottom + 4 ? 4 : 2));
  const lo = Math.min(bottom - 3, ...(win ? [win[0]] : []), ...lowRoom);
  const hi = Math.max(top + 3, ...(win ? [win[1]] : []), ...highRoom);
  const padT = 14, padB = names ? 34 : 14;
  const y = (s: number) => padT + (hi - s) * H;
  const height = padT + padB + (hi - lo) * H;

  // horizontal layout
  const clefW = 52;
  const sigGlyphs = Math.abs(keySig);
  const sigX0 = 16 + clefW;
  const tsX = sigX0 + sigGlyphs * (sp * 0.95) + (sigGlyphs ? 10 : 0);
  const noteX0 = tsX + (timeSig ? 40 : 6) + 34;
  const xs: number[] = [];
  let cur = noteX0 - gap;
  notes.forEach((nt, i) => { if (!nt.stack || i === 0) cur += gap; xs.push(cur); });

  const sigSteps = clef === 'treble'
    ? (keySig >= 0 ? SHARP_STEPS_TREBLE : FLAT_STEPS_TREBLE)
    : (keySig >= 0 ? SHARP_STEPS_BASS : FLAT_STEPS_BASS);

  const ledgers = (s: number, x: number) => {
    const out: number[] = [];
    if (s < bottom) for (let l = bottom - 2; l >= s; l -= 2) out.push(l);
    if (s > top) for (let l = top + 2; l <= s; l += 2) out.push(l);
    return out.map((l) => <line key={l} x1={x - sp * 1.15} x2={x + sp * 1.15} y1={y(l)} y2={y(l)} className="staff-line ledger" />);
  };

  const pickStep = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const vy = (e.clientY - r.top) * (height / r.height);
    return Math.round(hi - (vy - padT) / H);
  };

  // adjacent-step notes in a chord need their heads nudged apart
  const nudge = (i: number) => {
    const nt = notes[i];
    if (!nt.stack || i === 0) return 0;
    return Math.abs(steps[i] - steps[i - 1]) === 1 ? sp * 1.35 : 0;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`staff mini-staff ${className}`} role="img" aria-label={caption ?? `${clef} clef staff`}>
      {onPickStep && Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((s) => (
        <rect key={s} x={0} y={y(s) - H} width={width} height={H + 0.5} className="band"
          onMouseEnter={() => setGhost(s)} onMouseLeave={() => setGhost(null)} onClick={() => onPickStep(s)} />
      ))}
      {[0, 2, 4, 6, 8].map((o) => <line key={o} x1={12} x2={width - 12} y1={y(bottom + o)} y2={y(bottom + o)} className="staff-line" />)}
      <line x1={12} x2={12} y1={y(top)} y2={y(bottom)} className="staff-line bar" />
      {clef === 'treble'
        ? <text x={22} y={y(bottom + 2) + sp * 0.62} className="clef" style={{ fontSize: sp * 6.4 }}>𝄞</text>
        : <text x={22} y={y(bottom + 6) + sp * 0.05} className="clef" style={{ fontSize: sp * 4.4 }}>𝄢</text>}
      {sigGlyphs > 0 && Array.from({ length: sigGlyphs }, (_, i) => (
        <text key={i} x={sigX0 + i * (sp * 0.95)} y={y(sigSteps[i]) + sp * 0.5} className="acc" style={{ fontSize: sp * 2.2 }}>{keySig > 0 ? '♯' : '♭'}</text>
      ))}
      {timeSig && (
        <g className="timesig">
          <text x={tsX + 14} y={y(top) + H * 3.1} textAnchor="middle" style={{ fontSize: sp * 2.9 }}>{timeSig[0]}</text>
          <text x={tsX + 14} y={y(bottom) - H * 1.1} textAnchor="middle" style={{ fontSize: sp * 2.9 }}>{timeSig[1]}</text>
        </g>
      )}

      {ghost !== null && onPickStep && (
        <g className="note ghost">{ledgers(ghost, noteX0 + gap * 0)}<ellipse cx={noteX0} cy={y(ghost)} rx={sp * 0.74} ry={sp * 0.53} transform={`rotate(-20 ${noteX0} ${y(ghost)})`} className="head" /></g>
      )}

      {notes.map((nt, i) => {
        const s = steps[i], cx = xs[i] + nudge(i), cy = y(s);
        const down = s >= bottom + 4;
        const filled = nt.filled !== false;
        const showAcc = !nt.hideAcc && nt.n.acc !== sigAcc(keySig, nt.n.l);
        const accSym = nt.n.acc === 0 ? '♮' : ACC_SYMBOL[nt.n.acc];
        return (
          <g key={i} className={`note ${nt.cls ?? ''}`}>
            {ledgers(s, cx)}
            {showAcc && <text x={cx - sp * 1.9} y={cy + sp * 0.45} className="acc" textAnchor="middle" style={{ fontSize: sp * 2 }}>{accSym}</text>}
            {nt.stem !== false && (
              <line x1={down ? cx - sp * 0.72 : cx + sp * 0.72} x2={down ? cx - sp * 0.72 : cx + sp * 0.72}
                y1={cy} y2={down ? cy + sp * 3.3 : cy - sp * 3.3} className="stem" />
            )}
            <ellipse cx={cx} cy={cy} rx={sp * 0.74} ry={sp * 0.53} transform={`rotate(-20 ${cx} ${cy})`}
              className={filled ? 'head' : 'head open'} />
            {nt.label && <text x={cx} y={down ? cy - sp * 1.6 : cy + sp * 2.5} textAnchor="middle" className="head-label" style={{ fontSize: sp * 1.1 }}>{nt.label}</text>}
            {names && <text x={cx} y={y(lo) + sp * 2.2} textAnchor="middle" className="nm">{noteName(nt.n)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Piano-style grand staff: treble on top, bass below, sharing a left brace. Notes are drawn on whichever staff(s) you pass. */
export function GrandStaff({ trebleNotes = [], bassNotes = [], keySig = 0, width = 640, sp = 11, gap = 70, onPick }: {
  trebleNotes?: StaffNote[]; bassNotes?: StaffNote[]; keySig?: number; width?: number; sp?: number; gap?: number;
  onPick?: (clef: Clef, step: number) => void;
}) {
  return (
    <div className="grand">
      <MiniStaff clef="treble" keySig={keySig} notes={trebleNotes} width={width} sp={sp} gap={gap} window={[19, 41]}
        onPickStep={onPick ? (s) => onPick('treble', s) : undefined} caption="Treble staff" />
      <MiniStaff clef="bass" keySig={keySig} notes={bassNotes} width={width} sp={sp} gap={gap} window={[17, 33]}
        onPickStep={onPick ? (s) => onPick('bass', s) : undefined} caption="Bass staff" />
    </div>
  );
}

export const naturalAt = (step: number): Note => noteFromStep(step, 0);
export const letterPc = (l: number) => LETTER_PC[l];
