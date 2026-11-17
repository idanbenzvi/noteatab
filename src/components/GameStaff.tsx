import { useState } from 'react';
import { ACC_SYMBOL, noteFromStep, stepOf, noteName, type Note } from '../lib/music';

interface Props {
  question?: Note | null;     // the note being shown (staff → tab mode)
  answer?: Note | null;       // the correct note, revealed after answering
  guess?: Note | null;        // what the player chose (when wrong)
  acc: number;                // accidental applied to the next click
  interactive: boolean;
  onPick?: (n: Note) => void;
}

const LO = 21, HI = 49, BOTTOM = 30, SP = 16, H = SP / 2, W = 640, PAD = 28;
const NX = 400;
const y = (step: number) => PAD + (HI - step) * H;
const HEIGHT = PAD * 2 + (HI - LO) * H;

export default function GameStaff({ question, answer, guess, acc, interactive, onPick }: Props) {
  const [ghost, setGhost] = useState<Note | null>(null);

  // Pointer height → note. Naturals: one note per staff line/space. With ♯/♭ armed the pointer
  // walks the full chromatic scale: each line/space is split in two, and the half toward the
  // neighbouring letter holds the sharp (upper half) or flat (lower half) where one exists.
  const HAS_SHARP = [true, true, false, true, true, true, false]; // C D E F G A B
  const HAS_FLAT = [false, true, true, false, true, true, true];
  const noteAt = (e: React.MouseEvent<SVGRectElement>): Note => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const exact = HI - ((e.clientY - r.top) * (HEIGHT / r.height) - PAD) / H;
    const step = Math.max(LO, Math.min(HI, Math.round(exact)));
    const n = noteFromStep(step, 0);
    const upper = exact > step;
    if (acc === 1 && upper && HAS_SHARP[n.l]) n.acc = 1;
    if (acc === -1 && !upper && HAS_FLAT[n.l]) n.acc = -1;
    return n;
  };

  const ledgers = (step: number, x: number) => {
    const out: number[] = [];
    if (step < BOTTOM) for (let s = 28; s >= step; s -= 2) out.push(s);
    if (step > 38) for (let s = 40; s <= step; s += 2) out.push(s);
    return out.map((s) => <line key={s} x1={x - 19} x2={x + 19} y1={y(s)} y2={y(s)} className="staff-line ledger" />);
  };
  const head = (n: Note, x: number, cls: string, label?: string) => {
    const st = stepOf(n), cy = y(st), down = st >= 34;
    return (
      <g className={cls}>
        {ledgers(st, x)}
        {n.acc !== 0 && <text x={x - 27} y={cy + 7} className="acc" textAnchor="middle" style={{ fontSize: 28 }}>{ACC_SYMBOL[n.acc]}</text>}
        <line x1={down ? x - 8.2 : x + 8.2} x2={down ? x - 8.2 : x + 8.2} y1={cy} y2={down ? cy + SP * 3.3 : cy - SP * 3.3} className="stem" />
        <ellipse cx={x} cy={cy} rx="9.8" ry="7" transform={`rotate(-20 ${x} ${cy})`} className="head" />
        {label && <text x={x} y={down ? cy - 20 : cy + 32} textAnchor="middle" className="head-label">{label}</text>}
      </g>
    );
  };

  const wrong = guess && answer && (stepOf(guess) !== stepOf(answer) || guess.acc !== answer.acc);
  return (
    <svg viewBox={`0 0 ${W} ${HEIGHT}`} className={`staff game-staff ${interactive ? 'live' : ''}`} role="group" aria-label="Treble clef staff">
      {interactive && (
        <rect x={0} y={y(HI) - H} width={W} height={HEIGHT - PAD * 2 + H * 2} className="band"
          onMouseMove={(e) => setGhost(noteAt(e))} onMouseLeave={() => setGhost(null)}
          onClick={(e) => onPick?.(noteAt(e))} />
      )}
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={14} x2={W - 14} y1={y(30 + i * 2)} y2={y(30 + i * 2)} className="staff-line" />)}
      <line x1={14} x2={14} y1={y(38)} y2={y(30)} className="staff-line bar" />
      <text x={30} y={y(32) + 3.5 * SP * 0.38} className="clef" style={{ fontSize: SP * 6.6 }}>𝄞</text>

      {question && head(question, NX, 'note selected')}
      {interactive && ghost !== null && head(ghost, NX, 'note ghost')}
      {wrong && guess && head(guess, NX - 110, 'note miss', `you: ${noteName(guess, true)}`)}
      {answer && head(answer, NX, 'note hit', noteName(answer, true))}
    </svg>
  );
}
