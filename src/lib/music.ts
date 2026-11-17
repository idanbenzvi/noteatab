// Music theory core: notes, spelling, scales, circle of fifths, guitar geometry.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** A spelled note. l = letter index (C=0..B=6), acc = accidental (-2..2), oct = scientific octave. */
export interface Note { l: number; acc: number; oct: number }
export interface Pitch { l: number; acc: number } // octave-less (a root / pitch name)

export const ACC_SYMBOL: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };
export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const midiOf = (n: Note) => 12 * (n.oct + 1) + LETTER_PC[n.l] + n.acc;
export const stepOf = (n: Note) => n.oct * 7 + n.l; // diatonic step; E4 = 30
export const pcOf = (p: Pitch) => mod(LETTER_PC[p.l] + p.acc, 12);
export const pitchName = (p: Pitch) => LETTERS[p.l] + (ACC_SYMBOL[p.acc] ?? '');
export const noteName = (n: Pitch & { oct?: number }, withOct = false) => pitchName(n) + (withOct ? n.oct ?? "" : "");
export const noteFromStep = (step: number, acc: number): Note => {
  const oct = Math.floor(step / 7);
  return { l: step - oct * 7, acc, oct };
};

const SHARP_SPELL: [number, number][] = [[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
const FLAT_SPELL: [number, number][] = [[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];

export function spellMidi(midi: number, preferFlat = false): Note {
  const [l, acc] = (preferFlat ? FLAT_SPELL : SHARP_SPELL)[mod(midi, 12)];
  return { l, acc, oct: Math.floor(midi / 12) - 1 };
}

/* ------------------------------ Guitar ------------------------------ */

export const NUM_FRETS = 19;
/** Low → high. midi values are *sounding* pitches. */
export const STRINGS = [
  { name: 'E', midi: 40, label: '6' },
  { name: 'A', midi: 45, label: '5' },
  { name: 'D', midi: 50, label: '4' },
  { name: 'G', midi: 55, label: '3' },
  { name: 'B', midi: 59, label: '2' },
  { name: 'E', midi: 64, label: '1' },
];
/** Guitar music is written an octave above where it sounds. */
export const WRITTEN_OFFSET = 12;
export const MIN_WRITTEN = STRINGS[0].midi + WRITTEN_OFFSET;            // E3
export const MAX_WRITTEN = STRINGS[5].midi + NUM_FRETS + WRITTEN_OFFSET; // B6

export interface FretPos { s: number; f: number }
/** Every (string, fret) that produces the given *written* pitch. */
export function positionsFor(writtenMidi: number): FretPos[] {
  const sounding = writtenMidi - WRITTEN_OFFSET;
  const out: FretPos[] = [];
  STRINGS.forEach((st, s) => {
    const f = sounding - st.midi;
    if (f >= 0 && f <= NUM_FRETS) out.push({ s, f });
  });
  return out;
}

/* ------------------------------ Scales ------------------------------ */

export type ScaleType = 'major' | 'minor' | 'majorPent' | 'minorPent' | 'dorian';

export interface ScaleDef {
  label: string; blurb: string; semis: number[]; idx: number[]; degrees: string[]; family: 'major' | 'minor';
}
export const SCALES: Record<ScaleType, ScaleDef> = {
  major: {
    label: 'Major', family: 'major', semis: [0,2,4,5,7,9,11], idx: [0,1,2,3,4,5,6],
    degrees: ['1','2','3','4','5','6','7'], blurb: 'Bright and resolved: the sound of “do‑re‑mi”.',
  },
  minor: {
    label: 'Natural minor', family: 'minor', semis: [0,2,3,5,7,8,10], idx: [0,1,2,3,4,5,6],
    degrees: ['1','2','♭3','4','5','♭6','♭7'], blurb: 'Darker and more somber; shares its notes with the relative major.',
  },
  majorPent: {
    label: 'Major pentatonic', family: 'major', semis: [0,2,4,7,9], idx: [0,1,2,4,5],
    degrees: ['1','2','3','5','6'], blurb: 'Five sweet notes, no half‑steps. A favourite of country and pop.',
  },
  minorPent: {
    label: 'Minor pentatonic', family: 'minor', semis: [0,3,5,7,10], idx: [0,2,3,4,6],
    degrees: ['1','♭3','4','5','♭7'], blurb: 'The backbone of blues and rock soloing.',
  },
  dorian: {
    label: 'Dorian', family: 'minor', semis: [0,2,3,5,7,9,10], idx: [0,1,2,3,4,5,6],
    degrees: ['1','2','♭3','4','5','6','♭7'], blurb: 'Minor with a raised 6th: cool, funky, a little hopeful.',
  },
};
export const SCALE_ORDER: ScaleType[] = ['major', 'minor', 'majorPent', 'minorPent', 'dorian'];

export interface ScaleNote extends Pitch { pc: number; degree: string; isRoot: boolean; idx: number }

export function scaleNotes(root: Pitch, type: ScaleType): ScaleNote[] {
  const def = SCALES[type];
  const rootPc = pcOf(root);
  return def.semis.map((semi, i) => {
    const l = (root.l + def.idx[i]) % 7;
    const pc = (rootPc + semi) % 12;
    const acc = mod(pc - LETTER_PC[l] + 6, 12) - 6;
    return { l, acc, pc, degree: def.degrees[i], isRoot: i === 0, idx: def.idx[i] };
  });
}

/** The scale written ascending (root → octave) starting around middle C. */
export function scaleAscending(root: Pitch, type: ScaleType): { note: Note; degree: string }[] {
  const notes = scaleNotes(root, type);
  let rootOct = 4;
  const rm = (o: number) => midiOf({ ...root, oct: o });
  if (rm(rootOct) < 60) rootOct++;
  if (rm(rootOct) > 71) rootOct--;
  const out = notes.map((n) => ({
    note: { l: n.l, acc: n.acc, oct: rootOct + Math.floor((root.l + n.idx) / 7) } as Note,
    degree: n.degree,
  }));
  out.push({ note: { ...root, oct: rootOct + 1 }, degree: '1' });
  return out;
}

export function scaleGaps(type: ScaleType): string[] {
  const s = SCALES[type].semis.concat(12);
  return s.slice(1).map((v, i) => { const d = v - s[i]; return d === 1 ? 'H' : d === 2 ? 'W' : d === 3 ? 'W+H' : String(d); });
}

/* ------------------------- Circle of fifths ------------------------- */

const P = (l: number, acc = 0): Pitch => ({ l, acc });
/** Position 0 = top (C), clockwise by fifths. */
export const MAJOR_KEYS: Pitch[] = [P(0), P(4), P(1), P(5), P(2), P(6), P(3, 1), P(1, -1), P(5, -1), P(2, -1), P(6, -1), P(3)];
export const MINOR_KEYS: Pitch[] = [P(5), P(2), P(6), P(3, 1), P(0, 1), P(4, 1), P(1, 1), P(6, -1), P(3), P(0), P(4), P(1)];
export const KEY_SIGS = ['0', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯', '5♭', '4♭', '3♭', '2♭', '1♭'];
export const circlePos = (pc: number) => (pc * 7) % 12;

export const samePitch = (a: Pitch, b: Pitch) => pcOf(a) === pcOf(b) && a.l === b.l;

/* ---------------- Parent key (shared key signature) ---------------- */

const PARENT_LETTER_OFFSET: Record<ScaleType, number> = { major: 0, majorPent: 0, minor: 2, minorPent: 2, dorian: 6 };
const PARENT_SEMIS: Record<ScaleType, number> = { major: 0, majorPent: 0, minor: 3, minorPent: 3, dorian: 10 };

/** The major key whose notes (and key signature) the scale shares, spelled consistently with the scale's root. */
export function parentMajor(root: Pitch, type: ScaleType): Pitch {
  const l = (root.l + PARENT_LETTER_OFFSET[type]) % 7;
  const pc = (pcOf(root) + PARENT_SEMIS[type]) % 12;
  return { l, acc: mod(pc - LETTER_PC[l] + 6, 12) - 6 };
}
/** Sharps (positive) or flats (negative) in a major key's signature. */
export const signatureCount = (major: Pitch): number =>
  scaleNotes(major, 'major').reduce((n, x) => n + (x.acc > 0 ? 1 : x.acc < 0 ? -1 : 0), 0);
export const signatureLabel = (c: number) => (c === 0 ? '0' : `${Math.abs(c)}${c > 0 ? '♯' : '♭'}`);
