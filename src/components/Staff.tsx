import { useMemo, useRef, useState } from 'react';
import {
  ACC_SYMBOL, noteName, scaleAscending, stepOf, midiOf, noteFromStep, scaleNotes,
  type Note, type Pitch, type ScaleType, MIN_WRITTEN, MAX_WRITTEN,
} from '../lib/music';

export type AccMode = 'auto' | 0 | 1 | -1;
interface Props {
  root: Pitch; type: ScaleType; selected: Note; accMode: AccMode;
  onSelect: (n: Note) => void;
}

const SP = 14, H = SP / 2, W = 760, BOTTOM_STEP = 30; // E4 = bottom line
const NOTE_X0 = 150, NOTE_DX = 58, PICK_X = 690;

export default function Staff({ root, type, selected, accMode, onSelect }: Props) {
  const [ghost, setGhost] = useState<number | null>(null);
  const asc = useMemo(() => scaleAscending(root, type), [root, type]);
  // The staff's vertical extent only ever grows while the scale stays the same, so stepping the
  // selected note (e.g. while the scale plays) never resizes the SVG and shifts the page layout.
  const ext = useRef<{ key: typeof asc; lo: number; hi: number } | null>(null);
  if (!ext.current || ext.current.key !== asc) {
    ext.current = {
      key: asc,
      lo: Math.min(24, ...asc.map((a) => stepOf(a.note) - 3)),
      hi: Math.max(42, ...asc.map((a) => stepOf(a.note) + 3)),
    };
  }
  ext.current.lo = Math.min(ext.current.lo, stepOf(selected) - 3);
  ext.current.hi = Math.max(ext.current.hi, stepOf(selected) + 3);
  const { lo, hi } = ext.current;
  const yBottom = (hi - BOTTOM_STEP) * H + 20;           // y of E4 line
  const height = (hi - lo) * H + 90;
  const y = (step: number) => yBottom - (step - BOTTOM_STEP) * H;
  const scaleN = useMemo(() => scaleNotes(root, type), [root, type]);

  const noteForStep = (step: number): Note => {
    let acc = 0;
    if (accMode === 'auto') acc = scaleN.find((n) => n.l === ((step % 7) + 7) % 7)?.acc ?? 0;
    else acc = accMode;
    let n = noteFromStep(step, acc);
    if (midiOf(n) < MIN_WRITTEN || midiOf(n) > MAX_WRITTEN) n = noteFromStep(step, 0);
    return n;
  };

  const ledgers = (step: number, x: number) => {
    const out: number[] = [];
    if (step < BOTTOM_STEP) for (let s = 28; s >= step; s -= 2) out.push(s);
    if (step > 38) for (let s = 40; s <= step; s += 2) out.push(s);
    return out.map((s) => <line key={s} x1={x - 16} x2={x + 16} y1={y(s)} y2={y(s)} className="staff-line ledger" />);
  };

  const head = (n: Note, x: number, cls: string, label?: string) => {
    const st = stepOf(n), cy = y(st), down = st >= 34;
    return (
      <g className={cls}>
        {ledgers(st, x)}
        {n.acc !== 0 && <text x={x - 24} y={cy + 6} className="acc" textAnchor="middle">{ACC_SYMBOL[n.acc]}</text>}
        <line x1={down ? x - 7.2 : x + 7.2} x2={down ? x - 7.2 : x + 7.2} y1={cy} y2={down ? cy + SP * 3.3 : cy - SP * 3.3} className="stem" />
        <ellipse cx={x} cy={cy} rx="8.6" ry="6.2" transform={`rotate(-20 ${x} ${cy})`} className="head" />
        {label && <text x={x} y={down ? cy - 16 : cy + 28} textAnchor="middle" className="head-label">{label}</text>}
      </g>
    );
  };

  const selStep = stepOf(selected);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="staff" role="group" aria-label="Treble clef staff">
      {/* click bands: every line and space */}
      {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((s) => (
        <rect key={s} x={0} y={y(s) - H} width={W} height={SP / 2 + 0.5} className="band"
          onMouseEnter={() => setGhost(s)} onMouseLeave={() => setGhost(null)}
          onClick={() => onSelect(noteForStep(s))} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={16} x2={W - 16} y1={y(30 + i * 2)} y2={y(30 + i * 2)} className="staff-line" />)}
      <line x1={16} x2={16} y1={y(38)} y2={y(30)} className="staff-line bar" />
      <text x={30} y={y(32) + 3.5 * SP * 0.38} className="clef" style={{ fontSize: SP * 6.6 }}>𝄞</text>
      <text x={34} y={y(38) - 20} className="clef-hint">8 ↓ sounds an octave lower on guitar</text>

      {asc.map(({ note, degree }, i) => {
        const x = NOTE_X0 + i * NOTE_DX;
        const on = midiOf(note) === midiOf(selected);
        return (
          <g key={i} className="scale-note" onClick={() => onSelect(note)} role="button" tabIndex={0}>
            <rect x={x - 28} y={y(hi) } width={56} height={height} fill="transparent" />
            {head(note, x, on ? 'note on' : 'note', undefined)}
            <text x={x} y={y(lo) + 26} textAnchor="middle" className="deg">{degree}</text>
            <text x={x} y={y(lo) + 42} textAnchor="middle" className="nm">{noteName(note)}</text>
          </g>
        );
      })}

      <line x1={PICK_X - 44} x2={PICK_X - 44} y1={y(hi) + 6} y2={y(lo) - 6} className="pick-div" />
      {ghost !== null && ghost !== selStep && head(noteForStep(ghost), PICK_X, 'note ghost')}
      {head(selected, PICK_X, 'note selected', `${noteName(selected, true)}`)}
      <text x={PICK_X} y={y(hi) + 4} textAnchor="middle" className="pick-title">YOUR NOTE</text>
    </svg>
  );
}
