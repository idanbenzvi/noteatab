import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, allPositions, isValidFret, makeQuestion, sameSounding, type Mode, type Question, type Settings } from '../lib/game';
import { LETTERS, STRINGS, WRITTEN_OFFSET, noteName, type FretPos, type Note } from '../lib/music';
import { pluck, piano } from '../lib/audio';
import GameStaff from './GameStaff';
import { FretPicker, TabQuestion } from './TabViews';
import SpotlightCard from './reactbits/SpotlightCard';

const SPRINT_SECONDS = 60;
const MODES: { id: Mode; title: string; sub: string; icon: string }[] = [
  { id: 'tab2staff', title: 'Tab → Staff', sub: 'A fret number on a string. Click where that note sits on the treble clef.', icon: '𝄞' },
  { id: 'staff2tab', title: 'Staff → Tab', sub: 'A note on the treble clef. Click the string and fret where you would play it.', icon: '♯' },
  { id: 'ear', title: 'Ear → Staff', sub: 'Listen to a note, then write it on the staff. No tab to lean on.', icon: '♪' },
];

interface Result { correct: boolean; hinted: boolean; guessNote?: Note; guessPos?: FretPos }

const load = (k: string) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const save = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

export default function Games() {
  const [mode, setMode] = useState<Mode>('tab2staff');
  const [cfg, setCfg] = useState<Settings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<'menu' | 'play' | 'over'>('menu');
  const [q, setQ] = useState<Question | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [acc, setAcc] = useState(0);
  const [hint, setHint] = useState(false);
  const [sound, setSound] = useState(true);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [asked, setAsked] = useState(0);
  const [right, setRight] = useState(0);
  const [left, setLeft] = useState(SPRINT_SECONDS);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const endAt = useRef(0);
  const auto = useRef<number | undefined>(undefined);

  const bestKey = `fretmap.best.${mode}.${cfg.sprint ? 'sprint' : 'practice'}`;
  useEffect(() => { setBest(load(bestKey)); }, [bestKey]);

  // Guitar music is written an octave above where it sounds; a piano plays the written pitch.
  const sing = useCallback((written: number) => (
    cfg.instrument === 'piano' ? piano(written) : pluck(written - WRITTEN_OFFSET)
  ), [cfg.instrument]);
  const playQ = useCallback((qq: Question) => sing(qq.written), [sing]);

  const next = useCallback((prev?: Question) => {
    window.clearTimeout(auto.current);
    const nq = makeQuestion(cfg, prev);
    setQ(nq); setRes(null); setHint(false);
    if (mode === 'ear') window.setTimeout(() => sing(nq.written), 150);
  }, [cfg, mode, sing]);

  const start = () => {
    setScore(0); setStreak(0); setBestStreak(0); setAsked(0); setRight(0); setNewBest(false);
    setLeft(SPRINT_SECONDS); endAt.current = Date.now() + SPRINT_SECONDS * 1000;
    setPhase('play'); next();
  };

  const finish = useCallback(() => {
    window.clearTimeout(auto.current);
    setPhase('over');
  }, []);

  // keep best score in sync when a round ends
  useEffect(() => {
    if (phase !== 'over') return;
    if (score > best) { setBest(score); setNewBest(true); save(bestKey, score); }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // sprint clock
  useEffect(() => {
    if (phase !== 'play' || !cfg.sprint) return;
    const id = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) finish();
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, cfg.sprint, finish]);

  useEffect(() => () => window.clearTimeout(auto.current), []);

  const settle = (r: Result) => {
    if (!q || res) return;
    setRes(r);
    setAsked((n) => n + 1);
    if (r.correct) {
      const ns = r.hinted ? 0 : streak + 1;
      setStreak(ns); setBestStreak((b) => Math.max(b, ns)); setRight((n) => n + 1);
      setScore((s) => s + (r.hinted ? 3 : 10 + Math.min(streak, 10)));
    } else setStreak(0);
    if (sound || mode === 'ear') playQ(q);
    const wait = r.correct ? 900 : cfg.sprint ? 1700 : 0;
    if (wait) auto.current = window.setTimeout(() => (cfg.sprint && Date.now() >= endAt.current ? finish() : next(q)), wait);
  };

  const pickNote = (n: Note) => {
    if (!q || res) return;
    settle({ correct: sameSounding(n, q.written), hinted: hint, guessNote: n });
  };
  const pickFret = (p: FretPos) => {
    if (!q || res) return;
    settle({ correct: isValidFret(q.written, p), hinted: hint, guessPos: p });
  };

  // Enter / space → next question after a miss; R → replay; 1-3 → accidental
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.key === ' ') return;
      if ((e.key === 'Enter' || e.key === ' ') && res && !res.correct) { e.preventDefault(); cfg.sprint && Date.now() >= endAt.current ? finish() : next(q ?? undefined); }
      if (e.key === 'r' && q) playQ(q);
      if (cfg.accidentals && ['1', '2', '3'].includes(e.key)) setAcc([0, 1, -1][Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, res, q, cfg.sprint, cfg.accidentals, next, finish, playQ]);

  const toggleString = (i: number) => setCfg((c) => {
    const strings = c.strings.map((v, j) => (j === i ? !v : v));
    return strings.some(Boolean) ? { ...c, strings } : c;
  });

  const answerNote: Note | null = q && res ? (res.guessNote && res.correct ? res.guessNote : q.note) : null;
  const accuracy = asked ? Math.round((right / asked) * 100) : 0;
  const m = MODES.find((x) => x.id === mode)!;

  /* ------------------------------ menu ------------------------------ */
  if (phase === 'menu' || phase === 'over') {
    return (
      <div className="app">
        {phase === 'over' && (
          <SpotlightCard className="card result-card" spotlight="rgba(79,209,197,0.12)">
            <p className="eyebrow">Round complete</p>
            <h2>{newBest ? '🎉 New personal best!' : 'Nice work'}</h2>
            <div className="stat-row">
              <Stat label="Score" value={score} accent />
              <Stat label="Accuracy" value={`${accuracy}%`} />
              <Stat label="Answered" value={`${right}/${asked}`} />
              <Stat label="Best streak" value={bestStreak} />
            </div>
          </SpotlightCard>
        )}
        <SpotlightCard className="card">
          <p className="eyebrow">Practice</p>
          <h2>Train your eyes and your ears</h2>
          <p className="hint">Reading the staff and reading tab are two halves of the same skill. Pick a game, set your range, and build the reflex.</p>
          <div className="mode-grid" role="radiogroup" aria-label="Game mode">
            {MODES.map((x) => (
              <button key={x.id} role="radio" aria-checked={mode === x.id} className={`mode ${mode === x.id ? 'on' : ''}`} onClick={() => setMode(x.id)}>
                <span className="mode-icon">{x.icon}</span>
                <b>{x.title}</b>
                <small>{x.sub}</small>
              </button>
            ))}
          </div>

          <div className="settings">
            <div className="setting">
              <span className="setting-label">Frets</span>
              <div className="seg">
                {[[3, '0–3'], [7, '0–7'], [12, '0–12'], [19, '0–19']].map(([v, l]) => (
                  <button key={v} className={cfg.maxFret === v ? 'on' : ''} onClick={() => setCfg({ ...cfg, maxFret: v as number })}>{l}</button>
                ))}
              </div>
            </div>
            <div className="setting">
              <span className="setting-label">Notes</span>
              <div className="seg">
                <button className={!cfg.accidentals ? 'on' : ''} onClick={() => setCfg({ ...cfg, accidentals: false })}>Naturals</button>
                <button className={cfg.accidentals ? 'on' : ''} onClick={() => setCfg({ ...cfg, accidentals: true })}>+ ♯ ♭</button>
              </div>
            </div>
            <div className="setting">
              <span className="setting-label">Strings</span>
              <div className="str-chips">
                {STRINGS.map((s, i) => (
                  <button key={i} className={`str-chip ${cfg.strings[i] ? 'on' : ''}`} onClick={() => toggleString(i)} aria-pressed={cfg.strings[i]} title={`String ${s.label} (${s.name})`}>{s.label}</button>
                )).reverse()}
              </div>
            </div>
            <div className="setting">
              <span className="setting-label">Sound</span>
              <div className="seg">
                <button className={cfg.instrument === 'guitar' ? 'on' : ''} onClick={() => setCfg({ ...cfg, instrument: 'guitar' })}>🎸 Guitar</button>
                <button className={cfg.instrument === 'piano' ? 'on' : ''} onClick={() => setCfg({ ...cfg, instrument: 'piano' })}>🎹 Piano</button>
              </div>
            </div>
            <div className="setting">
              <span className="setting-label">Round</span>
              <div className="seg">
                <button className={!cfg.sprint ? 'on' : ''} onClick={() => setCfg({ ...cfg, sprint: false })}>Endless</button>
                <button className={cfg.sprint ? 'on' : ''} onClick={() => setCfg({ ...cfg, sprint: true })}>{SPRINT_SECONDS}s sprint</button>
              </div>
            </div>
          </div>

          <div className="start-row">
            <button className="pill accent big" onClick={start}>▶ Start {m.title}</button>
            <span className="muted">Best here: <b>{best}</b></span>
          </div>
        </SpotlightCard>
      </div>
    );
  }

  /* ------------------------------ play ------------------------------ */
  return (
    <div className="app">
      <SpotlightCard className={`card game ${res ? (res.correct ? 'ok' : 'no') : ''}`} spotlight="rgba(255,122,89,0.08)">
        <header className="card-head">
          <div>
            <p className="eyebrow">{m.title}{cfg.sprint ? ' · sprint' : ''}</p>
            <h2>{mode === 'tab2staff' ? 'Where does this note live on the staff?' : mode === 'staff2tab' ? 'Where would you play this note?' : 'What note did you hear?'}</h2>
          </div>
          <div className="controls">
            {cfg.sprint && <span className={`clock ${left <= 10 ? 'low' : ''}`}>{left}s</span>}
            <button className={`pill ${sound ? 'on' : ''}`} onClick={() => setSound(!sound)}>{sound ? '🔊' : '🔈'}</button>
            <button className="pill" onClick={finish}>{cfg.sprint ? 'End round' : 'Finish'}</button>
          </div>
        </header>

        <div className="hud">
          <Stat label="Score" value={score} accent />
          <Stat label="Streak" value={streak > 2 ? `🔥 ${streak}` : streak} />
          <Stat label="Accuracy" value={asked ? `${accuracy}%` : '–'} />
          <Stat label="Best" value={Math.max(best, score)} />
        </div>

        {q && (
          <>
            {mode === 'tab2staff' && <TabQuestion pos={q.pos} />}
            {mode === 'ear' && (
              <div className="ear">
                <button className="pill accent big" onClick={() => playQ(q)}>🔊 Play again <kbd>R</kbd></button>
                {!res && <span className="muted">{cfg.instrument === 'piano' ? 'The piano plays the note exactly as written.' : 'The written note is an octave above what you hear on guitar.'}</span>}
              </div>
            )}
            {mode !== 'staff2tab' && (
              <>
                {cfg.accidentals && !res && (
                  <div className="acc-pick">
                    <span className="setting-label">Next click is</span>
                    <div className="seg">
                      {([[0, '♮ natural'], [1, '♯ sharp'], [-1, '♭ flat']] as [number, string][]).map(([v, l], i) => (
                        <button key={v} className={acc === v ? 'on' : ''} onClick={() => setAcc(v)} title={`Key ${i + 1}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
                <GameStaff acc={cfg.accidentals ? acc : 0} interactive={!res} onPick={pickNote}
                  answer={answerNote} guess={res && !res.correct ? res.guessNote : null} />
              </>
            )}
            {mode === 'staff2tab' && (
              <>
                <GameStaff acc={0} interactive={false} question={q.note} />
                <FretPicker maxFret={cfg.maxFret} strings={cfg.strings} interactive={!res} onPick={pickFret}
                  picked={res?.guessPos} correct={res ? allPositions(q.written, cfg.maxFret) : []} />
              </>
            )}

            <div className="feedback" aria-live="polite">
              {!res && (
                <button className="link" disabled={hint} onClick={() => setHint(true)}>
                  {hint ? <>Hint: it is a <b>{LETTERS[q.note.l]}</b></> : 'Need a hint? (worth fewer points)'}
                </button>
              )}
              {res && (
                <p className={res.correct ? 'good' : 'bad'}>
                  {res.correct ? <>✓ Correct{res.hinted ? ' (with hint)' : ''}.</> : <>✗ Not quite.</>}{' '}
                  <b>{explain(q)}</b>
                </p>
              )}
              {res && !res.correct && !cfg.sprint && <button className="pill accent" onClick={() => next(q)}>Next <kbd>Enter</kbd></button>}
              {res && !res.correct && cfg.sprint && <span className="muted">Next one coming up…</span>}
            </div>
          </>
        )}
      </SpotlightCard>
    </div>
  );
}

function explain(q: Question) {
  const places = allPositions(q.written, 19);
  const other = places.filter((p) => !(p.s === q.pos.s && p.f === q.pos.f));
  const nm = noteName(q.note, true);
  const where = `string ${STRINGS[q.pos.s].label}, fret ${q.pos.f}`;
  return `${nm} is ${where}${other.length ? ` (also ${other.slice(0, 3).map((p) => `${STRINGS[p.s].label}/${p.f}`).join(', ')})` : ''}.`;
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return <div className={`stat ${accent ? 'accent' : ''}`}><b>{value}</b><small>{label}</small></div>;
}
