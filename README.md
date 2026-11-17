# noteatab

*Note → tab.* An interactive guide from the treble-clef staff to the guitar fretboard.

- **Learn**: pick a note on the staff and see every place it lives on the neck, with scales, a circle of fifths and a 3D fretboard.
- **Theory**: rhythm and note values, key signatures, clefs and ledger lines, enharmonics, intervals, chords and harmony, modes, tab symbols, moveable shapes (barre, CAGED, pentatonic boxes) and tunings/capo, all interactive and audible.
- **Practice games**: tab → staff, staff → tab, fretboard finder, clef/key-signature/enharmonic/interval quizzes, interval and chord ear training, rhythm tapping, plus a progress card with weak-spot practice.
- **Visualizer**: a "chord laser zoetrope" - progressions play through a spinning glowing disc where each note is a coloured laser arc (ring = pitch, length = duration).
- **Tools**: metronome (tap tempo, subdivisions, speed trainer) and a microphone tuner.
- **Instruments**: how piano, flute, alto sax, tenor sax and guitar are written vs. how they sound, and how to transpose.

### Narration

Each text section has a "Listen" pill that plays pre-generated speech (ElevenLabs, Voice Design). The pill appears only for sections whose audio exists in `public/narration/`.

```sh
ELEVENLABS_API_KEY=... npm run narrate     # designs the voice once, generates missing/changed sections
npm run narrate -- --dry                   # list sections and character counts, no network
```

Scripts live in `src/lib/narration.ts`. The key is read from the environment only and never stored.

Built with Astro, React and three.js.

```sh
npm install
npm run dev        # local dev server
npm run build      # static site in dist/
npm run deploy     # build + deploy to Cloudflare (Workers static assets)
```
