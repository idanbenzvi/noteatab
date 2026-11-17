import { piano, pluck } from '../../lib/audio';
import { WRITTEN_OFFSET } from '../../lib/music';

export type Voice = 'guitar' | 'piano';
/** Play a *written* pitch: a piano sounds it as written, a guitar sounds it an octave lower. */
export const soundWritten = (v: Voice, writtenMidi: number, delay = 0, dur = 1.6) =>
  v === 'piano' ? piano(writtenMidi, delay, dur + 0.8) : pluck(writtenMidi - WRITTEN_OFFSET, delay, dur);
/** Play a *sounding* pitch directly. */
export const soundReal = (v: Voice, midi: number, delay = 0, dur = 1.6) =>
  v === 'piano' ? piano(midi, delay, dur + 0.8) : pluck(midi, delay, dur);

export function VoiceToggle({ voice, onChange }: { voice: Voice; onChange: (v: Voice) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Sound">
      <button className={voice === 'guitar' ? 'on' : ''} onClick={() => onChange('guitar')}>🎸 Guitar</button>
      <button className={voice === 'piano' ? 'on' : ''} onClick={() => onChange('piano')}>🎹 Piano</button>
    </div>
  );
}

export const PITCH_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
