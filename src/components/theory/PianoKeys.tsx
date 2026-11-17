import { mod } from '../../lib/music';

interface KeyMark { cls?: 'on' | 'on-b' | 'alt'; label?: string }
interface Props {
  from?: number; to?: number;               // midi range, should start/end on white keys
  marks?: Record<number, KeyMark>;
  onKey?: (midi: number) => void;
  showC?: boolean;
  caption?: string;
}
const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(mod(m, 12));

export default function PianoKeys({ from = 60, to = 83, marks = {}, onKey, showC = true, caption }: Props) {
  const KW = 34, KH = 120, BKH = 74, BW = 21, PAD = 6;
  const whites: number[] = [];
  for (let m = from; m <= to; m++) if (!isBlack(m)) whites.push(m);
  const wx = (m: number) => PAD + whites.indexOf(m) * KW;
  const W = PAD * 2 + whites.length * KW;
  const blacks: number[] = [];
  for (let m = from; m <= to; m++) if (isBlack(m) && whites.includes(m - 1) && whites.includes(m + 1)) blacks.push(m);
  return (
    <svg viewBox={`0 0 ${W} ${KH + 18}`} className="piano-keys" role="group" aria-label={caption ?? 'Piano keyboard'}>
      {whites.map((m) => (
        <g key={m} className="kb-key" onClick={() => onKey?.(m)}>
          <rect x={wx(m)} y={4} width={KW} height={KH} className={`kb-white ${marks[m]?.cls === 'on' ? 'on' : marks[m]?.cls === 'on-b' ? 'on-b' : marks[m]?.cls === 'alt' ? 'alt' : ''}`} />
          {marks[m]?.label && <text x={wx(m) + KW / 2} y={KH - 8} textAnchor="middle" className="kb-lab">{marks[m].label}</text>}
          {showC && mod(m, 12) === 0 && !marks[m]?.label && <text x={wx(m) + KW / 2} y={KH - 8} textAnchor="middle" className="kb-label">C{Math.floor(m / 12) - 1}</text>}
        </g>
      ))}
      {blacks.map((m) => (
        <g key={m} className="kb-key" onClick={() => onKey?.(m)}>
          <rect x={wx(m - 1) + KW - BW / 2} y={4} width={BW} height={BKH} rx={3} className={`kb-black ${marks[m]?.cls === 'on' ? 'on' : marks[m]?.cls === 'on-b' ? 'on-b' : marks[m]?.cls === 'alt' ? 'alt' : ''}`} />
          {marks[m]?.label && <text x={wx(m - 1) + KW} y={BKH - 8} textAnchor="middle" className="kb-lab-b">{marks[m].label}</text>}
        </g>
      ))}
    </svg>
  );
}
