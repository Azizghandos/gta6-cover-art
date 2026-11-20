// Fixed scenes for screenshots: ?shot=cover shows a finished cover alone,
// ?shot=editor shows the app in the browser with a photo loaded. The query
// picks the layout, size, grade, sample photo and caption. window.__shotReady
// is set by main.js once the scene has painted.
export function shotScene(query) {
  const shot = query.get('shot');
  const layout = query.get('layout') || 'poster';
  const size = query.get('size') || 'square';
  const grade = query.get('grade') || 'sunset';
  const caption = query.get('caption') || 'Sunset Heist';
  const subtitle = query.get('subtitle') || 'Vice City · 2026';
  const photoName = query.get('photo') || 'pier';
  const photoName2 = query.get('photo2') || 'boulevard';
  const state = {
    size, layout, grade, caption, subtitle,
    halftone: query.get('halftone') !== '0',
    vignette: query.get('vignette') !== '0',
    grain: query.get('grain') === '1',
    panels: [
      { photo: 0, zoom: 1, ox: 0, oy: 0 },
      { photo: 1, zoom: 1, ox: 0, oy: 0 },
      { photo: 0, zoom: 1.15, ox: 0.05, oy: 0 },
      { photo: 1, zoom: 1.1, ox: -0.05, oy: 0.05 },
    ],
  };
  return { shot, state, photoName, photoName2, coverOnly: shot === 'cover' };
}
