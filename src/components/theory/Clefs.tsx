import { useState } from 'react';
import { LETTERS, midiOf, noteFromStep, noteName, spellMidi, stepOf, type Note } from '../../lib/music';
import { GrandStaff, MiniStaff, type StaffNote } from './MiniStaff';
import PianoKeys from './PianoKeys';
import { VoiceToggle, soundWritten, type Voice } from './common';
import TCard from './TCard';

const ledgerCount = (step: number, bottom: number) => (step < bottom ? Math.floor((bottom - step) / 2) : step > bottom + 8 ? Math.floor((step - (bottom + 8)) / 2) : 0);

/** Notes on the five lines (or four spaces) of a clef, bottom up, labelled with their letter. */
function lineSpace(clef: 'treble' | 'bass', kind: 'lines' | 'spaces'): StaffNote[] {
  const bottom = clef === 'treble' ? 30 : 18;
  const steps = kind === 'lines' ? [0, 2, 4, 6, 8] : [1, 3, 5, 7];
  return steps.map((o) => {
    const n = noteFromStep(bottom + o, 0);
    return { n, label: LETTERS[n.l] };
  });
}

export default function Clefs() {
  const [midi, setMidi] = useState(60);                 // written pitch (what the page shows); a piano plays this
  const [voice, setVoice] = useState<Voice>('piano');
  const note: Note = spellMidi(midi);
  const step = stepOf(note);
  // Middle C and above are read in the treble clef, below in the bass clef; the other clef shows the same pitch dimmed.
  const trebleN: StaffNote[] = midi >= 60 ? [{ n: note, cls: 'sel', label: noteName(note, true) }] : midi >= 55 ? [{ n: note, cls: 'dim' }] : [];
  const bassN: StaffNote[] = midi <= 60 ? [{ n: note, cls: 'sel', label: noteName(note, true) }] : midi <= 67 ? [{ n: note, cls: 'dim' }] : [];
  const clefNow = midi >= 60 ? 'treble' : 'bass';
  const lines = clefNow === 'treble' ? ledgerCount(step, 30) : ledgerCount(step, 18);
  const other = clefNow === 'treble' ? ledgerCount(step, 18) : ledgerCount(step, 30);
  const gtrWritten = 52;                                 // E3 written = open low E (sounds E2)

  return (
    <TCard eyebrow="Reading music · 3" title="Clefs, the grand staff and ledger lines" narrate="theory-clefs" className="explainer">
      <p className="hint">A <b>clef</b> tells you which pitch each line and space stands for. The <b>treble clef</b> (G clef) curls around the G above middle C; the <b>bass clef</b> (F clef) has its two dots around the F below middle C. Pianists read both together on the <b>grand staff</b>, joined at <b>middle C</b>, which sits on a short ledger line between them.</p>

      <div className="builder-bar"><VoiceToggle voice={voice} onChange={setVoice} /><span className="muted">Click a key (or any staff line or space) to place a note.</span></div>
      <PianoKeys from={36} to={84} marks={{ [midi]: { cls: 'on' } }} onKey={(m) => { setMidi(m); soundWritten(voice, m); }} showC />
      <GrandStaff trebleNotes={trebleN} bassNotes={bassN} gap={0}
        onPick={(_clef, s) => { const m = midiOf(noteFromStep(s, 0)); if (m >= 36 && m <= 84) { setMidi(m); soundWritten(voice, m); } }} />
      <div className="ex-live">
        <p className="ex-live-title">You chose <b>{noteName(note, true)}</b> (MIDI {midi}).</p>
        <ul>
          <li>Written in the <b>{clefNow} clef</b> it sits {lines === 0 ? 'on the staff itself' : <>on <b>{lines} ledger line{lines > 1 ? 's' : ''}</b></>}.
            {midi === 60 && <> Middle C is the one note that can be written either way: one ledger line below the treble staff or one above the bass staff.</>}</li>
          <li>Read in the {clefNow === 'treble' ? 'bass' : 'treble'} clef the same pitch needs {other} ledger line{other === 1 ? '' : 's'}, which is why choosing the right clef matters: it keeps notes close to the staff.</li>
        </ul>
      </div>

      <div className="ex-grid">
        <article>
          <h3>Treble clef</h3>
          <p>Lines, bottom to top: <b>E G B D F</b> (“Every Good Boy Does Fine”). Spaces: <b>F A C E</b>, which spell “face”.</p>
          <MiniStaff clef="treble" notes={lineSpace('treble', 'lines')} width={340} gap={52} sp={10} caption="Treble clef lines" />
          <MiniStaff clef="treble" notes={lineSpace('treble', 'spaces')} width={340} gap={52} sp={10} caption="Treble clef spaces" />
        </article>
        <article>
          <h3>Bass clef</h3>
          <p>Lines: <b>G B D F A</b> (“Good Boys Do Fine Always”). Spaces: <b>A C E G</b> (“All Cows Eat Grass”). Everything sits two letters lower than in the treble clef: its top space holds the G just below middle C.</p>
          <MiniStaff clef="bass" notes={lineSpace('bass', 'lines')} width={340} gap={52} sp={10} caption="Bass clef lines" />
          <MiniStaff clef="bass" notes={lineSpace('bass', 'spaces')} width={340} gap={52} sp={10} caption="Bass clef spaces" />
        </article>
        <article>
          <h3>Ledger lines</h3>
          <p>Notes beyond the five lines sit on short extra lines called <b>ledger lines</b>. Counting them is where beginners trip, so <b>find a landmark</b> (middle C, or the G or F the clef points to) and count steps from there rather than reading line by line.</p>
        </article>
        <article>
          <h3>Guitar is written an octave high</h3>
          <p>Guitar music is notated in the treble clef but <b>sounds an octave lower</b>. The open low E is written as E3, on <b>{ledgerCount(stepOf(spellMidi(gtrWritten)), 30)} ledger lines</b> below the staff, though it actually sounds E2. Sheet music sometimes marks this with a small 8 under the clef. Without it, a pianist reading a guitar part must remember to play it an octave lower.</p>
          <MiniStaff clef="treble" notes={[{ n: spellMidi(gtrWritten), cls: 'sel', label: 'E3 written · E2 sounds' }]} width={340} gap={90} sp={10} caption="Open low E string in guitar notation" />
        </article>
      </div>
    </TCard>
  );
}
