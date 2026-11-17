#!/usr/bin/env node
// Generates the spoken narration (public/narration/*.mp3) with ElevenLabs.
//
//   ELEVENLABS_API_KEY=... npm run narrate            # design the voice once, then generate any missing/changed sections
//   npm run narrate -- --only theory-rhythm,theory-keys
//   npm run narrate -- --force                        # regenerate everything
//   npm run narrate -- --redesign                     # design a new voice from the description
//   npm run narrate -- --dry                          # list what would be generated, no network
//
// The API key is read from the environment only; it is never written to disk or bundled into the site.
// The designed voice id is cached in scripts/.narration-voice.json (git-ignored). Set ELEVENLABS_VOICE_ID to use an existing voice instead.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NARRATION, VOICE_DESCRIPTION, VOICE_SAMPLE_TEXT } from '../src/lib/narration.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.NARRATION_OUT || join(root, 'public', 'narration');   // overridable for tests
const manifestPath = join(outDir, 'manifest.json');
const voiceCache = process.env.NARRATION_VOICE_CACHE || join(root, 'scripts', '.narration-voice.json');
const API = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7) || (args.includes('--only') ? args[args.indexOf('--only') + 1] : '');
const onlyIds = only ? only.split(',').map((s) => s.trim()).filter(Boolean) : null;

const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 0.95 };
const MODEL = 'eleven_multilingual_v2';
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);

const ids = Object.keys(NARRATION).filter((id) => !onlyIds || onlyIds.includes(id));
const unknown = (onlyIds ?? []).filter((id) => !(id in NARRATION));
if (unknown.length) { console.error(`Unknown section id(s): ${unknown.join(', ')}\nKnown: ${Object.keys(NARRATION).join(', ')}`); process.exit(1); }

if (flag('dry')) {
  const chars = ids.reduce((n, id) => n + NARRATION[id].length, 0);
  ids.forEach((id) => console.log(`${id.padEnd(20)} ${String(NARRATION[id].length).padStart(5)} characters`));
  console.log(`\n${ids.length} sections, ${chars} characters in total (this is what ElevenLabs bills for).`);
  process.exit(0);
}

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('ELEVENLABS_API_KEY is not set.\nRun:  ELEVENLABS_API_KEY=your-key npm run narrate\n(the key stays in your shell; it is not saved anywhere).');
  process.exit(1);
}

async function call(path, body, { raw = false } = {}) {
  const res = await fetch(API + path, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 400);
    const err = new Error(`${path} failed: HTTP ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

async function designVoice() {
  console.log('Designing the narrator voice from the description…');
  const design = await call('/v1/text-to-voice/design', { voice_description: VOICE_DESCRIPTION, text: VOICE_SAMPLE_TEXT, model_id: 'eleven_multilingual_ttv_v2' });
  const preview = design.previews?.[0];
  if (!preview) throw new Error('Voice Design returned no previews.');
  mkdirSync(dirname(voiceCache), { recursive: true });
  writeFileSync(join(dirname(voiceCache), '.narration-preview.mp3'), Buffer.from(preview.audio_base_64, 'base64'));
  console.log('  saved an audition clip next to the voice cache (.narration-preview.mp3)');
  let voice;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      voice = await call('/v1/text-to-voice', { voice_name: 'noteatab narrator', voice_description: VOICE_DESCRIPTION, generated_voice_id: preview.generated_voice_id });
      break;
    } catch (e) { if (e.status === 409) { await new Promise((r) => setTimeout(r, 2000)); continue; } throw e; }
  }
  if (!voice) throw new Error('Could not save the designed voice (still in progress after several retries). Run the command again.');
  writeFileSync(voiceCache, JSON.stringify({ voice_id: voice.voice_id, description_hash: sha(VOICE_DESCRIPTION) }, null, 2));
  console.log(`  voice created: ${voice.voice_id}`);
  return voice.voice_id;
}

async function getVoiceId() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (!flag('redesign') && existsSync(voiceCache)) {
    const c = JSON.parse(readFileSync(voiceCache, 'utf8'));
    if (c.voice_id && c.description_hash === sha(VOICE_DESCRIPTION)) return c.voice_id;
  }
  return designVoice();
}

mkdirSync(outDir, { recursive: true });
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const voiceId = await getVoiceId();

let made = 0, skipped = 0;
for (const id of ids) {
  const file = join(outDir, `${id}.mp3`);
  const version = sha(NARRATION[id] + voiceId + MODEL + JSON.stringify(VOICE_SETTINGS));
  if (!flag('force') && manifest[id] === version && existsSync(file)) { skipped++; continue; }
  process.stdout.write(`Narrating ${id} (${NARRATION[id].length} characters)… `);
  const audio = await call(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, { text: NARRATION[id], model_id: MODEL, voice_settings: VOICE_SETTINGS }, { raw: true });
  writeFileSync(file, audio);
  manifest[id] = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');   // saved after every section so an interruption loses nothing
  made++;
  console.log(`${(audio.length / 1024).toFixed(0)} KB`);
}
// drop manifest entries for sections that no longer exist
for (const id of Object.keys(manifest)) if (!(id in NARRATION)) delete manifest[id];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nDone: ${made} generated, ${skipped} already up to date. Now run "npm run deploy" to publish the audio.`);
