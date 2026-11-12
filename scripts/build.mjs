#!/usr/bin/env node
// Builds the profile plates in ../assets.
//
//   node scripts/build.mjs                 # data via $GITHUB_TOKEN, or the local `gh` CLI
//   node scripts/build.mjs --data cal.json # offline, from a saved GraphQL response
//
// No dependencies: Node 20+ (global fetch). Everything is deterministic for the
// same calendar, so the daily workflow only commits when the sky actually changed.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');
const LOGIN = process.env.PROFILE_LOGIN || 'AntaresTheOne';

// ───────────────────────────── palette ─────────────────────────────
const C = {
  bg0: '#07080F', bg1: '#0E0B1B', bg2: '#170B12',
  ink: '#ECE7F2', ink2: '#B7B0C9', ink3: '#7D7794', line: '#272338',
  gold: '#D9B46C', antares: '#FF5A36', core: '#FFE3C2', blue: '#BFDFFF',
};

// ───────────────────────────── data ─────────────────────────────
const QUERY = `query($login:String!){ user(login:$login){ createdAt
  contributionsCollection { contributionCalendar { totalContributions
    weeks { contributionDays { date contributionCount weekday } } } } } }`;

async function loadCalendar() {
  const i = process.argv.indexOf('--data');
  let json;
  if (i > 0) {
    json = JSON.parse(readFileSync(process.argv[i + 1], 'utf8'));
  } else if (process.env.GITHUB_TOKEN) {
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'profile-sky-builder',
      },
      body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
    });
    if (!r.ok) throw new Error(`GitHub GraphQL: HTTP ${r.status}`);
    json = await r.json();
  } else {
    json = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${QUERY}`, '-f', `login=${LOGIN}`], { encoding: 'utf8' }));
  }
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const u = json.data.user;
  const cal = u.contributionsCollection.contributionCalendar;
  return { createdAt: u.createdAt, total: cal.totalContributions, weeks: cal.weeks.map((w) => w.contributionDays) };
}

function stats(cal) {
  const days = cal.weeks.flat();
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  const max = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);
  return { days, active: days.filter((d) => d.contributionCount > 0).length, longest, max };
}

// ───────────────────────────── helpers ─────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f1 = (n) => +n.toFixed(1);
const f2 = (n) => +n.toFixed(2);
const num = (n) => n.toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
function roman(n) {
  const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FONTS = {
  serif: ['cormorant-600', 'Atlas Serif', 'normal', 600],
  serifIt: ['cormorant-italic-500', 'Atlas Serif', 'italic', 500],
  mono: ['jetbrains-400', 'Atlas Mono', 'normal', 400],
  monoB: ['jetbrains-700', 'Atlas Mono', 'normal', 700],
};
function fontFaces(keys) {
  return keys.map((k) => {
    const [file, family, style, weight] = FONTS[k];
    const b64 = readFileSync(join(ROOT, 'scripts/fonts', `${file}.woff2`)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');
}

const BASE_CSS = `
.serif{font-family:'Atlas Serif','Cormorant Garamond',Georgia,serif;font-weight:600}
.it{font-family:'Atlas Serif','Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500}
.mono{font-family:'Atlas Mono','JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.b{font-weight:700}
.caps{letter-spacing:.16em}
@media (prefers-reduced-motion:no-preference){
  .tw{animation:tw 4s ease-in-out infinite}
  .spin{animation:spin 48s linear infinite}
  .pulse{animation:pulse 7s ease-in-out infinite alternate}
}
@keyframes tw{50%{opacity:.18}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{from{transform:scale(1)}to{transform:scale(1.09)}}
`;

function svg({ w, h, title, desc, fonts, css = '', defs = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>
${fontFaces(fonts)}
${BASE_CSS}
${css}
</style>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.bg1}"/><stop offset=".55" stop-color="${C.bg0}"/><stop offset="1" stop-color="${C.bg2}"/>
  </linearGradient>
  <radialGradient id="glowRed"><stop offset="0" stop-color="${C.antares}" stop-opacity=".55"/><stop offset=".35" stop-color="#FF3B1F" stop-opacity=".18"/><stop offset="1" stop-color="#FF3B1F" stop-opacity="0"/></radialGradient>
  <radialGradient id="coreRed"><stop offset="0" stop-color="#FFF6EA"/><stop offset=".35" stop-color="${C.core}"/><stop offset=".75" stop-color="#FF9A5C"/><stop offset="1" stop-color="${C.antares}"/></radialGradient>
  <radialGradient id="glowWhite"><stop offset="0" stop-color="#DCEBFF" stop-opacity=".55"/><stop offset="1" stop-color="#DCEBFF" stop-opacity="0"/></radialGradient>
  <linearGradient id="spikeH" x1="0" x2="1"><stop offset="0" stop-color="#FFD2B0" stop-opacity="0"/><stop offset=".5" stop-color="#FFE9D6" stop-opacity=".9"/><stop offset="1" stop-color="#FFD2B0" stop-opacity="0"/></linearGradient>
  <linearGradient id="spikeV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD2B0" stop-opacity="0"/><stop offset=".5" stop-color="#FFE9D6" stop-opacity=".9"/><stop offset="1" stop-color="#FFD2B0" stop-opacity="0"/></linearGradient>
  <clipPath id="card"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="15"/></clipPath>
  ${defs}
</defs>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="url(#bg)" stroke="${C.line}"/>
<g clip-path="url(#card)">
${body}
</g>
${frame(w, h)}
</svg>
`;
}

// Engraved inner border with a graticule ruler along the top and bottom edges.
function frame(w, h) {
  let ticks = '';
  for (let x = 40, i = 0; x <= w - 40; x += 20, i++) {
    const l = i % 5 === 0 ? 6 : 3;
    ticks += `M${x} 11v${l}M${x} ${h - 11}v-${l}`;
  }
  return `<rect x="10.5" y="10.5" width="${w - 21}" height="${h - 21}" rx="10" fill="none" stroke="${C.gold}" stroke-opacity=".24"/>
<path d="${ticks}" stroke="${C.gold}" stroke-opacity=".28" stroke-width="1"/>`;
}

function header(w, no, title, right) {
  return `<text x="40" y="54"><tspan class="it" font-size="25" fill="${C.gold}">Plate ${no}.</tspan><tspan dx="14" class="mono caps" font-size="12.5" fill="${C.ink2}">${esc(title.toUpperCase())}</tspan></text>
<text x="${w - 40}" y="54" text-anchor="end" class="mono" font-size="12" fill="${C.ink3}">${esc(right)}</text>
<path d="M40 70.5H${w - 40}" stroke="${C.gold}" stroke-opacity=".2"/>`;
}

function starfield(rng, { x0 = 0, y0 = 0, x1, y1, n, tw = 0.14, rMax = 1.25, keep = () => true }) {
  const tints = ['#FFFFFF', '#FFF1E2', '#E3ECFF', '#FFE7D6', '#F4F2FF'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0);
    const r = 0.3 + Math.pow(rng(), 3) * rMax, o = 0.25 + rng() * 0.6;
    const fill = tints[Math.floor(rng() * tints.length)];
    if (!keep(x, y)) continue;
    const twinkle = rng() < tw ? ` class="tw" style="animation-delay:-${f1(rng() * 6)}s;animation-duration:${f1(3 + rng() * 5)}s"` : '';
    out += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r)}" fill="${fill}" opacity="${f2(o)}"${twinkle}/>`;
  }
  return out;
}

// A red supergiant: soft glow, diffraction spikes, hot core, pulsing like the real semi-regular variable.
function redGiant(x, y, s = 1) {
  return `<g class="pulse" style="transform-origin:${x}px ${y}px">
  <circle cx="${x}" cy="${y}" r="${66 * s}" fill="url(#glowRed)"/>
  <circle cx="${x}" cy="${y}" r="${26 * s}" fill="url(#glowRed)"/>
</g>
<rect x="${x - 78 * s}" y="${y - 0.6}" width="${156 * s}" height="1.2" fill="url(#spikeH)"/>
<rect x="${x - 0.6}" y="${y - 78 * s}" width="1.2" height="${156 * s}" fill="url(#spikeV)"/>
<circle cx="${x}" cy="${y}" r="${7.5 * s}" fill="url(#coreRed)"/>`;
}

// ───────────────────────────── hero ─────────────────────────────
// Scorpius — Bayer letter: [RA hours, Dec degrees, visual magnitude]
const SCO = {
  nu: [16.200, -19.46, 4.0], beta: [16.091, -19.81, 2.6], delta: [16.006, -22.62, 2.3],
  pi: [15.981, -26.11, 2.9], rho: [15.948, -29.21, 3.9], sigma: [16.353, -25.59, 2.9],
  alpha: [16.490, -26.43, 1.06], tau: [16.598, -28.22, 2.8], epsilon: [16.836, -34.29, 2.3],
  mu: [16.865, -38.05, 3.0], zeta: [16.910, -42.36, 3.6], eta: [17.203, -43.24, 3.3],
  theta: [17.622, -43.00, 1.9], iota: [17.793, -40.13, 3.0], kappa: [17.708, -39.03, 2.4],
  lambda: [17.560, -37.10, 1.6], upsilon: [17.513, -37.30, 2.7],
};
const SCO_LINES = [['nu', 'beta'], ['beta', 'delta'], ['delta', 'pi'], ['pi', 'rho'], ['delta', 'sigma'], ['sigma', 'alpha'],
  ['alpha', 'tau'], ['tau', 'epsilon'], ['epsilon', 'mu'], ['mu', 'zeta'], ['zeta', 'eta'], ['eta', 'theta'],
  ['theta', 'iota'], ['iota', 'kappa'], ['kappa', 'lambda'], ['lambda', 'upsilon']];

function projectScorpius(cx, cy, scale) {
  const ras = Object.values(SCO).map((s) => s[0]), decs = Object.values(SCO).map((s) => s[1]);
  const ra0 = (Math.min(...ras) + Math.max(...ras)) / 2, dec0 = (Math.min(...decs) + Math.max(...decs)) / 2;
  const k = Math.cos((dec0 * Math.PI) / 180);
  const p = {};
  // East is to the left on a sky chart, so x falls as RA grows.
  for (const [n, [ra, dec, mag]] of Object.entries(SCO)) p[n] = { x: cx - (ra - ra0) * 15 * k * scale, y: cy - (dec - dec0) * scale, mag };
  return p;
}

function hero(now) {
  const W = 1000, H = 400, rng = mulberry32(1603); // 1603 — Bayer's Uranometria
  const P = projectScorpius(790, 205, 12.6);
  const A = P.alpha;

  // The Milky Way runs right through the scorpion's tail, towards the galactic centre.
  const milkyWay = `<g transform="rotate(-30 700 330)">
  <ellipse cx="700" cy="330" rx="560" ry="120" fill="url(#mw1)"/>
  <ellipse cx="680" cy="330" rx="360" ry="58" fill="url(#mw2)"/>
  <ellipse cx="700" cy="338" rx="400" ry="18" fill="url(#dust)" opacity=".55"/>
</g>`;
  const inBand = (x, y) => { const a = (-30 * Math.PI) / 180, dx = x - 700, dy = y - 330; const v = -dx * Math.sin(a) + dy * Math.cos(a); return Math.abs(v) < 80; };
  const field = starfield(rng, { x1: W, y1: H, n: 190 })
    + starfield(rng, { x1: W, y1: H, n: 900, tw: 0, rMax: 0.5, keep: (x, y) => inBand(x, y) && rng() < 0.45 });

  let lines = '';
  SCO_LINES.forEach(([a, b], i) => {
    const s = P[a], e = P[b];
    lines += `<line x1="${f1(s.x)}" y1="${f1(s.y)}" x2="${f1(e.x)}" y2="${f1(e.y)}" pathLength="1" class="draw" style="animation-delay:${f2(0.3 + i * 0.11)}s"/>`;
  });
  let stars = '';
  for (const [n, s] of Object.entries(P)) {
    if (n === 'alpha') continue;
    const r = Math.max(1.1, 3.4 - 0.75 * (s.mag - 1.5));
    stars += `<circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(r * 3.2)}" fill="url(#glowWhite)" opacity=".7"/><circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f2(r)}" fill="#E6EEFF"/>`;
  }

  // Reticle + label on Antares
  const rx = f1(A.x), ry = f1(A.y);
  const reticle = `<g class="spin" style="transform-origin:${rx}px ${ry}px">
  <circle cx="${rx}" cy="${ry}" r="30" fill="none" stroke="${C.gold}" stroke-opacity=".55" stroke-dasharray="2 5"/>
</g>
<path d="M${rx} ${ry - 38}v-7M${rx} ${f1(A.y + 38)}v7M${f1(A.x - 38)} ${ry}h-7M${f1(A.x + 38)} ${ry}h7" stroke="${C.gold}" stroke-opacity=".7"/>
<circle cx="${f1(A.x + 9)}" cy="${f1(A.y - 6)}" r="1.6" fill="${C.blue}"/>
<path d="M${f1(A.x - 25)} ${f1(A.y - 25)}L${f1(A.x - 50)} ${f1(A.y - 50)}H${f1(A.x - 160)}" fill="none" stroke="${C.gold}" stroke-opacity=".55"/>
<text x="${f1(A.x - 160)}" y="${f1(A.y - 57)}" class="mono b caps" font-size="12" fill="${C.gold}">α SCO · ANTARES</text>
<text x="${f1(A.x - 160)}" y="${f1(A.y - 35)}" class="mono" font-size="12" fill="${C.ink3}">M1.5 Iab · variable</text>`;

  const body = `${milkyWay}
${field}
<g stroke="#B9C2F5" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round">${lines}</g>
${stars}
${redGiant(rx, ry, 1)}
${reticle}
<text x="56" y="100" class="mono caps" font-size="12.5" fill="${C.gold}">α SCO · HD 148478 · HEART OF THE SCORPION</text>
<text x="52" y="180" class="serif" font-size="80" fill="${C.ink}">Mirzo Isaev</text>
<text x="56" y="223" class="it" font-size="27" fill="${C.ink2}">full-stack engineer — from Oracle cores to AI agents</text>
<text x="56" y="274" class="mono" font-size="14.5" fill="${C.ink}"><tspan fill="${C.antares}">▸</tspan> PL/SQL · Java · Spring Boot · AngularJS · Flutter</text>
<text x="56" y="300" class="mono" font-size="14.5" fill="${C.ink}"><tspan fill="${C.antares}">▸</tspan> agents, MCP servers &amp; developer tooling<tspan class="cursor" fill="${C.antares}"> █</tspan></text>
<text x="56" y="362" class="mono" font-size="12" fill="${C.ink3}">RA 16h 29m 24s · DEC −26° 25′ 55″ · m +1.06 · d ≈ 550 ly</text>
<text x="${W - 40}" y="362" text-anchor="end" class="mono caps" font-size="11.5" fill="${C.ink3}">URANOMETRIA · ${roman(now.getUTCFullYear())}</text>`;

  return svg({
    w: W, h: H, fonts: ['serif', 'serifIt', 'mono', 'monoB'],
    title: 'Mirzo Isaev — α Scorpii',
    desc: 'A star chart of Scorpius with Antares glowing red. Mirzo Isaev, full-stack engineer — from Oracle cores to AI agents.',
    defs: `<radialGradient id="mw1"><stop offset="0" stop-color="#5B3A63" stop-opacity=".55"/><stop offset=".6" stop-color="#2C2147" stop-opacity=".25"/><stop offset="1" stop-color="#1A1530" stop-opacity="0"/></radialGradient>
  <radialGradient id="mw2"><stop offset="0" stop-color="#C08A7A" stop-opacity=".28"/><stop offset="1" stop-color="#C08A7A" stop-opacity="0"/></radialGradient>
  <radialGradient id="dust"><stop offset="0" stop-color="#05040A" stop-opacity=".75"/><stop offset="1" stop-color="#05040A" stop-opacity="0"/></radialGradient>`,
    css: `@media (prefers-reduced-motion:no-preference){
  .draw{stroke-dasharray:1;animation:draw 1.4s cubic-bezier(.3,.6,.2,1) both}
  .cursor{animation:blink 1.1s steps(1) infinite}
}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes blink{50%{opacity:0}}`,
    body,
  });
}

// ───────────────────────────── plate I: catalogue ─────────────────────────────
function catalogue(cal, st, now) {
  const W = 1000, H = 340, rng = mulberry32(6134); // HR 6134
  const years = Math.floor((now - new Date(cal.createdAt)) / (365.25 * 864e5));
  const rows = [
    ['designation', 'Mirzo Isaev  (α Sco)'],
    ['class', 'Full-stack engineer · HR-tech'],
    ['core', 'Oracle PL/SQL · Java 21 · Spring Boot'],
    ['photosphere', 'AngularJS · TypeScript · Flutter'],
    ['companion', 'AI agents · Claude Code · MCP · LLMs'],
    ['first light', `${fmtDate(cal.createdAt)} · ${years} years observed`],
    ['luminosity', null, `${num(cal.total)}`, ' contributions, last 12 months'],
    ['variability', `${st.active} active nights · ${st.longest}-night streak`],
  ];
  let table = '';
  rows.forEach(([k, v, hi, rest], i) => {
    const y = 106 + i * 28;
    table += `<text x="48" y="${y}" class="mono caps" font-size="11.5" fill="${C.ink3}">${esc(k.toUpperCase())}</text>`;
    table += v
      ? `<text x="196" y="${y}" class="mono" font-size="14.5" fill="${C.ink}">${esc(v)}</text>`
      : `<text x="196" y="${y}" class="mono" font-size="14.5" fill="${C.ink}"><tspan class="b" fill="${C.antares}">${esc(hi)}</tspan>${esc(rest)}</text>`;
  });

  // Spectrum: visible band, a 3600 K Planck curve, and absorption lines named after what the star is made of.
  const sx = 624, sw = 330, l0 = 380, l1 = 750;
  const X = (l) => sx + ((l - l0) / (l1 - l0)) * sw;
  const planck = (l) => { const m = l * 1e-9; return 1 / (m ** 5 * (Math.exp(1.4388e-2 / (m * 3600)) - 1)); };
  const pMax = planck(l1);
  let curve = '', area = `M${X(l0)} 180`;
  for (let l = l0; l <= l1; l += 5) {
    const y = f1(180 - (planck(l) / pMax) * 62);
    curve += `${l === l0 ? 'M' : 'L'}${f1(X(l))} ${y}`;
    area += `L${f1(X(l))} ${y}`;
  }
  area += `L${X(l1)} 180Z`;
  const LINES = [[393, 5, 'PL/SQL'], [434, 4, 'Java'], [476, 3, 'Spring'], [517, 2.2, 'Scala'], [545, 3, 'TS'],
    [589, 3.6, 'Angular'], [616, 2.4, 'Dart'], [656, 2.2, 'Python'], [705, 3.2, 'Claude']];
  let absorption = '', labels = '';
  LINES.forEach(([l, wdt, name], i) => {
    const x = f1(X(l)), low = i % 2 === 1, ly = low ? 268 : 250;
    absorption += `<rect x="${f1(x - wdt / 2)}" y="204" width="${wdt}" height="32" fill="#05040A" opacity=".82"/>`;
    labels += `<path d="M${x} 238V${ly - 11}" stroke="${C.ink3}" stroke-opacity=".7"/><text x="${x}" y="${ly}" text-anchor="middle" class="mono" font-size="12" fill="${C.ink2}">${esc(name)}</text>`;
  });
  let axis = '';
  for (const l of [400, 500, 600, 700]) axis += `<path d="M${f1(X(l))} 204v-4" stroke="${C.ink3}"/><text x="${f1(X(l))}" y="196" text-anchor="middle" class="mono" font-size="10.5" fill="${C.ink3}" opacity=".9">${l}</text>`;

  const body = `${starfield(rng, { x1: W, y1: H, n: 70, tw: 0.1, rMax: 0.8 })}
${header(W, 'I', 'catalogue entry', `${LOGIN} · HR 6134`)}
${table}
<path d="M600.5 88V312" stroke="${C.gold}" stroke-opacity=".16"/>
<text x="${sx}" y="106" class="mono caps" font-size="11.5" fill="${C.ink3}">SPECTRUM</text>
<text x="${sx + 2}" y="146" class="it" font-size="17" fill="${C.ink2}">B(λ, 3600 K)</text>
<path d="${area}" fill="url(#planckFill)"/>
<path d="${curve}" fill="none" stroke="${C.antares}" stroke-width="1.6" class="draw" pathLength="1"/>
${axis}
<rect x="${sx}" y="204" width="${sw}" height="32" fill="url(#visible)" rx="2"/>
${absorption}
<rect x="${sx}" y="204" width="${sw}" height="32" fill="none" stroke="${C.ink}" stroke-opacity=".15" rx="2"/>
${labels}
<text x="${sx}" y="304" class="it" font-size="16" fill="${C.ink3}">dark lines — what this star is made of</text>`;

  return svg({
    w: W, h: H, fonts: ['serifIt', 'mono', 'monoB'],
    title: 'Plate I — catalogue entry',
    desc: `Mirzo Isaev: full-stack engineer. Core: Oracle PL/SQL, Java 21, Spring Boot. Also AngularJS, TypeScript, Flutter, AI agents. ${num(cal.total)} contributions in the last 12 months, ${st.active} active days, longest streak ${st.longest} days.`,
    defs: `<linearGradient id="visible" x1="0" x2="1">
    <stop offset="0" stop-color="#5B2BC9"/><stop offset=".14" stop-color="#3A4BFF"/><stop offset=".28" stop-color="#1FB5E8"/>
    <stop offset=".42" stop-color="#2FD16A"/><stop offset=".55" stop-color="#D9E23B"/><stop offset=".66" stop-color="#FFB13B"/>
    <stop offset=".8" stop-color="#FF4A2A"/><stop offset="1" stop-color="#7A0E0E"/>
  </linearGradient>
  <linearGradient id="planckFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.antares}" stop-opacity=".22"/><stop offset="1" stop-color="${C.antares}" stop-opacity="0"/></linearGradient>`,
    css: `@media (prefers-reduced-motion:no-preference){.draw{stroke-dasharray:1;animation:draw 2.2s ease-out .2s both}}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}`,
    body,
  });
}

// ───────────────────────────── plate II: sky of commits ─────────────────────────────
// Each day of the contribution calendar is a star; busier days burn hotter (M → K → G → F → A).
const CLASSES = [
  { k: 'M', fill: '#F0603E', r: 1.55 },
  { k: 'K', fill: '#FFA266', r: 2.0 },
  { k: 'G', fill: '#FFE6B3', r: 2.45 },
  { k: 'F', fill: '#F7F6FF', r: 2.85, glow: 0.45 },
  { k: 'A', fill: '#C4DCFF', r: 3.1, glow: 0.8, spike: true },
];
const sparkle = (x, y, s) => `M${x} ${f1(y - s)}Q${x} ${y} ${f1(x + s)} ${y}Q${x} ${y} ${x} ${f1(y + s)}Q${x} ${y} ${f1(x - s)} ${y}Q${x} ${y} ${x} ${f1(y - s)}Z`;

function sky(cal, st) {
  const W = 1000, H = 300, cell = 16.6, gx = 76, gy = 102, rng = mulberry32(53);
  const nz = st.days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => (nz.length ? nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] : 0);
  const t = [q(0.25), q(0.5), q(0.75), q(0.9)];
  const cls = (c) => (c <= t[0] ? 0 : c <= t[1] ? 1 : c <= t[2] ? 2 : c <= t[3] ? 3 : 4);

  let dust = '', glows = '', stars = '', months = '', lastMonth = -1, lastLabelWeek = -9, maxPos;
  cal.weeks.forEach((week, wi) => {
    const m = Number(week[0].date.slice(5, 7)) - 1;
    if (m !== lastMonth) {
      if (wi - lastLabelWeek >= 3 && wi < cal.weeks.length - 1) {
        months += `<text x="${f1(gx + wi * cell)}" y="${gy - 12}" class="mono" font-size="11.5" fill="${C.ink3}">${MONTHS[m]}</text>`;
        lastLabelWeek = wi;
      }
      lastMonth = m;
    }
    for (const d of week) {
      const x = f1(gx + wi * cell + cell / 2), y = f1(gy + d.weekday * cell + cell / 2), c = d.contributionCount;
      if (d.date === st.max.date) maxPos = { x, y };
      if (!c) { dust += `<circle cx="${x}" cy="${y}" r=".8" fill="${C.ink3}" opacity=".32"/>`; continue; }
      const s = CLASSES[cls(c)];
      const tw = s.glow && rng() < 0.7 ? ` class="tw" style="animation-delay:-${f1(rng() * 6)}s;animation-duration:${f1(3 + rng() * 4)}s"` : '';
      if (s.glow) glows += `<circle cx="${x}" cy="${y}" r="${f1(s.r * 3.4)}" fill="url(#glowWhite)" opacity="${s.glow}"/>`;
      stars += s.spike
        ? `<g${tw}><path d="${sparkle(x, y, 7)}" fill="${s.fill}"/><circle cx="${x}" cy="${y}" r="${s.r - 1}" fill="#fff"/></g>`
        : `<circle cx="${x}" cy="${y}" r="${s.r}" fill="${s.fill}"${tw}/>`;
    }
  });
  const weekdays = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].map(([i, n]) => `<text x="${gx - 10}" y="${f1(gy + i * cell + cell / 2 + 4)}" text-anchor="end" class="mono" font-size="11" fill="${C.ink3}">${n}</text>`).join('');
  const reticle = maxPos ? `<g class="spin" style="transform-origin:${maxPos.x}px ${maxPos.y}px"><circle cx="${maxPos.x}" cy="${maxPos.y}" r="11" fill="none" stroke="${C.gold}" stroke-opacity=".8" stroke-dasharray="2 4"/></g>` : '';

  const ly = 262;
  let legend = `<text x="${gx}" y="${ly}" class="mono caps" font-size="11" fill="${C.ink3}">COOLER</text>`;
  CLASSES.forEach((s, i) => {
    const x = gx + 84 + i * 40;
    legend += s.spike ? `<path d="${sparkle(x, ly - 4, 6)}" fill="${s.fill}"/>` : `<circle cx="${x}" cy="${ly - 4}" r="${s.r}" fill="${s.fill}"/>`;
    legend += `<text x="${x + 9}" y="${ly}" class="mono" font-size="11.5" fill="${C.ink2}">${s.k}</text>`;
  });
  legend += `<text x="${gx + 84 + 5 * 40}" y="${ly}" class="mono caps" font-size="11" fill="${C.ink3}">HOTTER</text>`;
  legend += `<text x="${W - 46}" y="${ly}" text-anchor="end" class="mono" font-size="12" fill="${C.ink2}"><tspan fill="${C.gold}">◎</tspan> brightest night: <tspan class="b" fill="${C.ink}">${num(st.max.contributionCount)}</tspan> · ${fmtDate(st.max.date)}</text>`;

  const first = st.days[0].date, last = st.days[st.days.length - 1].date;
  const body = `${starfield(rng, { x1: W, y1: H, n: 60, tw: 0.08, rMax: 0.7 })}
${header(W, 'II', 'sky of commits', `${num(cal.total)} observations · ${fmtDate(first)} – ${fmtDate(last)}`)}
${months}${weekdays}
${dust}
${glows}
${stars}
${reticle}
${legend}`;

  return svg({
    w: W, h: H, fonts: ['serifIt', 'mono', 'monoB'],
    title: 'Plate II — sky of commits',
    desc: `The last year of GitHub contributions drawn as a star field: ${num(cal.total)} contributions, brightest day ${fmtDate(st.max.date)} with ${st.max.contributionCount}.`,
    body,
  });
}

// ───────────────────────────── plate III: orbits ─────────────────────────────
function orbits() {
  const W = 1000, H = 400, cx = 500, cy = 232, rng = mulberry32(1543); // De revolutionibus
  const ORBITS = [
    { rx: 118, T: 20, planets: [['Oracle', '#F06A55', 6], ['PL/SQL', '#FFA77A', 5]] },
    { rx: 200, T: 43, planets: [['Java', '#F2A65A', 6], ['Spring Boot', '#86C96F', 5], ['Scala', '#E0605A', 4]] },
    { rx: 282, T: 72, planets: [['AngularJS', '#E8556E', 5], ['TypeScript', '#5B9BE6', 5.5], ['JavaScript', '#EBCF5B', 4]] },
    { rx: 366, T: 107, planets: [['Flutter', '#63C9F5', 5], ['Python', '#F3D45E', 5], ['Claude Code', '#E08A68', 6], ['Git', '#F07A5A', 4]] },
  ];
  let back = '', front = '', planets = '', numerals = '';
  ORBITS.forEach((o, oi) => {
    const ry = f1(o.rx * 0.3);
    back += `<path d="M${cx - o.rx} ${cy}A${o.rx} ${ry} 0 0 1 ${cx + o.rx} ${cy}" fill="none" stroke="#AEB8F0" stroke-opacity=".16" stroke-dasharray="2 5"/>`;
    front += `<path d="M${cx - o.rx} ${cy}A${o.rx} ${ry} 0 0 0 ${cx + o.rx} ${cy}" fill="none" stroke="#AEB8F0" stroke-opacity=".34"/>`;
    numerals += `<text x="${cx + o.rx + 8}" y="${cy + 5}" class="it" font-size="15" fill="${C.gold}" opacity=".75">${roman(oi + 1)}</text>`;
    // Start at the front (6 o'clock): planets fade and shrink as they pass behind the star.
    const path = `M${cx} ${cy + ry}A${o.rx} ${ry} 0 1 1 ${cx} ${cy - ry}A${o.rx} ${ry} 0 1 1 ${cx} ${cy + ry}`;
    o.planets.forEach(([name, color, r], pi) => {
      const begin = `-${f1(o.T * (pi / o.planets.length + oi * 0.13))}s`;
      const anim = `dur="${o.T}s" begin="${begin}" repeatCount="indefinite"`;
      planets += `<g><animateMotion path="${path}" ${anim}/>
  <g><animateTransform attributeName="transform" type="scale" values="1;.72;1" ${anim}/><animate attributeName="opacity" values="1;.4;1" ${anim}/>
    <circle r="${r * 2.6}" fill="${color}" opacity=".16"/><circle r="${r}" fill="${color}"/><circle r="${f1(r * 0.45)}" cx="${f1(-r * 0.3)}" cy="${f1(-r * 0.3)}" fill="#fff" opacity=".35"/>
    <text x="${r + 7}" y="4.5" class="mono" font-size="13" fill="${C.ink}">${esc(name)}</text>
  </g>
</g>`;
    });
  });

  const body = `${starfield(rng, { x1: W, y1: H, n: 150, tw: 0.12, rMax: 0.9 })}
${header(W, 'III', 'orbital mechanics', 'planets = tools · T² ∝ a³')}
${back}
${redGiant(cx, cy, 0.62)}
${front}
${numerals}
${planets}
<text x="40" y="${H - 34}" class="it" font-size="16" fill="${C.ink3}">inner orbits: what I ship every day · outer: what I build with</text>`;

  return svg({
    w: W, h: H, fonts: ['serifIt', 'mono'],
    title: 'Plate III — orbital mechanics',
    desc: 'Tech stack as planets orbiting a red star: Oracle and PL/SQL; Java, Spring Boot, Scala; AngularJS, TypeScript, JavaScript; Flutter, Python, Claude Code, Git.',
    body,
  });
}

// ───────────────────────────── colophon ─────────────────────────────
function colophon(now) {
  const W = 1000, H = 120, rng = mulberry32(550);
  const body = `${starfield(rng, { x1: W, y1: H, n: 70, tw: 0.15, rMax: 0.8 })}
<g class="meteor"><path d="M0 0L-150 -48" stroke="url(#meteor)" stroke-width="1.6" stroke-linecap="round"/><circle r="1.6" fill="#fff"/></g>
<path d="M150 58.5H395M605 58.5H850" stroke="${C.gold}" stroke-opacity=".35"/>
<text x="500" y="66" text-anchor="middle" class="it" font-size="32" fill="${C.ink}">clear skies</text>
<text x="500" y="96" text-anchor="middle" class="mono" font-size="11.5" fill="${C.ink3}">sky last observed ${fmtDate(now.toISOString())} · redrawn daily by GitHub Actions</text>`;
  return svg({
    w: W, h: H, fonts: ['serifIt', 'mono'],
    title: 'Clear skies',
    desc: 'Sign-off.',
    defs: `<linearGradient id="meteor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    css: `.meteor{opacity:0}
@media (prefers-reduced-motion:no-preference){.meteor{animation:meteor 11s ease-in 2s infinite}}
@keyframes meteor{0%{opacity:0;transform:translate(820px,10px)}3%{opacity:1}9%{opacity:0;transform:translate(620px,74px)}100%{opacity:0;transform:translate(620px,74px)}}`,
    body,
  });
}

// ───────────────────────────── main ─────────────────────────────
const cal = await loadCalendar();
const st = stats(cal);
const now = new Date();
mkdirSync(OUT, { recursive: true });
const files = {
  'hero.svg': hero(now),
  'catalogue.svg': catalogue(cal, st, now),
  'sky.svg': sky(cal, st),
  'orbits.svg': orbits(),
  'colophon.svg': colophon(now),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT, name), content);
  console.log(`${name.padEnd(14)} ${(content.length / 1024).toFixed(1)} KB`);
}
console.log(`total ${cal.total} · active ${st.active} · longest ${st.longest} · max ${st.max.contributionCount} on ${st.max.date}`);
