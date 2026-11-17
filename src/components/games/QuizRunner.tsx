import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { record } from '../../lib/progress';
import SpotlightCard from '../reactbits/SpotlightCard';
import { RoundHud, RoundSummary, useRound } from './useRound';
import type { Voice } from '../theory/common';

export interface QuizQ {
  key: string;                                  // progress key for this kind of question
  prompt: ReactNode;
  visual?: ReactNode;
  options: { id: string; label: ReactNode }[];
  answer: string;
  explain: ReactNode;
  play?: () => void;                            // sound to (re)play
  autoplay?: boolean;
  layout?: 'chips' | 'grid' | 'wide';
}
export interface QuizDef {
  id: string; domain: string; title: string; sub: string; icon: string; group: string;
  levels: { id: string; label: string }[];
  ear?: boolean;
  make: (level: string, voice: Voice, prev?: QuizQ) => QuizQ;
}
export interface RunnerProps { level: string; voice: Voice; sprint: boolean; onExit: () => void }

export default function QuizRunner({ def, level, voice, sprint, onExit }: RunnerProps & { def: QuizDef }) {
  const lv = def.levels.find((l) => l.id === level) ?? def.levels[0];
  const r = useRound(`noteatab.best.${def.id}.${lv.id}.${sprint ? 'sprint' : 'practice'}`, sprint);
  const [q, setQ] = useState<QuizQ | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const auto = useRef<number | undefined>(undefined);
  const qRef = useRef<QuizQ | null>(null);
  qRef.current = q;

  const next = useCallback((prev?: QuizQ) => {
    window.clearTimeout(auto.current);
    const nq = def.make(lv.id, voice, prev);
    setQ(nq); setPicked(null);
    if (nq.autoplay && nq.play) window.setTimeout(() => nq.play!(), 200);
  }, [def, lv.id, voice]);

  useEffect(() => { next(); return () => window.clearTimeout(auto.current); }, [next]);

  const choose = (id: string) => {
    if (!q || picked || r.over) return;
    const ok = id === q.answer;
    setPicked(id);
    r.answer(ok);
    record(def.domain, q.key, ok);
    const wait = ok ? 900 : sprint ? 1800 : 0;
    if (wait) auto.current = window.setTimeout(() => (r.expired() ? r.finish() : next(q)), wait);
  };

  const again = () => { r.restart(); next(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cur = qRef.current;
      if (!cur || r.over) return;
      if (e.key === 'r' || e.key === 'R') { cur.play?.(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && picked && picked !== cur.answer) { e.preventDefault(); r.expired() ? r.finish() : next(cur); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= cur.options.length) choose(cur.options[n - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (r.over) return <RoundSummary r={r} title={def.title} onAgain={again} onExit={onExit} />;
  const wrong = picked !== null && q && picked !== q.answer;
  return (
    <SpotlightCard className={`card game ${picked && q ? (picked === q.answer ? 'ok' : 'no') : ''}`} spotlight="rgba(255,122,89,0.08)">
      <header className="card-head">
        <div><p className="eyebrow">{def.title} · {lv.label}{sprint ? ' · sprint' : ''}</p><h2>{q?.prompt}</h2></div>
        <div className="controls">
          {sprint && <span className={`clock ${r.left <= 10 ? 'low' : ''}`}>{r.left}s</span>}
          <button className="pill" onClick={r.finish}>{sprint ? 'End round' : 'Finish'}</button>
        </div>
      </header>
      <RoundHud r={r} />
      {q && (
        <>
          {q.play && <div className="ear"><button className="pill accent big" onClick={q.play}>🔊 {q.autoplay ? 'Play again' : 'Listen'} <kbd>R</kbd></button></div>}
          {q.visual && <div className="quiz-visual">{q.visual}</div>}
          <div className={`quiz-options ${q.layout ?? 'chips'}`} role="group" aria-label="Answers">
            {q.options.map((o, i) => {
              const state = picked ? (o.id === q.answer ? 'good' : o.id === picked ? 'bad' : 'dim') : '';
              return (
                <button key={o.id} className={`quiz-opt ${state}`} onClick={() => choose(o.id)} disabled={!!picked} aria-label={`Answer ${i + 1}`}>
                  <kbd>{i + 1}</kbd>{o.label}
                </button>
              );
            })}
          </div>
          <div className="feedback" aria-live="polite">
            {picked && (
              <p className={wrong ? 'bad' : 'good'}>{wrong ? '✗ Not quite. ' : '✓ Correct. '}<b>{q.explain}</b></p>
            )}
            {wrong && !sprint && <button className="pill accent" onClick={() => next(q)}>Next <kbd>Enter</kbd></button>}
            {wrong && sprint && <span className="muted">Next one coming up…</span>}
          </div>
        </>
      )}
    </SpotlightCard>
  );
}
