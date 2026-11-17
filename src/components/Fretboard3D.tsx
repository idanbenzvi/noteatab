import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { NUM_FRETS, STRINGS, midiOf, noteName, spellMidi, scaleNotes, mod, type FretPos, type Note, type Pitch, type ScaleType } from '../lib/music';

export type LabelMode = 'names' | 'degrees' | 'none';
interface Props {
  root: Pitch; type: ScaleType; selected: Note; focus: FretPos | null; labelMode: LabelMode;
  onPick: (s: number, f: number) => void;
}

const BOARD_W = 26;
const SCALE_LEN = BOARD_W / (1 - Math.pow(2, -NUM_FRETS / 12));
const fretX = (n: number) => SCALE_LEN * (1 - Math.pow(2, -n / 12));
const cellX = (f: number) => (f === 0 ? -1.15 : (fretX(f - 1) + fretX(f)) / 2);
const stringY = (s: number) => s * 1.1;
const BOARD_H = 7.2, CY = 2.75;

const C = { amber: 0xf2b84b, teal: 0x4fd1c5, coral: 0xff7a59 };

function labelTexture(text: string, fg: string, bold = true) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = `${bold ? 700 : 500} ${text.length > 2 ? 54 : 68}px Inter Variable, Inter, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
  g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2a1a12'); grad.addColorStop(.5, '#34211a'); grad.addColorStop(1, '#251610');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(${i % 3 ? '90,58,40' : '12,6,4'},${0.05 + Math.random() * 0.1})`;
    g.lineWidth = 0.5 + Math.random() * 1.6;
    const y = Math.random() * 256;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 160 + i) * 2.2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

interface Ctx {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  rig: THREE.Group; markers: THREE.Group; hits: THREE.Mesh[]; pulse: THREE.Object3D[];
  tip: HTMLDivElement; mouse: { x: number; y: number }; raf: number; ro: ResizeObserver;
  labelCache: Map<string, THREE.CanvasTexture>;
}

export default function Fretboard3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<Ctx | null>(null);
  const latest = useRef(props); latest.current = props;

  /* ---- one-time scene ---- */
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (err) {
      el.insertAdjacentHTML('afterbegin', `<p class="fb-fallback">The 3D fretboard needs WebGL, which isn’t available here (${String((err as Error).message).slice(0, 80)}).</p>`);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'pan-y';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 200);
    const rig = new THREE.Group(); scene.add(rig);

    scene.add(new THREE.HemisphereLight(0xfff1dd, 0x1a2030, 1.0));
    const key = new THREE.DirectionalLight(0xffe8c8, 2.2); key.position.set(10, 14, 22); scene.add(key);
    const rim = new THREE.PointLight(0x4fd1c5, 220, 60); rim.position.set(-6, -6, 10); scene.add(rim);

    // board
    const wood = woodTexture();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W + 0.9, BOARD_H, 0.6),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.05 }));
    board.position.set((BOARD_W + 0.9) / 2 - 0.45, CY, -0.3); rig.add(board);
    const neckBack = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.9, BOARD_H + 0.5, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: .8 }));
    neckBack.position.set(board.position.x, CY, -0.8); rig.add(neckBack);

    // nut + frets
    const nut = new THREE.Mesh(new THREE.BoxGeometry(0.34, BOARD_H, 0.34), new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: .4 }));
    nut.position.set(0, CY, 0.02); rig.add(nut);
    const fretMat = new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.9, roughness: 0.25 });
    for (let f = 1; f <= NUM_FRETS; f++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, BOARD_H, 0.1), fretMat);
      m.position.set(fretX(f), CY, 0.03); rig.add(m);
    }
    // inlays
    const inlayMat = new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: .35 });
    const dot = (x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 28), inlayMat);
      m.rotation.x = Math.PI / 2; m.position.set(x, y, 0.01); rig.add(m);
    };
    [3, 5, 7, 9, 15, 17, 19].forEach((f) => dot(cellX(f), CY));
    dot(cellX(12), CY - 1.65); dot(cellX(12), CY + 1.65);

    // strings
    STRINGS.forEach((_, s) => {
      const r = 0.045 + (5 - s) * -0.0 + (5 - s) * 0.012 * (s < 3 ? 1.6 : 0.6) + (s < 3 ? 0.02 : 0);
      const geo = new THREE.CylinderGeometry(r, r, fretX(NUM_FRETS) + 0.5, 12);
      const mat = new THREE.MeshStandardMaterial({ color: s < 3 ? 0xc9a063 : 0xdfe3ea, metalness: 0.95, roughness: 0.3 });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.z = Math.PI / 2; m.position.set(fretX(NUM_FRETS) / 2 - 0.1, stringY(s), 0.22); rig.add(m);
    });

    // fret numbers + string names
    const labelCache = new Map<string, THREE.CanvasTexture>();
    const spriteFor = (txt: string, color: string, size: number, bold = false) => {
      const key = `${txt}|${color}|${bold}`;
      let t = labelCache.get(key); if (!t) { t = labelTexture(txt, color, bold); labelCache.set(key, t); }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      sp.scale.set(size, size, 1); return sp;
    };
    for (let f = 1; f <= NUM_FRETS; f++) {
      const sp = spriteFor(String(f), '#8b93a7', 0.95); sp.position.set(cellX(f), CY - BOARD_H / 2 - 0.65, 0.2); rig.add(sp);
    }
    STRINGS.forEach((st, s) => {
      const sp = spriteFor(st.name, '#e8e6df', 1.05, true); sp.position.set(-2.55, stringY(s), 0.3); rig.add(sp);
    });

    // invisible hit cells
    const hits: THREE.Mesh[] = [];
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    STRINGS.forEach((_, s) => {
      for (let f = 0; f <= NUM_FRETS; f++) {
        const w = f === 0 ? 1.8 : fretX(f) - fretX(f - 1);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.8), hitMat);
        m.position.set(cellX(f), stringY(s), 0.3); m.userData = { s, f }; rig.add(m); hits.push(m);
      }
    });

    const markers = new THREE.Group(); rig.add(markers);
    const tip = tipRef.current!;
    const mouse = { x: 0, y: 0 };
    const c: Ctx = { renderer, scene, camera, rig, markers, hits, pulse: [], tip, mouse, raf: 0, ro: null as any, labelCache };
    ctx.current = c;

    const resize = () => {
      const w = el.clientWidth, h = Math.max(260, Math.round(w * 0.33));
      renderer.setSize(w, h); camera.aspect = w / h;
      const halfW = (BOARD_W + 7) / 2;
      const dist = Math.max(halfW / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect), 20);
      camera.position.set(BOARD_W / 2 - 0.5, CY, dist); camera.lookAt(BOARD_W / 2 - 0.5, CY, 0);
      camera.updateProjectionMatrix();
    };
    c.ro = new ResizeObserver(resize); c.ro.observe(el); resize();

    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const pick = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(hits, false)[0];
      return hit ? (hit.object.userData as { s: number; f: number }) : null;
    };
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      const h = pick(e);
      renderer.domElement.style.cursor = h ? 'pointer' : 'default';
      if (h) {
        const { root, type } = latest.current;
        const midi = STRINGS[h.s].midi + h.f;
        const sn = scaleNotes(root, type).find((n) => n.pc === mod(midi, 12));
        const name = sn ? noteName(sn) : noteName(spellMidi(midi));
        tip.textContent = `${name}${Math.floor(midi / 12) - 1} · string ${STRINGS[h.s].label} · ${h.f === 0 ? 'open' : 'fret ' + h.f}`;
        tip.style.opacity = '1';
        tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top - 34}px)`;
      } else tip.style.opacity = '0';
    };
    const onLeave = () => { tip.style.opacity = '0'; mouse.x = mouse.y = 0; };
    const onClick = (e: PointerEvent) => { const h = pick(e); if (h) latest.current.onPick(h.s, h.f); };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('click', onClick as any);

    // everything lives in `rig`; a pivot at the board centre lets it tilt toward the pointer
    const pivot = new THREE.Group(); scene.remove(rig); pivot.add(rig); scene.add(pivot);
    rig.position.set(-(BOARD_W / 2 - 0.5), -CY, 0);
    pivot.position.set(BOARD_W / 2 - 0.5, CY, 0);
    const clock = new THREE.Clock();
    const loop = () => {
      c.raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      pivot.rotation.y += (mouse.x * 0.14 - pivot.rotation.y) * 0.06;
      pivot.rotation.x += (-0.16 + mouse.y * 0.07 - pivot.rotation.x) * 0.06;
      c.pulse.forEach((o, i) => { const k = 1 + Math.sin(t * 3 + i) * 0.12; o.scale.set(k, k, 1); });
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(c.raf); c.ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('click', onClick as any);
      scene.traverse((o: any) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => x.dispose?.()); });
      labelCache.forEach((t) => t.dispose());
      renderer.dispose(); renderer.domElement.remove(); ctx.current = null;
    };
  }, []);

  /* ---- markers, rebuilt whenever the musical state changes ---- */
  useEffect(() => {
    const c = ctx.current; if (!c) return;
    const { root, type, selected, focus, labelMode } = props;
    c.markers.children.slice().forEach((o: any) => { c.markers.remove(o); o.geometry?.dispose?.(); o.material?.dispose?.(); });
    c.pulse = [];
    const scale = scaleNotes(root, type);
    const selMidi = midiOf(selected) - 12;
    const disc = new THREE.CylinderGeometry(1, 1, 0.1, 40);
    const ring = new THREE.RingGeometry(0.72, 1, 48);
    const sprite = (txt: string, fg: string) => {
      const key = `m|${txt}|${fg}`;
      let t = c.labelCache.get(key); if (!t) { t = labelTexture(txt, fg); c.labelCache.set(key, t); }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      return sp;
    };
    STRINGS.forEach((st, s) => {
      for (let f = 0; f <= NUM_FRETS; f++) {
        const midi = st.midi + f;
        const sn = scale.find((n) => n.pc === mod(midi, 12));
        const isSel = midi === selMidi;
        if (!sn && !isSel) continue;
        const x = cellX(f), y = stringY(s);
        const color = isSel ? C.coral : sn!.isRoot ? C.amber : C.teal;
        const r = isSel ? 0.5 : 0.36;
        const mk = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: isSel ? 0.85 : sn!.isRoot ? 0.5 : 0.22,
          roughness: 0.35, transparent: true, opacity: isSel ? 1 : 0.92,
        }));
        mk.rotation.x = Math.PI / 2; mk.scale.set(r, 1, r); mk.position.set(x, y, 0.34); c.markers.add(mk);
        if (isSel) {
          const halo = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          halo.scale.set(0.95, 0.95, 1); halo.position.set(x, y, 0.42); c.markers.add(halo); c.pulse.push(halo);
        }
        if (focus && focus.s === s && focus.f === f) {
          const fr = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
          fr.scale.set(0.72, 0.72, 1); fr.position.set(x, y, 0.5); fr.renderOrder = 5; c.markers.add(fr); c.pulse.push(fr);
        }
        if (labelMode !== 'none') {
          const txt = labelMode === 'degrees' && sn ? sn.degree : noteName(sn ?? spellMidi(midi));
          const sp = sprite(txt, isSel || sn?.isRoot ? '#1a1306' : '#06201e');
          sp.scale.set(r * 2.05, r * 2.05, 1); sp.position.set(x, y, 0.5); sp.renderOrder = 6; c.markers.add(sp);
        }
      }
    });
  }, [props.root, props.type, props.selected, props.focus, props.labelMode]);

  return (
    <div className="fb3d" ref={host}>
      <div className="fb-tip" ref={tipRef} />
    </div>
  );
}
