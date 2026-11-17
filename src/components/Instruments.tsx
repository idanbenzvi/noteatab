import { useState } from 'react';
import {
  ACC_SYMBOL, LETTER_PC, MAJOR_KEYS, mod, midiOf, noteFromStep, noteName, pcOf, pitchName,
  scaleNotes, spellMidi, stepOf, type Note, type Pitch,
} from '../lib/music';
import { piano, pluck } from '../lib/audio';
import SpotlightCard from './reactbits/SpotlightCard';
import Transpose from './Transpose';

/**
 * How instruments are written relative to how they sound.
 * steps/semis = how far ABOVE the sounding (concert) pitch the written note sits.
 * range       = sounding (concert) MIDI range of the instrument.
 */
interface Inst {
  id: string; name: string; in: string; steps: number; semis: number; range: [number, number];
  relation: string; short: string;
}
const INSTS: Inst[] = [
  { id: 'piano', name: 'Piano', in: 'in C', steps: 0, semis: 0, range: [21, 108], relation: 'written = sounding', short: 'no transposition' },
  { id: 'flute', name: 'Flute', in: 'in C', steps: 0, semis: 0, range: [59, 96], relation: 'written = sounding', short: 'no transposition' },
  { id: 'guitar', name: 'Guitar', in: 'octave', steps: 7, semis: 12, range: [40, 83], relation: 'sounds an octave lower', short: 'written 8va' },
  { id: 'alto', name: 'Alto sax', in: 'in E♭', steps: 5, semis: 9, range: [49, 81], relation: 'sounds a major 6th lower', short: 'written +M6' },
  { id: 'tenor', name: 'Tenor sax', in: 'in B♭', steps: 8, semis: 14, range: [44, 76], relation: 'sounds a major 9th lower', short: 'written +M9' },
];

const LO = 55, HI = 79;                 // selectable concert pitches: G3 … G5
const KW = 30, KX0 = 215, KH = 96, BKH = 58;
const W = 700, SP = 10, H = SP / 2;
const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(mod(m, 12));

const whitesBelow = (m: number) => { let n = 0; for (let k = LO; k < m; k++) if (!isBlack(k)) n++; return n; };
const keyX = (m: number) => KX0 + whitesBelow(m) * KW + (isBlack(m) ? 0 : KW / 2);

const writtenOf = (c: Note, i: Inst): Note => {
  const base = noteFromStep(stepOf(c) + i.steps, 0);
  return { ...base, acc: midiOf(c) + i.semis - midiOf(base) };
};
const transposePitch = (p: Pitch, i: Inst): Pitch => {
  const l = (p.l + i.steps) % 7;
  return { l, acc: mod(pcOf(p) + i.semis - LETTER_PC[l] + 6, 12) - 6 };
};
const sigCount = (p: Pitch) => scaleNotes(p, 'major').reduce((n, x) => n + x.acc, 0);
const sigText = (c: number) => (c === 0 ? 'no ♯ or ♭' : `${Math.abs(c)}${c > 0 ? '♯' : '♭'}`);

// Vertical window each staff needs so that every selectable note fits without resizing.
const windows = INSTS.map((i) => {
  let lo = 29, hi = 39;
  for (let m = LO; m <= HI; m++) {
    const s = stepOf(writtenOf(spellMidi(m), i));
    lo = Math.min(lo, s - 1); hi = Math.max(hi, s + 1);
  }
  return { lo, hi };
});

const midiName = (m: number, flat: boolean) => noteName(spellMidi(m, flat), true);

export default function Instruments() {
  const [midi, setMidi] = useState(60);        // concert pitch, C4 = middle C
  const [flat, setFlat] = useState(false);
  const [keyIdx, setKeyIdx] = useState(0);

  const concert = spellMidi(midi, flat);
  const hz = 440 * Math.pow(2, (midi - 69) / 12);

  /* ----- layout ----- */
  const padT = 14, padB = 12, GAP = 10;
  const rows = INSTS.map((_, i) => {
    const { lo, hi } = windows[i];
    return { lo, hi, h: padT + padB + (hi - lo) * H };
  });
  const top0 = KH + 56;
  const tops: number[] = [];
  rows.reduce((t, r, i) => { tops[i] = t; return t + r.h + GAP; }, top0);
  const totalH = tops[tops.length - 1] + rows[rows.length - 1].h + 6;

  const pickWritten = (i: number, e: React.MouseEvent<SVGRectElement>) => {
    const inst = INSTS[i];
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const vy = (e.clientY - r.top) * (totalH / r.height);
    const step = Math.round(rows[i].hi - (vy - tops[i] - padT) / H);
    const m = midiOf(noteFromStep(step, 0)) - inst.semis;
    if (m >= LO && m <= HI) setMidi(m);
  };

  const head = (n: Note, x: number, y: (s: number) => number, cls: string, label: string) => {
    const st = stepOf(n), cy = y(st), down = st >= 34;
    const ledgers: number[] = [];
    if (st < 30) for (let s = 28; s >= st; s -= 2) ledgers.push(s);
    if (st > 38) for (let s = 40; s <= st; s += 2) ledgers.push(s);
    return (
      <g className={cls}>
        {ledgers.map((s) => <line key={s} x1={x - 13} x2={x + 13} y1={y(s)} y2={y(s)} className="staff-line ledger" />)}
        {n.acc !== 0 && <text x={x - 19} y={cy + 5} className="acc" textAnchor="middle" style={{ fontSize: 20 }}>{ACC_SYMBOL[n.acc]}</text>}
        <line x1={down ? x - 5.8 : x + 5.8} x2={down ? x - 5.8 : x + 5.8} y1={cy} y2={down ? cy + SP * 3.3 : cy - SP * 3.3} className="stem" />
        <ellipse cx={x} cy={cy} rx="7" ry="5" transform={`rotate(-20 ${x} ${cy})`} className="head" />
        <text x={x + 16} y={cy + 4} className="inst-note-label">{label}</text>
      </g>
    );
  };

  /* ----- key table ----- */
  const keyRoot = MAJOR_KEYS[keyIdx];
  const keyRows = INSTS.map((i) => {
    const p = transposePitch(keyRoot, i);
    const count = sigCount(p);
    const theoretical = Math.abs(count) > 7;
    const alt = theoretical ? MAJOR_KEYS.find((k) => pcOf(k) === pcOf(p)) : undefined;
    return { i, p, count, theoretical, alt };
  });

  const keys: number[] = [];
  for (let m = LO; m <= HI; m++) keys.push(m);

  return (
    <div className="app inst">
      <section className="row two-one">
        <SpotlightCard className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">1 · One sound, five pages</p>
              <h2>Same pitch, different notation</h2>
            </div>
            <div className="seg" role="radiogroup" aria-label="Spell black keys with">
              <button className={!flat ? 'on' : ''} onClick={() => setFlat(false)} title="Spell black keys as sharps">♯</button>
              <button className={flat ? 'on' : ''} onClick={() => setFlat(true)} title="Spell black keys as flats">♭</button>
            </div>
          </header>
          <p className="hint">Press a piano key, or click any line or space on a staff. The dashed line follows that one sound down through every instrument’s music.</p>

          <svg viewBox={`0 0 ${W} ${totalH}`} className="inst-diagram" role="group" aria-label="Piano keyboard and the written note for each instrument">
            {/* dashed alignment guide */}
            <line x1={keyX(midi)} x2={keyX(midi)} y1={KH} y2={totalH - 4} className="inst-guide" />

            {/* keyboard */}
            <text x={12} y={18} className="inst-title">Concert pitch</text>
            <text x={12} y={36} className="inst-sub">what you actually hear</text>
            <text x={12} y={58} className="inst-big">{midiName(midi, flat)}</text>
            <text x={12} y={76} className="inst-sub">{hz.toFixed(1)} Hz</text>
            {keys.filter((m) => !isBlack(m)).map((m) => (
              <g key={m} onClick={() => setMidi(m)} className="kb-key">
                <rect x={keyX(m) - KW / 2 + 0.5} y={4} width={KW - 1} height={KH - 4} rx={3} className={`kb-white ${m === midi ? 'on' : ''}`} />
                {mod(m, 12) === 0 && <text x={keyX(m)} y={KH - 8} textAnchor="middle" className="kb-label">C{Math.floor(m / 12) - 1}</text>}
              </g>
            ))}
            {keys.filter(isBlack).map((m) => (
              <rect key={m} x={keyX(m) - 9} y={4} width={18} height={BKH} rx={2} onClick={() => setMidi(m)}
                className={`kb-black kb-key ${m === midi ? 'on' : ''}`} />
            ))}

            {/* instrument staves */}
            {INSTS.map((inst, idx) => {
              const { lo, hi } = rows[idx];
              const t = tops[idx];
              const y = (s: number) => t + padT + (hi - s) * H;
              const w = writtenOf(concert, inst);
              const out = midi < inst.range[0] || midi > inst.range[1];
              return (
                <g key={inst.id}>
                  <rect x={0} y={t} width={W} height={rows[idx].h} rx={10} className="inst-row" />
                  <text x={12} y={t + 22} className="inst-name">{inst.name}</text>
                  <text x={12} y={t + 38} className="inst-key">{inst.in}</text>
                  <text x={12} y={t + 54} className="inst-sub">{inst.relation}</text>
                  {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={150} x2={W - 14} y1={y(30 + k * 2)} y2={y(30 + k * 2)} className="staff-line" />)}
                  <line x1={150} x2={150} y1={y(38)} y2={y(30)} className="staff-line bar" />
                  <text x={156} y={y(32) + 3.5 * SP * 0.38} className="clef" style={{ fontSize: SP * 6.6 }}>𝄞</text>
                  <rect x={150} y={t} width={W - 150} height={rows[idx].h} className="band inst-band"
                    onClick={(e) => pickWritten(idx, e)} />
                  {head(w, keyX(midi), y, `note selected ${out ? 'out' : ''}`, `${noteName(w, true)}${out ? ' · out of range' : ''}`)}
                </g>
              );
            })}
          </svg>

          <div className="start-row">
            <button className="pill accent" onClick={() => piano(midi)}>🎹 Hear it</button>
            <button className="pill" onClick={() => pluck(midi)}>🎸 as a guitar</button>
            <span className="muted">Every row above makes <b>this same sound</b>. Only the page changes.</span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="card inst-info" spotlight="rgba(79,209,197,0.08)">
          <p className="eyebrow">2 · Why it is this way</p>
          <h2>Written pitch vs. concert pitch</h2>
          <p className="hint small"><b>Concert pitch</b> is the sound itself, named the way a piano names it. <b>Written pitch</b> is the note on <i>that instrument’s</i> page. For piano and flute they are the same. For the others they are not, on purpose.</p>

          <ul className="inst-why">
            <li><b>Piano &amp; flute: “in C”.</b> Written = sounding. The piano is the reference: its middle C (C4) is the C everyone else is measured against. The flute simply reads at concert pitch, with middle C as one of its lowest notes.</li>
            <li><b>Saxophones: one fingering, many sizes.</b> When Adolphe Sax designed the family in the 1840s, he made every size finger alike, so a player can switch from alto to tenor without relearning anything. The page therefore describes the <i>fingering</i>, not the pitch. A longer tube just sounds lower.</li>
            <li><b>Why “E♭” and “B♭”?</b> The name is the pitch you hear when the player fingers a written <b>C</b>. Alto (E♭) is a shorter tube, so written C sounds an E♭ a <b>major 6th</b> lower. Tenor (B♭) is longer, so written C sounds a B♭ a <b>major 9th</b> (octave + tone) lower.</li>
            <li><b>Guitar: an octave of padding.</b> Its low E sounds at E2. Written at real pitch it would hang far below the treble staff, so guitar music is written an octave higher and sounds an octave lower.</li>
            <li><b>Same reasons, same trick.</b> Transposing keeps each instrument’s whole range readable in the treble clef with few ledger lines. The cost is that a written C means a different sound on each instrument.</li>
          </ul>

          <div className="accs">
            <span className="accs-label">Everyone reads a written C →</span>
            <span className="acc-chip">Piano C</span>
            <span className="acc-chip">Flute C</span>
            <span className="acc-chip">Guitar C <small>(8vb)</small></span>
            <span className="acc-chip sharp">Alto E♭</span>
            <span className="acc-chip flat">Tenor B♭</span>
          </div>
          <p className="hint small"><b>Quick rule:</b> to write a concert note for alto sax, go up a major 6th; for tenor, up a major 9th (a major 2nd plus an octave). Mixed ensembles keep a <i>concert score</i> and hand each player a transposed <i>part</i>.</p>
        </SpotlightCard>
      </section>

      <SpotlightCard className="card" spotlight="rgba(242,184,75,0.08)">
        <header className="card-head">
          <div>
            <p className="eyebrow">3 · Keys travel too</p>
            <h2>Key signatures change with the instrument</h2>
          </div>
        </header>
        <p className="hint small">Pick the key the band is playing in (concert key). Each player reads a different written key, because the whole scale moves by the same interval as the notes do.</p>
        <div className="tabs" role="radiogroup" aria-label="Concert key">
          {MAJOR_KEYS.map((k, i) => (
            <button key={i} className={i === keyIdx ? 'on' : ''} onClick={() => setKeyIdx(i)}>{pitchName(k)}</button>
          ))}
        </div>
        <div className="inst-keys">
          {keyRows.map(({ i, p, count, theoretical, alt }) => (
            <div key={i.id} className="inst-key-row">
              <b>{i.name}</b>
              <span className="muted">{i.short}</span>
              <span className="inst-key-name">{pitchName(p)} major</span>
              <span className={`acc-chip ${count > 0 ? 'sharp' : count < 0 ? 'flat' : 'none'}`}>{sigText(count)}</span>
              {theoretical && alt && <span className="muted">theoretical key; written as {pitchName(alt)} major in practice</span>}
            </div>
          ))}
        </div>
      </SpotlightCard>
      <Transpose midi={midi} flat={flat} keyIdx={keyIdx} />
    </div>
  );
}
