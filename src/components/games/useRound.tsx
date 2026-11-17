import { useCallback, useEffect, useRef, useState } from 'react';
import SpotlightCard from '../reactbits/SpotlightCard';

export const SPRINT_SECONDS = 60;
const load = (k: string) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const save = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

export interface Round {
  score: number; streak: number; bestStreak: number; asked: number; right: number; left: number; best: number; newBest: boolean; over: boolean;
  accuracy: number; sprint: boolean;
  /** Register an answer. Returns the points awarded. */
  answer: (correct: boolean, hinted?: boolean) => number;
  finish: () => void;
  restart: () => void;
  expired: () => boolean;
}

/** Score, streak, best score and the optional 60 s sprint clock shared by the new games. */
export function useRound(bestKey: string, sprint: boolean): Round {
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [asked, setAsked] = useState(0);
  const [right, setRight] = useState(0);
  const [left, setLeft] = useState(SPRINT_SECONDS);
  const [best, setBest] = useState(() => load(bestKey));
  const [newBest, setNewBest] = useState(false);
  const [over, setOver] = useState(false);
  const endAt = useRef(Date.now() + SPRINT_SECONDS * 1000);
  const live = useRef({ score: 0, best });
  live.current = { score, best };

  const finish = useCallback(() => {
    setOver(true);
    if (live.current.score > live.current.best) { setBest(live.current.score); setNewBest(true); save(bestKey, live.current.score); }
  }, [bestKey]);

  useEffect(() => {
    if (!sprint || over) return;
    const id = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) finish();
    }, 200);
    return () => window.clearInterval(id);
  }, [sprint, over, finish]);

  const answer = (correct: boolean, hinted = false) => {
    setAsked((n) => n + 1);
    if (!correct) { setStreak(0); return 0; }
    const pts = hinted ? 3 : 10 + Math.min(streak, 10);
    const ns = hinted ? 0 : streak + 1;
    setStreak(ns); setBestStreak((b) => Math.max(b, ns)); setRight((n) => n + 1); setScore((s) => s + pts);
    return pts;
  };
  const restart = () => {
    setScore(0); setStreak(0); setBestStreak(0); setAsked(0); setRight(0); setNewBest(false); setOver(false); setLeft(SPRINT_SECONDS);
    endAt.current = Date.now() + SPRINT_SECONDS * 1000;
  };
  return { score, streak, bestStreak, asked, right, left, best, newBest, over, sprint, accuracy: asked ? Math.round((right / asked) * 100) : 0, answer, finish, restart, expired: () => sprint && Date.now() >= endAt.current };
}

export function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return <div className={`stat ${accent ? 'accent' : ''}`}><b>{value}</b><small>{label}</small></div>;
}

export function RoundHud({ r }: { r: Round }) {
  return (
    <div className="hud">
      <Stat label="Score" value={r.score} accent />
      <Stat label="Streak" value={r.streak > 2 ? `🔥 ${r.streak}` : r.streak} />
      <Stat label="Accuracy" value={r.asked ? `${r.accuracy}%` : '–'} />
      <Stat label="Best" value={Math.max(r.best, r.score)} />
    </div>
  );
}

export function RoundSummary({ r, title, onAgain, onExit }: { r: Round; title: string; onAgain: () => void; onExit: () => void }) {
  return (
    <SpotlightCard className="card result-card" spotlight="rgba(79,209,197,0.12)">
      <p className="eyebrow">Round complete · {title}</p>
      <h2>{r.newBest ? '🎉 New personal best!' : 'Nice work'}</h2>
      <div className="stat-row">
        <Stat label="Score" value={r.score} accent />
        <Stat label="Accuracy" value={`${r.accuracy}%`} />
        <Stat label="Answered" value={`${r.right}/${r.asked}`} />
        <Stat label="Best streak" value={r.bestStreak} />
      </div>
      <div className="start-row"><button className="pill accent big" onClick={onAgain}>▶ Play again</button><button className="pill big" onClick={onExit}>Back to games</button></div>
    </SpotlightCard>
  );
}
