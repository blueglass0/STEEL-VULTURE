// Renders the PWA icons in public/icons from the favicon emblem: node scripts/make-icons.cjs (repo root, needs Playwright).
const { chromium } = require('playwright');
const emblem = (scale) => {
  // The favicon's triangle + core, on a 32-unit grid, scaled about the centre.
  const t = (x, y) => `${16 + (x - 16) * scale},${16 + (y - 15) * scale}`;
  return `<path d="M${t(16, 5)} L${t(27, 23)} L${t(5, 23)}Z" fill="none" stroke="#e8a33d" stroke-width="${2.4 * scale}" stroke-linejoin="round"/>
  <circle cx="16" cy="${16 + 2 * scale}" r="${3 * scale}" fill="#e8a33d"/>`;
};
const svg = (bg, scale, rounded) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
  ${rounded ? '<rect width="32" height="32" rx="6" fill="#14181c"/>' : `<rect width="32" height="32" fill="${bg}"/>`}
  ${emblem(scale)}</svg>`;
const icons = [
  { file: 'icon-192.png', size: 192, svg: svg('#14181c', 1, true), transparent: true },
  { file: 'icon-512.png', size: 512, svg: svg('#14181c', 1, true), transparent: true },
  // Maskable: full bleed, emblem inside the 80% safe circle.
  { file: 'maskable-512.png', size: 512, svg: svg('#14181c', 0.72, false) },
  // iOS rounds the corners itself and dislikes transparency.
  { file: 'apple-touch-icon.png', size: 180, svg: svg('#14181c', 0.85, false) },
];
(async () => {
  const b = await chromium.launch();
  for (const ic of icons) {
    const p = await b.newPage({ viewport: { width: ic.size, height: ic.size } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${ic.svg}</body></html>`);
    await p.screenshot({ path: `public/icons/${ic.file}`, omitBackground: !!ic.transparent });
    await p.close();
  }
  await b.close();
})();
