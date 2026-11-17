import { useEffect, useRef, useState } from 'react';
import StarBorder from './reactbits/StarBorder';

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// The generator writes public/narration/manifest.json listing the sections that have audio.
// Until it exists (or lists a section) the pill is simply not shown, so the page never offers a dead control.
let manifest: Promise<Record<string, string>> | null = null;
const loadManifest = () => (manifest ??= fetch('/narration/manifest.json').then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : ({} as Record<string, string>))).catch(() => ({} as Record<string, string>)));
// Only one narration plays at a time.
let current: { audio: HTMLAudioElement; stop: () => void } | null = null;

/** A speaker pill that reads a section aloud using pre-generated narration (public/narration/<id>.mp3). */
export default function Narrate({ id, label = 'Listen' }: { id: string; label?: string }) {
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [available, setAvailable] = useState(false);
  const [version, setVersion] = useState('');
  useEffect(() => { let live = true; void loadManifest().then((m) => { if (live && m[id]) { setAvailable(true); setVersion(m[id]); } }); return () => { live = false; }; }, [id]);

  const stopSelf = () => { audio.current?.pause(); if (audio.current) audio.current.currentTime = 0; setState('idle'); setProgress(0); };

  useEffect(() => () => { audio.current?.pause(); if (current?.audio === audio.current) current = null; }, []);

  const toggle = async () => {
    if (state === 'error') return;
    if (state === 'playing') { audio.current?.pause(); setState('paused'); return; }
    if (state === 'paused') { void audio.current?.play(); setState('playing'); return; }
    if (current && current.audio !== audio.current) current.stop();
    const a = audio.current ?? new Audio(`/narration/${id}.mp3?v=${version}`);
    if (!audio.current) {
      audio.current = a;
      a.preload = 'auto';
      a.addEventListener('timeupdate', () => setProgress(a.duration ? a.currentTime / a.duration : 0));
      a.addEventListener('ended', () => { setState('idle'); setProgress(0); });
      a.addEventListener('error', () => setState('error'));
      a.addEventListener('waiting', () => setState((s) => (s === 'playing' ? 'loading' : s)));
      a.addEventListener('playing', () => setState('playing'));
    }
    current = { audio: a, stop: stopSelf };
    setState('loading');
    try { await a.play(); } catch { setState((s) => (s === 'loading' ? 'error' : s)); }
  };

  if (!available) return null;
  const text = state === 'error' ? 'Narration not available yet' : state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : state === 'loading' ? 'Loading…' : label;
  return (
    <StarBorder className={`narrate ${state}`} color={state === 'error' ? '#8c95aa' : '#4fd1c5'} speed="5s" onClick={toggle}
      aria-label={`${text}: narrated explanation`} aria-pressed={state === 'playing'} title={state === 'error' ? 'The narration audio for this section has not been generated yet.' : 'Hear this section read aloud'}>
      <span className="narrate-icon" aria-hidden="true">
        {state === 'playing' ? <i className="bars"><b /><b /><b /><b /></i> : state === 'paused' ? '▶' : state === 'error' ? '🔇' : '🔊'}
      </span>
      <span className="narrate-text">{text}</span>
      {(state === 'playing' || state === 'paused') && <span className="narrate-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>}
    </StarBorder>
  );
}
