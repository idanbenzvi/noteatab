import { useCallback, useEffect, useRef, useState } from 'react';
import SpotlightCard from './reactbits/SpotlightCard';
import StarBorder from './reactbits/StarBorder';
import { audioNow, playAt } from '../lib/audio';

/* ---------- harmony ---------- */
type Q = 'maj' | 'min' | 'maj7' | 'm7' | 'dom7' | 'm7b5';
const QOFFS: Record<Q, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], m7b5: [0, 3, 6, 10] };
const QSUF: Record<Q, string> = { maj: '', min: 'm', maj7: 'maj7', m7: 'm7', dom7: '7', m7b5: 'm7♭5' };
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
interface Step { r: number; q: Q }
interface Prog { id: string; label: string; steps: Step[] }
const S = (r: number, q: Q): Step => ({ r, q });
const PROGS: Prog[] = [
  { id: 'pop', label: 'Pop · I V vi IV', steps: [S(0, 'maj'), S(7, 'maj'), S(9, 'min'), S(5, 'maj')] },
  { id: 'jazz', label: 'Jazz · ii V I vi', steps: [S(2, 'm7'), S(7, 'dom7'), S(0, 'maj7'), S(9, 'm7')] },
  { id: 'canon', label: 'Canon', steps: [S(0, 'maj'), S(7, 'maj'), S(9, 'min'), S(4, 'min'), S(5, 'maj'), S(0, 'maj'), S(5, 'maj'), S(7, 'maj')] },
  { id: 'andalusian', label: 'Andalusian (minor)', steps: [S(0, 'min'), S(10, 'maj'), S(8, 'maj'), S(7, 'maj')] },
  { id: 'dream', label: 'Dreamy', steps: [S(0, 'maj7'), S(5, 'maj7'), S(4, 'm7'), S(9, 'm7')] },
  { id: 'blues', label: '12-bar blues', steps: [S(0, 'dom7'), S(0, 'dom7'), S(0, 'dom7'), S(0, 'dom7'), S(5, 'dom7'), S(5, 'dom7'), S(0, 'dom7'), S(0, 'dom7'), S(7, 'dom7'), S(5, 'dom7'), S(0, 'dom7'), S(7, 'dom7')] },
];
const randomProg = (): Prog => {
  const pool: Step[] = [S(2, 'm7'), S(4, 'm7'), S(5, 'maj7'), S(7, 'dom7'), S(9, 'm7'), S(5, 'maj'), S(7, 'maj'), S(9, 'min')];
  const steps = [S(0, Math.random() < 0.5 ? 'maj' : 'maj7')];
  while (steps.length < 4) { const c = pool[Math.floor(Math.random() * pool.length)]; if (c.r !== steps[steps.length - 1].r) steps.push(c); }
  return { id: 'random', label: 'Random', steps };
};

/* ---------- patterns: a bar of 4 beats as {midi, start, dur} ---------- */
interface VNote { midi: number; start: number; dur: number }
type Pattern = 'pad' | 'arp' | 'bounce' | 'rock' | 'strum';
const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'pad', label: 'Pad' }, { id: 'arp', label: 'Arpeggio' }, { id: 'bounce', label: 'Bounce' }, { id: 'rock', label: 'Rock' }, { id: 'strum', label: 'Strum' },
];
const BEATS = 4;
const mod = (n: number, m: number) => ((n % m) + m) % m;
function barNotes(step: Step, key: number, pattern: Pattern): VNote[] {
  const rootPc = mod(key + step.r, 12);
  const bass = 36 + mod(rootPc - 36, 12);
  const base = 48 + mod(rootPc - 48, 12);
  const tones = QOFFS[step.q].map((o) => base + o);
  const pool = [...tones, tones[0] + 12];
  const out: VNote[] = [];
  const n = (midi: number, start: number, dur: number) => out.push({ midi, start, dur });
  switch (pattern) {
    case 'pad':
      n(bass, 0, 4); tones.forEach((m, i) => n(m, i * 0.04, 3.9)); n(tones[0] + 12, 0.16, 3.8); break;
    case 'arp':
      n(bass, 0, 4);
      for (let i = 0; i < 8; i++) n(pool[i % pool.length] + (i >= pool.length ? 12 : 0), i * 0.5, 0.75);
      break;
    case 'bounce': {
      n(bass, 0, 4);
      const L = pool.length, seq = [0, 1, 2, 3, 2, 1, 2, 1].map((i) => Math.min(i, L - 1));
      seq.forEach((i, k) => n(pool[i], k * 0.5, 0.7));
      break;
    }
    case 'rock':
      n(bass, 0, 1.4); n(bass, 2, 1.4);
      [0, 1.5, 2, 3].forEach((t) => tones.slice(0, 3).forEach((m, i) => n(m, t + i * 0.03, 0.4)));
      break;
    case 'strum':
      n(bass, 0, 1.6);
      [0, 1, 1.5, 2.5, 3, 3.5].forEach((t) => tones.forEach((m, i) => n(m, t + i * 0.05, 0.45)));
      break;
  }
  return out;
}

/* ---------- drawing ---------- */
const LO = 34, HI = 90;
type HueMode = 'note' | 'height';
const hueOf = (midi: number, mode: HueMode) => (mode === 'note' ? (midi % 12) * 30 : 260 - ((midi - LO) / (HI - LO)) * 290);

interface Settings { prog: Prog; key: number; pattern: Pattern; bpm: number; voice: 'guitar' | 'piano'; hue: HueMode }

export default function Visualizer() {
  const [prog, setProg] = useState<Prog>(PROGS[0]);
  const [key, setKey] = useState(0);
  const [pattern, setPattern] = useState<Pattern>('arp');
  const [bpm, setBpm] = useState(84);
  const [voice, setVoice] = useState<'guitar' | 'piano'>('piano');
  const [hue, setHue] = useState<HueMode>('note');
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(0);

  const cfg = useRef<Settings>({ prog, key, pattern, bpm, voice, hue });
  cfg.current = { prog, key, pattern, bpm, voice, hue };
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef<{ t0: number; next: number; timer: number } | null>(null);
  const lastBar = useRef(-1);

  const stop = useCallback(() => {
    if (run.current) { clearInterval(run.current.timer); run.current = null; }
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (run.current) clearInterval(run.current.timer);
    const t0 = audioNow() + 0.15;
    const r = { t0, next: 0, timer: 0 };
    const tick = () => {
      const c = cfg.current, beat = 60 / c.bpm, barDur = beat * BEATS;
      while (r.t0 + r.next * barDur < audioNow() + 0.4) {
        const st = c.prog.steps[r.next % c.prog.steps.length];
        const at0 = r.t0 + r.next * barDur;
        barNotes(st, c.key, c.pattern).forEach((nt) => playAt(c.voice, nt.midi, at0 + nt.start * beat, Math.min(nt.dur * beat, 2.2)));
        r.next++;
      }
    };
    tick();
    r.timer = window.setInterval(tick, 50);
    run.current = r;
    lastBar.current = -1;
    setPlaying(true);
  }, []);

  // any change of the musical settings restarts the loop so the disc and the sound stay in step
  useEffect(() => { if (run.current) start(); }, [prog, key, pattern, bpm, voice, start]);
  useEffect(() => () => { if (run.current) clearInterval(run.current.timer); }, []);

  /* render loop */
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    let raf = 0;
    const fit = () => {
      const w = cv.clientWidth, d = Math.min(window.devicePixelRatio || 1, 2);
      if (w && cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(w * d); }
    };
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!cv.offsetParent) { if (run.current) stop(); return; }   // tab hidden: go quiet
      fit();
      const c = cfg.current, beat = 60 / c.bpm, barDur = beat * BEATS;
      const W = cv.width, cx = W / 2, cy = W / 2, R = W * 0.455;
      let t: number, barIdx: number, prog01: number;
      if (run.current) { t = audioNow() - run.current.t0; barIdx = Math.max(0, Math.floor(t / barDur)); prog01 = Math.max(0, t / barDur - barIdx); }
      else { t = 0; barIdx = 0; prog01 = (now / 1000 / (barDur * 2)) % 1; }   // idle: slow preview spin
      const n = c.prog.steps.length;
      if (barIdx !== lastBar.current) { lastBar.current = barIdx; setBar(barIdx % n); }
      const bars = [-1, 0, 1].map((k) => ({ k, step: c.prog.steps[mod(barIdx + k, n)] }));

      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(4,6,14,0.34)';          // translucent wipe leaves glowing trails
      g.fillRect(0, 0, W, W);
      g.globalCompositeOperation = 'lighter';

      const rOf = (midi: number) => R * (0.22 + 0.7 * ((midi - LO) / (HI - LO)));
      // pitch guides
      g.lineWidth = 1;
      for (let m = 36; m <= 84; m += 12) { g.strokeStyle = 'rgba(140,160,210,0.10)'; g.beginPath(); g.arc(cx, cy, rOf(m), 0, Math.PI * 2); g.stroke(); }
      // zoetrope slit ring, turning with the disc
      const rot = -prog01 * Math.PI * 2;
      for (let i = 0; i < 64; i++) {
        const a = rot + (i / 64) * Math.PI * 2;
        g.strokeStyle = i % 8 === 0 ? 'rgba(242,184,75,0.55)' : 'rgba(150,170,220,0.2)';
        g.lineWidth = i % 8 === 0 ? 2 : 1;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97); g.lineTo(cx + Math.cos(a) * R * 1.03, cy + Math.sin(a) * R * 1.03); g.stroke();
      }
      // the notes: a conveyor of laser arcs sweeping through the playhead at the top
      const TOP = -Math.PI / 2;
      let energy = 0, rootHue = 40;
      for (const { k, step } of bars) {
        const notes = barNotes(step, c.key, c.pattern);
        for (const nt of notes) {
          const f = (nt.start + k * BEATS) / BEATS - prog01;      // bars (positive = still to come)
          const len = nt.dur / BEATS;
          if (f > 1 || f + len < -0.3) continue;                  // off the visible turn
          const a0 = TOP + f * Math.PI * 2, a1 = a0 + Math.min(len, 0.98) * Math.PI * 2;
          const sinceOnset = -f * barDur;                          // seconds since the note began (negative = upcoming)
          const sounding = f <= 0 && f + len > 0 && run.current !== null;
          let I = f > 0 ? 0.5 - f * 0.25 : sounding ? 0.65 + 0.35 * Math.exp(-sinceOnset / 0.35) : Math.max(0.1, 0.5 * Math.exp(-(-f - len) * 4));
          if (!run.current) I = 0.55;
          if (sounding) energy += 1;
          const h = hueOf(nt.midi, c.hue), rr = rOf(nt.midi);
          for (const [lw, al, light] of [[16, 0.10, 55], [7, 0.28, 60], [2.4, 1, 82]] as const) {
            g.strokeStyle = `hsla(${h},100%,${light}%,${Math.min(1, al * I * (lw > 3 ? 1.1 : 1.4))})`;
            g.lineWidth = lw * (W / 700); g.lineCap = 'round';
            g.beginPath(); g.arc(cx, cy, rr, a0, a1); g.stroke();
          }
          if (sounding && sinceOnset < 0.25) {           // spark where the beam is cutting the note
            const sx = cx + Math.cos(TOP) * rr, sy = cy + Math.sin(TOP) * rr;
            const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 26 * (W / 700));
            gr.addColorStop(0, `hsla(${h},100%,85%,${0.9 * (1 - sinceOnset / 0.25)})`); gr.addColorStop(1, `hsla(${h},100%,60%,0)`);
            g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, 26 * (W / 700), 0, Math.PI * 2); g.fill();
          }
        }
      }
      // playhead beam
      const bg = g.createLinearGradient(cx, cy, cx, cy - R * 1.08);
      bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(0.5, 'rgba(255,255,255,0.18)'); bg.addColorStop(1, 'rgba(255,240,200,0.7)');
      g.strokeStyle = bg; g.lineWidth = 3 * (W / 700); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - R * 1.08); g.stroke();
      // central orb, pulsing on the beat
      const cur = c.prog.steps[barIdx % n];
      rootHue = hueOf(48 + mod(c.key + cur.r, 12), 'note');
      const beatPh = run.current ? ((t / beat) % 1 + 1) % 1 : 0.5;
      const pulse = 1 + 0.18 * Math.exp(-beatPh * 5) + Math.min(energy, 6) * 0.015;
      const OR = R * 0.19 * pulse;
      const og = g.createRadialGradient(cx, cy, 0, cx, cy, OR * 2.6);
      og.addColorStop(0, `hsla(${rootHue},100%,88%,0.95)`); og.addColorStop(0.25, `hsla(${rootHue},100%,60%,0.55)`); og.addColorStop(1, `hsla(${rootHue},100%,50%,0)`);
      g.fillStyle = og; g.beginPath(); g.arc(cx, cy, OR * 2.6, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(8,10,20,0.78)'; g.beginPath(); g.arc(cx, cy, OR * 0.78, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `600 ${Math.round(W * 0.05)}px Inter, system-ui, sans-serif`;
      g.fillText(NAMES[mod(c.key + cur.r, 12)] + QSUF[cur.q], cx, cy);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [stop]);

  const shuffle = () => setProg(randomProg());

  return (
    <SpotlightCard className="card viz" spotlight="rgba(120,90,255,0.10)">
      <header className="card-head">
        <div>
          <p className="eyebrow">Chord laser zoetrope</p>
          <h2>See the harmony spin</h2>
        </div>
        <StarBorder className="viz-play" color={playing ? '#ff7a59' : '#4fd1c5'} onClick={() => (playing ? stop() : start())}>
          {playing ? '■ Stop' : '▶ Play the disc'}
        </StarBorder>
      </header>
      <p className="lede viz-lede">Each bar is one turn of a glowing disc. Every note is a laser arc: its <b>ring</b> is its pitch (low in the middle, high at the rim), its <b>length</b> is how long it sounds, and its <b>colour</b> is its note. Notes sweep through the beam at the top the instant you hear them, and a chord is several rings lighting at once.</p>

      <div className="viz-stage">
        <canvas ref={canvas} className="viz-canvas" aria-label="Spinning laser disc showing the notes of each bar" />
      </div>

      <div className="viz-bars" aria-label="Progression">
        {prog.steps.map((s, i) => (
          <span key={i} className={`viz-chip ${playing && bar === i ? 'on' : ''}`}>{NAMES[mod(key + s.r, 12)]}{QSUF[s.q]}</span>
        ))}
      </div>

      <div className="viz-controls">
        <div className="viz-row"><span className="lab">Progression</span>
          <div className="chips">
            {PROGS.map((p) => <button key={p.id} className={`chip ${prog.id === p.id ? 'on' : ''}`} onClick={() => setProg(p)}>{p.label}</button>)}
            <button className={`chip ${prog.id === 'random' ? 'on' : ''}`} onClick={shuffle}>🎲 Shuffle</button>
          </div>
        </div>
        <div className="viz-row"><span className="lab">Key</span>
          <div className="seg wrap">{NAMES.map((nm, i) => <button key={nm} className={key === i ? 'on' : ''} onClick={() => setKey(i)}>{nm}</button>)}</div>
        </div>
        <div className="viz-row"><span className="lab">Pattern</span>
          <div className="seg">{PATTERNS.map((p) => <button key={p.id} className={pattern === p.id ? 'on' : ''} onClick={() => setPattern(p.id)}>{p.label}</button>)}</div>
        </div>
        <div className="viz-row split">
          <label className="viz-bpm"><span className="lab">Tempo</span>
            <input type="range" min={50} max={160} value={bpm} onChange={(e) => setBpm(+e.target.value)} /><b>{bpm} BPM</b></label>
          <div className="seg"><button className={voice === 'piano' ? 'on' : ''} onClick={() => setVoice('piano')}>🎹 Piano</button><button className={voice === 'guitar' ? 'on' : ''} onClick={() => setVoice('guitar')}>🎸 Guitar</button></div>
          <div className="seg"><button className={hue === 'note' ? 'on' : ''} onClick={() => setHue('note')} title="One colour per note name">🎨 By note</button><button className={hue === 'height' ? 'on' : ''} onClick={() => setHue('height')} title="Colour by pitch height">🌈 By height</button></div>
        </div>
      </div>
    </SpotlightCard>
  );
}
