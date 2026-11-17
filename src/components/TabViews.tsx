import { useState } from 'react';
import { NUM_FRETS, STRINGS, type FretPos } from '../lib/music';

const LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // top → bottom

/** A single fret number written on a six-line tab staff. */
export function TabQuestion({ pos }: { pos: FretPos }) {
  const row = 5 - pos.s; // string 1 (high e) on top
  const LH = 26, W = 420, H = LH * 5 + 40, x0 = 60;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tabview" role="img" aria-label={`Tab: string ${STRINGS[pos.s].label}, fret ${pos.f}`}>
      <text x={14} y={H / 2 - 6} className="tab-word">T</text>
      <text x={14} y={H / 2 + 12} className="tab-word">A</text>
      <text x={14} y={H / 2 + 30} className="tab-word">B</text>
      {LABELS.map((l, i) => <text key={i} x={44} y={20 + i * LH + 4} className="tab-str" textAnchor="end">{l}</text>)}
      {LABELS.map((_, i) => <line key={i} x1={x0} x2={W - 12} y1={20 + i * LH} y2={20 + i * LH} className="staff-line" />)}
      <line x1={x0} x2={x0} y1={20} y2={20 + 5 * LH} className="staff-line bar" />
      <rect x={W / 2 - 22} y={20 + row * LH - 13} width={44} height={26} rx={7} className="tab-fret-bg" />
      <text x={W / 2} y={20 + row * LH + 7} textAnchor="middle" className="tab-fret">{pos.f}</text>
    </svg>
  );
}

interface PickerProps {
  maxFret: number; strings: boolean[];
  interactive: boolean;
  picked?: FretPos | null; correct?: FretPos[];
  onPick?: (p: FretPos) => void;
}
const MARKS = [3, 5, 7, 9, 12, 15, 17, 19];

/** Flat clickable fretboard: choose the string and fret where the written note lives. */
export function FretPicker({ maxFret, strings, interactive, picked, correct = [], onPick }: PickerProps) {
  const [hover, setHover] = useState<FretPos | null>(null);
  const frets = Math.min(maxFret, NUM_FRETS);
  const CW = Math.max(34, Math.min(64, 760 / (frets + 1))), RH = 30, X0 = 44, Y0 = 26;
  const W = X0 + (frets + 1) * CW + 10, H = Y0 + 6 * RH + 26;
  const cx = (f: number) => X0 + f * CW + CW / 2;
  const ry = (row: number) => Y0 + row * RH + RH / 2;
  const isIn = (list: FretPos[], s: number, f: number) => list.some((p) => p.s === s && p.f === f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="picker" role="group" aria-label="Fretboard">
      {Array.from({ length: frets + 1 }, (_, f) => (
        <text key={f} x={cx(f)} y={H - 6} textAnchor="middle" className="pk-fretnum">{f}</text>
      ))}
      <rect x={X0 + CW} y={Y0} width={frets * CW} height={6 * RH} className="pk-board" />
      {MARKS.filter((m) => m <= frets).map((m) => m === 12
        ? <g key={m}><circle cx={cx(m)} cy={Y0 + 2 * RH} r={4} className="pk-mark" /><circle cx={cx(m)} cy={Y0 + 4 * RH} r={4} className="pk-mark" /></g>
        : <circle key={m} cx={cx(m)} cy={Y0 + 3 * RH} r={4} className="pk-mark" />)}
      {Array.from({ length: frets }, (_, i) => i + 2).map((f) => (
        <line key={f} x1={X0 + f * CW} x2={X0 + f * CW} y1={Y0} y2={Y0 + 6 * RH} className="pk-fret" />
      ))}
      <line x1={X0 + CW} x2={X0 + CW} y1={Y0} y2={Y0 + 6 * RH} className="pk-nut" />
      {LABELS.map((l, row) => {
        const s = 5 - row, on = strings[s];
        return (
          <g key={row} opacity={on ? 1 : 0.3}>
            <text x={X0 - 12} y={ry(row) + 4} textAnchor="end" className="tab-str">{l}</text>
            <line x1={X0 + 6} x2={W - 10} y1={ry(row)} y2={ry(row)} className="pk-string" style={{ strokeWidth: 0.8 + (s) * 0.35 }} />
          </g>
        );
      })}
      {LABELS.flatMap((_, row) => Array.from({ length: frets + 1 }, (_, f) => {
        const s = 5 - row;
        if (!strings[s]) return null;
        const good = isIn(correct, s, f), mine = picked && picked.s === s && picked.f === f;
        const hov = hover && hover.s === s && hover.f === f && interactive;
        return (
          <g key={`${s}-${f}`} onMouseEnter={() => setHover({ s, f })} onMouseLeave={() => setHover(null)}
            onClick={() => interactive && onPick?.({ s, f })} className={interactive ? 'pk-cell' : ''}>
            <rect x={cx(f) - CW / 2} y={Y0 + row * RH} width={CW} height={RH} fill="transparent" />
            {(good || mine || hov) && <circle cx={cx(f)} cy={ry(row)} r={11}
              className={good ? 'pk-dot good' : mine ? 'pk-dot bad' : 'pk-dot hov'} />}
          </g>
        );
      }))}
    </svg>
  );
}
