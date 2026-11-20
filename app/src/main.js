// Vice Cover Studio — wires the page: photos in, caption typed, panels arranged,
// a live preview, and a PNG export. A `?shot=` query sets up a fixed scene for
// a screenshot instead (./shots.js).
import { drawCoverArt, layoutPanels, SIZES, LAYOUTS, GRADES } from './cover.js';
import { shotScene } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const panelInfo = document.getElementById('panelInfo');

/** The editor's state. `panels` holds one entry per panel of the current layout. */
const state = {
  size: 'square',
  layout: 'poster',
  grade: 'sunset',
  halftone: true,
  vignette: true,
  grain: false,
  caption: 'Sunset Heist',
  subtitle: 'Vice City · 2026',
  photos: [null, null, null],
  panels: [
    { photo: 0, zoom: 1, ox: 0, oy: 0 },
    { photo: 1, zoom: 1, ox: 0, oy: 0 },
    { photo: 0, zoom: 1, ox: 0, oy: 0 },
    { photo: 1, zoom: 1, ox: 0, oy: 0 },
  ],
};
let selectedPanel = 0;

function redraw() {
  drawCoverArt(canvas, state);
  updatePanelControls();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function setStatus(text) {
  status.textContent = text;
}

/** Builds a row of buttons from an object of {value: label}. */
function buildButtons(container, values, current, onPick) {
  container.innerHTML = '';
  for (const [value, label] of Object.entries(values)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (value === current ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => onPick(value));
    container.appendChild(b);
  }
}

function refreshPickers() {
  buildButtons(document.getElementById('sizePicker'), Object.fromEntries(
    Object.entries(SIZES).map(([k, v]) => [k, v.label.split(' · ')[0]]),
  ), state.size, (v) => { state.size = v; refreshPickers(); redraw(); });
  buildButtons(document.getElementById('layoutPicker'), Object.fromEntries(
    Object.entries(LAYOUTS).map(([k, v]) => [k, v.label]),
  ), state.layout, (v) => { state.layout = v; selectedPanel = 0; refreshPickers(); redraw(); });
  buildButtons(document.getElementById('gradePicker'), Object.fromEntries(
    Object.entries(GRADES).map(([k, v]) => [k, v.label]),
  ), state.grade, (v) => { state.grade = v; refreshPickers(); redraw(); });
}

/** Shows the selected panel's crop controls, and keeps them in sync. */
function updatePanelControls() {
  const panel = state.panels[selectedPanel];
  const count = LAYOUTS[state.layout].panels;
  panelInfo.textContent = `Panel ${selectedPanel + 1} of ${count} — click the preview to pick another panel.`;
  const photoSelect = document.getElementById('panelPhoto');
  photoSelect.value = String(panel.photo);
  document.getElementById('zoom').value = panel.zoom;
  document.getElementById('panX').value = panel.ox;
  document.getElementById('panY').value = panel.oy;
  document.getElementById('zoomVal').textContent = `${Math.round(panel.zoom * 100)}%`;
}

/** Which panel of the current layout holds a point of the preview canvas. */
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const { w, h } = SIZES[state.size];
  const px = x * w, py = y * h;
  // The same rectangles the renderer draws, so a click always hits the panel shown.
  const rects = layoutPanels(state.layout, w, h);
  return rects.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
}

// Photo slots: file pickers and sample buttons.
document.querySelectorAll('[data-slot]').forEach((input) => {
  input.addEventListener('change', async (e) => {
    const slot = Number(e.target.dataset.slot);
    const file = e.target.files[0];
    if (!file) return;
    state.photos[slot] = await loadImage(URL.createObjectURL(file));
    setStatus(`Photo ${slot + 1} loaded.`);
    redraw();
  });
});
document.querySelectorAll('[data-sample]').forEach((button) => {
  button.addEventListener('click', async (e) => {
    const slot = Number(e.target.dataset.sample);
    const sample = e.target.dataset.photo;
    state.photos[slot] = await loadImage(`samples/${sample}.jpg`);
    setStatus(`Sample photo loaded into slot ${slot + 1}.`);
    redraw();
  });
});

// Caption, subtitle, effects.
document.getElementById('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('halftone').addEventListener('change', (e) => { state.halftone = e.target.checked; redraw(); });
document.getElementById('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; redraw(); });
document.getElementById('grain').addEventListener('change', (e) => { state.grain = e.target.checked; redraw(); });

// Selected panel's crop controls.
document.getElementById('panelPhoto').addEventListener('change', (e) => {
  state.panels[selectedPanel].photo = Number(e.target.value);
  redraw();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('panX').addEventListener('input', (e) => {
  state.panels[selectedPanel].ox = Number(e.target.value);
  redraw();
});
document.getElementById('panY').addEventListener('input', (e) => {
  state.panels[selectedPanel].oy = Number(e.target.value);
  redraw();
});
document.getElementById('fillAll').addEventListener('click', () => {
  const photo = state.panels[selectedPanel].photo;
  state.panels.forEach((p) => { p.photo = photo; });
  setStatus('Every panel now shows the selected photo.');
  redraw();
});
document.getElementById('resetCrop').addEventListener('click', () => {
  state.panels[selectedPanel] = { ...state.panels[selectedPanel], zoom: 1, ox: 0, oy: 0 };
  redraw();
});

// Drag on the preview to pan the selected panel's photo.
let dragging = false;
let dragStart = null;
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit >= 0) {
    selectedPanel = hit;
    updatePanelControls();
  }
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY, ox: state.panels[selectedPanel].ox, oy: state.panels[selectedPanel].oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || !dragStart) return;
  const rect = canvas.getBoundingClientRect();
  const panel = state.panels[selectedPanel];
  panel.ox = Math.max(-0.5, Math.min(0.5, dragStart.ox + (e.clientX - dragStart.x) / rect.width));
  panel.oy = Math.max(-0.5, Math.min(0.5, dragStart.oy + (e.clientY - dragStart.y) / rect.height));
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = false; dragStart = null; });

// Export: render at full size and download the PNG.
document.getElementById('export').addEventListener('click', () => {
  const { w, h } = SIZES[state.size];
  canvas.toBlob((blob) => {
    if (!blob) { setStatus('Export failed — try again.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    setStatus(`Saved vice-cover-${w}x${h}.png — share it anywhere.`);
  }, 'image/png');
});

// Load the display font, then the sample photos, then paint.
async function boot() {
  try {
    await document.fonts.load('100px "Archivo Black"');
  } catch { /* the canvas falls back to Arial Black */ }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    const scene = shotScene(new URLSearchParams(location.search));
    Object.assign(state, scene.state);
    if (scene.photoName) {
      state.photos[0] = await loadImage(`samples/${scene.photoName}.jpg`);
      if (scene.photoName2) state.photos[1] = await loadImage(`samples/${scene.photoName2}.jpg`);
    }
    if (scene.coverOnly) document.body.classList.add('shot-cover');
    refreshPickers();
    redraw();
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
    return;
  }
  // Default scene: both samples in, so the editor opens with art, not emptiness.
  state.photos[0] = await loadImage('samples/pier.jpg');
  state.photos[1] = await loadImage('samples/boulevard.jpg');
  refreshPickers();
  redraw();
}

refreshPickers();
boot();
