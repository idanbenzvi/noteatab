import type { ReactNode } from 'react';
import QuizRunner, { type RunnerProps } from './QuizRunner';
import { QUIZ_BY_ID } from './quizzes';
import RhythmTap from './RhythmTap';
import FretFinder from './FretFinder';

export interface GameEntry {
  id: string; title: string; sub: string; icon: string; section: string;
  levels: { id: string; label: string }[]; ear?: boolean;
  render: (p: RunnerProps) => ReactNode;
}

const quiz = (id: string, section: string): GameEntry => {
  const d = QUIZ_BY_ID[id];
  return { id: d.id, title: d.title, sub: d.sub, icon: d.icon, section, levels: d.levels, ear: d.ear, render: (p) => <QuizRunner def={d} {...p} /> };
};

export const EXTRA_GAMES: GameEntry[] = [
  { id: 'finder', title: 'Fretboard finder', sub: 'Given a note name, click where it lives on the neck, or find every one of them.', icon: '⌖', section: 'Staff & tab',
    levels: [{ id: 'string', label: 'One string, naturals' }, { id: 'sharps', label: 'One string, with ♯/♭' }, { id: 'all', label: 'Find every one (frets 0–12)' }],
    render: (p) => <FretFinder {...p} /> },
  quiz('clef', 'Reading theory'), quiz('keysig', 'Reading theory'), quiz('enharmonic', 'Reading theory'), quiz('spell', 'Reading theory'),
  quiz('interval-ear', 'Ear training'), quiz('chord-ear', 'Ear training'),
  { ...quiz('rhythm-pick', 'Rhythm'), section: 'Rhythm' },
  { id: 'rhythm-tap', title: 'Tap the rhythm', sub: 'A bar is shown, you get a count-in, then tap each note in time. Timing is measured in milliseconds.', icon: '𝅘𝅥', section: 'Rhythm',
    levels: [{ id: '1', label: 'Level 1: quarters & eighths' }, { id: '2', label: 'Level 2: adds rests' }, { id: '3', label: 'Level 3: sixteenths, 3/4' }],
    render: (p) => <RhythmTap {...p} /> },
];
export const EXTRA_BY_ID = Object.fromEntries(EXTRA_GAMES.map((g) => [g.id, g])) as Record<string, GameEntry>;
