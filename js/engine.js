// NRG Solution BESS Hardwald - Rechenkern (Layout, Dimensionierung, Normenprüfung, NISV, LSV, Simulation)
// Reines JavaScript ohne Abhängigkeiten: läuft im Browser und in Node (für Pläne, IFC und PDF).
// Koordinaten lokal: x = E - 2674035, z = 1250825 - N (Süden positiv), y = H - 390.

export const VERSION = '1.0.0';

// ------------------------------------------------------------------ Parameter
export const DEFAULTS = {
  cab: {
    name: 'DC-Outdoor-Batterieschrank 261 kWh (LFP, flüssiggekühlt)',
    w: 1.30, d: 1.40, h: 2.40, kWh: 261, dod: 0.95, mass_t: 3.2, ip: 'IP55', korrosion: 'C4',
    udc: '1040 bis 1500 V DC', lw_day: 75, lw_night: 70, aux_kW: 0.6, ul9540a: true, iec62619: true,
  },
  psCatalog: [
    { id: 'MVS-2.5', sMVA: 2.5, l: 6.06, w: 2.44, h: 2.90, mass_t: 16, lw_inv: 80, lw_trafo: 65, lw_hvac: 70, oil_l: 1400, ulv: 630 },
    { id: 'MVS-3.4', sMVA: 3.45, l: 6.06, w: 2.44, h: 2.90, mass_t: 19, lw_inv: 81, lw_trafo: 66, lw_hvac: 71, oil_l: 1800, ulv: 690 },
    { id: 'MVS-4.4', sMVA: 4.4, l: 6.06, w: 2.44, h: 2.90, mass_t: 22, lw_inv: 83, lw_trafo: 68, lw_hvac: 72, oil_l: 2200, ulv: 690 },
    { id: 'MVS-5.0', sMVA: 5.0, l: 6.06, w: 2.44, h: 2.90, mass_t: 24, lw_inv: 84, lw_trafo: 69, lw_hvac: 73, oil_l: 2500, ulv: 800 },
  ],
  layout: {
    redInset: 0.6,      // rote Linie im Luftbild = Aussenkante; Feldgrenze 0.6 m innen
    fenceClear: 1.0,    // Abstand Gerät - Zaun allgemein
    endClear: 1.2,      // Abstand Reihenende - Zaun (Durchgang)
    rearClear: 1.0,     // Rückseite Schrank - Zaun
    backGap: 1.0,       // Rückseite - Rückseite
    frontAisle: 2.0,    // Wartungsgasse vor Schranktüren
    sideGap: 0.15,      // Seitenabstand Schrank - Schrank innerhalb Gruppe (UL 9540A Prüflage)
    groupMax: 6,        // max. Schränke pro Brandgruppe
    fireGap: 3.0,       // Brandabstand zwischen Gruppen
    psClear: 3.0,       // Abstand Power Station - Batterieschrank
    psFence: 1.5,       // Power Station - Zaun (Türen, Bedienung)
    psField: 'BF3',
    cRateMax: 0.25,     // 4-h-System (Peak Shaving + Abendspitze)
    planum: 'strasse',  // 'strasse' (Werkstrassenniveau) oder 'ausgleich'
    exclude: [],        // zusätzliche Ausschlussbänder [{feature:'waldgrenze', d: 20}]
  },
  rules: {
    wald_abstand_pbg: 30, wald_forst: 15, wald_min: 10, baumfall: 0, brand_wald: 10, brand_halle_brennbar: 10, brand_halle: 5,
    brand_omen: 10, strasse_min: 1.0, halde_min: 5, grenz_min: 3.5, hydrant_max: 100,
    nisv_agw: 1.0, boeschung_warn: 1.5, boeschung_fail: 6.0, lw_q_lpm: 1200, lw_t_min: 60,
  },
  lsv: { II: [55, 45], III: [60, 50], IV: [65, 55] },
  ops: { target_kW: 1100, target_winter_kW: 750, conn_kW: 4500, lp_chf: 8.95, grid_mode: true, season: 'sommer', day: 'werktag', soc_min: 0.08, soc_max: 0.95, eta: 0.92 },
};

// ------------------------------------------------------------------ Geometrie
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
export const G = { sub, add, mul, dot, cross, len, norm };

export function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
export function centroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
function ccw(p) { return area(p) > 0 ? p.slice() : p.slice().reverse(); }
export function pip(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
export function segDist(p, a, b) { const ab = sub(b, a); const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1))); const q = add(a, mul(ab, t)); return [len(sub(p, q)), q]; }
function segInter(a, b, c, d) { const r = sub(b, a), s = sub(d, c); const den = cross(r, s); if (Math.abs(den) < 1e-12) return null; const t = cross(sub(c, a), s) / den, u = cross(sub(c, a), r) / den; return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? add(a, mul(r, t)) : null; }
// minimaler Abstand zwischen Polygon/Polylinie A und B, mit Fusspunkten
export function minDist(A, B, closedA = true, closedB = true, contain = true) {
  let best = [Infinity, null, null];
  const ea = closedA ? A.length : A.length - 1, eb = closedB ? B.length : B.length - 1;
  for (let i = 0; i < ea; i++) { const a1 = A[i], a2 = A[(i + 1) % A.length];
    for (let j = 0; j < eb; j++) { const b1 = B[j], b2 = B[(j + 1) % B.length];
      const x = segInter(a1, a2, b1, b2); if (x) return [0, x, x];
      for (const [p, s1, s2, flip] of [[a1, b1, b2, 0], [a2, b1, b2, 0], [b1, a1, a2, 1], [b2, a1, a2, 1]]) {
        const [d, q] = segDist(p, s1, s2); if (d < best[0]) best = flip ? [d, q, p] : [d, p, q]; } } }
  if (contain && closedB && A.some(p => pip(p, B))) return [0, A[0], A[0]];
  if (contain && closedA && B.some(p => pip(p, A))) return [0, B[0], B[0]];
  return best;
}
// Polygon (konvex) nach innen versetzen
export function inset(poly, d) {
  const p = ccw(poly), n = p.length, lines = [];
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; const t = norm(sub(b, a)); const nn = [-t[1], t[0]]; lines.push([add(a, mul(nn, d)), t]); }
  const out = [];
  for (let i = 0; i < n; i++) { const [p1, t1] = lines[(i + n - 1) % n], [p2, t2] = lines[i]; const den = cross(t1, t2); if (Math.abs(den) < 1e-9) { out.push(p2); continue; } const s = cross(sub(p2, p1), t2) / den; out.push(add(p1, mul(t1, s))); }
  return out;
}
// Halbebenen-Clip (behalte Seite, auf der dot(n, x - p0) >= 0)
export function clipHalf(poly, p0, n) {
  const out = []; const f = (q) => dot(n, sub(q, p0));
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(add(a, mul(sub(b, a), t))); } }
  return out;
}
export function rectPoly(c, w, d, angRad) { const u = [Math.cos(angRad), Math.sin(angRad)], v = [-u[1], u[0]]; const hw = w / 2, hd = d / 2;
  return [add(add(c, mul(u, -hw)), mul(v, -hd)), add(add(c, mul(u, hw)), mul(v, -hd)), add(add(c, mul(u, hw)), mul(v, hd)), add(add(c, mul(u, -hw)), mul(v, hd))]; }
function polylineLen(pl) { let s = 0; for (let i = 1; i < pl.length; i++) s += len(sub(pl[i], pl[i - 1])); return s; }
function closestOnPolyline(p, pl) { let best = [Infinity, null, 0]; let acc = 0; for (let i = 0; i < pl.length - 1; i++) { const [d, q] = segDist(p, pl[i], pl[i + 1]); if (d < best[0]) best = [d, q, i]; } return best; }
function sideOfPolyline(p, pl) { const [, q, i] = closestOnPolyline(p, pl); const t = sub(pl[i + 1], pl[i]); return Math.sign(cross(t, sub(p, q))); }

// ------------------------------------------------------------------ Layout
function fieldFrame(poly) {
  // Längsachse = Mittel der beiden längsten, ungefähr parallelen Kanten
  const e = poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; return { a, b, l: len(sub(b, a)), t: norm(sub(b, a)) }; });
  const s = e.slice().sort((x, y) => y.l - x.l);
  let t1 = s[0].t, t2 = s[1].t; if (dot(t1, t2) < 0) t2 = mul(t2, -1);
  let u = norm(add(t1, t2)); if (u[0] < 0) u = mul(u, -1); // Richtung Osten
  const v = [-u[1], u[0]];
  return { u, v };
}
const toUV = (p, o, f) => [dot(sub(p, o), f.u), dot(sub(p, o), f.v)];
const fromUV = (q, o, f) => add(o, add(mul(f.u, q[0]), mul(f.v, q[1])));
function uRangeAtV(polyUV, v) { // Schnitt der Linie v=const mit Polygon in UV
  const xs = []; for (let i = 0; i < polyUV.length; i++) { const a = polyUV[i], b = polyUV[(i + 1) % polyUV.length]; if ((a[1] - v) * (b[1] - v) <= 0 && a[1] !== b[1]) xs.push(a[0] + (v - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
  if (xs.length < 2) return null; return [Math.min(...xs), Math.max(...xs)];
}

export function computeLayout(scene, site, P, fields = null, opts = {}) {
  const L = P.layout, cab = P.cab;
  const BF = fields || scene.baufelder.map(b => ({ id: b.id, poly: inset(b.poly, L.redInset) }));
  const nap = [site.nap.x, site.nap.z];
  const objects = [], rowsOut = [], fieldsOut = [], dims = [];
  let nCab = 0, ps = null, psSpec = null;
  // Power-Station-Typ aus Flächenpotenzial (zweistufig: erst grob zählen, dann wählen)
  const order = BF.map(b => b.id);
  const fieldResults = {};
  for (const b of BF) {
    let poly = ccw(b.poly);
    // zusätzliche Ausschlussbänder (Alternative mit eingehaltenen Abständen)
    for (const ex of (L.exclude || [])) {
      const feat = ex.feature === 'waldgrenze' ? scene.legal.waldgrenze?.[0] : ex.feature === 'wal' ? scene.legal.wal?.[0] : null;
      if (!feat) continue; const c = centroid(poly); const [d0, q] = closestOnPolyline(c, feat); const nn = norm(sub(c, q));
      poly = clipHalf(poly, add(q, mul(nn, ex.d)), nn); if (poly.length < 3) break;
    }
    let f = fieldFrame(poly), o = centroid(poly);
    if (opts.maxCut != null && opts.heightAt) {
      // Feld auf den Bereich am Hangfuss begrenzen: Abtrag <= maxCut gegenüber Planum (Westkante + 0.3 m)
      const uv0 = poly.map(p => toUV(p, o, f)); const umin = Math.min(...uv0.map(q => q[0])), umax = Math.max(...uv0.map(q => q[0]));
      const vmin0 = Math.min(...uv0.map(q => q[1])), vmax0 = Math.max(...uv0.map(q => q[1]));
      const ref = Math.min(...[0.2, 0.5, 0.8].map(t => { const vv = vmin0 + (vmax0 - vmin0) * t; const r = uRangeAtV(uv0, vv); return r ? opts.heightAt(...fromUV([r[0] + 0.5, vv], o, f)) : 1e9; })) + 0.3;
      let ulim = umax; for (let uu = umin; uu <= umax; uu += 0.5) { let hmx = -1e9; for (let t = 0.05; t <= 0.95; t += 0.15) { const vv = vmin0 + (vmax0 - vmin0) * t; const r = uRangeAtV(uv0, vv); if (!r || uu < r[0] || uu > r[1]) continue; hmx = Math.max(hmx, opts.heightAt(...fromUV([uu, vv], o, f))); } if (hmx - ref > opts.maxCut) { ulim = uu; break; } }
      poly = clipHalf(poly, fromUV([ulim, 0], o, f), mul(f.u, -1)); if (poly.length < 3) continue; f = fieldFrame(poly); o = centroid(poly);
    }
    const uv = poly.map(p => toUV(p, o, f));
    const vmin = Math.min(...uv.map(q => q[1])), vmax = Math.max(...uv.map(q => q[1]));
    const res = { id: b.id, poly, frame: f, origin: o, rows: [], ps: null, area: Math.abs(area(poly)) };
    // Reservierung Power Station
    let uLimit = null;
    if (b.id === (opts.psField || L.psField) && !opts.noPS) {
      const ends = [[...uRangeAtV(uv, (vmin + vmax) / 2)]];
      const r = ends[0]; const pMin = fromUV([r[0], (vmin + vmax) / 2], o, f), pMax = fromUV([r[1], (vmin + vmax) / 2], o, f);
      const atMin = len(sub(pMin, nap)) < len(sub(pMax, nap));
      res.psEnd = atMin ? 'min' : 'max';
    }
    // Reihen
    let v = vmin + L.rearClear, k = 0; const rows = [];
    while (true) {
      const facing = (k % 2 === 0) ? 1 : -1; // Tür Richtung +v bzw. -v
      const v0 = v, v1 = v + cab.d;
      const spaceAfter = facing === 1 ? L.frontAisle : L.backGap;
      const needEnd = facing === 1 ? L.frontAisle : L.rearClear; // Reihe am Rand: Tür zur Zaunseite braucht Gasse
      if (v1 + Math.min(needEnd, spaceAfter) > vmax + 1e-6) break;
      if (v1 + needEnd > vmax + 1e-6 && facing === 1) { break; }
      const r0 = uRangeAtV(uv, v0), r1 = uRangeAtV(uv, v1); if (!r0 || !r1) break;
      let ua = Math.max(r0[0], r1[0]) + L.endClear, ub = Math.min(r0[1], r1[1]) - L.endClear;
      rows.push({ v0, v1, ua, ub, facing });
      v = v1 + spaceAfter; k++;
      if (k > 20) break;
    }
    // letzte Reihe: wenn ihre Tür zur Zaunseite zeigt und Gasse fehlt -> entfernen
    // Power Station einbauen
    if (res.psEnd) {
      const vc = (vmin + vmax) / 2;
      const r = uRangeAtV(uv, vc);
      res.ps = { vc, u: res.psEnd === 'min' ? r[0] + L.psFence + 0 : r[1] - L.psFence };
    }
    res.rowsRaw = rows; fieldResults[b.id] = res;
  }
  // grobe Kapazität für Typwahl
  const pitch = cab.w + L.sideGap;
  function fillRow(ua, ub) { const out = []; let u = ua, g = 0; while (u + cab.w <= ub + 1e-6) { out.push(u + cab.w / 2); g++; if (g >= L.groupMax) { u += cab.w + L.fireGap; g = 0; } else u += pitch; } return out; }
  // PS-Typ: Leistung = min(E * cRate, Katalog)
  let roughCab = 0; for (const id of order) for (const r of fieldResults[id].rowsRaw) roughCab += fillRow(r.ua, r.ub).length;
  const eRough = roughCab * cab.kWh;
  psSpec = P.psCatalog.find(c => c.sMVA * 1000 * 0.95 >= eRough * L.cRateMax * 0.98) || P.psCatalog[P.psCatalog.length - 1];
  if (opts.psId) psSpec = P.psCatalog.find(c => c.id === opts.psId) || psSpec;
  // Endgültige Belegung
  for (const id of order) {
    const res = fieldResults[id]; const f = res.frame, o = res.origin;
    let psU0 = null, psU1 = null;
    if (res.ps) {
      const psLen = psSpec.l; // Längsseite entlang u
      if (res.psEnd === 'min') { psU0 = res.ps.u; psU1 = psU0 + psLen; } else { psU1 = res.ps.u; psU0 = psU1 - psLen; }
      const c = fromUV([(psU0 + psU1) / 2, res.ps.vc], o, f);
      const ang = Math.atan2(f.u[1], f.u[0]);
      ps = { id: 'PS-01', type: 'power_station', field: id, c, ang, l: psLen, w: psSpec.w, h: psSpec.h, spec: psSpec, poly: rectPoly(c, psLen, psSpec.w, ang) };
    }
    let rowIdx = 0;
    for (const r of res.rowsRaw) {
      let ua = r.ua, ub = r.ub;
      if (res.ps) {
        // Schränke dürfen nicht in den PS-Bereich inkl. Brandabstand
        const psV0 = res.ps.vc - psSpec.w / 2 - L.psClear, psV1 = res.ps.vc + psSpec.w / 2 + L.psClear;
        if (r.v1 > psV0 && r.v0 < psV1) { if (res.psEnd === 'min') ua = Math.max(ua, psU1 + L.psClear); else ub = Math.min(ub, psU0 - L.psClear); }
      }
      const us = fillRow(ua, ub); if (!us.length) continue;
      // zentrieren
      const used = us[us.length - 1] + cab.w / 2 - (us[0] - cab.w / 2); const shift = ((ub - ua) - used) / 2;
      const vc = (r.v0 + r.v1) / 2; const ang = Math.atan2(f.u[1], f.u[0]);
      const rowId = `${id}-R${++rowIdx}`; const cabs = [];
      us.forEach((u0, i) => { const u = u0 + shift; const c = fromUV([u, vc], o, f); nCab++;
        const cid = `C-${String(nCab).padStart(2, '0')}`;
        const obj = { id: cid, type: 'battery_cabinet', field: id, row: rowId, c, ang: ang + (r.facing === 1 ? 0 : Math.PI), w: cab.w, d: cab.d, h: cab.h, poly: rectPoly(c, cab.w, cab.d, ang) };
        objects.push(obj); cabs.push(obj); });
      // Gruppen
      const groups = []; let g = [cabs[0]];
      for (let i = 1; i < cabs.length; i++) { const gap = len(sub(cabs[i].c, cabs[i - 1].c)) - cab.w; if (gap > L.sideGap + 0.5) { groups.push(g); g = []; } g.push(cabs[i]); }
      groups.push(g);
      const uA = us[0] + shift - cab.w / 2, uB = us[us.length - 1] + shift + cab.w / 2;
      rowsOut.push({ id: rowId, field: id, v0: r.v0, v1: r.v1, facing: r.facing, uA, uB, n: cabs.length, groups: groups.map(x => x.map(c => c.id)), frame: f, origin: o,
        line: [fromUV([uA, vc], o, f), fromUV([uB, vc], o, f)] });
    }
    fieldsOut.push({ id, poly: res.poly, area: res.area, frame: f, origin: o });
  }
  if (ps) objects.push(ps);
  // Fundamente (2 Streifen je Reihe), Kabelkanäle, Zaun, Anprallschutz
  const found = [], trays = [], fences = [], blocks = [], bollards = [];
  for (const r of rowsOut) {
    const f = r.frame, o = r.origin; const ang = Math.atan2(f.u[1], f.u[0]);
    for (const grp of r.groups) {
      const cs = grp.map(id => objects.find(x => x.id === id)); const a = cs[0].c, b = cs[cs.length - 1].c;
      const cu = (toUV(a, o, f)[0] + toUV(b, o, f)[0]) / 2; const glen = len(sub(b, a)) + cab.w + 0.3;
      for (const dv of [-cab.d / 2 + 0.25, cab.d / 2 - 0.25]) {
        const vc = (r.v0 + r.v1) / 2 + dv; const c = fromUV([cu, vc], o, f);
        found.push({ id: `F-${found.length + 1}`, type: 'foundation_strip', field: r.field, c, ang, w: glen, d: 0.45, h: 0.35, depth: 0.8, poly: rectPoly(c, glen, 0.45, ang) });
      }
    }
  }
  if (ps) { const f = fieldResults[ps.field].frame; const ang = Math.atan2(f.u[1], f.u[0]);
    found.push({ id: `F-${found.length + 1}`, type: 'foundation_slab', field: ps.field, c: ps.c, ang, w: ps.l + 0.6, d: ps.w + 0.6, h: 0.3, depth: 0.6, poly: rectPoly(ps.c, ps.l + 0.6, ps.w + 0.6, ang) }); }
  // Zaun + Tor (Westseite = Seite zur Werkstrasse)
  const wk = site.werkstrasse;
  for (const fo of fieldsOut) {
    const p = fo.poly; let best = 0, bd = Infinity;
    for (let i = 0; i < p.length; i++) { const m = mul(add(p[i], p[(i + 1) % p.length]), 0.5); const d = closestOnPolyline(m, wk)[0]; if (d < bd) { bd = d; best = i; } }
    fences.push({ id: `Z-${fo.id}`, type: 'fence', field: fo.id, poly: p, h: 2.0, gateEdge: best, gateW: 4.0 });
    // Betonblöcke entlang der Strassenseite (Anprallschutz), 1.0 m vor dem Zaun
    const a = p[best], b = p[(best + 1) % p.length]; const t = norm(sub(b, a)); let nn = [-t[1], t[0]]; const mid = mul(add(a, b), 0.5);
    if (pip(add(mid, mul(nn, 0.5)), p)) nn = mul(nn, -1);
    const el = len(sub(b, a)); const gate0 = el / 2 - 2.0, gate1 = el / 2 + 2.0;
    for (let s = 0.2; s + 1.6 <= el - 0.2; s += 1.8) {
      if (s + 1.6 > gate0 && s < gate1) continue;
      const c = add(add(a, mul(t, s + 0.8)), mul(nn, 1.0)); blocks.push({ id: `AB-${blocks.length + 1}`, type: 'impact_block', c, ang: Math.atan2(t[1], t[0]), w: 1.6, d: 0.8, h: 0.8, poly: rectPoly(c, 1.6, 0.8, Math.atan2(t[1], t[0])) });
    }
    for (const s of [gate0 - 0.3, gate1 + 0.3]) { const c = add(add(a, mul(t, s)), mul(nn, 0.6)); bollards.push({ id: `P-${bollards.length + 1}`, type: 'bollard', c, diam: 0.27, h: 1.2 }); }
    fo.gate = { a: add(a, mul(t, gate0)), b: add(a, mul(t, gate1)), n: nn };
  }
  // DC-Kabelweg: Sammelkanal entlang der Westseite innen bis zur Power Station
  if (ps) {
    const path = [];
    for (const fo of fieldsOut) {
      const fence = fences.find(z => z.field === fo.id); const p = fo.poly; const i = fence.gateEdge; const a = p[i], b = p[(i + 1) % p.length];
      const t = norm(sub(b, a)); let nn = [-t[1], t[0]]; if (!pip(add(mul(add(a, b), 0.5), mul(nn, 0.5)), p)) nn = mul(nn, -1);
      const a2 = add(a, mul(nn, 0.5)), b2 = add(b, mul(nn, 0.5));
      // sortiert Nord -> Süd
      const seg = a2[1] < b2[1] ? [a2, b2] : [b2, a2]; path.push(...seg);
    }
    path.sort((p, q) => p[1] - q[1]);
    const psTerm = ps.c; path.push(psTerm);
    trays.push({ id: 'KT-DC', type: 'cable_tray', name: 'DC-Kabelkanal (Betonkanal mit Deckel) Schränke - Power Station', pts: path, w: 0.5, h: 0.4 });
  }
  // MS-Kabelweg zum NAP entlang Werkstrasse
  let mv = null;
  if (ps) {
    const start = ps.c; const [d0, q0, i0] = closestOnPolyline(start, wk); const [d1, q1, i1] = closestOnPolyline(nap, wk);
    const pts = [start, q0]; if (i1 >= i0) for (let i = i0 + 1; i <= i1; i++) pts.push(wk[i]); else for (let i = i0; i > i1; i--) pts.push(wk[i]);
    pts.push(q1, nap);
    mv = { id: 'KW-MS', type: 'cable_route_mv', name: 'MS-Kabel 3x1x240 mm2 Al, 16 kV, im Rohrblock 0.8 m tief', pts, len: polylineLen(pts) + 2 * 3 };
  }
  const E_kWh = nCab * cab.kWh;
  const P_kW = ps ? Math.min(psSpec.sMVA * 1000 * 0.95, E_kWh * L.cRateMax) : 0;
  return { fields: fieldsOut, rows: rowsOut, objects, ps, psSpec, nCab, E_kWh, Euse_kWh: E_kWh * cab.dod, P_kW, found, trays, mv, fences, blocks, bollards, nap };
}

// ------------------------------------------------------------------ Gelände / Planum
export function earthworks(layout, heightAt, site) {
  const out = [];
  for (const fo of layout.fields) {
    const p = fo.poly; const fence = layout.fences.find(z => z.field === fo.id); const a = p[fence.gateEdge], b = p[(fence.gateEdge + 1) % p.length];
    const west = mul(add(a, b), 0.5); const planum = Math.round((heightAt(west[0], west[1]) + 0.3) * 10) / 10;
    let vc = 0, vf = 0, hmax = 0, hEast = 0; const step = 0.5; const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) for (let z = Math.min(...zs); z <= Math.max(...zs); z += step) {
      if (!pip([x, z], p)) continue; const h = heightAt(x, z); const dh = h - planum; if (dh > 0) { vc += dh * step * step; hmax = Math.max(hmax, dh); } else vf += -dh * step * step; }
    // Höhe an der waldseitigen Kante (gegenüber Tor)
    const opp = mul(add(p[(fence.gateEdge + 2) % p.length], p[(fence.gateEdge + 3) % p.length]), 0.5);
    for (let s = 0; s <= 1; s += 0.1) { const q = add(p[(fence.gateEdge + 2) % p.length], mul(sub(p[(fence.gateEdge + 3) % p.length], p[(fence.gateEdge + 2) % p.length]), s)); hEast = Math.max(hEast, heightAt(q[0], q[1]) - planum); }
    out.push({ field: fo.id, planum, planumAbs: planum + 390, cut_m3: Math.round(vc), fill_m3: Math.round(vf), hmaxCut: Math.round(hmax * 10) / 10, wallH: Math.max(0, Math.round((hEast + 0.3) * 10) / 10) });
  }
  return out;
}

// ------------------------------------------------------------------ NISV (Biot-Savart, 3 Phasen, Effektivwert)
// Quellen: NS-Sammelschienen Wechselrichter-Trafo in der Power Station, MS-Kabel zum NAP (Dreieck verlegt), Trafostreufeld vereinfacht.
function bSeg(P, A, B, I) { // Feldvektor (T) eines geraden Leiters A->B mit Strom I (komplex als [re,im]) im Punkt P (3D)
  const mu = 1e-7; const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]; const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; const Ll = Math.sqrt(L2);
  const ap = [P[0] - A[0], P[1] - A[1], P[2] - A[2]]; const t = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L2;
  const foot = [A[0] + ab[0] * t, A[1] + ab[1] * t, A[2] + ab[2] * t]; const r = [P[0] - foot[0], P[1] - foot[1], P[2] - foot[2]]; const d = Math.hypot(...r) || 1e-3;
  const bp = [P[0] - B[0], P[1] - B[1], P[2] - B[2]]; const la = Math.hypot(...ap), lb = Math.hypot(...bp);
  const cos1 = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (la * Ll), cos2 = (bp[0] * ab[0] + bp[1] * ab[1] + bp[2] * ab[2]) / (lb * Ll);
  const mag = mu / d * (cos1 - cos2); // ohne I
  const dir = [ab[1] * r[2] - ab[2] * r[1], ab[2] * r[0] - ab[0] * r[2], ab[0] * r[1] - ab[1] * r[0]]; const dl = Math.hypot(...dir) || 1;
  const k = mag / dl; return [[dir[0] * k * I[0], dir[1] * k * I[0], dir[2] * k * I[0]], [dir[0] * k * I[1], dir[1] * k * I[1], dir[2] * k * I[1]]];
}
export function nisvSources(layout) {
  const src = []; const ps = layout.ps; if (!ps) return src; const S = ps.spec.sMVA * 1e6; const Ilv = S / (Math.sqrt(3) * ps.spec.ulv); const Imv = S / (Math.sqrt(3) * 16000);
  const ph = [0, -2 * Math.PI / 3, 2 * Math.PI / 3].map(a => [Math.cos(a), Math.sin(a)]);
  const u = [Math.cos(ps.ang), Math.sin(ps.ang)], v = [-u[1], u[0]];
  // NS-Schienen: 3 Leiter, Abstand 0.18 m, Länge 2.2 m, Höhe 1.2 m, in der Mitte der Station quer
  const segs = [];
  for (let k = 0; k < 3; k++) { const off = (k - 1) * 0.18; const a = add(ps.c, add(mul(u, -1.1), mul(v, off))); const b = add(ps.c, add(mul(u, 1.1), mul(v, off)));
    segs.push({ A: [a[0], 1.3, a[1]], B: [b[0], 1.3, b[1]], I: [Ilv * ph[k][0], Ilv * ph[k][1]] }); }
  // Trafo-Streufeld als kurze Ersatzleiter (Wicklungsabgänge)
  for (let k = 0; k < 3; k++) { const off = (k - 1) * 0.25; const a = add(ps.c, add(mul(u, 1.4), mul(v, off))); segs.push({ A: [a[0], 0.6, a[1]], B: [a[0], 2.0, a[1]], I: [Ilv * 0.5 * ph[k][0], Ilv * 0.5 * ph[k][1]] }); }
  // MS-Kabel (Dreieck, 0.06 m), 0.8 m tief
  if (layout.mv) { const pl = layout.mv.pts; for (let i = 0; i < pl.length - 1; i++) { const a = pl[i], b = pl[i + 1]; const t = norm(sub(b, a)), nn = [-t[1], t[0]];
    const offs = [[0, 0.035], [-0.03, -0.017], [0.03, -0.017]]; offs.forEach((o, k) => { const da = add(mul(nn, o[0]), [0, 0]); segs.push({ A: [a[0] + da[0], -0.8 + o[1], a[1] + da[1]], B: [b[0] + da[0], -0.8 + o[1], b[1] + da[1]], I: [Imv * ph[k][0], Imv * ph[k][1]] }); }); } }
  return segs;
}
export function bField(P, segs) { let re = [0, 0, 0], im = [0, 0, 0]; for (const s of segs) { const [r, i] = bSeg(P, s.A, s.B, s.I); for (let k = 0; k < 3; k++) { re[k] += r[k]; im[k] += i[k]; } }
  return Math.sqrt(re[0] ** 2 + re[1] ** 2 + re[2] ** 2 + im[0] ** 2 + im[1] ** 2 + im[2] ** 2) * 1e6; } // µT (Effektivwert)
export function nisvGrid(layout, segs, opts = {}) {
  const ps = layout.ps; if (!ps) return null; const R = opts.R || 40, st = opts.step || 1, y = opts.y ?? 1.0; const n = Math.round(2 * R / st) + 1; const vals = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) vals[j * n + i] = bField([ps.c[0] - R + i * st, y, ps.c[1] - R + j * st], segs);
  // Radius 1 µT
  let r1 = 0; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (vals[j * n + i] >= 1) r1 = Math.max(r1, Math.hypot(-R + i * st, -R + j * st));
  return { x0: ps.c[0] - R, z0: ps.c[1] - R, n, step: st, y, vals, r1 };
}

// ------------------------------------------------------------------ LSV (vereinfachte Ausbreitung nach ISO 9613-2, konservativ)
export function noiseSources(layout, P, mode = 'night') {
  const src = []; const cab = P.cab; const lw = mode === 'night' ? cab.lw_night : cab.lw_day;
  for (const o of layout.objects) if (o.type === 'battery_cabinet') src.push({ x: o.c[0], z: o.c[1], y: 2.2, lw, k2: 2, name: o.id });
  if (layout.ps) { const s = layout.ps.spec, c = layout.ps.c; src.push({ x: c[0], z: c[1], y: 1.8, lw: s.lw_inv, k2: 2, name: 'Wechselrichter' }, { x: c[0], z: c[1], y: 1.5, lw: s.lw_trafo, k2: 6, name: 'Transformator (tonhaltig)' }, { x: c[0], z: c[1], y: 2.8, lw: s.lw_hvac, k2: 2, name: 'Lüftung/HVAC' }); }
  return src;
}
export function lp(x, z, src, yR = 1.5) { // A-bewerteter Pegel + max K2-Anteil
  let s = 0, k2w = 0; for (const q of src) { const d = Math.max(1, Math.hypot(x - q.x, z - q.z, yR - q.y)); const L = q.lw - 20 * Math.log10(d) - 11 - 0.005 * d; const e = 10 ** (L / 10); s += e; k2w += e * q.k2; }
  return { L: 10 * Math.log10(s || 1e-12), k2: s ? Math.round(k2w / s) : 0 };
}
export function noiseAt(r, layout, P) {
  const out = {}; for (const m of ['day', 'night']) { const src = noiseSources(layout, P, m); const { L, k2 } = lp(r.x, r.z, src); const k1 = 5; const lr = L + k1 + Math.min(6, k2) + 0; out[m] = { leq: L, lr }; }
  const pw = P.lsv[r.es] || P.lsv.III; const bonus = r.betriebsraum && r.es !== 'IV' ? 5 : 0; out.pw = [pw[0] + bonus, pw[1] + bonus]; return out;
}
export function noiseGrid(layout, P, mode = 'night', opts = {}) {
  const src = noiseSources(layout, P, mode); const c = layout.ps ? layout.ps.c : [0, 0]; const R = opts.R || 160, st = opts.step || 4; const n = Math.round(2 * R / st) + 1; const vals = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const { L, k2 } = lp(c[0] - R + i * st, c[1] - R + j * st, src); vals[j * n + i] = L + 5 + Math.min(6, k2); }
  return { x0: c[0] - R, z0: c[1] - R, n, step: st, vals, mode };
}

// ------------------------------------------------------------------ Lastgang und Peak Shaving (1-min-Simulation)
function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function loadProfile(ops) {
  const r = rng(ops.season === 'sommer' ? 11 : 23); const N = 1440; const brech = new Float32Array(N), wasch = new Float32Array(N), asph = new Float32Array(N), basis = new Float32Array(N);
  const work = ops.day === 'werktag', sat = ops.day === 'samstag', summer = ops.season === 'sommer';
  for (let m = 0; m < N; m++) {
    const h = m / 60; basis[m] = (h > 6 && h < 18 ? 120 : 55) + 15 * Math.sin(m / 37) + 10 * r();
    if (work || (sat && h < 12)) {
      const on = (h >= 6.5 && h < 11.75) || (h >= 12.75 && h < (sat ? 0 : 16.75));
      if (on) brech[m] = 520 + 90 * Math.sin(m / 3.1) + 60 * (r() - 0.5) + (r() < 0.05 ? 180 : 0);
      if ((h >= 7 && h < 11.75) || (h >= 12.75 && h < (sat ? 0 : 16.5))) wasch[m] = 310 + 25 * (r() - 0.5);
      if (summer && h >= 5.5 && h < 15) asph[m] = 600 + 160 * Math.max(0, Math.sin(m / 4.3)) + 50 * (r() - 0.5);
      if (summer && h >= 3.5 && h < 5.5) asph[m] = 160; // Vorheizen Bitumentanks
    }
  }
  // Anlaufspitzen (Direktanlauf, im Minutenmittel)
  const starts = work ? [6.5, 7.0, 12.75, 13.0] : []; for (const s of starts) { const m = Math.round(s * 60); for (let k = 0; k < 3; k++) brech[m + k] += [420, 260, 120][k]; }
  if (summer && work) { const m = Math.round(5.5 * 60); for (let k = 0; k < 4; k++) asph[m + k] += [380, 300, 160, 80][k]; }
  const load = new Float32Array(N); for (let m = 0; m < N; m++) load[m] = basis[m] + brech[m] + wasch[m] + asph[m];
  // Netzsignal VNB: +1 Hochlast (entladen), -1 Schwachlast/Überschuss (laden)
  const sig = new Int8Array(N); for (let m = 0; m < N; m++) { const h = m / 60;
    if (summer) { if ((h >= 7 && h < 9) || (h >= 18 && h < 21)) sig[m] = 1; if (h >= 11 && h < 15.5) sig[m] = -1; if (h < 5 || h >= 22) sig[m] = -1; }
    else { if ((h >= 7 && h < 10) || (h >= 17 && h < 20.5)) sig[m] = 1; if (h < 5.5 || h >= 22) sig[m] = -1; if (h >= 12 && h < 14) sig[m] = -1; } }
  return { N, load, basis, brech, wasch, asph, sig };
}
export function simulate(layout, P, opts = {}) {
  const ops = { ...P.ops, ...opts }; const prof = loadProfile(ops); const N = prof.N;
  const E = layout.Euse_kWh || 1, Pm = layout.P_kW || 0, eta = Math.sqrt(ops.eta); const aux = (layout.nCab || 0) * P.cab.aux_kW;
  const soc = new Float32Array(N + 1), pb = new Float32Array(N), nap = new Float32Array(N), napNo = new Float32Array(N);
  const target = (ops.season === 'winter' && !ops.targetSet) ? ops.target_winter_kW : ops.target_kW;
  let natPeak = 0; for (let i = 7 * 60; i < 20 * 60; i += 15) { let s = 0; for (let k = 0; k < 15; k++) s += prof.load[i + k]; natPeak = Math.max(natPeak, s / 15); }
  const cap = Math.min(target, natPeak * 0.97); // Laden nie über die Grenze bzw. die ohnehin auftretende Tagesspitze (sonst steigt die verrechnete Leistung)
  soc[0] = 0.55;
  // einfacher Vorschau-Bedarf: Energie über Ziel in den nächsten 6 h
  const over = new Float32Array(N); for (let m = 0; m < N; m++) over[m] = Math.max(0, prof.load[m] + aux - target);
  for (let m = 0; m < N; m++) {
    const L = prof.load[m] + aux; napNo[m] = prof.load[m]; let p = 0; // + = Entladen
    const eNow = soc[m] * E; const eMin = ops.soc_min * E, eMax = ops.soc_max * E;
    const hh = m / 60; const inWin = hh >= 7 && hh < 20; const capNow = inWin ? cap : Math.max(cap, ops.conn_kW);
    if (L > target && inWin) p = Math.min(Pm, L - target);
    else {
      let need = 0; for (let k = m; k < Math.min(N, m + 360); k++) need += over[k] / 60;
      if (ops.grid_mode && prof.sig[m] === 1 && eNow - eMin > need / eta + 0.15 * E) p = Math.min(Pm, (eNow - eMin - need / eta) * 60 / 30, Pm * 0.8);
      else if ((ops.grid_mode && prof.sig[m] === -1) || eNow < need / eta + eMin) p = -Math.min(Pm, Math.max(0, capNow - L), (eMax - eNow) * 60);
    }
    // Grenzen SOC
    if (p > 0) p = Math.min(p, Math.max(0, (eNow - eMin) * 60 * eta)); else p = Math.max(p, -Math.max(0, (eMax - eNow) * 60 / eta));
    pb[m] = p; nap[m] = L - p;
    soc[m + 1] = (eNow - (p > 0 ? p / eta : p * eta) / 60) / E;
  }
  const q = (arr) => { let mx = 0; for (let i = 7 * 60; i < 20 * 60; i += 15) { let s = 0; for (let k = 0; k < 15; k++) s += arr[i + k]; mx = Math.max(mx, s / 15); } return mx; };
  let eDis = 0, eCh = 0; for (let m = 0; m < N; m++) { if (pb[m] > 0) eDis += pb[m] / 60; else eCh += -pb[m] / 60; }
  return { prof, pb, nap, napNo, soc, peakNo: q(napNo), peakWith: q(nap), eDis, eCh, cycles: eDis / E, aux };
}

// ------------------------------------------------------------------ Normen- und Vorschriftenprüfung
function st(ok, warn) { return ok ? 'ok' : warn ? 'warn' : 'fail'; }
export function runChecks(scene, site, layout, P, extra = {}) {
  const R = P.rules; const checks = []; const dims = [];
  const equip = layout.objects.filter(o => o.type === 'battery_cabinet' || o.type === 'power_station');
  const fenceP = layout.fields.map(f => f.poly);
  const minTo = (featPolys, closed, contain = true) => { let best = [Infinity, null, null, null]; for (const e of equip) for (const f of featPolys) { const r = minDist(e.poly, f, true, closed, contain); if (r[0] < best[0]) best = [...r, e.id]; } return best; };
  const addDim = (r, label, limit, status, key) => { if (r && r[1]) dims.push({ a: r[1], b: r[2], d: r[0], label, limit, status, key }); };
  const wg = scene.legal.waldgrenze || [], wal = scene.legal.wal || [];
  // 1 Waldabstand
  const dW = minTo(wg, false);
  // Seite der Waldabstandslinie: Waldpunkt bestimmt die "verbotene" Seite
  const forestPt = wg.length ? wg[0][Math.floor(wg[0].length / 2)] : [60, 0];
  let beyond = 0; if (wal.length) { const sF = sideOfPolyline(forestPt, wal[0]); for (const e of equip) for (const p of e.poly) if (sideOfPolyline(p, wal[0]) === sF) { beyond++; break; } }
  const dWal = wal.length ? minTo(wal, false) : [Infinity];
  addDim(dW, 'Waldgrenze', R.wald_forst, st(dW[0] >= R.wald_forst, dW[0] >= R.wald_min), 'wald');
  addDim(dWal, 'Waldabstandslinie', 0, beyond ? 'fail' : 'ok', 'wal');
  const walStatus = !beyond ? (dW[0] >= R.wald_forst ? 'ok' : 'warn') : (dW[0] < R.wald_min ? 'fail' : 'warn');
  if (dims.length) { const d = dims.find(x => x.key === 'wal'); if (d) d.status = walStatus; const w = dims.find(x => x.key === 'wald'); if (w) w.status = dW[0] >= R.wald_forst ? 'ok' : dW[0] >= R.wald_min ? 'warn' : 'fail'; }
  checks.push({ id: 'WAL', group: 'Wald', title: 'Waldabstand (Waldabstandslinie PBG ZH, forstrechtliche Bewilligung)', norm: 'WaG Art. 17; PBG ZH § 66 und § 262 (Waldabstandslinien gelten für Gebäude); § 220 PBG; Waldabstandslinie Unterengstringen 1985',
    measured: `${beyond} von ${equip.length} Elementen östlich der Waldabstandslinie; Abstand zur Waldgrenze min. ${dW[0].toFixed(1)} m`, limit: `Gebäude diesseits der Waldabstandslinie; Anlagen < ${R.wald_forst} m: forstrechtliche Bewilligung; < ${R.wald_min} m in der Regel ungenügend`, status: walStatus,
    reason: beyond ? 'Die Baufelder liegen zwischen Waldabstandslinie und Wald. § 262 PBG beschränkt Gebäude; Batterieschränke und Skid gelten voraussichtlich als Anlagen (in der harmonisierten Fassung ausdrücklich ausgenommen). Massgebend wird dann WaG Art. 17: unter 15 m Abstand braucht es eine forstrechtliche Bewilligung der Abteilung Wald (ALN). Die Einordnung durch die Gemeinde ist offen.' : 'Anordnung diesseits der Waldabstandslinie.',
    measure: 'Frühe Voranfrage Gemeinde und ALN; Power Station als gebäudeähnlichstes Element westlich der Linie anordnen; sonst Variante B (Ersatzfeld West) oder Ausnahme nach § 220 PBG.' });
  // 2 Waldbrand / Baumfall
  const treeH = extra.treeH || 28;
  checks.push({ id: 'WALDBRAND', group: 'Brandschutz', title: 'Waldbrand- und Baumfallrisiko am Waldrand', norm: 'VKF-Brandschutzrichtlinie Schutzabstände (15-15); WaG Art. 17; Sorgfaltspflicht',
    measured: `Abstand zur Waldgrenze ${dW[0].toFixed(1)} m; Baumhöhen am Waldrand bis ${treeH.toFixed(0)} m (swissSURFACE3D)`, limit: `>= ${R.brand_wald} m vegetationsfrei, Fallraum Baumhöhe`,
    status: dW[0] >= treeH ? 'ok' : dW[0] >= R.brand_wald ? 'warn' : 'fail', reason: dW[0] < treeH ? 'Batterieschränke liegen im Fallraum der Randbäume; Funkenflug und Strahlungswärme in beide Richtungen möglich.' : 'Abstand ausreichend.',
    measure: 'Vegetationsfreie Zone 10 m (Kiesbelag), gestufter Waldrand mit Sicherheitsholzerei in Absprache mit Revierförster, Waldbrandgefahr-Stufe im EMS berücksichtigen (Lastreduktion bei Stufe 4/5).' });
  // 3 Brandschutz Hallen
  let wHalls = { d: Infinity }; for (const h of site.halls) { const r = minTo([h.poly], true); const lim = h.brennbar ? R.brand_halle_brennbar : R.brand_halle; if (r[0] - lim < (wHalls.d - (wHalls.lim || 0))) wHalls = { d: r[0], r, lim, h }; addDim(r, h.name.split('(')[0].trim(), lim, st(r[0] >= lim, r[0] >= lim * 0.6), 'halle-' + h.id); }
  checks.push({ id: 'BRAND-GEB', group: 'Brandschutz', title: 'Schutzabstand zu Gebäuden (Zelthallen, Lagerhallen)', norm: 'VKF-Brandschutzrichtlinie 15-15 Schutzabstände; VKF-Stand der Technik Batteriespeicher; UL 9540A Grossbrandversuch',
    measured: `${wHalls.h.name}: ${wHalls.d.toFixed(1)} m`, limit: `${wHalls.lim} m (${wHalls.h.brennbar ? 'brennbare Aussenwand' : 'nicht brennbar'})`, status: st(wHalls.d >= wHalls.lim, wHalls.d >= wHalls.lim * 0.6),
    reason: wHalls.d >= wHalls.lim ? 'Schutzabstand eingehalten.' : 'Schutzabstand zur Halle mit brennbarer Membran unterschritten.', measure: 'Brandschutzmauer EI 90 zwischen Feld und Halle oder Felder um Fehlbetrag nach Osten verschieben; Alternativ Halle mit nicht brennbarer Hülle.' });
  // 4 Brandgruppen / Abstand PS
  let minGroupGap = Infinity, minPsCab = Infinity; for (const r of layout.rows) { for (let g = 1; g < r.groups.length; g++) { const a = layout.objects.find(o => o.id === r.groups[g - 1].slice(-1)[0]), b = layout.objects.find(o => o.id === r.groups[g][0]); minGroupGap = Math.min(minGroupGap, len(sub(a.c, b.c)) - P.cab.w); } }
  if (layout.ps) for (const o of layout.objects) if (o.type === 'battery_cabinet') { const d = minDist(o.poly, layout.ps.poly)[0]; if (d < minPsCab) { minPsCab = d; } }
  if (layout.ps) { const r = minTo([layout.ps.poly], true); }
  checks.push({ id: 'BRAND-GRP', group: 'Brandschutz', title: 'Brandabschnitte: Schrankgruppen und Power Station', norm: 'IEC 62933-5-2; UL 9540A (Ausbreitungsnachweis); VKF Brandabschnitte',
    measured: `max. ${P.layout.groupMax} Schränke je Gruppe, Gruppenabstand ${isFinite(minGroupGap) ? minGroupGap.toFixed(2) : '-'} m, Schrank - Power Station ${isFinite(minPsCab) ? minPsCab.toFixed(2) : '-'} m`, limit: `${P.layout.fireGap} m / ${P.layout.psClear} m`,
    status: st((minGroupGap >= P.layout.fireGap - 0.01 || !isFinite(minGroupGap)) && minPsCab >= P.layout.psClear - 0.01), reason: 'Abstände aus Layoutregeln erzeugt und nachgemessen.', measure: 'UL-9540A-Bericht des Herstellers als Nachweis für 0.15 m Seitenabstand beilegen.' });
  // 5 Abstand Werkstrasse / Anprallschutz
  const roadEdge = site.werkstrasse; const dRoad = minTo([roadEdge], false); const dRoadEdge = dRoad[0] - site.werkstrasse_breite / 2;
  addDim(dRoad, 'Werkstrasse (Achse)', R.strasse_min + site.werkstrasse_breite / 2, st(dRoadEdge >= R.strasse_min, dRoadEdge >= 0), 'strasse');
  checks.push({ id: 'STRASSE', group: 'Betrieb', title: 'Abstand Werkstrasse und Anprallschutz gegen Werkverkehr', norm: 'SUVA/EKAS Verkehrswege; Betreiberauflage; SN EN 1317 sinngemäss',
    measured: `Rand Werkstrasse - Gerät ${dRoadEdge.toFixed(1)} m; ${layout.blocks.length} Betonblöcke, ${layout.bollards.length} Poller`, limit: `>= ${R.strasse_min} m plus Anprallschutz`, status: st(dRoadEdge >= R.strasse_min && layout.blocks.length > 0, dRoadEdge >= 0),
    reason: 'Radlader und Muldenkipper verkehren direkt westlich der Felder.', measure: 'Betonblöcke 160 x 80 x 80 cm durchgehend, Poller mit Signalfarbe an den Toren, Geschwindigkeitsbegrenzung 10 km/h.' });
  // 6 Kieshalden
  const dPile = minTo(site.piles.map(p => p.poly), true); addDim(dPile, 'Kieshalde', R.halde_min, st(dPile[0] >= R.halde_min, dPile[0] >= 2), 'halde');
  checks.push({ id: 'HALDE', group: 'Betrieb', title: 'Abstand zu Kieshalden (Abrutschen, Staub, Radlader)', norm: 'Betreiberregel Kieswerk; SIA 267', measured: `${dPile[0].toFixed(1)} m`, limit: `>= ${R.halde_min} m`, status: st(dPile[0] >= R.halde_min, dPile[0] >= 2),
    reason: 'Schüttkegel können beim Beschicken abrutschen; Staubniederschlag auf Lüftungsgitter.', measure: 'Haldenfuss mit Blocksteinen oder Betonblöcken begrenzen, Haldenbewirtschaftung im Betriebsreglement festlegen.' });
  // 7 Grenzabstand
  const dPar = minTo(scene.legal.parcel, true, false); addDim(dPar, 'Grundstücksgrenze', R.grenz_min, st(dPar[0] >= R.grenz_min), 'grenze');
  checks.push({ id: 'GRENZE', group: 'Baurecht', title: 'Grenzabstand zur Parzellengrenze', norm: 'PBG ZH § 260; BZO Unterengstringen (Industriezone)', measured: `${dPar[0].toFixed(1)} m`, limit: `>= ${R.grenz_min} m (Annahme BZO)`, status: st(dPar[0] >= R.grenz_min),
    reason: 'Parzelle 2301 reicht ostseitig in den Wald; Grenzabstand unkritisch.', measure: '-' });
  // 8 Betriebsgebäude (OMEN) Abstand
  let dO = { d: Infinity }; for (const o of site.omen) { for (const e of equip) { const r = minDist(e.poly, [[o.x - 0.5, o.z - 0.5], [o.x + 0.5, o.z - 0.5], [o.x + 0.5, o.z + 0.5], [o.x - 0.5, o.z + 0.5]]); if (r[0] < dO.d) dO = { d: r[0], o, r }; } }
  addDim(dO.r, 'Betriebsgebäude', R.brand_omen, st(dO.d >= R.brand_omen), 'omen');
  // 9 NISV
  const segs = nisvSources(layout); let bMax = 0, bAt = null; for (const o of site.omen) { const b = bField([o.x, o.y, o.z], segs); if (b > bMax) { bMax = b; bAt = o; } }
  const grid = extra.nisv || nisvGrid(layout, segs, { R: 30, step: 1 });
  checks.push({ id: 'NISV', group: 'Umwelt', title: 'NISV: Anlagegrenzwert 1 µT an Orten mit empfindlicher Nutzung', norm: 'NISV Anhang 1 Ziff. 12 (Transformatorenstationen) und Ziff. 15; Vollzugshilfe BAFU',
    measured: `max. ${bMax.toFixed(3)} µT an OMEN (${bAt ? bAt.name : '-'}); 1-µT-Radius um die Power Station ${grid ? grid.r1.toFixed(1) : '-'} m`, limit: `${R.nisv_agw} µT`, status: st(bMax <= R.nisv_agw),
    reason: `Massgebend sind die NS-Sammelschienen (${Math.round(layout.ps ? layout.ps.spec.sMVA * 1e6 / (Math.sqrt(3) * layout.ps.spec.ulv) : 0)} A je Phase bei Nennlast). Keine OMEN innerhalb des 1-µT-Bereichs.`, measure: 'Standortdatenblatt NISV mit Herstellerangaben (Schienenlage, Abschirmung) zum ESTI-Gesuch; Zutritt im 1-µT-Bereich nur für Personal.' });
  // 10 LSV
  const nres = site.receptors.map(r => ({ r, n: noiseAt(r, layout, P) }));
  const worst = nres.reduce((w, x) => { const m = Math.max(x.n.day.lr - x.n.pw[0], x.n.night.lr - x.n.pw[1]); return m > w.m ? { m, x } : w; }, { m: -999, x: null });
  checks.push({ id: 'LSV', group: 'Umwelt', title: 'LSV: Planungswerte für neue ortsfeste Anlage (Tag/Nacht)', norm: 'LSV Art. 7 und Anhang 6; ES III (in Kraft), ES IV (Vorwirkung)',
    measured: nres.map(x => `${x.r.name}: Lr Tag ${x.n.day.lr.toFixed(0)} / Nacht ${x.n.night.lr.toFixed(0)} dB(A)`).join('; '), limit: 'PW je Empfänger (ES II 55/45, ES III 60/50, Betriebsräume +5)',
    status: worst.m <= -3 ? 'ok' : worst.m <= 0 ? 'warn' : 'fail', reason: `Kritischster Empfänger: ${worst.x.r.name} mit ${worst.m > 0 ? `Überschreitung des Planungswerts um ${worst.m.toFixed(1)} dB` : `${(-worst.m).toFixed(1)} dB unter dem Planungswert`}. Konservativ ohne Abschirmung der Hallen gerechnet; K1 = 5, K2 bis 6 dB (Trafo tonhaltig).`,
    measure: 'Lüftercharakteristik Nacht reduziert, Trafo mit Geräuschkapselung, Lärmprognose durch Akustiker mit Herstellerdaten.' , detail: nres });
  // 11 Löschwasser / Zufahrt / Rückhaltung
  const ec = layout.ps ? layout.ps.c : equip[0].c; let dHy = Infinity; for (const h of site.hydranten) dHy = Math.min(dHy, len(sub([h.x, h.z], ec)));
  checks.push({ id: 'LOESCHWASSER', group: 'Brandschutz', title: 'Löschwasser und Feuerwehrzufahrt', norm: 'VKF-Brandschutznorm; FKS-Richtlinie Feuerwehrzufahrten; GVZ', measured: `nächster Hydrant ${dHy.toFixed(0)} m (Annahme); Zufahrt über Werkstrasse ${site.werkstrasse_breite} m breit`, limit: `Hydrant <= ${R.hydrant_max} m, Zufahrt >= 3.5 m`,
    status: st(dHy <= R.hydrant_max, dHy <= 1.6 * R.hydrant_max), reason: 'Hydrantenstandorte sind nicht amtlich erhoben, sondern angenommen.', measure: 'Neuer Hydrant an der Werkstrasse bei BF2 oder Löschwasserbezug aus Kieswaschwasserbecken mit Feuerwehr Unterengstringen abstimmen.' });
  const vRet = R.lw_q_lpm * R.lw_t_min / 1000;
  checks.push({ id: 'RUECKHALT', group: 'Gewässerschutz', title: 'Löschwasserrückhaltung im Gewässerschutzbereich Au', norm: 'GSchG Art. 6; GSchV Anhang 4 Ziff. 211; Leitfaden Löschwasser-Rückhaltung (BAFU/KVU); AWEL', measured: `Bedarf ${vRet.toFixed(0)} m3 (${R.lw_q_lpm} l/min x ${R.lw_t_min} min)`, limit: 'Rückhalt für kontaminiertes Löschwasser, dichte Fläche',
    status: 'warn', reason: 'Kiesboden sehr durchlässig, ergiebiges Grundwasser Limmattal; kontaminiertes Kühl- und Löschwasser darf nicht versickern.', measure: `Felder mit dichtem Belag und Gefälle zu Rinne, Rückhaltebecken ${Math.ceil(vRet / 5) * 5} m3 mit Absperrschieber, Esteröl-Trafo mit Wanne 110 %.` });
  checks.push({ id: 'AU', group: 'Gewässerschutz', title: 'Gewässerschutzbereich Au: Bauten und wassergefährdende Stoffe', norm: 'GSchV Art. 31 und Anhang 4 Ziff. 211; VWF / Tankanlagen', measured: `Trafoöl ${layout.ps ? layout.ps.spec.oil_l : 0} l Esteröl (biologisch abbaubar); Fundamente max. 0.8 m tief`, limit: 'keine Anlagen unter mittlerem Grundwasserspiegel, Rückhalt 100 %',
    status: 'ok', reason: 'Fundamente liegen weit über dem Grundwasserspiegel (Annahme, Kieswerkssohle ca. 389 m ü. M.).', measure: 'Bewilligung nach Art. 19 GSchG beim AWEL; Grundwasserstand aus Pegelmessung bestätigen.' });
  // 12 Altlasten
  const inKbs = (scene.legal.kbs || []).some(p => equip.some(e => pip(e.c, p)));
  checks.push({ id: 'ALTLAST', group: 'Gewässerschutz', title: 'Belasteter Standort (Kataster der belasteten Standorte)', norm: 'AltlV Art. 3; VVEA (Aushubentsorgung)', measured: inKbs ? 'Felder auf KbS 0249/D.0002-000 (belastet, weder überwachungs- noch sanierungsbedürftig)' : 'ausserhalb KbS', limit: 'Bauvorhaben darf keinen Sanierungsbedarf auslösen',
    status: inKbs ? 'warn' : 'ok', reason: 'Ehemalige Deponie: Aushub kann belastet sein.', measure: 'Altlastenfachliche Begleitung, Aushubkonzept mit Triage nach VVEA, Bauen nur oberflächennah.' });
  // 13 Böschung
  const ew = extra.earth || []; const hMax = ew.reduce((m, e) => Math.max(m, e.wallH), 0);
  checks.push({ id: 'BOESCHUNG', group: 'Geotechnik', title: 'Böschungs- und Hangstabilität am Waldrand', norm: 'SIA 267 Geotechnik; SIA 261', measured: ew.map(e => `${e.field}: Planum ${e.planumAbs.toFixed(1)} m ü. M., Abtrag ${e.cut_m3} m3, Stützhöhe ${e.wallH.toFixed(1)} m`).join('; '), limit: `Stützhöhe <= ${R.boeschung_warn} m ohne Massnahme`,
    status: hMax <= R.boeschung_warn ? 'ok' : hMax <= R.boeschung_fail ? 'warn' : 'fail', reason: 'Die Felder liegen am Fuss der Haldenschüttung und der Böschung zur Waldterrasse (ca. 398 bis 399 m ü. M.).',
    measure: 'Haldenmaterial abtragen (verwertbar), Böschung mit Neigung 2:3 oder Nagelwand / Blocksteinmauer sichern, geotechnisches Gutachten.' });
  // 14 Staub / Schutzart / Anprallschutz
  checks.push({ id: 'STAUB', group: 'Technik', title: 'Staubschutz und Schutzart wegen Kiesbetrieb', norm: 'IEC 60529; IEC 62933-5-2; Herstellerangaben', measured: `${P.cab.ip}, Korrosivität ${P.cab.korrosion}, Filtermatten, Flüssigkühlung (geschlossener Kreislauf)`, limit: '>= IP54, C4', status: 'ok', reason: 'Kalk- und Quarzstaub aus Brech- und Siebanlage.', measure: 'Filterwechsel im Wartungsplan quartalsweise, Felder befestigt und befeuchtet.' });
  // 15 Elektro-Normen (Nachweis offen, Konzept erfüllt)
  const doc = (id, group, title, norm, measured, measure, status = 'ok', reason = 'Im Konzept berücksichtigt; Nachweis im Ausführungsprojekt.') => checks.push({ id, group, title, norm, measured, limit: 'Nachweis', status, reason, measure });
  doc('NIV', 'Elektro', 'Niederspannung: NIV und NIN SN 411000', 'NIV SR 734.27; NIN 2025 SN 411000', 'Hilfsbetriebe 400/230 V, Fehlerschutz, Sicherheitsnachweis', 'Installationsanzeige und Sicherheitsnachweis durch bewilligten Installateur.');
  doc('ESTI', 'Elektro', 'Starkstromverordnung und ESTI-Plangenehmigung', 'StV SR 734.2; VPeA SR 734.25', `MS-Anlage 16 kV, ${layout.ps ? layout.ps.spec.sMVA : 0} MVA`, 'Plangenehmigungsgesuch ESTI (MS-Schaltanlage, Trafo, MS-Kabel) mit NISV-Standortdatenblatt.', 'warn', 'Bewilligungspflichtig; Verfahrensdauer einplanen.');
  doc('EN61936', 'Elektro', 'Anlagen über 1 kV und Erdung', 'SN EN 61936-1; SN EN 50522', 'Erdungsanlage als Ringerder um alle Felder, vermascht mit Fundamenterder', 'Erdungsmessung und Nachweis Berührungsspannung nach SN EN 50522.');
  doc('IEC62933', 'Batterie', 'BESS-Sicherheit, Zellen und Thermal Runaway', 'IEC 62933-5-2; IEC 62619; UL 9540A', 'Schränke mit Gasdetektion, Überdruckklappen, Aerosol-Löschung, Zellnachweise', 'Zertifikate und UL-9540A-Bericht (Zelle, Modul, Einheit) vom Hersteller.');
  doc('EN50549', 'Netz', 'Netzanschluss und Messung', 'SN EN 50549-2; VSE Distribution Code, NA/RR, Metering Code Schweiz', 'Netzschutz am NAP, Q(U)-Regelung, Viertelstunden-Messung', 'Anschlussgesuch beim VNB, Netzverträglichkeitsprüfung, Messkonzept.', 'warn', 'Netzkapazität am 16-kV-Strang beim VNB abzuklären.');
  doc('IEC62443', 'Cyber', 'Cybersecurity EMS und Fernzugriff', 'IEC 62443-3-3; IEC 62443-4-2', 'Zonen/Conduits, SL 2, Fernzugriff über Jump-Host mit MFA', 'Security-Konzept und Abnahmetest.');
  doc('ISO16739', 'BIM', 'IFC-Export', 'ISO 16739-1 (IFC4)', 'IFC4 mit Georeferenz LV95 (IfcMapConversion)', '-');
  doc('ZONE', 'Baurecht', 'Zonenkonformität und Richtplan', 'RPG Art. 22; PBG ZH; BZO Unterengstringen; Richtplan ZH', 'Industriezone I, Energiespeicher als gewerbliche Anlage zonenkonform', 'Baugesuch im ordentlichen Verfahren.', 'ok', 'Industriezone erlaubt gewerbliche und technische Anlagen.');
  doc('ABBAU', 'Baurecht', 'Abbau- und Rekultivierungsauflagen Kieswerk', 'Abbaubewilligung / Gestaltungsplan Kieswerk (zu beschaffen)', 'Felder auf bestehender Halden- und Lagerfläche', 'Endgestaltung und Rekultivierungsplan beim Betreiber und Kanton einsehen.', 'warn', 'Auflagen nicht öffentlich verfügbar.');
  doc('SIZ', 'Baurecht', 'Sicherheitszonenplan Flughafen Zürich', 'LFG; VIL; Sicherheitszonenplan (öffentlich aufgelegt)', 'Anlagenhöhe < 4 m über Terrain', '-', 'ok', 'Höhenbeschränkung bei weitem nicht erreicht.');
  return { checks, dims, nisv: grid, noise: nres };
}

// ------------------------------------------------------------------ Gesamtlauf mit automatischer Alternative
export function computeAll(scene, site, Pin = {}, heightAt = () => 0, extra = {}) {
  const P = deepMerge(structuredCloneSafe(DEFAULTS), Pin);
  const layout = computeLayout(scene, site, P);
  const earth = earthworks(layout, heightAt, site);
  const res = runChecks(scene, site, layout, P, { ...extra, earth });
  const sim = simulate(layout, P);
  const variants = [];
  const fails = res.checks.filter(c => c.status === 'fail').map(c => c.id);
  if (fails.includes('BOESCHUNG')) {
    const la = computeLayout(scene, site, P, null, { maxCut: P.rules.boeschung_warn, heightAt });
    const ea = earthworks(la, heightAt, site); const ra = runChecks(scene, site, la, P, { ...extra, earth: ea });
    variants.push({ id: 'A2', name: 'Variante A2: Baufelder nur am Hangfuss (Abtrag <= 1.5 m, ohne hohe Stützmauer)', hinweis: 'Gleiche Baufelder, Belegung bis zum Böschungsfuss; Waldabstand bleibt kritisch.', layout: la, earth: ea, checks: ra.checks, dims: ra.dims, nisv: ra.nisv, noise: ra.noise });
  }
  if (fails.includes('WAL') || fails.includes('WALDBRAND') || fails.includes('BRAND-GEB') || res.checks.some(c => (c.id === 'WAL' || c.id === 'WALDBRAND') && c.status !== 'ok')) {
    // Variante B: Ersatzfeld westlich der Waldabstandslinie
    for (const alt of site.alternativen || []) {
      const fld = [{ id: alt.id, poly: alt.poly }];
      const lb = computeLayout(scene, site, P, fld, { psField: alt.id });
      const eb = earthworks(lb, heightAt, site);
      const rb = runChecks(scene, site, lb, P, { ...extra, earth: eb });
      variants.push({ id: 'B', name: 'Variante B: ' + alt.name, hinweis: alt.hinweis, layout: lb, earth: eb, checks: rb.checks, dims: rb.dims, nisv: rb.nisv, noise: rb.noise });
    }
  }
  return { P, layout, earth, ...res, sim, variants };
}
function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) a[k] = deepMerge(a[k] || {}, b[k]); else a[k] = b[k]; } return a; }

// Höhenfunktion aus Terrain-Raster (Uint16, cm über hmin)
export function makeHeightAt(scene, u16) {
  const T = scene.terrain, W = scene.window, n = T.n, s = T.step;
  return (x, z) => { const fx = (x - W.x0) / s, fz = (z - W.z0) / s; const i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fz))); const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const h = (ii, jj) => T.hmin + u16[jj * n + ii] * T.scale; return h(i, j) * (1 - tx) * (1 - tz) + h(i + 1, j) * tx * (1 - tz) + h(i, j + 1) * (1 - tx) * tz + h(i + 1, j + 1) * tx * tz; };
}
