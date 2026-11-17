import { SCALES, parentMajor, pitchName, scaleNotes, signatureCount, signatureLabel, type Pitch, type ScaleType } from '../lib/music';
import SpotlightCard from './reactbits/SpotlightCard';

const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export default function Explainer({ root, type }: { root: Pitch; type: ScaleType }) {
  const parent = parentMajor(root, type);
  const pn = scaleNotes(parent, 'major');
  const relMinor = pn[5];
  const IV = pn[3];
  const V = pn[4];
  const count = signatureCount(parent);
  const sig = signatureLabel(count);
  const n = Math.abs(count);
  const sharp = count > 0;
  const acc = (sharp ? SHARPS : FLATS).slice(0, n);

  return (
    <SpotlightCard className="card explainer" spotlight="rgba(242,184,75,0.08)">
      <p className="eyebrow">6 · Understanding the circle</p>
      <h2>How the circle of fifths works</h2>

      <div className="ex-live">
        <p className="ex-live-title">Right now: <b>{pitchName(root)} {SCALES[type].label.toLowerCase()}</b></p>
        <ul>
          <li>Its notes belong to the key of <b>{pitchName(parent)} major</b> / <b>{pitchName(relMinor)} minor</b>
            {count === 0 ? ' (no sharps or flats)' : ` (${sig})`}.</li>
          <li>Next door on the circle: <b>{pitchName(IV)}</b> (a fifth below, the IV chord) and <b>{pitchName(V)}</b> (a fifth above, the V chord), the keys that share six of seven notes with it.</li>
          <li>Key signature: {acc.length ? acc.map((l) => <span key={l} className="acc-chip">{l}{sharp ? '♯' : '♭'}</span>) : <span className="acc-chip">none</span>}</li>
        </ul>
      </div>

      <div className="ex-grid">
        <article>
          <h3>1 · What it is</h3>
          <p>The circle of fifths arranges the twelve notes so that each step clockwise moves up a <b>perfect fifth</b> (seven semitones, e.g. C → G). After twelve steps you arrive back at C, which is why it closes into a circle. Going counter-clockwise moves up a fourth instead (C → F), the same pattern in reverse.</p>
        </article>
        <article>
          <h3>2 · Why fifths?</h3>
          <p>The fifth is the most consonant interval after the octave, so keys a fifth apart sound closely related. Moving one step around the circle changes <b>only one note</b> of the scale: G major is C major with F raised to F♯. That is what makes the circle a map of how “near” or “far” keys are from one another.</p>
        </article>
        <article>
          <h3>3 · Key signatures</h3>
          <p>Each step clockwise adds one sharp; each step counter-clockwise adds one flat. Sharps always appear in this order: <span className="order">F C G D A E B</span>. Flats arrive in the reverse order: <span className="order">B E A D G C F</span>. At the bottom, F♯ major (6♯) and G♭ major (6♭) are the same pitches under two names, called <i>enharmonic</i> keys.</p>
        </article>
        <article>
          <h3>4 · Two rings: major and minor</h3>
          <p>The inner ring holds each major key’s <b>relative minor</b>, the minor key that uses exactly the same notes and signature. Find it by counting down three semitones (C → A) or by reading the wedge directly beneath. A natural minor is simply the major scale started from its sixth degree.</p>
        </article>
        <article>
          <h3>5 · Where the other scales fit</h3>
          <p><b>Pentatonic</b> scales are five-note subsets: major pentatonic drops the 4th and 7th of the major scale, minor pentatonic drops the 2nd and ♭6th of the minor. They live in the same wedge as their parent key. <b>Dorian</b> is a minor sound with a raised 6th; it uses the notes of the major key a <b>whole step below</b> its tonic (D Dorian = C major notes), so on the circle it sits one step <b>clockwise</b> of the plain minor key of the same name (D minor uses F major’s notes, D Dorian uses C major’s).</p>
        </article>
        <article>
          <h3>6 · Using it on guitar</h3>
          <ul>
            <li><b>Chords:</b> in any key, the I, IV and V chords are a wedge and its two neighbours. In C that is C, F and G, the backbone of countless songs.</li>
            <li><b>Modulating:</b> to change key smoothly, move to a neighbour. Only one note changes, so your fretboard shapes barely move.</li>
            <li><b>Soloing:</b> a pentatonic or major shape slides along the neck; the circle tells you which key’s shape to use over each chord.</li>
            <li><b>Reading music:</b> count the sharps or flats in the key signature on the staff, then find that wedge. That is the key of the piece.</li>
          </ul>
        </article>
      </div>
      <p className="hint small">Try it: pick a wedge above, then compare the lit notes on the fretboard with its neighbour. Exactly one note changes.</p>
    </SpotlightCard>
  );
}
