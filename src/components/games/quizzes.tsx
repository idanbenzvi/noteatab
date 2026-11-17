import { LETTERS, LETTER_PC, mod, noteFromStep, noteName, pcOf, pitchName, type Note, type Pitch } from '../../lib/music';
import {
  INTERVALS, QUALITY_BY_ID, SEMIS_TO_NUMBER, intervalBetween, majorKeyForCount, minorKeyForCount, noteAbove, sigLetters,
} from '../../lib/theory';
import { playChord } from '../../lib/audio';
import { pickWeighted } from '../../lib/progress';
import { BASE_INFO, TIME_SIGS, randomBar, rhythmKey, variation, type REvent } from '../../lib/rhythm';
import { schedulePattern } from '../../lib/rhythmAudio';
import { spellings } from '../theory/Enharmonics';
import { MiniStaff, type Clef } from '../theory/MiniStaff';
import RhythmStaff from '../theory/RhythmStaff';
import { soundReal, type Voice } from '../theory/common';
import type { QuizDef, QuizQ } from './QuizRunner';

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[rnd(a.length)];
const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* ------------------------------ interval ear ------------------------------ */

const IV_SETS: Record<string, number[]> = {
  easy: [3, 4, 5, 7, 12],
  medium: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12],
  hard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};
const intervalEar: QuizDef = {
  id: 'interval-ear', domain: 'interval', title: 'Interval ear training', icon: '♬', group: 'Train your ear', ear: true,
  sub: 'Two notes: how far apart are they? Learn the sound of each interval.',
  levels: [{ id: 'easy', label: 'Easy (m3 M3 P4 P5 8ve)' }, { id: 'medium', label: 'Medium (no tritone)' }, { id: 'hard', label: 'Hard (all, incl. together)' }],
  make(level, voice) {
    const set = IV_SETS[level];
    const semis = pickWeighted(set, (s) => String(INTERVALS.find((i) => i.semis === s)!.short), 'interval');
    const info = INTERVALS.find((i) => i.semis === semis)!;
    const root = 50 + rnd(14);
    const dir = level === 'easy' ? 'up' : pick(['up', 'down']);
    const harmonic = level === 'hard' && Math.random() < 0.3;
    const [a, b] = dir === 'up' ? [root, root + semis] : [root + semis, root];
    const how = harmonic ? 'both notes together' : dir === 'up' ? 'going up' : 'going down';
    return {
      key: info.short, prompt: <>What interval do you hear? <span className="muted">({how})</span></>,
      options: set.map((s) => { const i = INTERVALS.find((x) => x.semis === s)!; return { id: i.short, label: <><b>{i.short}</b> <small>{i.name}</small></> }; }),
      answer: info.short, layout: 'grid', autoplay: true,
      play: () => { soundReal(voice, a, 0, 1.2); soundReal(voice, b, harmonic ? 0 : 0.75, 1.6); },
      explain: <>{info.name} ({info.short}), {info.semis} semitone{info.semis === 1 ? '' : 's'}. Think of <i>{info.song}</i>. {info.tip}</>,
    };
  },
};

/* ------------------------------ chord ear ------------------------------ */

const CH_SETS: Record<string, string[]> = {
  easy: ['maj', 'min'], medium: ['maj', 'min', 'dim', 'aug'], hard: ['maj', 'min', 'dim', 'aug', 'sus4', 'dom7', 'maj7', 'min7'],
};
const chordEar: QuizDef = {
  id: 'chord-ear', domain: 'chord', title: 'Chord quality ear training', icon: '𝄚', group: 'Train your ear', ear: true,
  sub: 'Major or minor? Dominant or major 7th? Name the chord from its sound.',
  levels: [{ id: 'easy', label: 'Easy (major / minor)' }, { id: 'medium', label: 'Medium (+ dim, aug)' }, { id: 'hard', label: 'Hard (+ sus4, sevenths)' }],
  make(level, voice) {
    const id = pickWeighted(CH_SETS[level], (x) => x, 'chord');
    const q = QUALITY_BY_ID[id];
    const root = 45 + rnd(12);
    const midis = q.offs.map((o) => root + o + (q.offs.length === 3 ? 12 : 0));
    midis.unshift(root);
    return {
      key: id, prompt: 'What kind of chord is this?',
      options: CH_SETS[level].map((x) => ({ id: x, label: <><b>{QUALITY_BY_ID[x].name}</b> <small>{QUALITY_BY_ID[x].formula}</small></> })),
      answer: id, layout: 'grid', autoplay: true,
      play: () => playChord(voice, midis, { dur: 2.4 }),
      explain: <>{q.name} chord: {q.formula}. {q.sound}</>,
    };
  },
};

/* ------------------------------ key signatures ------------------------------ */

const sigExplain = (count: number): string => {
  if (count === 0) return 'No sharps or flats: C major (or A minor).';
  const major = pitchName(majorKeyForCount(count)), minor = pitchName(minorKeyForCount(count));
  const letters = sigLetters(count).map((l) => LETTERS[l]);
  if (count > 0) return `Last sharp is ${letters[letters.length - 1]}♯, so go up a half step: ${major} major (relative minor ${minor}).`;
  if (count === -1) return 'One flat (B♭) is F major, a special case (relative minor D minor).';
  return `The second-to-last flat is ${letters[letters.length - 2]}♭, which names the key: ${major} major (relative minor ${minor}).`;
};

const keySig: QuizDef = {
  id: 'keysig', domain: 'keysig', title: 'Key signatures', icon: '♯', group: 'Read music',
  sub: 'Name the key from its sharps and flats (or the other way round).',
  levels: [{ id: 'major4', label: 'Major, up to 4 ♯/♭' }, { id: 'major', label: 'All major keys' }, { id: 'minor', label: 'Major + minor' }, { id: 'reverse', label: 'Key → signature' }],
  make(level) {
    const max = level === 'major4' ? 4 : 7;
    const counts = Array.from({ length: 2 * max + 1 }, (_, i) => i - max);
    const count = pickWeighted(counts, (c) => String(c), 'keysig');
    const names = (c: number, minor: boolean) => `${pitchName(minor ? minorKeyForCount(c) : majorKeyForCount(c))} ${minor ? 'minor' : 'major'}`;
    if (level === 'reverse') {
      const near = shuffle(counts.filter((c) => c !== count && Math.abs(c - count) <= 3)).slice(0, 3);
      const opts = shuffle([count, ...near]);
      return {
        key: String(count), prompt: <>Which signature belongs to <b>{names(count, false)}</b>?</>, layout: 'wide',
        options: opts.map((c) => ({ id: String(c), label: <MiniStaff keySig={c} width={250} sp={9} gap={0} caption={`${Math.abs(c)} ${c >= 0 ? 'sharps' : 'flats'}`} /> })),
        answer: String(count), explain: <>{names(count, false)} has {count === 0 ? 'no sharps or flats' : `${Math.abs(count)} ${count > 0 ? 'sharp' : 'flat'}${Math.abs(count) > 1 ? 's' : ''}`}. {sigExplain(count)}</>,
      };
    }
    const minor = level === 'minor' && Math.random() < 0.5;
    const clef: Clef = level === 'major4' ? 'treble' : pick<Clef>(['treble', 'bass']);
    const near = shuffle(counts.filter((c) => c !== count && Math.abs(c - count) <= 2)).slice(0, 3);
    const opts = [count, ...near.slice(0, level === 'major4' ? 3 : 2)].map((c) => names(c, minor));
    if (level !== 'major4') opts.push(names(count, !minor));            // the relative key is the classic trap
    const uniq = [...new Set(opts)].slice(0, 4);
    while (uniq.length < 4) { const c = pick(counts); const nm = names(c, minor); if (!uniq.includes(nm)) uniq.push(nm); }
    return {
      key: String(count), prompt: <>Which <b>{minor ? 'minor' : 'major'}</b> key has this signature?</>,
      visual: <MiniStaff clef={clef} keySig={count} width={420} gap={0} sp={11} window={clef === 'treble' ? [26, 42] : [14, 30]} caption="Key signature" />,
      options: shuffle(uniq).map((n) => ({ id: n, label: <b>{n}</b> })), answer: names(count, minor),
      explain: <>{sigExplain(count)}</>,
    };
  },
};

/* ------------------------------ clef reading ------------------------------ */

export function describePosition(step: number, clef: Clef): string {
  const off = step - (clef === 'treble' ? 30 : 18);
  const ord = (n: number) => ['', '1st', '2nd', '3rd', '4th', '5th', '6th'][n] ?? `${n}th`;
  if (off >= 0 && off <= 8) return off % 2 === 0 ? `on the ${ord(off / 2 + 1)} line (counting from the bottom)` : `in the ${ord((off + 1) / 2)} space`;
  if (off < 0) return off === -1 ? 'in the space just below the staff' : off % 2 === 0 ? `on the ${ord(-off / 2)} ledger line below` : `in the space under the ${ord((-off - 1) / 2)} ledger line`;
  const d = off - 8;
  return d === 1 ? 'in the space just above the staff' : d % 2 === 0 ? `on the ${ord(d / 2)} ledger line above` : `in the space over the ${ord((d - 1) / 2)} ledger line`;
}
const RANGES: Record<string, [Clef, number, number][]> = {
  treble: [['treble', 28, 40]], bass: [['bass', 16, 28]], both: [['treble', 26, 42], ['bass', 14, 30]],
};
const clefReading: QuizDef = {
  id: 'clef', domain: 'clef', title: 'Note names & ledger lines', icon: '𝄞', group: 'Read music',
  sub: 'Name the note on the treble or bass clef, including ledger lines.',
  levels: [{ id: 'treble', label: 'Treble clef' }, { id: 'bass', label: 'Bass clef' }, { id: 'both', label: 'Both clefs, more ledger lines' }],
  make(level, _v, prev) {
    const [clef, lo, hi] = pick(RANGES[level]);
    const steps = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const prevKey = prev?.key;
    const step = pickWeighted(steps.filter((s) => `${clef}:${s}` !== prevKey), (s) => `${clef}:${s}`, 'clef');
    const n: Note = noteFromStep(step, 0);
    return {
      key: `${clef}:${step}`, prompt: <>Which note is this? <span className="muted">({clef} clef)</span></>,
      visual: <MiniStaff clef={clef} notes={[{ n, cls: 'sel' }]} width={360} gap={0} sp={12} window={clef === 'treble' ? [22, 44] : [12, 32]} caption={`A note in the ${clef} clef`} />,
      options: LETTERS.map((l, i) => ({ id: l, label: <b>{l}</b> })), answer: LETTERS[n.l],
      explain: <>{noteName(n, true)}: {describePosition(step, clef)}. {clef === 'treble' ? 'Lines E G B D F; spaces F A C E.' : 'Lines G B D F A; spaces A C E G.'}</>,
    };
  },
};

/* ------------------------------ enharmonics ------------------------------ */

const enharmonic: QuizDef = {
  id: 'enharmonic', domain: 'enharm', title: 'Enharmonic names', icon: '♮', group: 'Read music',
  sub: 'Same key, different name: find the note that sounds identical.',
  levels: [{ id: 'simple', label: 'Black keys (C♯ = D♭)' }, { id: 'hard', label: 'Includes E♯, C♭, 𝄪' }],
  make(level) {
    const pcs = level === 'simple' ? [1, 3, 6, 8, 10] : Array.from({ length: 12 }, (_, i) => i);
    const pc = pickWeighted(pcs, (p) => String(p), 'enharm');
    const sp = spellings(pc).filter((s) => level === 'hard' || Math.abs(s.acc) <= 1);
    const [asked, same] = shuffle(sp.length >= 2 ? sp : spellings(pc)).slice(0, 2);
    const wrongPcs = shuffle(pcs.filter((p) => p !== pc && (level === 'simple' || Math.abs(mod(p - pc + 6, 12) - 6) <= 4)));
    const wrongs = wrongPcs.map((p) => pick(spellings(p).filter((s) => level === 'hard' || Math.abs(s.acc) <= 1))).slice(0, 3);
    const opts = shuffle([same, ...wrongs]);
    return {
      key: String(pc), prompt: <>Which note sounds the <b>same</b> as <b>{pitchName(asked)}</b>?</>,
      options: opts.map((o) => ({ id: pitchName(o), label: <b>{pitchName(o)}</b> })), answer: pitchName(same),
      explain: <>{pitchName(asked)} and {pitchName(same)} are one pitch: the same piano key and the same fret. The spelling follows the key: sharps in sharp keys, flats in flat keys.</>,
    };
  },
};

/* ------------------------------ interval spelling ------------------------------ */

const SPELL_SETS: Record<string, number[]> = {
  easy: [2, 4, 5, 7, 9, 11, 12], medium: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11], hard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const spellInterval: QuizDef = {
  id: 'spell', domain: 'spell', title: 'Spell the interval', icon: '3', group: 'Read music',
  sub: 'Write the note a given interval above. Letters first, then semitones.',
  levels: [{ id: 'easy', label: 'Easy (major & perfect, natural roots)' }, { id: 'medium', label: 'Medium (adds minor)' }, { id: 'hard', label: 'Hard (♯/♭ roots, tritone)' }],
  make(level) {
    for (let tries = 0; tries < 50; tries++) {
      const semis = pickWeighted(SPELL_SETS[level], (s) => String(s), 'spell');
      const rootL = rnd(7);
      const acc = level === 'hard' ? pick([-1, 0, 0, 1]) : 0;
      const root: Note = { l: rootL, acc, oct: 4 };
      const number = SEMIS_TO_NUMBER[semis];
      const top = noteAbove(root, number, semis);
      if (Math.abs(top.acc) > 1) continue;
      if (level !== 'hard' && Math.abs(root.acc) > 0) continue;
      const iv = intervalBetween(root, top);
      const names = new Set<string>([pitchName(top)]);
      const wrong: Pitch[] = [
        { l: top.l, acc: top.acc + 1 }, { l: top.l, acc: top.acc - 1 },
        enh(top, 1), enh(top, -1),
      ];
      const opts: Pitch[] = [top];
      for (const w of shuffle(wrong)) { if (Math.abs(w.acc) <= 1 && !names.has(pitchName(w)) && opts.length < 4) { names.add(pitchName(w)); opts.push(w); } }
      if (opts.length < 4) continue;
      const info = INTERVALS.find((i) => i.semis === semis)!;
      const letters = Array.from({ length: number }, (_, i) => LETTERS[(rootL + i) % 7]).join(' ');
      return {
        key: iv.short, prompt: <>What is a <b>{iv.name}</b> above <b>{pitchName(root)}</b>?</>,
        visual: <MiniStaff notes={[{ n: root, cls: 'sel', label: pitchName(root) }]} width={300} gap={0} sp={11} caption={`Root note ${pitchName(root)}`} />,
        options: shuffle(opts).map((o) => ({ id: pitchName(o), label: <b>{pitchName(o)}</b> })), answer: pitchName(top),
        explain: <>Count letters: {letters} gives a {number}{['', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'][number]}. Then {semis} semitones makes it {info.name}, so the note is {pitchName(top)}.</>,
      };
    }
    return spellInterval.make('easy', 'guitar');
  },
};
/** The same pitch as `top` spelled on a neighbouring letter (a plausible-looking wrong answer). */
function enh(top: Note, dl: number): Pitch {
  const l = mod(top.l + dl, 7);
  return { l, acc: mod(pcOf(top) - LETTER_PC[l] + 6, 12) - 6 };
}

/* ------------------------------ rhythm reading ------------------------------ */

const describeBar = (bar: REvent[]) => bar.map((e) => (e.rest ? `${BASE_INFO[e.base].restName.toLowerCase()}` : BASE_INFO[e.base].name.replace(' note', ' note').toLowerCase()) + (e.dot ? ' (dotted)' : '')).join(', ');
const rhythmPick: QuizDef = {
  id: 'rhythm-pick', domain: 'rhythm', title: 'Hear it, read it', icon: '𝅘𝅥𝅮', group: 'Rhythm', ear: true,
  sub: 'Listen to a bar of rhythm and choose the notation that matches.',
  levels: [{ id: '1', label: 'Level 1: quarters & eighths' }, { id: '2', label: 'Level 2: adds rests' }, { id: '3', label: 'Level 3: sixteenths, 3/4, 6/8' }],
  make(level, voice) {
    const lv = Number(level) as 1 | 2 | 3;
    const sig = lv === 3 ? pick([TIME_SIGS[0], TIME_SIGS[0], TIME_SIGS[1], TIME_SIGS[3]]) : TIME_SIGS[0];
    const bar = randomBar(sig, lv);
    const opts = new Map<string, REvent[]>([[rhythmKey(bar), bar]]);
    for (let i = 0; i < 30 && opts.size < 3; i++) { const v = variation(bar, sig, lv); opts.set(rhythmKey(v), v); }
    const list = shuffle([...opts.entries()]);
    return {
      key: `bar${lv}`, prompt: 'Which rhythm did you hear?', layout: 'wide', autoplay: true,
      play: () => { schedulePattern(bar, sig, sig.group === 6 ? 56 : 88, { voice, pitch: voice === 'piano' ? 60 : 55, countIn: true }); },
      options: list.map(([k, b]) => ({ id: k, label: <RhythmStaff events={b} sig={sig} counts={false} lineOnly small width={420} pulse={false} caption="A rhythm option" /> })),
      answer: rhythmKey(bar),
      explain: <>In {sig.label}: {describeBar(bar)}.</>,
    };
  },
};

export const QUIZZES: QuizDef[] = [clefReading, keySig, enharmonic, spellInterval, intervalEar, chordEar, rhythmPick];
export const QUIZ_BY_ID = Object.fromEntries(QUIZZES.map((q) => [q.id, q])) as Record<string, QuizDef>;
export type { QuizQ };
