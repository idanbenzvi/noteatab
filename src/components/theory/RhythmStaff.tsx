import { Fragment } from 'react';
import { onsets, countLabel, type REvent, type TimeSig } from '../../lib/rhythm';

interface TabNote { s: number; f: number }
interface Props {
  events: REvent[];
  sig: TimeSig;
  steps?: number[];            // diatonic staff step per *sounding* event; default: all on one note
  tab?: TabNote[];             // per sounding event, draws a tab staff aligned underneath
  counts?: boolean;            // show counting syllables
  active?: number;             // event index being played
  status?: Record<number, 'hit' | 'miss' | 'late' | 'early'>;
  width?: number;
  lineOnly?: boolean;          // single-line rhythm staff (no pitch)
  small?: boolean;
  caption?: string;
  pulse?: boolean;             // draw beat grid
}

const REST_GLYPH: Record<string, string> = { w: '𝄻', h: '𝄼', q: '𝄽', e: '𝄾', s: '𝄿' };

/** Rhythm notation on a staff, with optional aligned tab. Time → x is linear so it lines up with the tab. */
export default function RhythmStaff({ events, sig, steps, tab, counts = true, active, status = {}, width = 720, lineOnly, small, caption, pulse = true }: Props) {
  const sp = small ? 9 : 12, H = sp / 2;
  const bottom = 30;                                  // E4
  const padT = 30, countH = counts ? 26 : 8;
  const staffTop = padT;
  const yStep = (st: number) => staffTop + (bottom + 8 - st) * H;
  const staffBottom = yStep(bottom);
  const staffH = 8 * H;
  const tabTop = staffBottom + countH + 26;
  const TL = 11;                                      // tab line spacing
  const tabH = TL * 5;
  const total = tab ? tabTop + tabH + 22 : staffBottom + countH + 10;
  const x0 = lineOnly ? 70 : 120, x1 = width - 22;
  const span = x1 - x0;
  const U = sig.units;
  const xOf = (u: number) => x0 + 16 + (u / U) * (span - 32);
  const ons = onsets(events);
  const middle = lineOnly ? 34 : 34;                  // default pitch: B4 (middle line)
  let soundIdx = -1;
  const stepFor = (i: number) => (steps ? steps[i] : middle);

  // beam groups: consecutive sounding notes of ≤ eighth length inside the same beat
  const groups: number[][] = [];
  let curG: number[] = [];
  const flush = () => { if (curG.length > 1) groups.push(curG); curG = []; };
  ons.forEach((o, i) => {
    const x = events[i];
    const beamable = !x.rest && x.base !== 'q' && x.base !== 'h' && x.base !== 'w';
    if (!beamable) { flush(); return; }
    const beat = Math.floor(o.unit / sig.group);
    const prev = curG.length ? Math.floor(ons[curG[curG.length - 1]].unit / sig.group) : beat;
    if (curG.length && beat !== prev) flush();
    curG.push(i);
  });
  flush();
  const beamOf = new Map<number, number[]>();
  groups.forEach((g) => g.forEach((i) => beamOf.set(i, g)));

  // pre-compute sounding-note index per event for steps/tab lookups
  const soundIndex = events.map((x) => (x.rest ? -1 : ++soundIdx));

  const stemLen = sp * 3.4;
  const drawNote = (i: number) => {
    const x = events[i], o = ons[i];
    const cx = xOf(o.unit);
    const st = lineOnly ? 32 : stepFor(soundIndex[i]);
    const cy = lineOnly ? staffTop + staffH / 2 : yStep(st);
    const cls = status[i] ? `rn-${status[i]}` : active === i ? 'rn-active' : '';
    if (x.rest) {
      const ry = staffTop + (lineOnly ? staffH / 2 : staffH / 2);
      const fs = sp * (x.base === 'w' || x.base === 'h' ? 3.4 : 4.2);
      const yy = x.base === 'w' ? staffTop + H * 2 + 1 : x.base === 'h' ? staffTop + H * 4 + 1 : ry + sp * (x.base === 'q' ? 0.95 : x.base === 'e' ? 0.7 : 0.7);
      return (
        <g key={i} className={`rn ${cls}`}>
          <text x={cx} y={yy} textAnchor="middle" className="rn-rest" style={{ fontSize: fs }}>{REST_GLYPH[x.base]}</text>
          {x.dot && <circle cx={cx + sp * 1.3} cy={ry - H * 0.5} r={1.9} className="rn-dot" />}
        </g>
      );
    }
    const open = x.base === 'w' || x.base === 'h';
    const hasStem = x.base !== 'w';
    const g = beamOf.get(i);
    const down = !lineOnly && st >= 34;
    const sx = down ? cx - sp * 0.72 : cx + sp * 0.72;
    const sy2 = down ? cy + stemLen : cy - stemLen;
    return (
      <g key={i} className={`rn ${cls}`}>
        {!lineOnly && st < bottom && Array.from({ length: Math.ceil((bottom - st) / 2) }, (_, k) => bottom - 2 - k * 2).filter((l) => l >= st).map((l) => <line key={l} x1={cx - sp * 1.15} x2={cx + sp * 1.15} y1={yStep(l)} y2={yStep(l)} className="staff-line ledger" />)}
        {hasStem && <line x1={sx} x2={sx} y1={cy} y2={sy2} className="stem" />}
        <ellipse cx={cx} cy={cy} rx={sp * 0.74} ry={sp * 0.53} transform={`rotate(-20 ${cx} ${cy})`} className={open ? 'head open' : 'head'} />
        {x.dot && <circle cx={cx + sp * 1.25} cy={cy - (st % 2 === 0 ? H * 0.5 : 0)} r={1.9} className="rn-dot" />}
        {!g && (x.base === 'e' || x.base === 's') && (
          <path d={flagPath(sx, sy2, down, x.base === 's', sp)} className="rn-flag" />
        )}
      </g>
    );
  };

  const beams = groups.map((g, gi) => {
    const dir = (lineOnly ? 32 : steps ? g.reduce((a, i) => a + stepFor(soundIndex[i]), 0) / g.length : middle) >= 34 && !lineOnly ? 'down' : 'up';
    const pts = g.map((i) => {
      const st = lineOnly ? 32 : stepFor(soundIndex[i]);
      const cy = lineOnly ? staffTop + staffH / 2 : yStep(st);
      const cx = xOf(ons[i].unit);
      return { i, x: dir === 'down' ? cx - sp * 0.72 : cx + sp * 0.72, y: dir === 'down' ? cy + stemLen : cy - stemLen };
    });
    // flat beam at the extreme stem end so every stem reaches it
    const by = dir === 'down' ? Math.max(...pts.map((p) => p.y)) : Math.min(...pts.map((p) => p.y));
    const t = sp * 0.42;
    const bar = (x1: number, x2: number, off: number, k: string) => (
      <rect key={k} x={x1} y={dir === 'down' ? by - off - t : by + off} width={x2 - x1} height={t} className="rn-beam" />
    );
    const out = [bar(pts[0].x, pts[pts.length - 1].x, 0, 'a')];
    // secondary beams for sixteenths
    pts.forEach((p, k) => {
      if (events[p.i].base !== 's') return;
      const nxt = pts[k + 1], prv = pts[k - 1];
      if (nxt && events[nxt.i].base === 's') out.push(bar(p.x, nxt.x, t + 2, `s${k}`));
      else if (!prv || events[prv.i].base !== 's') out.push(bar(p.x, p.x + sp * 1.1, t + 2, `p${k}`));
      else if (prv && events[prv.i].base === 's' && !(nxt && events[nxt.i].base === 's')) { /* already drawn from prev */ }
    });
    return <g key={gi} className={`rn ${pts.some((p) => active === p.i) ? 'rn-active' : ''}`}>{out}
      {pts.map((p) => {
        const st = lineOnly ? 32 : stepFor(soundIndex[p.i]);
        const cy = lineOnly ? staffTop + staffH / 2 : yStep(st);
        return <line key={p.i} x1={p.x} x2={p.x} y1={cy} y2={by} className="stem" />;
      })}
    </g>;
  });

  const grid = pulse ? Array.from({ length: Math.floor(U / sig.group) + 1 }, (_, b) => b * sig.group) : [];
  const staffLines = lineOnly ? [staffTop + staffH / 2] : [0, 2, 4, 6, 8].map((o) => yStep(bottom + o));
  return (
    <svg viewBox={`0 0 ${width} ${total}`} className={`staff rhythm-staff ${small ? 'small' : ''}`} role="img" aria-label={caption ?? 'Rhythm notation'}>
      {staffLines.map((y, i) => <line key={i} x1={14} x2={width - 14} y1={y} y2={y} className="staff-line" />)}
      <line x1={14} x2={14} y1={lineOnly ? staffTop + staffH / 2 - 14 : staffTop} y2={lineOnly ? staffTop + staffH / 2 + 14 : staffBottom} className="staff-line bar" />
      <line x1={width - 14} x2={width - 14} y1={lineOnly ? staffTop + staffH / 2 - 14 : staffTop} y2={lineOnly ? staffTop + staffH / 2 + 14 : staffBottom} className="staff-line bar" />
      {!lineOnly && <text x={20} y={yStep(bottom + 2) + sp * 0.62} className="clef" style={{ fontSize: sp * 6.4 }}>𝄞</text>}
      <g className="timesig">
        <text x={lineOnly ? 44 : 98} y={(lineOnly ? staffTop + staffH / 2 : staffTop + H * 3.2 + 0) - (lineOnly ? 2 : 0)} textAnchor="middle" style={{ fontSize: sp * 2.9 }}>{sig.top}</text>
        <text x={lineOnly ? 44 : 98} y={(lineOnly ? staffTop + staffH / 2 : staffBottom - H * 1.1) + (lineOnly ? sp * 2.2 : 0)} textAnchor="middle" style={{ fontSize: sp * 2.9 }}>{sig.bottom}</text>
      </g>
      {grid.map((u) => u > 0 && u < U && <line key={u} x1={xOf(u) - 0.5} x2={xOf(u) - 0.5} y1={staffTop - 10} y2={tab ? tabTop + tabH + 4 : staffBottom + 4} className="rn-grid" />)}
      {ons.map((_, i) => drawNote(i))}
      {beams}
      {counts && ons.map((o, i) => (
        <text key={i} x={xOf(o.unit)} y={staffBottom + 22} textAnchor="middle" className={`rn-count ${o.unit % sig.group === 0 ? 'beat' : ''}`}>{countLabel(o.unit, sig)}</text>
      ))}
      {tab && (
        <g className="rn-tab">
          <text x={22} y={tabTop + tabH / 2 - 8} className="tab-word" style={{ fontSize: 12 }}>T</text>
          <text x={22} y={tabTop + tabH / 2 + 5} className="tab-word" style={{ fontSize: 12 }}>A</text>
          <text x={22} y={tabTop + tabH / 2 + 18} className="tab-word" style={{ fontSize: 12 }}>B</text>
          {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={44} x2={width - 14} y1={tabTop + i * (tabH / 5)} y2={tabTop + i * (tabH / 5)} className="staff-line" />)}
          {ons.map((o, i) => {
            if (events[i].rest) return null;
            const t = tab[soundIndex[i]];
            if (!t) return null;
            const yy = tabTop + (5 - t.s) * (tabH / 5);
            return (
              <Fragment key={i}>
                <rect x={xOf(o.unit) - 8} y={yy - 7} width={16} height={14} className="tab-fret-bg" />
                <text x={xOf(o.unit)} y={yy + 4.5} textAnchor="middle" className={`rn-tabnum ${active === i ? 'on' : ''}`}>{t.f}</text>
              </Fragment>
            );
          })}
        </g>
      )}
    </svg>
  );
}

function flagPath(x: number, y: number, down: boolean, sixteenth: boolean, sp: number) {
  const d = down ? -1 : 1;
  const one = (dy: number) => `M ${x} ${y + dy * d * -1} c ${sp * 0.2} ${d * sp * 0.9 * -1} ${sp * 1.15} ${d * sp * 0.9 * -1} ${sp * 0.95} ${d * sp * 2 * -1}`;
  // flag hangs from the stem end: for stems-up it curls downward-right
  const f = (off: number) => `M ${x} ${y + (down ? -off : off)} c ${sp * 0.1} ${down ? -sp * 0.8 : sp * 0.8} ${sp * 1.2} ${down ? -sp * 0.7 : sp * 0.7} ${sp * 0.9} ${down ? -sp * 1.9 : sp * 1.9}`;
  void one;
  return sixteenth ? `${f(0)} ${f(sp * 0.8)}` : f(0);
}
