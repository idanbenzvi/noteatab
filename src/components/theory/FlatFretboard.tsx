import { useState } from 'react';
import { STRINGS } from '../../lib/music';

export interface Mark {
  s: number; f: number;
  kind?: 'root' | 'scale' | 'sel' | 'alt' | 'good' | 'bad' | 'dim' | 'heat';
  label?: string;
  fill?: string;          // explicit colour for kind 'heat'
}
export interface Box { lo: number; hi: number; cls?: string }

interface Props {
  tuning?: number[];                 // sounding midi, low → high
  names?: string[];                  // string labels, low → high
  frets?: number;
  marks?: Mark[];
  boxes?: Box[];
  capo?: number;
  onCell?: (s: number, f: number) => void;
  hoverHint?: boolean;
  maxWidth?: number;
  caption?: string;
}
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

/** A flat, clickable guitar neck. Strings run low (bottom) to high (top); fret 0 is left of the nut. */
export default function FlatFretboard({ tuning = STRINGS.map((s) => s.midi), names, frets = 15, marks = [], boxes = [], capo = 0, onCell, maxWidth = 900, caption }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const n = tuning.length;
  const CW = Math.max(34, Math.min(66, 840 / (frets + 1))), RH = 30, X0 = 52, Y0 = 18;
  const W = X0 + (frets + 1) * CW + 10, Hh = Y0 + n * RH + 26;
  const cx = (f: number) => X0 + f * CW + CW / 2;
  const ry = (s: number) => Y0 + (n - 1 - s) * RH + RH / 2;
  const labels = names ?? tuning.map((m) => ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][m % 12]);
  const markAt = new Map(marks.map((m) => [`${m.s}:${m.f}`, m]));
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="picker flat-fb" style={{ maxWidth }} role={onCell ? 'group' : 'img'} aria-label={caption ?? 'Guitar fretboard'}>
      {Array.from({ length: frets + 1 }, (_, f) => (
        <text key={f} x={cx(f)} y={Hh - 7} textAnchor="middle" className="pk-fretnum">{f}</text>
      ))}
      <rect x={X0 + CW} y={Y0} width={frets * CW} height={n * RH} className="pk-board" />
      {boxes.map((b, i) => (
        <rect key={i} x={X0 + (b.lo) * CW + (b.lo === 0 ? CW * 0.15 : 0)} y={Y0 - 3} width={(b.hi - b.lo + 1) * CW - (b.lo === 0 ? CW * 0.15 : 0)} height={n * RH + 6} rx={8} className={`fb-box ${b.cls ?? ''}`} />
      ))}
      {INLAYS.filter((m) => m <= frets).map((m) => <circle key={m} cx={cx(m)} cy={Y0 + (n * RH) / 2} r={4} className="pk-mark" />)}
      {frets >= 12 && (
        <g><circle cx={cx(12)} cy={Y0 + n * RH * 0.32} r={4} className="pk-mark" /><circle cx={cx(12)} cy={Y0 + n * RH * 0.68} r={4} className="pk-mark" /></g>
      )}
      <line x1={X0 + CW} x2={X0 + CW} y1={Y0} y2={Y0 + n * RH} className="pk-nut" />
      {Array.from({ length: frets - 1 }, (_, i) => i + 2).map((f) => (
        <line key={f} x1={X0 + f * CW} x2={X0 + f * CW} y1={Y0} y2={Y0 + n * RH} className="pk-fret" />
      ))}
      {capo > 0 && <rect x={X0 + capo * CW + CW * 0.6} y={Y0 - 5} width={9} height={n * RH + 10} rx={3} className="fb-capo" />}
      {tuning.map((_, s) => (
        <g key={s}>
          <line x1={X0 + CW * 0.1} x2={W - 10} y1={ry(s)} y2={ry(s)} className="pk-string" style={{ strokeWidth: 0.8 + (n - 1 - s) * 0.18 }} />
          <text x={X0 - 14} y={ry(s) + 4} textAnchor="end" className="fb-strname">{labels[s]}</text>
        </g>
      ))}
      {Array.from({ length: n }, (_, s) => Array.from({ length: frets + 1 }, (_, f) => {
        const m = markAt.get(`${s}:${f}`);
        const hov = hover === `${s}:${f}` && onCell;
        return (
          <g key={`${s}-${f}`} className={onCell ? 'pk-cell' : ''}
            onMouseEnter={() => onCell && setHover(`${s}:${f}`)} onMouseLeave={() => setHover(null)}
            onClick={() => onCell?.(s, f)}>
            <rect x={X0 + f * CW} y={ry(s) - RH / 2} width={CW} height={RH} fill="transparent" />
            {(m || hov) && (
              <circle cx={cx(f)} cy={ry(s)} r={11.5} className={`fb-dot ${m?.kind ?? 'hov'} ${!m ? 'hov' : ''}`} style={m?.fill ? { fill: m.fill } : undefined} />
            )}
            {m?.label && <text x={cx(f)} y={ry(s) + 4} textAnchor="middle" className="fb-dotlabel">{m.label}</text>}
          </g>
        );
      }))}
    </svg>
  );
}
