import { useState } from 'react';
import { STRINGS } from '../../lib/music';
import { pluck, techNote } from '../../lib/audio';
import TCard from './TCard';

type Item = { f?: number; x: number; text?: string; dy?: number; s?: number; cls?: string; start?: boolean };
interface Tech { id: string; name: string; sym: string; how: string; items: Item[]; play: () => void; s?: number }

const G = 3;                                      // snippets are written on the G string
const base = STRINGS[G].midi;                     // 55
const strumChord = (frets: number[], down: boolean) => {
  const order = down ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
  order.forEach((s, i) => { if (frets[s] >= 0) pluck(STRINGS[s].midi + frets[s], i * 0.04, 1.8); });
};

const TECHS: Tech[] = [
  { id: 'h', name: 'Hammer-on', sym: 'h', how: 'Pick the first note, then “hammer” a finger down on the higher fret without picking again. The second note sounds from the force of your finger alone.',
    items: [{ f: 5, x: 60 }, { text: 'h', x: 105, dy: -16 }, { f: 7, x: 150 }], play: () => { techNote('pick', base + 5); techNote('hammer', base + 7, { delay: 0.4 }); } },
  { id: 'p', name: 'Pull-off', sym: 'p', how: 'Fret both notes, pick the higher one, then pull the finger off sideways so the string sounds the lower fretted note.',
    items: [{ f: 7, x: 60 }, { text: 'p', x: 105, dy: -16 }, { f: 5, x: 150 }], play: () => { techNote('pick', base + 7); techNote('pull', base + 5, { delay: 0.4 }); } },
  { id: 'slide', name: 'Slide', sym: '/  \\', how: 'Pick the first note, then slide the finger along the string to the second fret. “/” slides up, “\\” slides down. Both notes are heard; the slide connects them.',
    items: [{ f: 5, x: 60 }, { text: '/', x: 105 }, { f: 7, x: 150 }, { f: 7, x: 220 }, { text: '\\', x: 265 }, { f: 5, x: 310 }],
    play: () => { techNote('slide', base + 5, { to: base + 7 }); techNote('slide', base + 7, { to: base + 5, delay: 1.1 }); } },
  { id: 'b', name: 'Bend', sym: 'b', how: 'Push or pull the string across the fretboard to raise its pitch without moving up a fret. “7b9” means: fret 7, then bend until it sounds like fret 9 (a whole step).',
    items: [{ f: 7, x: 60 }, { text: 'b', x: 105, dy: -16 }, { f: 9, x: 150, cls: 'bend' }], play: () => techNote('bend', base + 7, { to: base + 9, dur: 1.6 }) },
  { id: 'r', name: 'Bend and release', sym: 'b … r', how: 'Bend the string up, then let it come back down while the note still rings. “7b9r7”: bend to fret 9, release to fret 7.',
    items: [{ f: 7, x: 40 }, { text: 'b', x: 80, dy: -16 }, { f: 9, x: 115, cls: 'bend' }, { text: 'r', x: 160, dy: -16 }, { f: 7, x: 195 }], play: () => techNote('release', base + 7, { to: base + 9, dur: 1.8 }) },
  { id: 'v', name: 'Vibrato', sym: '~', how: 'Make the pitch waver slightly by rocking the finger (or bending slightly up and down). A wavy line follows the fret number. It gives a sustained note life and a singing quality.',
    items: [{ f: 7, x: 60 }, { text: '~~~~~', x: 108 }], play: () => techNote('vibrato', base + 7, { dur: 2.2 }) },
  { id: 'pm', name: 'Palm mute', sym: 'P.M.', how: 'Rest the edge of your picking hand lightly on the strings next to the bridge. The sound becomes short, dark and chunky, the engine of rock and metal rhythm. “P.M.” and a dashed line show how long.',
    items: [{ text: 'P.M.- - - - - - - -|', x: 52, dy: -26, start: true }, { f: 0, x: 60, s: 1 }, { f: 0, x: 105, s: 1 }, { f: 0, x: 150, s: 1 }, { f: 0, x: 195, s: 1 }],
    play: () => { for (let i = 0; i < 4; i++) techNote('mute', STRINGS[1].midi, { delay: i * 0.22 }); }, s: 1 },
  { id: 'x', name: 'Dead note', sym: 'x', how: 'Lightly touch the string without pressing it to the fret and strum: you hear a percussive click, not a pitch. Funk guitarists use dead notes to make rhythm.',
    items: [{ f: 5, x: 60 }, { text: 'x', x: 110 }, { f: 5, x: 160 }, { text: 'x', x: 210 }], play: () => { techNote('pick', base + 5, { dur: 0.3 }); techNote('mute', base + 5, { delay: 0.3, dur: 0.15 }); techNote('pick', base + 5, { delay: 0.6, dur: 0.3 }); techNote('mute', base + 5, { delay: 0.9, dur: 0.15 }); } },
  { id: 'harm', name: 'Natural harmonic', sym: '<12>', how: 'Touch the string lightly directly over a fret wire (12th, 7th or 5th) without pressing, pick, and lift off. You get a bell-like tone an octave (12th fret), a twelfth (7th fret) or two octaves (5th fret) above the open string.',
    items: [{ text: '<12>', x: 70, dy: 0, f: undefined }], play: () => techNote('harmonic', base + 12, { dur: 2.2 }) },
  { id: 'tap', name: 'Tapping', sym: 'T', how: 'Hammer a fretting-hand finger or a picking-hand finger directly onto the fretboard for fast, legato runs. “T” marks the tapped fret; the notes that follow are pull-offs.',
    items: [{ text: 'T', x: 60, dy: -16 }, { f: 17, x: 60 }, { f: 8, x: 105 }, { f: 5, x: 150 }], play: () => { techNote('tap', base + 17, { dur: 0.5 }); techNote('pull', base + 8, { delay: 0.25, dur: 0.5 }); techNote('pull', base + 5, { delay: 0.5, dur: 0.9 }); } },
];

function TabSnippet({ tech }: { tech: Tech }) {
  const W = 360, LH = 14, T = 26, H = T + LH * 5 + 24, s0 = tech.s ?? G;
  const y = (s: number) => T + (5 - s) * LH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tab-snippet" role="img" aria-label={`${tech.name} in tab`}>
      {[0, 1, 2, 3, 4, 5].map((s) => <line key={s} x1={14} x2={W - 8} y1={y(s)} y2={y(s)} className="staff-line" />)}
      <text x={2} y={y(2) + 4} className="tab-word" style={{ fontSize: 11 }}>T</text><text x={2} y={y(2) + 14} className="tab-word" style={{ fontSize: 11 }}>A</text><text x={2} y={y(2) + 24} className="tab-word" style={{ fontSize: 11 }}>B</text>
      {tech.items.map((it, i) => it.f !== undefined ? (
        <g key={i}><rect x={it.x - 8} y={y(it.s ?? s0) - 7} width={it.f > 9 ? 20 : 16} height={14} className="tab-fret-bg" style={{ transform: it.f > 9 ? 'translateX(-2px)' : undefined }} /><text x={it.x} y={y(it.s ?? s0) + 4.5} textAnchor="middle" className="rn-tabnum">{it.f}</text></g>
      ) : (
        <text key={i} x={it.x} y={y(it.s ?? s0) + 4.5 + (it.dy ?? 0)} textAnchor={it.start ? 'start' : 'middle'} className="tab-sym">{it.text}</text>
      ))}
    </svg>
  );
}

export default function TabSymbols() {
  const [playing, setPlaying] = useState<string | null>(null);
  const run = (t: Tech) => { setPlaying(t.id); t.play(); window.setTimeout(() => setPlaying((p) => (p === t.id ? null : p)), 1800); };
  const E = [0, 2, 2, 1, 0, 0];
  return (
    <TCard eyebrow="Guitar · 1" title="Reading tab symbols" narrate="theory-tab" className="explainer">
      <p className="hint"><b>Tablature</b> is a picture of the neck: six lines are the six strings (the thinnest, high E, on top) and a number is the <b>fret</b> to press. Numbers stacked in a column are played together; numbers further right come later. Beyond the numbers, a small vocabulary of letters and symbols says <i>how</i> to play each note. Click a card to hear it.</p>

      <div className="ex-grid tab-intro">
        <article>
          <h3>Reading the lines</h3>
          <svg viewBox="0 0 360 120" className="tab-snippet" role="img" aria-label="A tab line with a chord and single notes">
            {[0, 1, 2, 3, 4, 5].map((s) => <line key={s} x1={34} x2={352} y1={14 + (5 - s) * 15} y2={14 + (5 - s) * 15} className="staff-line" />)}
            {['e', 'B', 'G', 'D', 'A', 'E'].map((l, i) => <text key={l} x={22} y={18 + i * 15} textAnchor="end" className="tab-str">{l}</text>)}
            {E.map((f, s) => <g key={s}><rect x={52} y={14 + (5 - s) * 15 - 7} width={16} height={14} className="tab-fret-bg" /><text x={60} y={14 + (5 - s) * 15 + 4.5} textAnchor="middle" className="rn-tabnum">{f}</text></g>)}
            {[{ s: 5, f: 0, x: 130 }, { s: 5, f: 3, x: 175 }, { s: 4, f: 1, x: 220 }, { s: 3, f: 2, x: 265 }].map((n, i) => <g key={i}><rect x={n.x - 8} y={14 + (5 - n.s) * 15 - 7} width={16} height={14} className="tab-fret-bg" /><text x={n.x} y={14 + (5 - n.s) * 15 + 4.5} textAnchor="middle" className="rn-tabnum">{n.f}</text></g>)}
          </svg>
          <p>First column: an E major chord (open strings 0 and the fretted 2-2-1). Then four single notes. Read left to right. <b>0</b> means play the open string.</p>
          <div className="start-row"><button className="pill" onClick={() => strumChord(E, true)}>↓ Down-strum</button><button className="pill" onClick={() => strumChord(E, false)}>↑ Up-strum</button></div>
        </article>
        <article>
          <h3>What tab does not tell you</h3>
          <p>Standard tab shows <b>where</b> but not <b>when</b>: it has no note lengths. Good tab adds rhythm symbols above the numbers (stems, beams and rests like those in the Rhythm section), or you must learn the song by ear. Staff notation includes rhythm and pitch but not the string; tab includes the string but not the rhythm. Reading both together gives you everything.</p>
          <p className="hint small">Strumming arrows: <b>⊓</b> (or ↓) is a down-stroke, <b>V</b> (or ↑) is an up-stroke.</p>
        </article>
      </div>

      <div className="tech-grid">
        {TECHS.map((t) => (
          <button key={t.id} className={`tech-card ${playing === t.id ? 'on' : ''}`} onClick={() => run(t)} aria-label={`Hear ${t.name}`}>
            <span className="tech-head"><b>{t.name}</b><code>{t.sym}</code><span className="tech-play">{playing === t.id ? '♪' : '▶'}</span></span>
            <TabSnippet tech={t} />
            <small>{t.how}</small>
          </button>
        ))}
      </div>
    </TCard>
  );
}
