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

/* ---------- scales, chord naming, editing ---------- */
const MAXBARS = 12, STEPS = 8, STEP_BEATS = BEATS / STEPS;
const SCALES: { id: string; label: string; pcs: number[] }[] = [
  { id: 'pent', label: 'Pentatonic', pcs: [0, 2, 4, 7, 9] },
  { id: 'major', label: 'Major', pcs: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minpent', label: 'Minor pent.', pcs: [0, 3, 5, 7, 10] },
  { id: 'minor', label: 'Minor', pcs: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'blues', label: 'Blues', pcs: [0, 3, 5, 6, 7, 10] },
];
const LENGTHS = [{ steps: 1, label: '♪ eighth' }, { steps: 2, label: '♩ quarter' }, { steps: 4, label: '𝅗𝅥 half' }, { steps: 8, label: '𝅝 whole' }];

function rowsFor(key: number, scale: number[]): number[] {
  const root = 48 + mod(key - 48, 12);
  const out: number[] = [];
  for (let m = root; m <= root + 24; m++) if (scale.includes(mod(m - key, 12))) out.push(m);
  return out;
}
function nameBar(notes: VNote[]): string {
  if (!notes.length) return '';
  const pcs = new Set(notes.map((n) => n.midi % 12));
  const low = notes.reduce((a, b) => (b.midi < a.midi ? b : a)).midi % 12;
  const order: Q[] = ['maj7', 'm7', 'dom7', 'm7b5', 'maj', 'min'];
  for (const r of [low, ...[...pcs].filter((x) => x !== low)]) {
    const q = order.find((qq) => QOFFS[qq].every((o) => pcs.has((r + o) % 12)));
    if (q) return NAMES[r] + QSUF[q];
  }
  return '';
}
function randomBar(rows: number[], key: number): VNote[] {
  const out: VNote[] = [];
  const bass = 36 + mod(key - 36, 12);
  out.push({ midi: bass, start: 0, dur: 2 });
  let i = Math.floor(rows.length / 2);
  for (let st = 0; st < STEPS; st++) {
    if (Math.random() < (st === 0 ? 0.8 : 0.5)) {
      i = Math.max(0, Math.min(rows.length - 1, i + Math.round((Math.random() - 0.5) * 5)));
      const steps = Math.random() < 0.7 ? 1 : 2;
      out.push({ midi: rows[i], start: st * STEP_BEATS, dur: Math.min(steps * STEP_BEATS, BEATS - st * STEP_BEATS) });
    }
  }
  return out;
}

/* ---------- drawing ---------- */
const LO = 46, HI = 84;
type HueMode = 'note' | 'height';
const hueOf = (midi: number, mode: HueMode) => (mode === 'note' ? (midi % 12) * 30 : 260 - ((Math.max(36, Math.min(88, midi)) - 36) / 52) * 290);
const rRatio = (midi: number) => 0.2 + 0.74 * Math.max(0, Math.min(1, (midi - LO) / (HI - LO)));
const TOP = -Math.PI / 2;

interface Cell { midi: number; step: number }
const STORE = 'noteatab.viz.v2';

export default function Visualizer() {
  const [bars, setBars] = useState<VNote[][]>(() => [0, 7, 9, 5].map((r, i) => barNotes(S(r, i === 2 ? 'min' : 'maj'), 0, 'arp')));
  const [sel, setSel] = useState(0);
  const [key, setKey] = useState(0);
  const [scaleId, setScaleId] = useState('pent');
  const [len, setLen] = useState(1);
  const [prog, setProg] = useState<Prog>(PROGS[0]);
  const [pattern, setPattern] = useState<Pattern>('arp');
  const [genBars, setGenBars] = useState(4);
  const [bpm, setBpm] = useState(84);
  const [voice, setVoice] = useState<'guitar' | 'piano'>('piano');
  const [hue, setHue] = useState<HueMode>('note');
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(0);
  const loaded = useRef(false);

  const scale = SCALES.find((x) => x.id === scaleId)!;
  const rows = rowsFor(key, scale.pcs);

  const live = useRef({ bars, sel, bpm, voice, hue, rows, len, playing });
  live.current = { bars, sel, bpm, voice, hue, rows, len, playing };
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef<{ t0: number; next: number; timer: number } | null>(null);
  const lastBar = useRef(-1);
  const hover = useRef<Cell | null>(null);

  // remember the composition between visits
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.bars) && d.bars.length && d.bars.length <= MAXBARS) setBars(d.bars);
        if (typeof d.key === 'number') setKey(d.key);
        if (typeof d.bpm === 'number') setBpm(d.bpm);
        if (SCALES.some((x) => x.id === d.scale)) setScaleId(d.scale);
      }
    } catch { /* ignore */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORE, JSON.stringify({ bars, key, bpm, scale: scaleId })); } catch { /* ignore */ }
  }, [bars, key, bpm, scaleId]);

  const stop = useCallback(() => {
    if (run.current) { clearInterval(run.current.timer); run.current = null; }
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (run.current) clearInterval(run.current.timer);
    const r = { t0: audioNow() + 0.15, next: 0, timer: 0 };
    const tick = () => {
      const c = live.current, beat = 60 / c.bpm, barDur = beat * BEATS;
      while (r.t0 + r.next * barDur < audioNow() + 0.4) {
        const at0 = r.t0 + r.next * barDur;
        c.bars[r.next % c.bars.length].forEach((nt) => playAt(c.voice, nt.midi, at0 + nt.start * beat, Math.min(nt.dur * beat, 2.2)));
        r.next++;
      }
    };
    tick();
    r.timer = window.setInterval(tick, 50);
    run.current = r;
    lastBar.current = -1;
    setPlaying(true);
  }, []);

  useEffect(() => { if (run.current) start(); }, [bpm, voice, start]);
  useEffect(() => () => { if (run.current) clearInterval(run.current.timer); }, []);
  useEffect(() => { if (sel >= bars.length) setSel(bars.length - 1); }, [bars.length, sel]);

  /* ---- render loop ---- */
  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext('2d');
    if (!cv || !g) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!cv.offsetParent) { if (run.current) stop(); return; }
      const w = cv.clientWidth, d = Math.min(window.devicePixelRatio || 1, 2);
      if (w && cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(w * d); }
      const c = live.current, beat = 60 / c.bpm, barDur = beat * BEATS, n = c.bars.length;
      const W = cv.width, cx = W / 2, cy = W / 2, R = W * 0.455, u = W / 700;
      const rOf = (m: number) => R * rRatio(m);
      const isPlay = run.current !== null;
      let t = 0, barIdx = c.sel, p = 0;
      if (isPlay) { t = audioNow() - run.current!.t0; const bi = Math.max(0, Math.floor(t / barDur)); barIdx = bi % n; p = Math.max(0, t / barDur - bi); if (bi !== lastBar.current) { lastBar.current = bi; setBar(barIdx); } }

      g.globalCompositeOperation = 'source-over';
      g.fillStyle = isPlay ? 'rgba(4,6,14,0.34)' : 'rgba(4,6,14,0.6)';
      g.fillRect(0, 0, W, W);
      g.globalCompositeOperation = 'lighter';

      // guides: in compose mode every scale tone gets a ring and every step a spoke
      if (!isPlay) {
        c.rows.forEach((m) => { g.strokeStyle = mod(m - key, 12) === 0 ? 'rgba(242,184,75,0.55)' : 'rgba(140,160,210,0.28)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, rOf(m), 0, Math.PI * 2); g.stroke(); });
        for (let i = 0; i < STEPS; i++) {
          const a = TOP + (i / STEPS) * Math.PI * 2;
          g.strokeStyle = i % 2 === 0 ? 'rgba(150,170,220,0.4)' : 'rgba(150,170,220,0.2)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2); g.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98); g.stroke();
        }
      } else {
        for (let m = 36; m <= 84; m += 12) { g.strokeStyle = 'rgba(140,160,210,0.10)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, rOf(m), 0, Math.PI * 2); g.stroke(); }
      }
      // zoetrope slits
      const rot = -p * Math.PI * 2;
      for (let i = 0; i < 64; i++) {
        const a = rot + (i / 64) * Math.PI * 2;
        g.strokeStyle = i % 8 === 0 ? 'rgba(242,184,75,0.55)' : 'rgba(150,170,220,0.2)'; g.lineWidth = i % 8 === 0 ? 2 : 1;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97); g.lineTo(cx + Math.cos(a) * R * 1.03, cy + Math.sin(a) * R * 1.03); g.stroke();
      }

      let energy = 0;
      const groups = isPlay ? [-1, 0, 1] : [0];
      for (const k of groups) {
        const notes = isPlay ? c.bars[mod(barIdx + k, n)] : c.bars[c.sel];
        for (const nt of notes) {
          const f = (nt.start + k * BEATS) / BEATS - p, ln = nt.dur / BEATS;
          if (f > 1 || f + ln < -0.3) continue;
          const a0 = TOP + f * Math.PI * 2, a1 = a0 + Math.min(ln, 0.98) * Math.PI * 2;
          const since = -f * barDur;
          const sounding = isPlay && f <= 0 && f + ln > 0;
          let I = !isPlay ? 0.85 : f > 0 ? 0.5 - f * 0.25 : sounding ? 0.65 + 0.35 * Math.exp(-since / 0.35) : Math.max(0.1, 0.5 * Math.exp(-(-f - ln) * 4));
          if (sounding) energy++;
          const h = hueOf(nt.midi, c.hue), rr = rOf(nt.midi);
          for (const [lw, al, light] of [[16, 0.10, 55], [7, 0.28, 60], [2.4, 1, 82]] as const) {
            g.strokeStyle = `hsla(${h},100%,${light}%,${Math.min(1, al * I * (lw > 3 ? 1.1 : 1.4))})`;
            g.lineWidth = lw * u; g.lineCap = 'round';
            g.beginPath(); g.arc(cx, cy, rr, a0, a1); g.stroke();
          }
          if (sounding && since < 0.25) {
            const sx = cx + Math.cos(TOP) * rr, sy = cy + Math.sin(TOP) * rr, gr = g.createRadialGradient(sx, sy, 0, sx, sy, 26 * u);
            gr.addColorStop(0, `hsla(${h},100%,85%,${0.9 * (1 - since / 0.25)})`); gr.addColorStop(1, `hsla(${h},100%,60%,0)`);
            g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, 26 * u, 0, Math.PI * 2); g.fill();
          }
        }
      }
      // compose: hovering cell preview
      const hv = hover.current;
      if (!isPlay && hv) {
        const a0 = TOP + (hv.step / STEPS) * Math.PI * 2, steps = Math.min(c.len, STEPS - hv.step), hh = hueOf(hv.midi, c.hue);
        g.strokeStyle = `hsla(${hh},100%,70%,0.55)`; g.lineWidth = 7 * u; g.lineCap = 'round';
        g.beginPath(); g.arc(cx, cy, rOf(hv.midi), a0, a0 + (steps / STEPS) * Math.PI * 2); g.stroke();
        g.strokeStyle = `hsla(${hh},100%,88%,0.9)`; g.lineWidth = 2 * u; g.stroke();
      }
      // playhead beam
      const bg = g.createLinearGradient(cx, cy, cx, cy - R * 1.08);
      bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(0.5, 'rgba(255,255,255,0.18)'); bg.addColorStop(1, 'rgba(255,240,200,0.7)');
      g.strokeStyle = bg; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - R * 1.08); g.stroke();
      // orb
      const cur = c.bars[barIdx] ?? [], low = cur.length ? cur.reduce((a, b) => (b.midi < a.midi ? b : a)).midi : 48;
      const oh = hueOf(low, 'note'), ph = isPlay ? (((t / beat) % 1) + 1) % 1 : 0.5;
      const OR = R * 0.17 * (1 + 0.18 * Math.exp(-ph * 5) + Math.min(energy, 6) * 0.015);
      const og = g.createRadialGradient(cx, cy, 0, cx, cy, OR * 2.6);
      og.addColorStop(0, `hsla(${oh},100%,88%,0.9)`); og.addColorStop(0.25, `hsla(${oh},100%,60%,0.5)`); og.addColorStop(1, `hsla(${oh},100%,50%,0)`);
      g.fillStyle = og; g.beginPath(); g.arc(cx, cy, OR * 2.6, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(8,10,20,0.8)'; g.beginPath(); g.arc(cx, cy, OR * 0.85, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const nm = nameBar(cur);
      g.font = `600 ${Math.round(W * (nm.length > 3 ? 0.038 : 0.047))}px Inter, system-ui, sans-serif`;
      g.fillText(nm || '·', cx, cy - W * 0.008);
      g.fillStyle = 'rgba(190,200,225,0.8)'; g.font = `${Math.round(W * 0.022)}px Inter, system-ui, sans-serif`;
      g.fillText(`bar ${barIdx + 1}`, cx, cy + W * 0.032);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [stop, key]);

  /* ---- pointer: find the ring (pitch) and sector (time) under the cursor ---- */
  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>): Cell | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const rr = Math.hypot(dx, dy) / (r.width * 0.455);
    if (rr > 1.0 || rr < 0.12) return null;
    let best = rows[0], bd = Infinity;
    for (const m of rows) { const dd = Math.abs(rRatio(m) - rr); if (dd < bd) { bd = dd; best = m; } }
    let th = Math.atan2(dy, dx) - TOP; th = mod(th, Math.PI * 2);
    return { midi: best, step: Math.min(STEPS - 1, Math.floor(th / ((Math.PI * 2) / STEPS))) };
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => { hover.current = live.current.playing ? null : cellAt(e); };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (playing) return;
    const cell = cellAt(e);
    hover.current = cell;
    if (!cell) return;
    const start = cell.step * STEP_BEATS;
    setBars((bs) => bs.map((b, i) => {
      if (i !== sel) return b;
      const at = b.findIndex((nt) => nt.midi === cell.midi && Math.abs(nt.start - start) < 0.01);
      if (at >= 0) return b.filter((_, j) => j !== at);
      playAt(voice, cell.midi, audioNow() + 0.02, 0.6);
      return [...b, { midi: cell.midi, start, dur: Math.min(len * STEP_BEATS, BEATS - start) }];
    }));
  };

  /* ---- bar tools ---- */
  const setSelBar = (fn: (b: VNote[]) => VNote[]) => setBars((bs) => bs.map((b, i) => (i === sel ? fn(b) : b)));
  const addBar = () => { if (bars.length < MAXBARS) { setBars([...bars, []]); setSel(bars.length); } };
  const removeBar = () => { if (bars.length > 1) { setBars(bars.filter((_, i) => i !== sel)); setSel(Math.max(0, sel - 1)); } };
  const duplicate = () => { if (bars.length < MAXBARS) { const nb = [...bars]; nb.splice(sel + 1, 0, bars[sel].map((x) => ({ ...x }))); setBars(nb); setSel(sel + 1); } };
  const generate = () => {
    const nb = Array.from({ length: genBars }, (_, i) => barNotes(prog.steps[i % prog.steps.length], key, pattern));
    setBars(nb); setSel(0);
  };
  const surprise = () => { setBars(Array.from({ length: genBars }, () => randomBar(rows, key))); setSel(0); };

  return (
    <SpotlightCard className="card viz" spotlight="rgba(120,90,255,0.10)">
      <header className="card-head">
        <div>
          <p className="eyebrow">Chord laser zoetrope · composer</p>
          <h2>Draw music on the disc</h2>
        </div>
        <StarBorder className="viz-play" color={playing ? '#ff7a59' : '#4fd1c5'} onClick={() => (playing ? stop() : start())}>
          {playing ? '■ Stop' : '▶ Spin it'}
        </StarBorder>
      </header>
      <p className="lede viz-lede">
        {playing
          ? 'Listening. Each bar is one turn of the disc, and notes sweep through the beam at the top as you hear them. Press Stop to edit.'
          : <>Click the disc to place a note: the <b>ring</b> you click is its pitch (higher = further out) and the <b>slice</b> is when it falls in the bar (the beam at the top is the start). Click a note again to remove it. Build up to {MAXBARS} bars, then press <b>Spin it</b>.</>}
      </p>

      <div className="viz-stage">
        <canvas ref={canvas} className={`viz-canvas ${playing ? '' : 'edit'}`} onPointerMove={onMove} onPointerLeave={() => { hover.current = null; }} onPointerDown={onDown}
          aria-label="Spinning laser disc: click to place notes" />
      </div>

      <div className="viz-bars" aria-label="Bars">
        {bars.map((b, i) => (
          <button key={i} className={`viz-chip ${sel === i ? 'sel' : ''} ${playing && bar === i ? 'on' : ''}`} onClick={() => setSel(i)}>
            <i>{i + 1}</i>{nameBar(b) || (b.length ? '♪' : '—')}
          </button>
        ))}
        <button className="viz-chip add" onClick={addBar} disabled={bars.length >= MAXBARS} title="Add an empty bar">+ bar</button>
        <span className="viz-count">{bars.length} / {MAXBARS} bars</span>
      </div>

      <div className="viz-controls">
        <div className="viz-row"><span className="lab">Edit bar {sel + 1}</span>
          <div className="seg">{LENGTHS.map((l) => <button key={l.steps} className={len === l.steps ? 'on' : ''} onClick={() => setLen(l.steps)} title="Length of the next note you place">{l.label}</button>)}</div>
          <div className="chips">
            <button className="chip" onClick={() => setSelBar(() => [])}>Clear</button>
            <button className="chip" onClick={() => setSelBar(() => randomBar(rows, key))}>🎲 Random notes</button>
            <button className="chip" onClick={duplicate} disabled={bars.length >= MAXBARS}>Duplicate</button>
            <button className="chip" onClick={removeBar} disabled={bars.length <= 1}>Delete bar</button>
          </div>
        </div>
        <div className="viz-row"><span className="lab">Scale</span>
          <div className="seg">{SCALES.map((x) => <button key={x.id} className={scaleId === x.id ? 'on' : ''} onClick={() => setScaleId(x.id)}>{x.label}</button>)}</div>
        </div>
        <div className="viz-row"><span className="lab">Key</span>
          <div className="seg wrap">{NAMES.map((nm, i) => <button key={nm} className={key === i ? 'on' : ''} onClick={() => setKey(i)}>{nm}</button>)}</div>
        </div>
        <div className="viz-gen">
          <span className="lab">Generate</span>
          <div className="chips">{PROGS.map((p) => <button key={p.id} className={`chip ${prog.id === p.id ? 'on' : ''}`} onClick={() => setProg(p)}>{p.label}</button>)}</div>
          <div className="seg">{PATTERNS.map((p) => <button key={p.id} className={pattern === p.id ? 'on' : ''} onClick={() => setPattern(p.id)}>{p.label}</button>)}</div>
          <label className="viz-bpm"><span>Bars</span><input type="range" min={1} max={MAXBARS} value={genBars} onChange={(e) => setGenBars(+e.target.value)} /><b>{genBars}</b></label>
          <div className="chips">
            <button className="chip on" onClick={generate} disabled={playing}>✨ Generate {genBars} bars</button>
            <button className="chip" onClick={() => { setProg(randomProg()); }} title="Pick a random progression">🎲 Random progression</button>
            <button className="chip" onClick={surprise} disabled={playing}>🎲 Surprise melody</button>
          </div>
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
