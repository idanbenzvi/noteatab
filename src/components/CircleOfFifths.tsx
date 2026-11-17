import { useMemo } from 'react';
import {
  MAJOR_KEYS, MINOR_KEYS, KEY_SIGS, pitchName, pcOf, circlePos, scaleNotes, SCALES,
  type Pitch, type ScaleType,
} from '../lib/music';

interface Props { root: Pitch; type: ScaleType; onPick: (root: Pitch, ring: 'major' | 'minor') => void }

const C = 250, R_OUT = 230, R_MID = 168, R_IN = 112, R_CORE = 62;
const ang = (i: number) => ((i * 30 - 90) * Math.PI) / 180;
// round so server (Node) and browser produce identical strings; avoids hydration mismatches
const rd = (n: number) => Math.round(n * 100) / 100;
const pt = (r: number, i: number): [number, number] => [rd(C + r * Math.cos(ang(i))), rd(C + r * Math.sin(ang(i)))];

function wedge(i: number, r1: number, r2: number) {
  const a0 = ang(i) - Math.PI / 12 + 0.006, a1 = ang(i) + Math.PI / 12 - 0.006;
  const p = (r: number, a: number) => `${rd(C + r * Math.cos(a))} ${rd(C + r * Math.sin(a))}`;
  return `M ${p(r2, a0)} A ${r2} ${r2} 0 0 1 ${p(r2, a1)} L ${p(r1, a1)} A ${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
}

export default function CircleOfFifths({ root, type, onPick }: Props) {
  const notes = useMemo(() => scaleNotes(root, type), [root, type]);
  const rootPos = circlePos(pcOf(root));
  const family = SCALES[type].family;

  // polygon joining scale tones around the core
  const sorted = [...notes].sort((a, b) => circlePos(a.pc) - circlePos(b.pc));
  const polySorted = sorted.map((n) => pt(R_CORE - 8, circlePos(n.pc)).join(',')).join(' ');

  const ring = (keys: Pitch[], r1: number, r2: number, kind: 'major' | 'minor') =>
    keys.map((k, i) => {
      const pc = pcOf(k);
      const lit = notes.some((n) => n.pc === pc);
      const isRoot = pc === pcOf(root) && kind === family;
      const [tx, ty] = pt((r1 + r2) / 2, i);
      const id = `${kind}${i}`;
      return (
        <g key={id} className={`cof-seg ${lit ? 'lit' : ''} ${isRoot ? 'root' : ''} ${kind}`}
           onClick={() => onPick(k, kind)} role="button" tabIndex={0}
           onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(k, kind)}
           aria-label={`${pitchName(k)} ${kind}`}>
          <path d={wedge(i, r1, r2)} />
          <text x={tx} y={ty - (kind === 'major' ? 3 : 2)} className={kind === 'major' ? 'cof-major' : 'cof-minor'}>
            {pitchName(k)}{kind === 'minor' ? 'm' : ''}
          </text>
          {kind === 'major' && <text x={tx} y={ty + 17} className="cof-sig">{KEY_SIGS[i]}</text>}
        </g>
      );
    });

  const [ax, ay] = pt(R_OUT + 14, rootPos);
  return (
    <svg viewBox="0 0 500 500" className="cof" role="group" aria-label="Circle of fifths">
      <defs>
        <radialGradient id="cofGlow"><stop offset="0" stopColor="#f2b84b" stopOpacity=".35" /><stop offset="1" stopColor="#f2b84b" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R_OUT + 10} className="cof-halo" />
      {ring(MAJOR_KEYS, R_MID + 2, R_OUT, 'major')}
      {ring(MINOR_KEYS, R_IN + 2, R_MID - 2, 'minor')}
      {/* pitch-class dots on the core: where the scale's notes sit on the circle */}
      <circle cx={C} cy={C} r={R_CORE} className="cof-core" />
      <polygon points={polySorted} className="cof-poly" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x, y] = pt(R_CORE - 8, i);
        const n = notes.find((nn) => circlePos(nn.pc) === i);
        return <circle key={i} cx={x} cy={y} r={n ? (n.isRoot ? 6 : 4.5) : 2} className={n ? (n.isRoot ? 'cd root' : 'cd on') : 'cd'} />;
      })}
      <text x={C} y={C - 4} className="cof-center">{pitchName(root)}</text>
      <text x={C} y={C + 16} className="cof-center-sub">{SCALES[type].label.toLowerCase()}</text>
      <circle cx={ax} cy={ay} r="4" className="cof-pointer" />
    </svg>
  );
}
