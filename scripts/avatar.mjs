#!/usr/bin/env node
// Builds avatar/avatar.svg — an astrolabe seal around Antares, in the same atlas style as the profile plates.
// Render to PNG with headless Chrome:  chrome --headless --screenshot=avatar.png --window-size=1024,1024 avatar/avatar.svg

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = 1024, c = 512, DISC = 405;
const f1 = (n) => +n.toFixed(1);
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rng = mulberry32(66632623);
const gold = '#D9B46C';
const font = readFileSync(join(ROOT, 'scripts/fonts/jetbrains-700.woff2')).toString('base64');

// Scorpius, centred on Antares. [RA h, Dec °, mag]
const SCO = {
  nu: [16.200, -19.46, 4.0], beta: [16.091, -19.81, 2.6], delta: [16.006, -22.62, 2.3],
  pi: [15.981, -26.11, 2.9], rho: [15.948, -29.21, 3.9], sigma: [16.353, -25.59, 2.9],
  alpha: [16.490, -26.43, 1.06], tau: [16.598, -28.22, 2.8], epsilon: [16.836, -34.29, 2.3],
  mu: [16.865, -38.05, 3.0], zeta: [16.910, -42.36, 3.6], eta: [17.203, -43.24, 3.3],
  theta: [17.622, -43.00, 1.9], iota: [17.793, -40.13, 3.0], kappa: [17.708, -39.03, 2.4],
  lambda: [17.560, -37.10, 1.6], upsilon: [17.513, -37.30, 2.7],
};
const LINES = [['nu', 'beta'], ['beta', 'delta'], ['delta', 'pi'], ['pi', 'rho'], ['delta', 'sigma'], ['sigma', 'alpha'],
  ['alpha', 'tau'], ['tau', 'epsilon'], ['epsilon', 'mu'], ['mu', 'zeta'], ['zeta', 'eta'], ['eta', 'theta'],
  ['theta', 'iota'], ['iota', 'kappa'], ['kappa', 'lambda'], ['lambda', 'upsilon']];
const scale = 15.5, k = Math.cos((31.35 * Math.PI) / 180), [ra0, dec0] = SCO.alpha;
const P = Object.fromEntries(Object.entries(SCO).map(([n, [ra, dec, mag]]) =>
  [n, { x: c - (ra - ra0) * 15 * k * scale, y: c - (dec - dec0) * scale, mag }]));

// Background stars inside the disc, denser along the Milky Way through the tail.
let stars = '';
const band = (x, y) => Math.abs(-(x - 430) * Math.sin(-0.6) + (y - 700) * Math.cos(-0.6)) < 90;
for (let i = 0; i < 1400; i++) {
  const x = rng() * S, y = rng() * S;
  if (Math.hypot(x - c, y - c) > DISC - 4) continue;
  const inBand = band(x, y);
  if (!inBand && rng() < 0.72) continue;
  const r = 0.5 + Math.pow(rng(), 3) * (inBand ? 1.2 : 2.2), o = 0.25 + rng() * 0.6;
  const tint = ['#FFFFFF', '#FFF1E2', '#E3ECFF', '#FFE7D6'][Math.floor(rng() * 4)];
  stars += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${tint}" opacity="${o.toFixed(2)}"/>`;
}

let lines = '', sco = '';
for (const [a, b] of LINES) lines += `<line x1="${f1(P[a].x)}" y1="${f1(P[a].y)}" x2="${f1(P[b].x)}" y2="${f1(P[b].y)}"/>`;
for (const [n, s] of Object.entries(P)) {
  if (n === 'alpha') continue;
  const r = Math.max(2.2, 6.4 - 1.4 * (s.mag - 1.5));
  sco += `<circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(r * 3.4)}" fill="url(#glowWhite)"/><circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(r)}" fill="#EEF3FF"/>`;
}

// Bezel: degree ticks and an engraved legend.
let ticks = '';
for (let d = 0; d < 360; d++) {
  const a = (d * Math.PI) / 180, r1 = 496, r0 = d % 10 === 0 ? 470 : d % 5 === 0 ? 478 : 486;
  ticks += `M${f1(c + r0 * Math.sin(a))} ${f1(c - r0 * Math.cos(a))}L${f1(c + r1 * Math.sin(a))} ${f1(c - r1 * Math.cos(a))}`;
}
const RT = 430;
// The legend runs clockwise from 6 o'clock; rotate it so the name sits centred at 12.
const ringText = ['MIRZO ISAEV', 'ANTARES', 'α SCORPII', 'RA 16h 29m 24s', 'DEC −26° 25′ 55″', 'HEART OF THE SCORPION'].join(' · ') + ' · ';
const shift = (5 - Math.round(ringText.length / 2 - 0.5) + ringText.length) % ringText.length;
const legend = ringText.slice(shift) + ringText.slice(0, shift);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<title>AntaresTheOne — α Scorpii seal</title>
<style>@font-face{font-family:'Atlas Mono';font-weight:700;src:url(data:font/woff2;base64,${font}) format('woff2')}</style>
<defs>
  <radialGradient id="sky" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#2B0E10"/><stop offset=".3" stop-color="#170B1A"/><stop offset=".75" stop-color="#0C0A17"/><stop offset="1" stop-color="#06070D"/>
  </radialGradient>
  <radialGradient id="bezel" cx="50%" cy="50%" r="50%">
    <stop offset=".78" stop-color="#0E0C17"/><stop offset=".9" stop-color="#14111F"/><stop offset="1" stop-color="#08080E"/>
  </radialGradient>
  <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
  </radialGradient>
  <radialGradient id="mw"><stop offset="0" stop-color="#7A5070" stop-opacity=".42"/><stop offset=".55" stop-color="#3A2850" stop-opacity=".2"/><stop offset="1" stop-color="#1A1530" stop-opacity="0"/></radialGradient>
  <radialGradient id="dust"><stop offset="0" stop-color="#05040A" stop-opacity=".6"/><stop offset="1" stop-color="#05040A" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowRed"><stop offset="0" stop-color="#FF4A26" stop-opacity=".8"/><stop offset=".3" stop-color="#FF3B1F" stop-opacity=".26"/><stop offset="1" stop-color="#FF3B1F" stop-opacity="0"/></radialGradient>
  <radialGradient id="coreRed"><stop offset="0" stop-color="#FFF1E0"/><stop offset=".3" stop-color="#FFC48F"/><stop offset=".72" stop-color="#FF7442"/><stop offset="1" stop-color="#E8401F"/></radialGradient>
  <radialGradient id="glowWhite"><stop offset="0" stop-color="#DCEBFF" stop-opacity=".5"/><stop offset="1" stop-color="#DCEBFF" stop-opacity="0"/></radialGradient>
  <linearGradient id="spikeH" x1="0" x2="1"><stop offset="0" stop-color="#FFD2B0" stop-opacity="0"/><stop offset=".5" stop-color="#FFF0E2"/><stop offset="1" stop-color="#FFD2B0" stop-opacity="0"/></linearGradient>
  <linearGradient id="spikeV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD2B0" stop-opacity="0"/><stop offset=".5" stop-color="#FFF0E2"/><stop offset="1" stop-color="#FFD2B0" stop-opacity="0"/></linearGradient>
  <clipPath id="disc"><circle cx="${c}" cy="${c}" r="${DISC}"/></clipPath>
  <path id="ring" d="M${c} ${c + RT}A${RT} ${RT} 0 0 1 ${c} ${c - RT}A${RT} ${RT} 0 0 1 ${c} ${c + RT}"/>
</defs>

<rect width="${S}" height="${S}" fill="#08080E"/>
<circle cx="${c}" cy="${c}" r="${c}" fill="url(#bezel)"/>

<g clip-path="url(#disc)">
  <circle cx="${c}" cy="${c}" r="${DISC}" fill="url(#sky)"/>
  <g transform="rotate(-34 430 700)">
    <ellipse cx="430" cy="700" rx="560" ry="130" fill="url(#mw)"/>
    <ellipse cx="430" cy="708" rx="420" ry="20" fill="url(#dust)"/>
  </g>
  ${stars}
  <g stroke="#C3CBF7" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round">${lines}</g>
  ${sco}
  <circle cx="${c}" cy="${c}" r="330" fill="url(#glowRed)"/>
  <circle cx="${c}" cy="${c}" r="130" fill="url(#glowRed)"/>
  <rect x="${c - 230}" y="${c - 1.5}" width="460" height="3" fill="url(#spikeH)" opacity=".85"/>
  <rect x="${c - 1.5}" y="${c - 230}" width="3" height="460" fill="url(#spikeV)" opacity=".85"/>
  <circle cx="${c}" cy="${c}" r="27" fill="url(#coreRed)"/>
  <circle cx="${c}" cy="${c}" r="96" fill="none" stroke="${gold}" stroke-opacity=".75" stroke-width="2.5" stroke-dasharray="5 11"/>
  <path d="M${c} ${c - 112}v-22M${c} ${c + 112}v22M${c - 112} ${c}h-22M${c + 112} ${c}h22" stroke="${gold}" stroke-width="3" stroke-opacity=".9"/>
  <circle cx="${c}" cy="${c}" r="${DISC}" fill="url(#vignette)"/>
</g>

<g fill="none" stroke="${gold}">
  <circle cx="${c}" cy="${c}" r="${DISC}" stroke-width="3" stroke-opacity=".85"/>
  <circle cx="${c}" cy="${c}" r="${DISC + 8}" stroke-width="1" stroke-opacity=".4"/>
  <circle cx="${c}" cy="${c}" r="464" stroke-width="1.5" stroke-opacity=".55"/>
  <circle cx="${c}" cy="${c}" r="498" stroke-width="3" stroke-opacity=".8"/>
  <path d="${ticks}" stroke-width="1.6" stroke-opacity=".7"/>
</g>
<path d="M${c - 9} ${c - 500}L${c} ${c - 484}L${c + 9} ${c - 500}Z" fill="#FF5A36"/>
<text xml:space="preserve" style="white-space:pre" font-family="'Atlas Mono',monospace" font-weight="700" font-size="23" fill="${gold}" fill-opacity=".9"><textPath href="#ring" textLength="${f1(2 * Math.PI * RT)}" lengthAdjust="spacing">${legend}</textPath></text>
</svg>
`;
mkdirSync(join(ROOT, 'avatar'), { recursive: true });
writeFileSync(join(ROOT, 'avatar/avatar.svg'), svg);
console.log(`avatar/avatar.svg ${(svg.length / 1024).toFixed(1)} KB`);
