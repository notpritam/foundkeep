// FoundKeep's own 3D objects: one for each thing the product keeps or does
// (a saved page, a screenshot, a photo, a post, a highlight, a note, a voice
// memo, a video, a PDF, a folder, a tag, the save bookmark, AI sparkles,
// search). Modelled in three.js and rendered to transparent images by
// render.mjs; the app shows the images. Edit here, then re-render.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  emerald: '#12a66c', emeraldDeep: '#0d7a50', mint: '#c6f0dc', coral: '#ff4a3d', coralDeep: '#e2433a',
  amber: '#ffb319', amberDeep: '#f28c00', cream: '#fff7e8', paper: '#ffffff', ink: '#23262b', grey: '#c9ced6',
  lilac: '#7a5cff', yellow: '#ffdf3d', slate: '#1c1f24', gold: '#ffbd14',
};

const plastic = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.26, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.12, ...o });
const matte = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, ...o });

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function extrude(shape, depth, bevel = 0.06, segments = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segments, curveSegments: 32 });
  g.center(); return g;
}
const box = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, r), material);

/** A flat face with rounded corners whose texture spans its bounds. */
function roundedFace(w, h, r, material) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  return new THREE.Mesh(g, material);
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const faceMaterial = map => new THREE.MeshPhysicalMaterial({ map, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 });
async function image(url) { const img = new Image(); img.src = url; await img.decode(); return img; }
function cover(ctx, img, x, y, w, h, r = 0) {
  const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
  ctx.save(); if (r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip(); }
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
}
function bars(ctx, x, y, widths, h, gap, color) { ctx.fillStyle = color; widths.forEach((w, i) => { ctx.beginPath(); ctx.roundRect(x, y + i * (h + gap), w, h, h / 2); ctx.fill(); }); }

const photo = '/samples/scenic.webp', article = '/samples/region.jpg', chart = '/samples/image.jpg';

export const OBJECTS = {
  // The save itself: FoundKeep's bookmark ribbon.
  async bookmark() {
    const w = 1.15, h = 1.75, s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(-w / 2, h / 2 - 0.22); s.quadraticCurveTo(-w / 2, h / 2, -w / 2 + 0.22, h / 2);
    s.lineTo(w / 2 - 0.22, h / 2); s.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - 0.22); s.lineTo(w / 2, -h / 2); s.lineTo(0, -h / 2 + 0.46); s.lineTo(-w / 2, -h / 2);
    const g = new THREE.Group(); g.add(new THREE.Mesh(extrude(s, 0.16, 0.08), plastic(C.coral)));
    return { group: g, pose: [0.25, -0.5, 0.14] };
  },
  // A saved page: the article with its lead image, and the bookmark tab.
  async page() {
    const img = await image(article), g = new THREE.Group();
    g.add(box(2, 2.6, 0.22, 0.12, matte(C.paper)));
    const tex = canvasTexture(640, 832, (x, w, h) => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); cover(x, img, 40, 40, w - 80, 330, 22);
      bars(x, 40, 410, [480, 380], 30, 18, '#23262b'); bars(x, 40, 530, [560, 520, 560, 440, 500, 300], 16, 20, '#c9ced6');
    });
    const f = roundedFace(1.9, 2.5, 0.1, faceMaterial(tex)); f.position.z = 0.111; g.add(f);
    const tab = new THREE.Shape(); tab.moveTo(-0.2, 0.5); tab.lineTo(0.2, 0.5); tab.lineTo(0.2, -0.4); tab.lineTo(0, -0.24); tab.lineTo(-0.2, -0.4); tab.lineTo(-0.2, 0.5);
    const t = new THREE.Mesh(extrude(tab, 0.06, 0.03), plastic(C.emerald)); t.position.set(0.62, 1.22, 0.1); g.add(t);
    return { group: g, pose: [0.14, 0.5, -0.06] };
  },
  // A region screenshot: the capture inside emerald crop corners.
  async screenshot() {
    const img = await image(article), g = new THREE.Group();
    g.add(box(2.2, 1.44, 0.12, 0.05, matte(C.paper)));
    const tex = canvasTexture(880, 576, (x, w, h) => cover(x, img, 0, 0, w, h));
    const f = roundedFace(2.14, 1.38, 0.04, faceMaterial(tex)); f.position.z = 0.061; g.add(f);
    const m = plastic(C.emerald), L = 0.46, T = 0.1;
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const a = box(L, T, T, 0.045, m), b = box(T, L, T, 0.045, m);
      a.position.set(sx * (1.18 - L / 2), sy * 0.8, 0.14); b.position.set(sx * 1.18, sy * (0.8 - L / 2), 0.14); g.add(a, b);
    }
    return { group: g, pose: [0.2, -0.38, 0.05] };
  },
  // A photo: a print with a landscape.
  async photo() {
    const img = await image(photo), g = new THREE.Group();
    g.add(box(1.7, 2.05, 0.12, 0.05, matte(C.cream)));
    const tex = canvasTexture(640, 640, (x, w, h) => cover(x, img, 0, 0, w, h));
    const f = roundedFace(1.46, 1.46, 0.03, faceMaterial(tex)); f.position.set(0, 0.2, 0.061); g.add(f);
    return { group: g, pose: [0.1, 0.35, 0.14] };
  },
  // A post: avatar, name, the text and its image.
  async post() {
    const img = await image(chart), g = new THREE.Group();
    g.add(box(2.2, 1.7, 0.2, 0.16, matte(C.paper)));
    const tex = canvasTexture(880, 680, (x, w, h) => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
      const grd = x.createLinearGradient(40, 40, 120, 120); grd.addColorStop(0, '#2fd28f'); grd.addColorStop(1, '#0d7a50');
      x.fillStyle = grd; x.beginPath(); x.arc(84, 84, 44, 0, Math.PI * 2); x.fill();
      bars(x, 150, 58, [230], 24, 0, '#23262b'); bars(x, 150, 96, [150], 18, 0, '#aab0ba');
      bars(x, 40, 160, [780, 700, 520], 18, 18, '#c9ced6'); cover(x, img, 40, 290, w - 80, 340, 24);
    });
    const f = roundedFace(2.08, 1.6, 0.12, faceMaterial(tex)); f.position.z = 0.101; g.add(f);
    return { group: g, pose: [0.18, -0.42, -0.05] };
  },
  // A highlight: a passage with one line marked, and the marker.
  async highlight() {
    const g = new THREE.Group(); g.add(box(2.1, 1.35, 0.16, 0.12, matte(C.cream)));
    const tex = canvasTexture(840, 540, (x, w, h) => {
      x.fillStyle = C.cream; x.fillRect(0, 0, w, h); x.fillStyle = C.yellow; x.beginPath(); x.roundRect(40, 200, 700, 60, 12); x.fill();
      bars(x, 60, 90, [700, 620], 22, 34, '#b9b2a4'); bars(x, 60, 219, [620], 22, 0, '#5b4a1f'); bars(x, 60, 330, [690, 560], 22, 34, '#b9b2a4');
    });
    const f = roundedFace(2.0, 1.25, 0.08, faceMaterial(tex)); f.position.z = 0.081; g.add(f);
    const pen = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.35, 40), plastic(C.emerald)); pen.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.4, 40), plastic(C.slate)); cap.position.y = 0.72; pen.add(cap);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.28, 40), plastic(C.yellow)); tip.position.y = -0.8; pen.add(tip);
    pen.rotation.z = -1.05; pen.position.set(0.55, -0.55, 0.35); g.add(pen);
    return { group: g, pose: [0.2, 0.36, 0.04] };
  },
  // A note: a sticky note with handwriting and a lifted corner.
  async note() {
    const g = new THREE.Group(); g.add(box(1.6, 1.6, 0.08, 0.03, matte(C.yellow)));
    const tex = canvasTexture(640, 640, (x, w, h) => {
      x.fillStyle = C.yellow; x.fillRect(0, 0, w, h); x.strokeStyle = '#7a5d10'; x.lineWidth = 12; x.lineCap = 'round';
      for (const [y, len] of [[170, 440], [270, 380], [370, 460], [470, 260]]) { x.beginPath(); x.moveTo(90, y); for (let i = 0; i <= len; i += 40) x.quadraticCurveTo(90 + i + 20, y + (i % 80 ? -14 : 14), 90 + i + 40, y); x.stroke(); }
    });
    const f = roundedFace(1.54, 1.54, 0.02, faceMaterial(tex)); f.position.z = 0.041; g.add(f);
    const fold = new THREE.Shape(); fold.moveTo(0, 0); fold.lineTo(-0.42, 0); fold.lineTo(0, 0.42); fold.lineTo(0, 0);
    const c = new THREE.Mesh(new THREE.ShapeGeometry(fold), matte('#fff1a8', { side: THREE.DoubleSide })); c.position.set(0.8, -0.8, 0.05); c.rotation.set(0.35, -0.35, 0); g.add(c);
    return { group: g, pose: [0.12, -0.3, -0.1] };
  },
  // A voice memo: a capsule with its waveform.
  async voice() {
    const g = new THREE.Group(); g.add(new THREE.Mesh(extrude(roundedRect(2.3, 0.86, 0.43), 0.22, 0.08), plastic(C.emerald)));
    const heights = [0.18, 0.34, 0.52, 0.3, 0.6, 0.42, 0.24, 0.46, 0.3, 0.16], m = plastic('#ffffff');
    heights.forEach((h, i) => { const b = box(0.09, h, 0.06, 0.045, m); b.position.set(-0.72 + i * 0.16, 0, 0.2); g.add(b); });
    return { group: g, pose: [0.22, 0.42, 0.1] };
  },
  // A video: a frame with the play button.
  async video() {
    const img = await image(photo), g = new THREE.Group();
    g.add(box(2.2, 1.4, 0.2, 0.14, plastic(C.slate)));
    const tex = canvasTexture(880, 560, (x, w, h) => { cover(x, img, 0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, w, h); });
    const f = roundedFace(2.06, 1.26, 0.1, faceMaterial(tex)); f.position.z = 0.101; g.add(f);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 48), plastic('#ffffff', { transparent: true, opacity: 0.92 })); disc.rotation.x = Math.PI / 2; disc.position.z = 0.2; g.add(disc);
    const tri = new THREE.Shape(); tri.moveTo(-0.1, 0.17); tri.lineTo(0.2, 0); tri.lineTo(-0.1, -0.17); tri.lineTo(-0.1, 0.17);
    const t = new THREE.Mesh(extrude(tri, 0.05, 0.03), plastic(C.coral)); t.position.set(0.03, 0, 0.28); g.add(t);
    return { group: g, pose: [0.16, -0.36, 0.06] };
  },
  // A PDF: a page with a folded corner and its label.
  async pdf() {
    const w = 1.7, h = 2.2, k = 0.46, s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2 - k); s.lineTo(w / 2 - k, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
    const g = new THREE.Group(); g.add(new THREE.Mesh(extrude(s, 0.06, 0.03), matte(C.paper)));
    const fold = new THREE.Shape(); fold.moveTo(0, 0); fold.lineTo(k, 0); fold.lineTo(0, -k); fold.lineTo(0, 0);
    const c = new THREE.Mesh(extrude(fold, 0.02, 0.02), matte('#e7ebf0')); c.position.set(w / 2 - k * 0.66, h / 2 - k * 0.34, 0.07); g.add(c);
    const lines = canvasTexture(512, 512, (x, W) => bars(x, 0, 40, [400, 460, 360, 440, 300], 20, 34, '#c9ced6'));
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: lines, transparent: true })); fl.position.set(-0.02, 0.1, 0.071); g.add(fl);
    const label = box(0.98, 0.44, 0.08, 0.1, plastic(C.coral)); label.position.set(-0.3, -0.68, 0.12); g.add(label);
    const text = canvasTexture(392, 176, (x, W, H) => { x.fillStyle = '#fff'; x.font = '700 110px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PDF', W / 2, H / 2 + 6); });
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.4), new THREE.MeshBasicMaterial({ map: text, transparent: true })); tl.position.set(-0.3, -0.68, 0.165); g.add(tl);
    return { group: g, pose: [0.16, 0.42, 0.08] };
  },
  // A folder: open, with a page inside.
  async folder() {
    const back = new THREE.Shape(), w = 2.1, h = 1.5, tw = 0.8, th = 0.24, r = 0.12;
    back.moveTo(-w / 2 + r, -h / 2); back.lineTo(w / 2 - r, -h / 2); back.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); back.lineTo(w / 2, h / 2 - r);
    back.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); back.lineTo(-w / 2 + tw + 0.18, h / 2); back.lineTo(-w / 2 + tw, h / 2 + th); back.lineTo(-w / 2 + r, h / 2 + th);
    back.quadraticCurveTo(-w / 2, h / 2 + th, -w / 2, h / 2 + th - r); back.lineTo(-w / 2, -h / 2 + r); back.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.Group(); const b = new THREE.Mesh(extrude(back, 0.08, 0.04), plastic(C.amberDeep)); g.add(b);
    const sheet = box(1.8, 1.3, 0.03, 0.02, matte(C.paper)); sheet.position.set(0.05, 0.12, 0.08); sheet.rotation.z = 0.04; g.add(sheet);
    const front = new THREE.Mesh(extrude(roundedRect(2.1, 1.28, 0.12), 0.08, 0.04), plastic(C.amber)); front.position.set(0, -0.2, 0.2); front.rotation.x = -0.22; g.add(front);
    return { group: g, pose: [0.24, -0.34, 0.04] };
  },
  // A tag: with its hole and string.
  async tag() {
    const w = 1.9, h = 1.0, p = 0.46, r = 0.14, s = new THREE.Shape();
    s.moveTo(-w / 2 + p, h / 2); s.lineTo(w / 2 - r, h / 2); s.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - r); s.lineTo(w / 2, -h / 2 + r); s.quadraticCurveTo(w / 2, -h / 2, w / 2 - r, -h / 2);
    s.lineTo(-w / 2 + p, -h / 2); s.lineTo(-w / 2, 0); s.lineTo(-w / 2 + p, h / 2);
    const hole = new THREE.Path(); hole.absarc(-w / 2 + 0.42, 0, 0.12, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new THREE.Group(); g.add(new THREE.Mesh(extrude(s, 0.12, 0.05), plastic(C.lilac)));
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.5, 0.0, 0.1), new THREE.Vector3(-0.75, 0.25, 0.25), new THREE.Vector3(-1.15, 0.55, 0.1), new THREE.Vector3(-1.45, 0.45, -0.05), new THREE.Vector3(-1.2, 0.1, -0.1), new THREE.Vector3(-0.53, -0.02, -0.08)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.035, 12, false), matte(C.cream)));
    return { group: g, pose: [0.2, 0.3, -0.22] };
  },
  // AI organising: sparkles.
  async sparkles() {
    const star = (R, k) => { const s = new THREE.Shape(); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 2, b = a + Math.PI / 4, n = a + Math.PI / 2;
      const P = [Math.cos(a) * R, Math.sin(a) * R], Q = [Math.cos(b) * R * k, Math.sin(b) * R * k], N = [Math.cos(n) * R, Math.sin(n) * R];
      if (i === 0) s.moveTo(...P); s.quadraticCurveTo(...Q, ...N); } return s; };
    const m = plastic(C.gold, { metalness: 0.15, roughness: 0.22, clearcoat: 1 });
    const g = new THREE.Group(); g.add(new THREE.Mesh(extrude(star(1, 0.22), 0.18, 0.1), m));
    const small = new THREE.Mesh(extrude(star(0.42, 0.22), 0.1, 0.06), m); small.position.set(0.95, 0.85, 0.1); g.add(small);
    return { group: g, pose: [0.2, 0.35, 0.1] };
  },
  // Search: a magnifier with a glass lens.
  async search() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 32, 96), plastic(C.emerald)));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 64), new THREE.MeshPhysicalMaterial({ color: '#dff6ff', roughness: 0.05, transmission: 0.9, thickness: 0.3, ior: 1.4, clearcoat: 1 }));
    lens.rotation.x = Math.PI / 2; g.add(lens);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.95, 40), plastic(C.slate)); handle.position.set(0.8, -0.8, 0); handle.rotation.z = Math.PI / 4; g.add(handle);
    return { group: g, pose: [0.2, -0.4, 0] };
  },
};
