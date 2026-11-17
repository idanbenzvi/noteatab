// Extra music theory: intervals, modes, key signatures, chord formulas, tunings, moveable shapes.
import {
  LETTER_PC, MAJOR_KEYS, MINOR_KEYS, NUM_FRETS, STRINGS, mod, midiOf, noteFromStep, pcOf, pitchName, scaleNotes, spellMidi, stepOf,
  type Note, type Pitch,
} from './music';

/* ------------------------------ intervals ------------------------------ */

export interface Interval { number: number; quality: string; semis: number; name: string; short: string }

const PERFECT = new Set([1, 4, 5]);                      // simple numbers that are "perfect" intervals
const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];              // semitones of the major-scale degree 1..7
const QUALITY_NAME: Record<string, string> = { P: 'Perfect', M: 'Major', m: 'Minor', A: 'Augmented', d: 'Diminished', AA: 'Doubly augmented', dd: 'Doubly diminished' };
const NUM_NAME = ['', 'unison', '2nd', '3rd', '4th', '5th', '6th', '7th', 'octave', '9th'];

/** The interval from note a up to note b (b must not be below a by letter). */
export function intervalBetween(a: Note, b: Note): Interval {
  const steps = stepOf(b) - stepOf(a);
  const semis = midiOf(b) - midiOf(a);
  const simple = steps % 7;
  const octaves = Math.floor(steps / 7);
  const number = steps + 1;
  const base = MAJOR_SEMIS[simple] + 12 * octaves;
  const diff = semis - base;
  let q: string;
  if (PERFECT.has(simple + 1) || (simple === 0 && octaves > 0)) {
    q = diff === 0 ? 'P' : diff === 1 ? 'A' : diff === -1 ? 'd' : diff > 1 ? 'AA' : 'dd';
  } else {
    q = diff === 0 ? 'M' : diff === -1 ? 'm' : diff === 1 ? 'A' : diff === -2 ? 'd' : diff > 1 ? 'AA' : 'dd';
  }
  const nm = NUM_NAME[number] ?? `${number}th`;
  return { number, quality: q, semis, name: `${QUALITY_NAME[q]} ${nm}`, short: `${q}${number}` };
}

/** Intervals within one octave that ear training uses, by semitones. */
export interface IntervalInfo { semis: number; short: string; name: string; song: string; tip: string }
export const INTERVALS: IntervalInfo[] = [
  { semis: 0, short: 'P1', name: 'Unison', song: 'The same note twice', tip: 'No distance at all.' },
  { semis: 1, short: 'm2', name: 'Minor 2nd', song: '“Jaws” theme', tip: 'One fret: tense, creeping.' },
  { semis: 2, short: 'M2', name: 'Major 2nd', song: '“Do‑Re‑Mi” (do→re)', tip: 'Two frets: a whole step.' },
  { semis: 3, short: 'm3', name: 'Minor 3rd', song: '“Smoke on the Water” (first two notes)', tip: 'Three frets: the sound of minor chords.' },
  { semis: 4, short: 'M3', name: 'Major 3rd', song: '“When the Saints Go Marching In”', tip: 'Four frets: the sound of major chords.' },
  { semis: 5, short: 'P4', name: 'Perfect 4th', song: '“Here Comes the Bride”', tip: 'Same fret, one string up (except G→B).' },
  { semis: 6, short: 'TT', name: 'Tritone', song: '“The Simpsons” theme', tip: 'Half an octave: unstable, wants to resolve.' },
  { semis: 7, short: 'P5', name: 'Perfect 5th', song: '“Twinkle Twinkle” (first leap) · Star Wars', tip: 'Open, strong: the power chord.' },
  { semis: 8, short: 'm6', name: 'Minor 6th', song: '“The Entertainer” (opening leap)', tip: 'Wistful, a bit dramatic.' },
  { semis: 9, short: 'M6', name: 'Major 6th', song: '“My Bonnie Lies over the Ocean”', tip: 'Sweet and open.' },
  { semis: 10, short: 'm7', name: 'Minor 7th', song: '“Somewhere” (West Side Story)', tip: 'Bluesy, wants to move on.' },
  { semis: 11, short: 'M7', name: 'Major 7th', song: '“Take On Me” (chorus leap)', tip: 'Bright but leaning hard toward the octave.' },
  { semis: 12, short: 'P8', name: 'Octave', song: '“Somewhere Over the Rainbow”', tip: 'The same note, higher.' },
];

/** Spell the note that lies `iv` above `from` (same letter-count the interval implies). */
export function noteAbove(from: Note, number: number, semis: number): Note {
  const target = noteFromStep(stepOf(from) + (number - 1), 0);
  return { ...target, acc: midiOf(from) + semis - midiOf(target) };
}
/** A natural default spelling for an interval above a root, by semitones (major/perfect, minor, tritone as ♯4). */
export const SEMIS_TO_NUMBER = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7, 8];

/* ------------------------------ modes ------------------------------ */

export type ModeId = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';
export interface ModeDef {
  id: ModeId; name: string; degree: number; semis: number[]; mood: string; use: string; bright: number; chord: string;
}
export const MODES: ModeDef[] = [
  { id: 'ionian', name: 'Ionian', degree: 1, semis: [0, 2, 4, 5, 7, 9, 11], bright: 6, chord: 'maj7', mood: 'Bright, happy, resolved: the plain major scale.', use: 'Pop, folk, country, classical.' },
  { id: 'dorian', name: 'Dorian', degree: 2, semis: [0, 2, 3, 5, 7, 9, 10], bright: 3, chord: 'm7', mood: 'Minor with a lift: cool, funky, a little hopeful.', use: 'Funk, jazz, Santana-style rock, folk.' },
  { id: 'phrygian', name: 'Phrygian', degree: 3, semis: [0, 1, 3, 5, 7, 8, 10], bright: 1, chord: 'm7', mood: 'Dark and tense, with a Spanish / flamenco flavour from the ♭2.', use: 'Flamenco, metal, film tension.' },
  { id: 'lydian', name: 'Lydian', degree: 4, semis: [0, 2, 4, 6, 7, 9, 11], bright: 7, chord: 'maj7', mood: 'Dreamy and floating: major with a raised 4th.', use: 'Film scores, Satriani-style rock, jazz.' },
  { id: 'mixolydian', name: 'Mixolydian', degree: 5, semis: [0, 2, 4, 5, 7, 9, 10], bright: 5, chord: '7', mood: 'Major but relaxed and bluesy, because of the ♭7.', use: 'Blues, classic rock, folk, jam bands.' },
  { id: 'aeolian', name: 'Aeolian', degree: 6, semis: [0, 2, 3, 5, 7, 8, 10], bright: 2, chord: 'm7', mood: 'The natural minor scale: sad, serious, familiar.', use: 'Rock, pop ballads, metal.' },
  { id: 'locrian', name: 'Locrian', degree: 7, semis: [0, 1, 3, 5, 6, 8, 10], bright: 0, chord: 'm7♭5', mood: 'Unstable and eerie: the ♭5 means the tonic chord never feels at home.', use: 'Rare as a home key; metal and jazz colour.' },
];
export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeDef>;

export interface ModeNote extends Pitch { pc: number; degree: string; altered: boolean; isRoot: boolean; i: number }

const degLabel = (i: number, semi: number) => {
  const d = semi - MAJOR_SEMIS[i];
  return (d < 0 ? '♭'.repeat(-d) : d > 0 ? '♯'.repeat(d) : '') + (i + 1);
};

/** Spell a mode on a root: seven consecutive letters, each used once. */
export function modeNotes(root: Pitch, mode: ModeId): ModeNote[] {
  const def = MODE_BY_ID[mode];
  const rootPc = pcOf(root);
  return def.semis.map((semi, i) => {
    const l = (root.l + i) % 7;
    const pc = (rootPc + semi) % 12;
    const acc = mod(pc - LETTER_PC[l] + 6, 12) - 6;
    return { l, acc, pc, degree: degLabel(i, semi), altered: semi !== MAJOR_SEMIS[i], isRoot: i === 0, i };
  });
}

/** The major key whose notes this mode shares: the mode's root sits on degree `degree` of that key. */
export function modeParent(root: Pitch, mode: ModeId): Pitch {
  const def = MODE_BY_ID[mode];
  const l = mod(root.l - (def.degree - 1), 7);
  const pc = mod(pcOf(root) - MAJOR_SEMIS[def.degree - 1], 12);
  return { l, acc: mod(pc - LETTER_PC[l] + 6, 12) - 6 };
}

/* ------------------------------ key signatures ------------------------------ */

export const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];   // letter indices F C G D A E B
export const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];    // B E A D G C F
// staff step (E4 = 30) where each glyph is placed in the treble and bass clef
export const SHARP_STEPS_TREBLE = [38, 35, 39, 36, 33, 37, 34];
export const FLAT_STEPS_TREBLE = [34, 37, 33, 36, 32, 35, 31];
export const SHARP_STEPS_BASS = [24, 21, 25, 22, 19, 23, 20];
export const FLAT_STEPS_BASS = [20, 23, 19, 22, 18, 21, 17];

/** Signed accidental count (+sharps / -flats) for a major key; minor keys use their relative major. */
export function keyCount(root: Pitch, minor = false): number {
  const major = minor ? relativeMajor(root) : root;
  return scaleNotes(major, 'major').reduce((n, x) => n + (x.acc > 0 ? 1 : x.acc < 0 ? -1 : 0), 0);
}
export function relativeMajor(minorRoot: Pitch): Pitch {
  const l = (minorRoot.l + 2) % 7;
  const pc = (pcOf(minorRoot) + 3) % 12;
  return { l, acc: mod(pc - LETTER_PC[l] + 6, 12) - 6 };
}
export function relativeMinor(majorRoot: Pitch): Pitch {
  const l = (majorRoot.l + 5) % 7;
  const pc = (pcOf(majorRoot) + 9) % 12;
  return { l, acc: mod(pc - LETTER_PC[l] + 6, 12) - 6 };
}
/** Letters of the accidentals in a key signature, in the order written. */
export function sigLetters(count: number): number[] {
  return (count >= 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, Math.abs(count));
}
/** Every key a key-signature quiz may ask, keyed by signature count (-7..7). */
export function majorKeyForCount(count: number): Pitch {
  // circle position: count sharps → index count; flats → 12 + count
  const idx = count >= 0 ? count : 12 + count;
  if (count === 7) return { l: 0, acc: 1 };
  if (count === -7) return { l: 0, acc: -1 };
  return MAJOR_KEYS[idx];
}
export function minorKeyForCount(count: number): Pitch {
  return relativeMinor(majorKeyForCount(count));
}
export { MINOR_KEYS };

/* ------------------------------ chord qualities ------------------------------ */

export interface Quality { id: string; name: string; symbol: string; offs: number[]; formula: string; sound: string; seventh: boolean }
export const QUALITIES: Quality[] = [
  { id: 'maj', name: 'Major', symbol: '', offs: [0, 4, 7], formula: '1 – 3 – 5', sound: 'Bright, stable, happy.', seventh: false },
  { id: 'min', name: 'Minor', symbol: 'm', offs: [0, 3, 7], formula: '1 – ♭3 – 5', sound: 'Darker, sadder, more serious.', seventh: false },
  { id: 'dim', name: 'Diminished', symbol: 'dim', offs: [0, 3, 6], formula: '1 – ♭3 – ♭5', sound: 'Tense and unstable, wants to resolve.', seventh: false },
  { id: 'aug', name: 'Augmented', symbol: 'aug', offs: [0, 4, 8], formula: '1 – 3 – ♯5', sound: 'Strange, floating, unresolved.', seventh: false },
  { id: 'sus2', name: 'Suspended 2nd', symbol: 'sus2', offs: [0, 2, 7], formula: '1 – 2 – 5', sound: 'Open and airy: no third, so neither major nor minor.', seventh: false },
  { id: 'sus4', name: 'Suspended 4th', symbol: 'sus4', offs: [0, 5, 7], formula: '1 – 4 – 5', sound: 'Hanging, asks to resolve to the major or minor chord.', seventh: false },
  { id: 'dom7', name: 'Dominant 7th', symbol: '7', offs: [0, 4, 7, 10], formula: '1 – 3 – 5 – ♭7', sound: 'Bluesy, restless, pulls toward the I chord.', seventh: true },
  { id: 'maj7', name: 'Major 7th', symbol: 'maj7', offs: [0, 4, 7, 11], formula: '1 – 3 – 5 – 7', sound: 'Smooth, dreamy, jazzy.', seventh: true },
  { id: 'min7', name: 'Minor 7th', symbol: 'm7', offs: [0, 3, 7, 10], formula: '1 – ♭3 – 5 – ♭7', sound: 'Mellow, relaxed, soulful.', seventh: true },
  { id: 'hdim', name: 'Half-diminished', symbol: 'm7♭5', offs: [0, 3, 6, 10], formula: '1 – ♭3 – ♭5 – ♭7', sound: 'Dark and yearning: the ii chord of a minor key.', seventh: true },
];
export const QUALITY_BY_ID = Object.fromEntries(QUALITIES.map((q) => [q.id, q])) as Record<string, Quality>;

/** Spell a chord from a root and offsets: stacked thirds get consecutive letters (sus chords use 2nd/4th). */
export function spellChord(root: Pitch, q: Quality): Pitch[] {
  const letterStep = q.id === 'sus2' ? [0, 1, 4] : q.id === 'sus4' ? [0, 3, 4] : [0, 2, 4, 6];
  return q.offs.map((o, k) => {
    const l = (root.l + letterStep[k]) % 7;
    const pc = (pcOf(root) + o) % 12;
    return { l, acc: mod(pc - LETTER_PC[l] + 6, 12) - 6 };
  });
}

/** MIDI notes for a root-position chord starting at the given bass note. */
export function chordMidis(rootPc: number, q: Quality, bass = 48): number[] {
  const b = bass + mod(rootPc - bass, 12);
  return q.offs.map((o) => b + o);
}

/* ------------------------------ functional harmony ------------------------------ */

export type Func = 'T' | 'S' | 'D';
export const FUNCTION_NAMES: Record<Func, { name: string; blurb: string }> = {
  T: { name: 'Tonic', blurb: 'Home: rest and stability.' },
  S: { name: 'Subdominant', blurb: 'Departure: moving away from home.' },
  D: { name: 'Dominant', blurb: 'Tension: pulling back home.' },
};
export const MAJOR_FUNCTIONS: Func[] = ['T', 'S', 'T', 'S', 'D', 'T', 'D'];  // I ii iii IV V vi vii°
export const MINOR_FUNCTIONS: Func[] = ['T', 'S', 'T', 'S', 'D', 'S', 'D'];  // i ii° III iv v VI VII

/* ------------------------------ tunings ------------------------------ */

export interface Tuning { id: string; name: string; notes: string; midi: number[]; blurb: string }
const T = (id: string, name: string, notes: string, midi: number[], blurb: string): Tuning => ({ id, name, notes, midi, blurb });
export const TUNINGS: Tuning[] = [
  T('std', 'Standard', 'E A D G B E', [40, 45, 50, 55, 59, 64], 'The default. Four perfect fourths and one major third (G→B) make chord shapes easy to reach.'),
  T('dropd', 'Drop D', 'D A D G B E', [38, 45, 50, 55, 59, 64], 'Lower the 6th string a whole step. The three lowest strings become a power chord under one finger; a rock and metal staple.'),
  T('halfdown', 'Half step down', 'E♭ A♭ D♭ G♭ B♭ E♭', [39, 44, 49, 54, 58, 63], 'Everything one fret lower: looser strings and a darker sound. Common in blues and rock; you read and finger as normal.'),
  T('dadgad', 'DADGAD', 'D A D G A D', [38, 45, 50, 55, 57, 62], 'Open and modal, neither major nor minor. A favourite for Celtic and fingerstyle guitar.'),
  T('openg', 'Open G', 'D G D G B D', [38, 43, 50, 55, 59, 62], 'Strumming the open strings gives a G major chord. A slide and blues classic, and the basis of many Rolling‑Stones‑style riffs.'),
  T('opend', 'Open D', 'D A D F♯ A D', [38, 45, 50, 54, 57, 62], 'Open strings spell D major. Great for slide guitar and rich, resonant folk.'),
  T('opene', 'Open E', 'E B E G♯ B E', [40, 47, 52, 56, 59, 64], 'Open strings spell E major; the same shapes as Open D, a whole step higher.'),
  T('openc', 'Open C', 'C G C G C E', [36, 43, 48, 55, 60, 64], 'A deep, wide open‑C chord with huge resonance; popular for ringing fingerstyle.'),
  T('dbldrop', 'Double drop D', 'D A D G B D', [38, 45, 50, 55, 59, 62], 'Both E strings dropped to D: power chords low and a lovely D drone at both ends.'),
];

/* ------------------------------ moveable chord shapes ------------------------------ */

export interface Shape { id: string; label: string; root: number; frets: (number | null)[] } // root = string index holding the root; frets relative to the root fret
export const BARRE_SHAPES: Record<string, Shape[]> = {
  maj: [
    { id: 'E', label: 'E shape', root: 0, frets: [0, 2, 2, 1, 0, 0] },
    { id: 'A', label: 'A shape', root: 1, frets: [null, 0, 2, 2, 2, 0] },
  ],
  min: [
    { id: 'Em', label: 'Em shape', root: 0, frets: [0, 2, 2, 0, 0, 0] },
    { id: 'Am', label: 'Am shape', root: 1, frets: [null, 0, 2, 2, 1, 0] },
  ],
  dom7: [
    { id: 'E7', label: 'E7 shape', root: 0, frets: [0, 2, 0, 1, 0, 0] },
    { id: 'A7', label: 'A7 shape', root: 1, frets: [null, 0, 2, 0, 2, 0] },
  ],
  min7: [
    { id: 'Em7', label: 'Em7 shape', root: 0, frets: [0, 2, 0, 0, 0, 0] },
    { id: 'Am7', label: 'Am7 shape', root: 1, frets: [null, 0, 2, 0, 1, 0] },
  ],
};

/** The five CAGED forms of a major chord: frets relative to the root fret on the root string. */
export const CAGED_FORMS: Shape[] = [
  { id: 'C', label: 'C shape', root: 1, frets: [null, 0, -1, -3, -2, -3] },
  { id: 'A', label: 'A shape', root: 1, frets: [null, 0, 2, 2, 2, 0] },
  { id: 'G', label: 'G shape', root: 0, frets: [0, -1, -3, -3, -3, 0] },
  { id: 'E', label: 'E shape', root: 0, frets: [0, 2, 2, 1, 0, 0] },
  { id: 'D', label: 'D shape', root: 2, frets: [null, null, 0, 2, 3, 2] },
];

/** Place a moveable shape so its root lands on `rootPc`: returns absolute frets, or null if impossible. */
export function placeShape(shape: Shape, rootPc: number, tuning = STRINGS.map((s) => s.midi), minRoot = 0): (number | null)[] | null {
  const open = tuning[shape.root];
  let r = mod(rootPc - open, 12);
  const lowest = Math.min(...shape.frets.filter((f): f is number => f !== null).map((f) => f), 0);
  while (r + lowest < 0) r += 12;
  while (r < minRoot) r += 12;
  const out = shape.frets.map((f) => (f === null ? null : r + f));
  if (out.some((f) => f !== null && (f < 0 || f > NUM_FRETS))) return null;
  return out;
}

/* ------------------------------ pentatonic boxes ------------------------------ */

/** The five "box" positions of a pentatonic scale: two notes per string, all within ~5 frets. */
export function pentatonicBoxes(rootPc: number, minor: boolean, tuning = STRINGS.map((s) => s.midi)): { pos: { s: number; f: number }[]; lo: number; hi: number }[] {
  const semis = minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const pcs = new Set(semis.map((x) => (rootPc + x) % 12));
  // all scale pitches from low E - 12 upward, ascending
  const base = tuning[0];
  const pitches: number[] = [];
  for (let p = base; p <= base + 12 + 36; p++) if (pcs.has(mod(p, 12))) pitches.push(p);
  const boxes: { pos: { s: number; f: number }[]; lo: number; hi: number }[] = [];
  for (let start = 0; start < pitches.length && boxes.length < 5 + 2; start++) {
    const pos: { s: number; f: number }[] = [];
    let idx = start, ok = true;
    for (let s = 0; s < 6 && ok; s++) {
      // two consecutive scale pitches that are playable on this string
      while (idx < pitches.length && pitches[idx] < tuning[s]) idx++;
      if (idx + 1 >= pitches.length) { ok = false; break; }
      pos.push({ s, f: pitches[idx] - tuning[s] }, { s, f: pitches[idx + 1] - tuning[s] });
      idx += 2;
    }
    if (!ok) continue;
    const frets = pos.map((p) => p.f);
    const lo = Math.min(...frets), hi = Math.max(...frets);
    if (hi > NUM_FRETS || hi - lo > 5 || lo < 0) continue;
    boxes.push({ pos, lo, hi });
  }
  // keep one per distinct low fret window, sorted up the neck, cap to the first full cycle of five
  boxes.sort((a, b) => a.lo - b.lo);
  const uniq: typeof boxes = [];
  for (const b of boxes) if (!uniq.some((u) => u.lo === b.lo)) uniq.push(b);
  return uniq;
}

/* ------------------------------ capo ------------------------------ */

export const CAPO_SHAPES: { name: string; root: Pitch; minor: boolean }[] = [
  { name: 'C', root: { l: 0, acc: 0 }, minor: false },
  { name: 'G', root: { l: 4, acc: 0 }, minor: false },
  { name: 'D', root: { l: 1, acc: 0 }, minor: false },
  { name: 'A', root: { l: 5, acc: 0 }, minor: false },
  { name: 'E', root: { l: 2, acc: 0 }, minor: false },
  { name: 'Am', root: { l: 5, acc: 0 }, minor: true },
  { name: 'Em', root: { l: 2, acc: 0 }, minor: true },
  { name: 'Dm', root: { l: 1, acc: 0 }, minor: true },
];

/** Spell a scale-degree chord symbol for a key, e.g. degree 4 of C major → "F". */
export function diatonicName(key: Pitch, minor: boolean, d: number): string {
  const s = scaleNotes(key, minor ? 'minor' : 'major');
  const qs = minor ? ['m', 'dim', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'dim'];
  return pitchName(s[d]) + qs[d];
}

/** Letter name from a midi number, spelled with sharps or flats. */
export const midiName = (m: number, flat = false) => {
  const n = spellMidi(m, flat);
  return pitchName(n) + n.oct;
};

/** Plain name for a number of semitones between adjacent strings. */
export const intervalName = (semis: number) =>
  ({ 3: 'minor 3rd', 4: 'major 3rd', 5: 'perfect 4th', 6: 'tritone', 7: 'perfect 5th', 2: 'major 2nd' } as Record<number, string>)[semis] ?? `${semis} st`;
