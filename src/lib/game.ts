// Question generation + checking for the practice games.
import { pickWeighted } from './progress';
import { NUM_FRETS, STRINGS, WRITTEN_OFFSET, midiOf, positionsFor, spellMidi, type FretPos, type Note } from './music';

export type Mode = 'tab2staff' | 'staff2tab' | 'ear';
export interface Settings {
  maxFret: number;            // highest fret that may be asked
  accidentals: boolean;       // include sharps / flats
  strings: boolean[];         // which strings (index 0 = low E) may be asked
  sprint: boolean;            // 60 s timed round instead of endless practice
  instrument: 'guitar' | 'piano'; // voice used for the notes you hear
  focusWeak: boolean;         // favour the positions you get wrong most often
}
export const DEFAULT_SETTINGS: Settings = { maxFret: 7, accidentals: false, strings: [true, true, true, true, true, true], sprint: false, instrument: 'guitar', focusWeak: false };

export interface Question { pos: FretPos; written: number; note: Note }

const NATURAL_PC = new Set([0, 2, 4, 5, 7, 9, 11]);
const rnd = (n: number) => Math.floor(Math.random() * n);

export function makeQuestion(s: Settings, prev?: Question): Question {
  const pool: FretPos[] = [];
  STRINGS.forEach((st, si) => {
    if (!s.strings[si]) return;
    for (let f = 0; f <= Math.min(s.maxFret, NUM_FRETS); f++) {
      if (!s.accidentals && !NATURAL_PC.has((st.midi + f) % 12)) continue;
      pool.push({ s: si, f });
    }
  });
  const draw = () => (s.focusWeak ? pickWeighted(pool, (p) => `${p.s}:${p.f}`, 'fret') : pool[rnd(pool.length)]);
  let pos = draw();
  // avoid asking the very same note twice in a row when there is a choice
  for (let i = 0; i < 6 && prev && pool.length > 1 && STRINGS[pos.s].midi + pos.f === STRINGS[prev.pos.s].midi + prev.pos.f; i++) pos = draw();
  const written = STRINGS[pos.s].midi + pos.f + WRITTEN_OFFSET;
  return { pos, written, note: spellMidi(written, Math.random() < 0.5) };
}

export const sameSounding = (a: Note, writtenMidi: number) => midiOf(a) === writtenMidi;
export const allPositions = (writtenMidi: number, maxFret: number) => positionsFor(writtenMidi).filter((p) => p.f <= maxFret);
export const isValidFret = (writtenMidi: number, p: FretPos) => STRINGS[p.s].midi + p.f + WRITTEN_OFFSET === writtenMidi;
