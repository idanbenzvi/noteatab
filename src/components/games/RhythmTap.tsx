import { useCallback, useEffect, useRef, useState } from 'react';
import { ac } from '../../lib/audio';
import { record } from '../../lib/progress';
import { TIME_SIGS, randomBar, onsets, type REvent, type TimeSig } from '../../lib/rhythm';
import { schedulePattern } from '../../lib/rhythmAudio';
import RhythmStaff from '../theory/RhythmStaff';
import SpotlightCard from '../reactbits/SpotlightCard';
import { RoundHud, RoundSummary, useRound } from './useRound';
import type { RunnerProps } from './QuizRunner';

type Phase = 'ready' | 'counting' | 'tapping' | 'result';
type Status = 'hit' | 'miss' | 'late' | 'early';
const TOL = 0.17, REACH = 0.3;                 // seconds: "on the beat" window and the furthest tap still matched to a note

export default function RhythmTap({ level, voice, sprint, onExit }: RunnerProps) {
  const lv = (Number(level) || 1) as 1 | 2 | 3;
  const r = useRound(`noteatab.best.rhythm-tap.${lv}.${sprint ? 'sprint' : 'practice'}`, sprint);
  const [bpm, setBpm] = useState(lv === 3 ? 80 : 72);
  const [sig, setSig] = useState<TimeSig>(TIME_SIGS[0]);
  const [bar, setBar] = useState<REvent[] | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [offsets, setOffsets] = useState<number[]>([]);
  const [extras, setExtras] = useState(0);
  const [flash, setFlash] = useState(0);
  const [perfect, setPerfect] = useState<boolean | null>(null);
  const taps = useRef<number[]>([]);
  const expected = useRef<{ idx: number; t: number }[]>([]);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

  const newBar = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    const s = lv === 3 && Math.random() < 0.3 ? TIME_SIGS[1] : TIME_SIGS[0];
    setSig(s); setBar(randomBar(s, lv)); setPhase('ready'); setStatus({}); setOffsets([]); setExtras(0); setPerfect(null);
  }, [lv]);
  useEffect(() => { newBar(); return () => timers.current.forEach(clearTimeout); }, [newBar]);

  const hear = () => { if (bar) schedulePattern(bar, sig, bpm, { voice, pitch: voice === 'piano' ? 60 : 55, countIn: true, metronome: false }); };

  const evaluate = useCallback(() => {
    if (!bar) return;
    const exp = expected.current;
    const used = new Set<number>();
    const st: Record<number, Status> = {};
    const offs: number[] = [];
    exp.forEach(({ idx, t }) => {
      let best = -1, bd = 9;
      taps.current.forEach((tp, i) => { if (used.has(i)) return; const d = Math.abs(tp - t); if (d < bd) { bd = d; best = i; } });
      if (best >= 0 && bd <= REACH) {
        used.add(best);
        const dt = taps.current[best] - t;
        offs.push(dt);
        st[idx] = Math.abs(dt) <= TOL ? 'hit' : dt < 0 ? 'early' : 'late';
      } else st[idx] = 'miss';
    });
    const extra = taps.current.length - used.size;
    const ok = Object.values(st).every((v) => v === 'hit') && extra === 0;
    setStatus(st); setOffsets(offs); setExtras(extra); setPerfect(ok); setPhase('result');
    r.answer(ok);
    record('rhythm-tap', `L${lv}`, ok);
    if (sprint && ok) timers.current.push(window.setTimeout(() => (r.expired() ? r.finish() : newBar()), 1100));
  }, [bar, lv, newBar, r, sprint]);

  const startTap = useCallback(() => {
    if (!bar || phaseRef.current !== 'ready') return;
    const c = ac();
    const sch = schedulePattern(bar, sig, bpm, { metronome: true, countIn: true, silent: true });
    const lat = c.outputLatency || c.baseLatency || 0;     // we hear a click slightly after it is scheduled
    const ons = onsets(bar);
    expected.current = ons.filter((o) => !o.rest).map((o) => ({ idx: o.index, t: sch.times[o.index] + lat }));
    taps.current = [];
    setPhase('counting'); setStatus({});
    const now = c.currentTime;
    timers.current.push(window.setTimeout(() => setPhase('tapping'), Math.max(0, (sch.startAt - 0.12 - now) * 1000)));
    timers.current.push(window.setTimeout(evaluate, Math.max(0, (sch.endAt + REACH + 0.05 - now) * 1000)));
  }, [bar, sig, bpm, evaluate]);

  const tap = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'ready') { startTap(); return; }
    if (p !== 'counting' && p !== 'tapping') return;
    taps.current.push(ac().currentTime);
    setFlash((f) => f + 1);
  }, [startTap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
        e.preventDefault();
        if (phaseRef.current === 'result') { if (!sprint) newBar(); } else tap();
      }
      if (e.key === 'r' || e.key === 'R') if (phaseRef.current === 'ready') hear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (r.over) return <RoundSummary r={r} title="Tap the rhythm" onAgain={() => { r.restart(); newBar(); }} onExit={onExit} />;
  const avg = offsets.length ? Math.round((offsets.reduce((a, b) => a + b, 0) / offsets.length) * 1000) : 0;
  return (
    <SpotlightCard className={`card game ${perfect === null ? '' : perfect ? 'ok' : 'no'}`} spotlight="rgba(255,122,89,0.08)">
      <header className="card-head">
        <div><p className="eyebrow">Tap the rhythm · Level {lv}{sprint ? ' · sprint' : ''}</p><h2>Tap this rhythm in time</h2></div>
        <div className="controls">
          {sprint && <span className={`clock ${r.left <= 10 ? 'low' : ''}`}>{r.left}s</span>}
          <button className="pill" onClick={r.finish}>{sprint ? 'End round' : 'Finish'}</button>
        </div>
      </header>
      <RoundHud r={r} />
      {bar && <RhythmStaff events={bar} sig={sig} status={status} caption="The rhythm to tap" />}
      <div className="tap-controls">
        <div className="seg" role="radiogroup" aria-label="Tempo">
          {[60, 72, 84, 100].map((b) => <button key={b} className={bpm === b ? 'on' : ''} onClick={() => setBpm(b)} disabled={phase === 'counting' || phase === 'tapping'}>{b}</button>)}
        </div>
        <span className="muted">bpm</span>
        <button className="pill" onClick={hear} disabled={phase !== 'ready'}>🔊 Hear it first <kbd>R</kbd></button>
      </div>
      <button className={`tap-pad ${phase} ${flash % 2 ? 'f1' : 'f2'}`} onPointerDown={(e) => { e.preventDefault(); tap(); }} aria-label="Tap pad"
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); }}>
        {phase === 'ready' && <>▶ Tap here (or press <kbd>Space</kbd>) to start: a one-bar count-in, then tap each note</>}
        {phase === 'counting' && <>Count-in… get ready</>}
        {phase === 'tapping' && <>TAP!</>}
        {phase === 'result' && <>{perfect ? '✓ Perfect bar' : 'Not quite'}</>}
      </button>
      <div className="feedback" aria-live="polite">
        {phase === 'result' && (
          <>
            <p className={perfect ? 'good' : 'bad'}>
              {Object.values(status).filter((v) => v === 'hit').length}/{Object.keys(status).length} notes on the beat
              {extras > 0 && <> · {extras} extra tap{extras > 1 ? 's' : ''}</>}
              {offsets.length > 0 && <> · you were on average <b>{Math.abs(avg)} ms {avg < 0 ? 'early' : 'late'}</b></>}.
              {' '}<span className="muted">Green = on time, amber = early/late, red = missed. Rests mean: do not tap.</span>
            </p>
            {!sprint && <button className="pill accent" onClick={newBar}>Next rhythm <kbd>Space</kbd></button>}
          </>
        )}
      </div>
    </SpotlightCard>
  );
}
