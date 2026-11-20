// Vice Cover Studio — the render engine. Draws a GTA-style multi-panel cover:
// each panel holds a photo with its own crop and zoom, a sunset or neon grade,
// halftone dots, and bold caption lettering across the foot. All drawing is
// plain Canvas 2D, so the app runs offline from static files.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080 · square post' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 · portrait post' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080 · wide post' },
};

export const LAYOUTS = {
  hero: { label: 'Single hero', panels: 1 },
  poster: { label: 'Poster · hero + two', panels: 3 },
  grid: { label: 'Grid · four panels', panels: 4 },
};

export const GRADES = {
  sunset: { label: 'Sunset', photo: 'saturate(1.45) contrast(1.12) brightness(1.02)' },
  neon: { label: 'Neon nights', photo: 'saturate(1.6) contrast(1.18) brightness(0.98)' },
  noir: { label: 'Noir', photo: 'grayscale(1) contrast(1.25) brightness(1.05)' },
  palm: { label: 'Palm dusk', photo: 'saturate(1.3) contrast(1.08) sepia(0.25)' },
};

/** Panel rectangles for a layout, in pixels, with a dark gutter between them. */
export function layoutPanels(layout, w, h) {
  const g = Math.round(Math.min(w, h) * 0.012);
  if (layout === 'hero') return [{ x: 0, y: 0, w, h }];
  if (layout === 'grid') {
    const hw = (w - g) / 2, hh = (h - g) / 2;
    return [
      { x: 0, y: 0, w: hw, h: hh },
      { x: hw + g, y: 0, w: hw, h: hh },
      { x: 0, y: hh + g, w: hw, h: hh },
      { x: hw + g, y: hh + g, w: hw, h: hh },
    ];
  }
  // poster: big hero on top, two small panels along the foot
  const heroH = Math.round(h * 0.64);
  const footH = h - heroH - g;
  const halfW = (w - g) / 2;
  return [
    { x: 0, y: 0, w, h: heroH },
    { x: 0, y: heroH + g, w: halfW, h: footH },
    { x: halfW + g, y: heroH + g, w: halfW, h: footH },
  ];
}

/** A tiny offscreen canvas of halftone dots, tiled over a panel. */
function halftonePattern() {
  const c = document.createElement('canvas');
  c.width = 12; c.height = 12;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(10, 6, 18, 0.55)';
  x.beginPath(); x.arc(6, 6, 2.1, 0, Math.PI * 2); x.fill();
  return c;
}

/** A tiny offscreen canvas of film grain, tiled over the whole cover. */
function grainPattern() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

let halftone = null;
let grain = null;

/** Draws one photo into one panel, cover-fit, with the panel's zoom and pan. */
function drawPanelPhoto(ctx, panel, photo, panelState, grade) {
  if (!photo) {
    ctx.fillStyle = '#3a2340';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 ${Math.round(panel.h * 0.06)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', panel.x + panel.w / 2, panel.y + panel.h / 2);
    return;
  }
  const iw = photo.naturalWidth, ih = photo.naturalHeight;
  const base = Math.max(panel.w / iw, panel.h / ih);
  const scale = base * (panelState.zoom || 1);
  const dw = iw * scale, dh = ih * scale;
  const dx = panel.x + (panel.w - dw) / 2 + (panelState.ox || 0) * panel.w;
  const dy = panel.y + (panel.h - dh) / 2 + (panelState.oy || 0) * panel.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  ctx.filter = GRADES[grade].photo;
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.filter = 'none';
  // Grade wash: a warm wash rising from the foot of the panel.
  const wash = ctx.createLinearGradient(0, panel.y + panel.h * 0.3, 0, panel.y + panel.h);
  if (grade === 'neon') {
    wash.addColorStop(0, 'rgba(0, 229, 255, 0.08)');
    wash.addColorStop(0.6, 'rgba(255, 0, 153, 0.32)');
    wash.addColorStop(1, 'rgba(120, 0, 180, 0.62)');
  } else if (grade === 'noir') {
    wash.addColorStop(0, 'rgba(0, 0, 0, 0)');
    wash.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  } else if (grade === 'palm') {
    wash.addColorStop(0, 'rgba(20, 120, 90, 0)');
    wash.addColorStop(1, 'rgba(255, 170, 60, 0.35)');
  } else {
    wash.addColorStop(0, 'rgba(255, 120, 80, 0)');
    wash.addColorStop(0.55, 'rgba(255, 90, 60, 0.18)');
    wash.addColorStop(1, 'rgba(190, 30, 110, 0.5)');
  }
  ctx.fillStyle = wash;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
}

/** Splits a caption into at most two lines that fit the width. */
function wrapCaption(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
    if (lines.length === 2) break;
  }
  if (line && lines.length < 2) lines.push(line);
  return lines;
}

/** Draws the bold caption across the foot of the cover, with a dark outline. */
function drawCaption(ctx, w, h, caption, subtitle) {
  const text = (caption || '').trim().toUpperCase();
  const bandH = h * 0.26;
  const bandY = h - bandH;
  // A dark band keeps the lettering readable over any photo.
  const band = ctx.createLinearGradient(0, bandY, 0, h);
  band.addColorStop(0, 'rgba(16, 8, 24, 0)');
  band.addColorStop(0.35, 'rgba(16, 8, 24, 0.55)');
  band.addColorStop(1, 'rgba(16, 8, 24, 0.88)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, h - bandY);
  if (!text) return;
  let size = Math.round(h * 0.115);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fit = (px) => {
    ctx.font = `${px}px "Archivo Black", "Arial Black", sans-serif`;
    return wrapCaption(ctx, text, w * 0.92);
  };
  let lines = fit(size);
  while (size > 20 && lines.some((l) => ctx.measureText(l).width > w * 0.92)) {
    size -= 4;
    lines = fit(size);
  }
  const lineH = size * 1.04;
  const totalH = lines.length * lineH;
  let y = h - h * 0.045 - totalH + size;
  const fill = ctx.createLinearGradient(0, y - size, 0, y + size * 0.4);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.55, '#ffe9a8');
  fill.addColorStop(1, '#ff7a3c');
  for (const line of lines) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160a20';
    ctx.lineWidth = Math.max(4, size * 0.14);
    ctx.strokeText(line, w / 2, y);
    ctx.fillStyle = fill;
    ctx.fillText(line, w / 2, y);
    y += lineH;
  }
  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const subSize = Math.max(14, Math.round(h * 0.026));
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.35)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffd9ec';
    ctx.fillText(sub, w / 2, h - h * 0.02 + subSize * 0.4);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/**
 * Draws the whole cover onto `canvas` from a state:
 * { size, layout, grade, halftone, vignette, grain, caption, subtitle,
 *   photos: [img|null, ...], panels: [{ photo, zoom, ox, oy }, ...] }
 */
export function drawCoverArt(canvas, state) {
  const { w, h } = SIZES[state.size] || SIZES.square;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, w, h);
  const panels = layoutPanels(state.layout, w, h);
  panels.forEach((panel, i) => {
    const panelState = (state.panels && state.panels[i]) || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const photo = state.photos ? state.photos[panelState.photo] : null;
    drawPanelPhoto(ctx, panel, photo, panelState, state.grade);
    // Halftone dots across the foot of each panel, comic-book style.
    if (state.halftone) {
      if (!halftone) halftone = halftonePattern();
      ctx.save();
      ctx.beginPath();
      ctx.rect(panel.x, panel.y + panel.h * 0.55, panel.w, panel.h * 0.45);
      ctx.clip();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ctx.createPattern(halftone, 'repeat');
      ctx.fillRect(panel.x, panel.y + panel.h * 0.55, panel.w, panel.h * 0.45);
      ctx.restore();
    }
    // A pale frame around each panel, poster style.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.004));
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
  });
  // Film grain over the whole cover.
  if (state.grain) {
    if (!grain) grain = grainPattern();
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // Vignette: dark corners pulling the eye to the middle.
  if (state.vignette) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(10, 4, 18, 0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  drawCaption(ctx, w, h, state.caption, state.subtitle);
}
