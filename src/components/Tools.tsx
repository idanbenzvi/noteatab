import { useCallback, useEffect, useRef, useState } from 'react';
import { ac, click, holdTone } from '../lib/audio';
import { detectPitch, midiFromHz } from '../lib/pitch';
import { TUNINGS } from '../lib/theory';
import SpotlightCard from './reactbits/SpotlightCard';

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const TEMPOS: [number, string][] = [[40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [999, 'Prestissimo']];
const tempoWord = (b: number) => TEMPOS.find(([m]) => b <= m)![1];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function Tools() {
  return (
    <div className="app">
      <section className="row one-one">
        <Metronome />
        <Tuner />
      </section>
    </div>
  );
}

/* ------------------------------ metronome ------------------------------ */

function Metronome() {
  const [bpm, setBpm] = useState(100);
  const [beats, setBeats] = useState(4);
  const [subs, setSubs] = useState(1);
  const [accent, setAccent] = useState(true);
  const [vol, setVol] = useState(0.7);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const [trainer, setTrainer] = useState(false);
  const [tStep, setTStep] = useState(5);
  const [tBars, setTBars] = useState(4);
  const [tMax, setTMax] = useState(140);
  const taps = useRef<number[]>([]);
  const live = useRef({ bpm, beats, subs, accent, vol, trainer, tStep, tBars, tMax });
  live.current = { bpm, beats, subs, accent, vol, trainer, tStep, tBars, tMax };
  const st = useRef({ next: 0, beat: 0, sub: 0, bar: 0, id: 0, timers: [] as number[] });

  const tick = useCallback(() => {
    const c = ac(), s = st.current, L = live.current;
    while (s.next < c.currentTime + 0.12) {
      const level = s.sub === 0 ? (s.beat === 0 && L.accent ? 'accent' : 'beat') : 'sub';
      click(s.next, level, L.vol);
      if (s.sub === 0) { const b = s.beat; s.timers.push(window.setTimeout(() => setBeat(b), Math.max(0, (s.next - c.currentTime) * 1000))); }
      s.next += 60 / L.bpm / L.subs;
      s.sub++;
      if (s.sub >= L.subs) {
        s.sub = 0; s.beat++;
        if (s.beat >= L.beats) {
          s.beat = 0; s.bar++;
          if (L.trainer && s.bar % L.tBars === 0 && L.bpm < L.tMax) setBpm(Math.min(L.tMax, L.bpm + L.tStep));
        }
      }
    }
    if (s.timers.length > 40) s.timers = s.timers.slice(-20);
  }, []);

  const start = () => {
    const c = ac(), s = st.current;
    Object.assign(s, { next: c.currentTime + 0.08, beat: 0, sub: 0, bar: 0 });
    s.id = window.setInterval(tick, 25);
    setRunning(true);
  };
  const stop = useCallback(() => {
    const s = st.current;
    window.clearInterval(s.id); s.timers.forEach(clearTimeout); s.timers = [];
    setRunning(false); setBeat(null);
  }, []);
  useEffect(() => stop, [stop]);

  const tap = () => {
    const now = performance.now();
    const t = taps.current;
    if (t.length && now - t[t.length - 1] > 2200) t.length = 0;
    t.push(now);
    if (t.length > 6) t.shift();
    if (t.length >= 2) setBpm(clamp(Math.round(60000 / ((t[t.length - 1] - t[0]) / (t.length - 1))), 30, 240));
  };

  return (
    <SpotlightCard className="card" spotlight="rgba(242,184,75,0.10)">
      <p className="eyebrow">Tool · 1</p>
      <h2>Metronome</h2>
      <p className="hint">Practise slowly against a steady pulse. Start at a tempo where you can play cleanly, then raise it a little at a time.</p>
      <div className="met-display">
        <button className="pill" onClick={() => setBpm((b) => clamp(b - 1, 30, 240))} aria-label="Slower">−</button>
        <div className="met-bpm"><b>{bpm}</b><small>bpm · {tempoWord(bpm)}</small></div>
        <button className="pill" onClick={() => setBpm((b) => clamp(b + 1, 30, 240))} aria-label="Faster">+</button>
      </div>
      <input className="met-slider" type="range" min={30} max={240} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo" />
      <div className="met-beats" aria-hidden="true">
        {Array.from({ length: beats }, (_, i) => <i key={i} className={`${i === 0 && accent ? 'acc' : ''} ${beat === i ? 'on' : ''}`} />)}
      </div>
      <div className="start-row">
        <button className="pill accent big" onClick={running ? stop : start}>{running ? '■ Stop' : '▶ Start'}</button>
        <button className="pill big" onClick={tap}>Tap tempo</button>
      </div>
      <div className="settings" style={{ marginTop: 14 }}>
        <div className="setting"><span className="setting-label">Beats</span>
          <div className="seg">{[2, 3, 4, 5, 6, 7].map((n) => <button key={n} className={beats === n ? 'on' : ''} onClick={() => setBeats(n)}>{n}</button>)}</div></div>
        <div className="setting"><span className="setting-label">Divide</span>
          <div className="seg">{([[1, '♩'], [2, '♪♪'], [3, 'triplet'], [4, '16ths']] as [number, string][]).map(([n, l]) => <button key={n} className={subs === n ? 'on' : ''} onClick={() => setSubs(n)}>{l}</button>)}</div></div>
        <div className="setting"><span className="setting-label">Accent</span>
          <label className="check"><input type="checkbox" checked={accent} onChange={(e) => setAccent(e.target.checked)} /> stress beat 1</label></div>
        <div className="setting"><span className="setting-label">Volume</span>
          <input type="range" min={0.1} max={1} step={0.05} value={vol} onChange={(e) => setVol(Number(e.target.value))} aria-label="Volume" /></div>
        <div className="setting"><span className="setting-label">Trainer</span>
          <label className="check"><input type="checkbox" checked={trainer} onChange={(e) => setTrainer(e.target.checked)} /> speed up automatically</label></div>
        {trainer && (
          <div className="setting" style={{ paddingLeft: 78 }}>
            <span className="muted">+</span><input className="num" type="number" min={1} max={20} value={tStep} onChange={(e) => setTStep(clamp(Number(e.target.value) || 1, 1, 20))} />
            <span className="muted">bpm every</span><input className="num" type="number" min={1} max={16} value={tBars} onChange={(e) => setTBars(clamp(Number(e.target.value) || 1, 1, 16))} />
            <span className="muted">bars, up to</span><input className="num" type="number" min={40} max={240} value={tMax} onChange={(e) => setTMax(clamp(Number(e.target.value) || 120, 40, 240))} /><span className="muted">bpm</span>
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}

/* ------------------------------ tuner ------------------------------ */

function Tuner() {
  const [tid, setTid] = useState('std');
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const [reading, setReading] = useState<{ midi: number; cents: number; hz: number } | null>(null);
  const [ref, setRef] = useState<number | null>(null);
  const tuning = TUNINGS.find((t) => t.id === tid)!;
  const stopRef = useRef<(() => void) | null>(null);
  const hold = useRef<(() => void) | null>(null);
  const hist = useRef<number[]>([]);

  const stop = useCallback(() => { stopRef.current?.(); stopRef.current = null; setOn(false); setReading(null); hist.current = []; }, []);
  useEffect(() => () => { stopRef.current?.(); hold.current?.(); }, []);

  const start = async () => {
    setErr('');
    if (!navigator.mediaDevices?.getUserMedia) { setErr('This browser cannot access the microphone (it needs a secure https page).'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const c = ac();
      const src = c.createMediaStreamSource(stream);
      const an = c.createAnalyser();
      an.fftSize = 4096;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let raf = 0, n = 0, last = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (++n % 2) return;
        an.getFloatTimeDomainData(buf);
        const p = detectPitch(buf, c.sampleRate, 60, 700);
        if (p && p.clarity > 0.85) {
          const m = midiFromHz(p.hz);
          const h = hist.current; h.push(m); if (h.length > 5) h.shift();
          const med = [...h].sort((a, b) => a - b)[Math.floor(h.length / 2)];
          last = performance.now();
          setReading({ midi: Math.round(med), cents: Math.round((med - Math.round(med)) * 100), hz: p.hz });
        } else if (performance.now() - last > 600) { hist.current = []; setReading(null); }
      };
      loop();
      stopRef.current = () => { cancelAnimationFrame(raf); src.disconnect(); stream.getTracks().forEach((t) => t.stop()); };
      setOn(true);
    } catch (e) {
      setErr((e as DOMException)?.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser’s site settings to use the tuner.' : 'Could not start the microphone.');
    }
  };

  // nearest open string to the detected pitch
  let target = -1, cents = reading?.cents ?? 0;
  if (reading) {
    let best = 99;
    tuning.midi.forEach((m, s) => { const d = Math.abs(m - (reading.midi + reading.cents / 100)); if (d < best) { best = d; target = s; } });
    if (best < 2.5) cents = Math.round((reading.midi + reading.cents / 100 - tuning.midi[target]) * 100); else target = -1;
  }
  const shown = reading ? (target >= 0 ? tuning.midi[target] : reading.midi) : null;
  const inTune = reading && Math.abs(cents) <= 5;
  const angle = clamp(cents, -50, 50) * 0.9;

  const toggleRef = (s: number) => {
    hold.current?.(); hold.current = null;
    if (ref === s) { setRef(null); return; }
    hold.current = holdTone(tuning.midi[s]); setRef(s);
  };

  return (
    <SpotlightCard className="card" spotlight="rgba(79,209,197,0.10)">
      <p className="eyebrow">Tool · 2</p>
      <h2>Tuner</h2>
      <p className="hint">Pluck one string at a time and let it ring. The needle shows how many cents (hundredths of a semitone) you are sharp or flat. Nothing you play is recorded or sent anywhere.</p>
      <div className="tabs" role="radiogroup" aria-label="Tuning">
        {TUNINGS.slice(0, 5).map((t) => <button key={t.id} role="radio" aria-checked={tid === t.id} className={tid === t.id ? 'on' : ''} onClick={() => { hold.current?.(); hold.current = null; setRef(null); setTid(t.id); }}>{t.name}</button>)}
      </div>
      <svg viewBox="0 0 300 170" className="gauge" role="img" aria-label={reading ? `${NAMES[reading.midi % 12]} ${cents} cents` : 'Tuner gauge'}>
        <path d="M 30 140 A 120 120 0 0 1 270 140" className="g-arc" />
        <path d="M 138 24 A 120 120 0 0 1 162 24" className={`g-ok ${inTune ? 'on' : ''}`} style={{ strokeWidth: 8 }} />
        {Array.from({ length: 11 }, (_, i) => {
          const ang = ((i - 5) * 18 * Math.PI) / 180;
          const x1 = 150 + Math.sin(ang) * 112, y1 = 140 - Math.cos(ang) * 112, x2 = 150 + Math.sin(ang) * (i % 5 === 0 ? 96 : 104), y2 = 140 - Math.cos(ang) * (i % 5 === 0 ? 96 : 104);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={`g-tick ${i === 5 ? 'mid' : ''}`} />;
        })}
        <text x={30} y={162} className="g-lab" textAnchor="middle">−50</text><text x={150} y={20} className="g-lab" textAnchor="middle">0</text><text x={270} y={162} className="g-lab" textAnchor="middle">+50</text>
        <g style={{ transform: `rotate(${reading ? angle : 0}deg)`, transformOrigin: '150px 140px', transition: 'transform .18s ease-out' }} opacity={reading ? 1 : 0.3}>
          <line x1={150} y1={140} x2={150} y2={36} className={`g-needle ${inTune ? 'ok' : ''}`} />
        </g>
        <circle cx={150} cy={140} r={6} className="g-hub" />
      </svg>
      <div className="tuner-read">
        <div className={`tuner-note ${inTune ? 'ok' : ''}`}>{shown !== null ? NAMES[shown % 12] : '–'}<small>{shown !== null ? Math.floor(shown / 12) - 1 : ''}</small></div>
        <div className="tuner-info">
          {reading ? <><b>{inTune ? '✓ In tune' : cents > 0 ? `${cents} cents sharp: loosen` : `${-cents} cents flat: tighten`}</b><span>{reading.hz.toFixed(1)} Hz{target >= 0 ? ` · string ${6 - target}` : ''}</span></>
            : <span className="muted">{on ? 'Listening… pluck a string.' : 'Press start, then pluck a string.'}</span>}
        </div>
      </div>
      <div className="start-row">
        <button className="pill accent big" onClick={on ? stop : start}>{on ? '■ Stop listening' : '🎤 Start tuner'}</button>
      </div>
      {err && <p className="bad" role="alert">{err}</p>}
      <div className="tuner-strings" aria-label="Reference tones">
        <span className="setting-label" style={{ width: 'auto' }}>Reference tones</span>
        {tuning.midi.map((m, s) => (
          <button key={s} className={`str-chip wide ${ref === s ? 'on' : ''} ${target === s ? 'hit' : ''}`} onClick={() => toggleRef(s)} aria-pressed={ref === s} title={`String ${6 - s}: hold the tone`}>
            {NAMES[m % 12]}<small>{6 - s}</small>
          </button>
        ))}
      </div>
      <p className="hint small">Tap a string name to hear a steady reference tone, tune until the beating stops, tap again to silence it. Tune <b>up</b> to the note (from slightly flat) so the string settles.</p>
    </SpotlightCard>
  );
}
