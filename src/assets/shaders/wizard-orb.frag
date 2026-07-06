#version 300 es
precision highp float;

uniform sampler2D uArt;
uniform sampler2D uMask;
uniform sampler2D uNorm;
uniform sampler2D uEmpty;   // empty-glass plate
uniform sampler2D uPack;    // r: sphere depth/thickness, g: ambient occlusion
uniform sampler2D uStone;   // petrified-orb plate for reservations
uniform vec2  uRes;
uniform float uTime;
uniform float uHP;        // displayed 0..1
uniform float uMP;
uniform float uLvlL;      // surface height in orb units (-1.05..1.05)
uniform float uLvlR;
uniform float uSloshL;    // signed tilt
uniform float uSloshR;
uniform float uBeat;      // accumulated heartbeat phase
uniform int   uOct;
uniform float uFlashL;    // event flash impulse, decays in JS
uniform float uFlashR;
uniform float uFullL;     // gentle full-charge bloom, decays in JS
uniform float uFullR;
uniform float uPoison;    // 0..1 poison saturation of the blood
uniform float uBleed;     // 0..1 bleed intensity (stacks)
uniform float uResL;      // reserved fraction, life
uniform float uResR;      // reserved fraction, mana
uniform float uResLvlL;   // stone boundary height (orb units); >1.5 means none
uniform float uResLvlR;
uniform float uMotion;    // 1.0 normal, lower if reduced motion

out vec4 outColor;

const vec2 ART  = vec2(1672.0, 941.0);
const vec3 ORBL = vec3(541.0, 484.5, 252.0);  // cx, cy(y-up), r in art px
const vec3 ORBR = vec3(1128.0, 483.0, 252.0);
const float INNER = 0.94;                      // inner glass radius

float maxChan(vec3 c){ return max(c.r, max(c.g, c.b)); }

float hash12(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
const mat2 M2 = mat2(0.8, 0.6, -0.6, 0.8);
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){
    if (i >= uOct) break;
    s += a * vnoise(p);
    p = M2 * p * 2.03 + vec2(11.7, 9.3);
    a *= 0.5;
  }
  return s;
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float satur(vec3 c){
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  return (mx - mn) / max(mx, 1e-3);
}
float beatEnv(float ph){
  float f = fract(ph);
  return exp(-f * 7.0) + 0.5 * exp(-pow((f - 0.33) * 9.0, 2.0)); // lub-dub
}

/* ------------------------------ LIFE ------------------------------ */
vec3 lifeLiquid(vec2 p, float surf, float surfFlat){
  float hp    = uHP;
  float low   = smoothstep(0.5, 0.1, hp);
  float vital = smoothstep(0.12, 0.85, hp);
  float beat  = beatEnv(uBeat) * low;
  float t = uTime;

  // double domain warp: opaque billowing cloud, no grid bias
  vec2 q = p * vec2(1.0, 1.22) + vec2(0.0, -t * 0.045);
  q += normalize(p + vec2(1e-4)) * beat * 0.05;
  vec2 w1 = vec2(fbm(q * 1.8 + vec2(0.0,  t * 0.04)),
                 fbm(q * 1.8 + vec2(7.3, -t * 0.05)));
  vec2 q2 = q + (w1 - 0.5) * 1.7;

  // plume density: ridged billow + base, like paint blooming in water
  float b1 = fbm(q2 * 2.3);
  float dN = clamp(b1 * 0.55 + (1.0 - abs(2.0 * b1 - 1.0)) * 0.62 - 0.12, 0.0, 1.0);
  // the same field sampled toward the light: curl edges catch it
  vec2 Ld = vec2(-0.38, 0.925);
  float b2 = fbm((q2 + Ld * 0.075) * 2.3);
  float d2s = clamp(b2 * 0.55 + (1.0 - abs(2.0 * b2 - 1.0)) * 0.62 - 0.12, 0.0, 1.0);
  float lit = clamp((dN - d2s) * 3.2, -1.0, 1.0);
  // a dimmer plume layer drifting behind
  float bF = fbm(q2 * 3.4 + vec2(5.1, 2.7) + vec2(0.0, -t * 0.018));
  float dF = clamp(bF * 0.55 + (1.0 - abs(2.0 * bF - 1.0)) * 0.62 - 0.18, 0.0, 1.0);
  float n1 = dN;
  float n2 = fbm(q2 * 4.4 + (w1 - 0.5) * 2.2 + vec2(t * 0.03, 0.0));  // fine inner cloud

  vec3 deep    = vec3(0.16, 0.005, 0.022);
  vec3 maroon  = mix(vec3(0.27, 0.012, 0.04), vec3(0.42, 0.025, 0.05), vital);
  vec3 crimson = mix(vec3(0.40, 0.03, 0.05),  vec3(0.72, 0.06, 0.06), vital);
  vec3 scarlet = mix(vec3(0.52, 0.05, 0.055), vec3(1.02, 0.16, 0.10), vital);

  // clear medium with the far plumes ghosting through it
  vec3 col = mix(deep * 0.65, crimson * 0.55, smoothstep(0.25, 0.85, dF));
  // near plumes: body, fine detail, then sculpted by the light
  vec3 near = mix(maroon, crimson, smoothstep(0.20, 0.62, dN) * (0.6 + 0.4 * smoothstep(0.3, 0.7, n2)));
  near = mix(near, scarlet, smoothstep(0.52, 0.90, dN) * (0.40 + 0.60 * vital));
  near += scarlet * max(lit, 0.0) * (0.40 + 0.50 * vital);   // sunlit curl edges
  near *= 1.0 - 0.32 * max(-lit, 0.0);                       // shadowed undersides
  col = mix(col, near, smoothstep(0.12, 0.58, dN));

  // subtle vein filaments (ridged, follows the warp — organic, connected)
  float ridge = 1.0 - abs(2.0 * fbm(q2 * 3.3 + vec2(3.1, 1.2)) - 1.0);
  float vein  = pow(smoothstep(0.66, 0.985, ridge), 3.0);
  float bleedDark = 1.0 - 0.35 * uBleed;
  col = mix(col, scarlet * 0.85 + vec3(0.10, 0.0, 0.0), vein * (0.18 + 0.14 * vital));
  col *= bleedDark + (1.0 - bleedDark) * 0.4;            // the whole blood darkens as it bleeds out

  // soft warm glints riding the warped field (replaces the gridded shimmer)
  float gl = pow(smoothstep(0.74, 0.97, fbm(q2 * 8.5 + vec2(0.0, -t * 0.35))), 2.0);
  col += gl * vec3(1.0, 0.30, 0.16) * 0.32 * vital;

  col += scarlet * 0.28 * exp(-length(p - vec2(0.0, surf - 0.55)) * 1.6) * (0.3 + 0.7 * vital);

  float dSurf = max(surf - p.y, 0.0);
  col *= mix(0.62, 1.16, exp(-dSurf * 1.1));            // oxygen-rich near the surface

  // ---- status effects ----
  if (uPoison > 0.01){                                   // sickly green blooms
    float pgn = smoothstep(0.48, 0.85, fbm(q2 * 3.1 + vec2(9.7, 4.4)));
    col = mix(col, vec3(0.14, 0.38, 0.05) * (0.55 + 0.7 * n2), pgn * uPoison * 0.75);
    col += vec3(0.25, 0.6, 0.08) * vein * uPoison * 0.25;
  }
  if (uBleed > 0.01){
    // hemorrhage: heavy dark clouds shearing downward through the blood
    float drip = pow(vnoise(vec2(p.x * 14.0 + w1.x * 4.0, p.y * 2.2 + t * 0.9)), 2.0);
    float clot = smoothstep(0.55, 0.9, fbm(q2 * 2.6 + vec2(4.4, t * 0.25)));
    col = mix(col, vec3(0.075, 0.0, 0.012), drip * uBleed * 0.75 * smoothstep(0.0, 0.3, dSurf + 0.08));
    col = mix(col, vec3(0.14, 0.002, 0.02), clot * uBleed * 0.55);
    // wound-bright seams between the clots
    col += vein * vec3(0.85, 0.06, 0.05) * uBleed * 0.35;
  }

  float ringR = fract(uBeat) * 1.25;
  float ring  = exp(-abs(length(p) - ringR) * 16.0) * low * smoothstep(1.3, 0.4, ringR);
  col += ring * vec3(0.85, 0.10, 0.10) * 0.6;

  col *= 1.0 + beat * 0.55;
  col += exp(-dSurf * 14.0) * vec3(0.9, 0.18, 0.15) * (0.3 + 0.55 * beat + 0.25 * vital)
       * (1.0 - smoothstep(0.72, 0.92, surf));
  return col;
}
vec4 lifeSplash(vec2 p, float surf){
  float low = smoothstep(0.45, 0.08, uHP);
  float boost = clamp(low + uFlashL * 0.9, 0.0, 1.0);
  boost *= smoothstep(0.015, 0.12, uResLvlL - uLvlL);
  if (boost < 0.03 || p.y < surf - 0.02) return vec4(0.0);
  boost *= 1.0 - smoothstep(0.68, 0.88, surf);
  if (boost < 0.03) return vec4(0.0);
  float vital = smoothstep(0.12, 0.85, uHP);
  vec3 body = mix(vec3(0.30, 0.012, 0.03), vec3(0.78, 0.07, 0.05), vital);
  vec3 hi   = vec3(1.0, 0.35, 0.25);
  vec4 acc = vec4(0.0);
  float tt = fract(uBeat);

  // teardrop droplets, stretched along their velocity
  for (int i = 0; i < 7; i++){
    float fi   = float(i);
    float seed = floor(uBeat) + fi * 7.31;
    float h1 = hash12(vec2(seed, fi));
    float h2 = hash12(vec2(seed, fi + 9.2));
    float h3 = hash12(vec2(seed, fi + 3.3));
    float lt = max(tt - h3 * 0.22, 0.0);
    float launch = step(0.001, lt)
                 * step(hash12(vec2(seed, fi + 5.5)), 0.40 + 0.60 * boost);
    float vx = (h2 - 0.5) * 0.7;
    float v0 = 0.45 + 0.55 * h1;
    vec2 pos = vec2(h1 * 1.3 - 0.65 + vx * lt, surf + v0 * lt - 1.6 * lt * lt);
    vec2 vel = vec2(vx, v0 - 3.2 * lt);
    float spd = length(vel) + 1e-3;
    vec2 dir = vel / spd;
    vec2 rel = p - pos;
    float along = dot(rel, dir);
    float perp  = dot(rel, vec2(-dir.y, dir.x));
    float wx = 0.013 + 0.012 * h2;
    float wy = wx * (1.5 + 2.2 * spd);
    float taper = mix(1.0, 0.45, smoothstep(0.0, -wy, along));   // tapering tail
    float dd = length(vec2(perp / (wx * taper), along / wy));
    float mB = smoothstep(1.0, 0.72, dd) * launch;               // crisp edge
    float rim = (smoothstep(1.0, 0.85, dd) - smoothstep(0.78, 0.55, dd)) * launch;
    float fade = smoothstep(1.0, 0.72, tt);
    vec3 c = body + hi * rim * 0.9 + hi * 0.3 * smoothstep(0.45, 0.0, dd);
    float a = mB * fade;
    acc.rgb = mix(acc.rgb, c, a * (1.0 - acc.a));
    acc.a = max(acc.a, a);
  }

  // crown rings breaking into arcs at the impact point
  for (int i = 0; i < 2; i++){
    float fi   = float(i);
    float seed = floor(uBeat) + fi * 3.77;
    float sx = hash12(vec2(seed, 2.2 + fi)) * 1.1 - 0.55;
    float rad = 0.05 + tt * 0.42;
    vec2 rel = p - vec2(sx, surf);
    float ringd = abs(length(rel * vec2(1.0, 1.7)) - rad);
    float seg = step(0.32, vnoise(vec2(atan(rel.y, rel.x) * 3.0 + seed * 7.0, rad * 6.0)));
    float ring = smoothstep(0.020, 0.006, ringd) * step(surf - 0.01, p.y)
               * smoothstep(0.85, 0.25, tt) * seg;
    vec3 c = body * 0.8 + hi * 0.5;
    float a = ring * 0.9;
    acc.rgb = mix(acc.rgb, c, a * (1.0 - acc.a));
    acc.a = max(acc.a, a);
  }
  acc.a = clamp(acc.a * boost, 0.0, 1.0);
  return acc;
}

/* ------------------------------ MANA ------------------------------ */
vec3 manaLiquid(vec2 p, float surf, float surfFlat){
  float mp  = uMP;
  float low = smoothstep(0.45, 0.08, mp);
  float t = uTime;

  // conserve detail: the nebula condenses — folding in on itself rather than squashing
  float fold = smoothstep(0.55, -0.05, surfFlat);
  float span = mix(1.88, max(clamp(surfFlat, -0.94, 0.94) + 0.94, 0.06), fold);
  float vy = (p.y + 0.94) / span;
  vec2 pc = mix(p, vec2(p.x, vy * 1.88 - 0.94), 0.40);   // gentle volumetric compaction
  float dens = 1.0 + 0.85 * fold;                         // overall densification, both axes
  vec2 q = pc * vec2(1.1, 1.25) * dens;
  float drift = mix(1.0, 0.55, fold);                     // condensed mass churns slower
  vec2 warp = vec2(fbm(q * 2.0 + vec2(0.0,  t * 0.05 * drift)),
                   fbm(q * 2.0 + vec2(5.2, -t * 0.04 * drift)));
  vec2 cq = q * 2.3 + warp * (1.6 + 1.6 * fold) + vec2(t * 0.028 * drift, 0.0);
  vec2 fc = cq / dens;                                    // fold at constant screen-space wavelength
  cq += vec2(sin(fc.y * 1.7 + warp.y * 3.2), sin(fc.x * 1.5 - warp.x * 3.2)) * 0.34 * fold;
  float bC = fbm(cq);
  float d = clamp(bC * 0.55 + (1.0 - abs(2.0 * bC - 1.0)) * 0.60 - 0.10, 0.0, 1.0); // billowed plumes

  // moon: floats high in the volume, sinks to the surface as mana drains
  float moonY = mix(surfFlat - 0.06, min(surfFlat - 0.42, 0.35), smoothstep(0.10, 0.6, mp));
  vec2 moon = vec2(0.30 * sin(t * 0.05 + 1.7), moonY);
  moon += vec2(sin(t * 0.9) * 0.014 + sin(t * 0.37 + 2.0) * 0.02,
               sin(t * 1.7 + 1.0) * 0.011);                       // wisp wander
  float wisp = 0.55 + 0.45 * fbm(vec2(t * 0.45, 1.3));            // breathing flicker
  vec2 toM = p - moon;
  float dm = length(toM);
  vec2 nM = toM / max(dm, 1e-4);

  float b2 = fbm(cq - nM * 0.10);                        // toward the moon
  float d2 = clamp(b2 * 0.55 + (1.0 - abs(2.0 * b2 - 1.0)) * 0.60 - 0.10, 0.0, 1.0);
  float lining = clamp((d - d2) * 3.0, 0.0, 1.0) * exp(-dm * 1.4);   // silver linings

  float band = pow(abs(sin((d * 5.0 + pc.y * 1.5 + warp.x) * 3.14159)), mix(12.0, 6.0, fold)); // malachite veins

  float dd   = smoothstep(0.18, 0.85, d);                 // occluding cloud mass
  float occl = pow(clamp(1.0 - dd, 0.0, 1.0), 2.4);       // gaps in the cover
  float moonR = 0.085;
  float disc = smoothstep(moonR * 1.45, moonR * 0.45, dm); // soft, ambiguous edge
  float glow = exp(-dm * 3.4) * (0.10 + 0.90 * occl);      // tight, brooding halo
  float peek = disc * (0.10 + 1.1 * occl) * wisp;          // moon? highlight? wisp?

  float ang  = atan(toM.y, toM.x);
  float gate = smoothstep(0.45, 0.75, fbm(vec2(t * 0.05, 3.7)));     // rays come and go
  float rays = pow(clamp(vnoise(vec2(ang * 4.0 + t * 0.10, dm * 1.5 - t * 0.12)), 0.0, 1.0), 3.0)
             * exp(-dm * 1.1) * (1.0 - d * 0.8) * gate;

  vec3 abyss    = vec3(0.006, 0.012, 0.052);
  vec3 indigo   = vec3(0.050, 0.080, 0.31);
  vec3 sapphire = vec3(0.10, 0.28, 0.85);
  vec3 silver   = vec3(0.75, 0.88, 1.05);

  vec3 col = mix(abyss, indigo, smoothstep(0.15, 0.58, d));
  col = mix(col, sapphire, smoothstep(0.50, 0.85, d) * 0.6);
  vec3 mala = mix(vec3(0.03, 0.46, 0.30), vec3(0.07, 0.30, 0.70), 0.5 + 0.5 * sin(d * 9.0));
  col += band * mala * 0.55;
  float band2 = pow(abs(sin((d * 9.0 - pc.y * 2.0 + warp.y) * 3.14159)), mix(22.0, 9.0, fold));
  col += band2 * vec3(0.10, 0.55, 0.38) * 0.30;

  vec3 moonCol = mix(vec3(1.0, 0.60, 0.34), silver, smoothstep(0.12, 0.5, mp)); // warms at moonset
  col += lining * moonCol * 1.7;
  col += glow * moonCol * 0.6 * wisp + peek * moonCol * 1.15;
  col += rays * vec3(0.55, 0.75, 1.1) * 0.65;

  float dSurf = max(surf - p.y, 0.0);
  col *= mix(0.55, 1.0, exp(-dSurf * 0.9));

  // sunset band hugging the surface when low
  float ws = exp(-abs(surf - p.y) * 5.0);
  col = mix(col, vec3(1.0, 0.45, 0.22) * 1.15, ws * low * 0.6);
  col += ws * low * vec3(1.0, 0.30, 0.42) * 0.18;

  // the flash at the surface
  float cyc = t * 0.45;
  float id  = floor(cyc);
  float happen = step(1.0 - clamp(0.18 + 0.65 * low, 0.0, 0.85), hash12(vec2(id, 4.2)));
  float fx = hash12(vec2(id, 9.1)) * 1.3 - 0.65;
  float ft = fract(cyc);
  float spark = exp(-pow((ft - 0.22) * 6.5, 2.0));
  float flash = exp(-pow((p.x - fx) * 9.0, 2.0)) * exp(-abs(p.y - surf) * 25.0) * spark * happen * (0.35 + low);
  col += flash * vec3(0.45, 1.0, 0.75) * 1.7;

  // arcane flash on big spends: the whole nebula ignites, linings flare,
  // and soft luminous filaments bloom beneath the surface
  float fl = uFlashR;
  if (fl > 0.015){
    col *= 1.0 + fl * 0.8;
    col += lining * silver * fl * 2.2;
    col += pow(1.0 - clamp(d, 0.0, 1.0), 3.0) * silver * fl * 0.5;
    float vein = pow(smoothstep(0.60, 0.94, fbm(p * 6.5 + warp * 2.2 + vec2(0.0, t * 0.7))), 2.0);
    float arcband = exp(-abs(p.y - surf + 0.07) * 22.0);
    col += vein * arcband * vec3(0.65, 0.85, 1.2) * fl * 1.8;
  }

  // glitter: sharp anisotropic micro-sparkles drifting with the nebula
  float glit = 0.0;
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float scl = mix(9.0, 17.0, fi);
    vec2 gm = (q / dens) * scl + warp * 0.35 + vec2(fi * 31.7, -t * (0.22 + fi * 0.16) * drift);
    vec2 cell = floor(gm);
    vec2 md = fract(gm) - 0.5
            - vec2(hash12(cell) - 0.5, hash12(cell + 7.7) - 0.5) * 0.6;
    float sel = step(0.84 - 0.09 * fold, hash12(cell + 1.3));
    float tw = pow(0.5 + 0.5 * sin(t * (1.5 + 3.5 * hash12(cell + 5.1))
                 + hash12(cell + 3.1) * 6.2831), 14.0);            // hard glints
    float pt = exp(-dot(md, md) * (220.0 + 160.0 * fi));
    float cross = exp(-abs(md.x) * 70.0) * exp(-abs(md.y) * 16.0)
                + exp(-abs(md.y) * 70.0) * exp(-abs(md.x) * 16.0); // star flare
    glit += (pt * 1.1 + cross * 0.7 * tw) * sel * tw;
  }
  col += glit * mix(silver, vec3(0.6, 0.95, 1.1), 0.4) * 1.1;
  return col;
}

/* --------------------------- ORB COMPOSITE ------------------------ */
vec3 orbContent(vec2 p, bool life, vec3 empty, float thick, vec3 stoneTex){
  float t = uTime;
  float lvl   = life ? uLvlL  : uLvlR;
  float slosh = life ? uSloshL : uSloshR;
  float res   = life ? uHP : uMP;
  float capLvl = life ? uResLvlL : uResLvlR;
  float capDamp = smoothstep(0.015, 0.12, capLvl - lvl);  // pinned flat against the stone
  float low   = smoothstep(0.5, 0.1, res);
  float beat  = beatEnv(uBeat) * (life ? low : 0.0);

  // animated surface
  float amp = life
    ? mix(0.006, 0.040, low) * (1.0 + beat * 1.3)
    : mix(0.008, 0.022, low);
  amp *= mix(0.10, 1.0, capDamp);
  float wob = amp * (0.6 * sin(p.x * 5.0 - t * 2.2) + 0.4 * sin(p.x * 9.3 + t * 3.7));
  if (!life) wob = amp * (0.6 * sin(p.x * 3.6 - t * 1.1) + 0.4 * sin(p.x * 7.1 + t * 1.9));
  float surf = lvl + wob + slosh * capDamp * (p.x * 0.85 + 0.3 * sin(p.x * 6.0 + t * 9.0));

  vec3 liqAvg = life
    ? mix(vec3(0.30, 0.02, 0.03), vec3(0.95, 0.13, 0.10), smoothstep(0.12, 0.85, res)) * (1.0 + beat * 0.4)
    : mix(vec3(0.20, 0.10, 0.05), vec3(0.16, 0.36, 1.00), smoothstep(0.10, 0.6, res));
  if (life){
    liqAvg = mix(liqAvg, vec3(0.22, 0.50, 0.08), uPoison * 0.55);
    liqAvg *= 1.0 - 0.35 * uBleed;
  }

  float rr = length(p);

  // real empty glass from the plate, washed by the liquid's glow
  vec3 col = empty;
  float wall = smoothstep(0.55, 0.95, rr);
  col += liqAvg * wall * exp(-max(p.y - surf, 0.0) * 2.2) * 0.22 * (0.25 + res);
  col += liqAvg * exp(-max(p.y - surf, 0.0) * 4.0) * 0.10 * res;
  if (!life) col += vec3(1.0, 0.45, 0.25) * exp(-abs(p.y - surf) * 3.5) * low * 0.18
                  + vec3(0.6, 0.8, 1.15) * exp(-max(p.y - surf, 0.0) * 2.5) * uFlashR * 0.6;

  // liquid body, clipped to inner sphere
  float inner = smoothstep(INNER + 0.01, INNER - 0.01, rr);
  float fullKick = life ? uFullL : uFullR;
  float inLiq = smoothstep(0.004, -0.004, p.y - surf) * inner;
  if (inLiq > 0.0){
    vec3 lc = life ? lifeLiquid(p, surf, lvl) : manaLiquid(p, surf, lvl);
    float vital = smoothstep(0.12, 0.85, res);
    lc *= life ? (1.0 + thick * (0.30 * vital - 0.15 * low))
               : (0.84 + 0.34 * thick);
    // topping out: the surface energy dissolves into a gentle whole-orb bloom
    lc *= 1.0 + fullKick * 0.45;
    lc += liqAvg * fullKick * 0.30;
    col = mix(col, lc, inLiq * 0.97);
    // the plate's glass reflections read over the liquid (top only —
    // the pedestal seen through the bottom of the glass stays hidden)
    col += empty * empty * 0.65 * (0.12 + 0.88 * smoothstep(-0.70, -0.05, p.y));
  }

  // anime splash above the surface (low hp, or kicked by big hits)
  if (life){
    vec4 spl = lifeSplash(p, surf);
    col = mix(col, spl.rgb, clamp(spl.a, 0.0, 1.0) * inner);
  }

  // meniscus: front line + dimmer back ellipse edge
  float chord = sqrt(max(1.0 - lvl * lvl, 0.02));
  float inSpan = smoothstep(chord + 0.03, chord - 0.02, abs(p.x));
  float men = exp(-abs(p.y - surf) * 55.0) * inSpan;
  vec3 menCol = life ? vec3(1.0, 0.30, 0.22) : vec3(0.55, 0.85, 1.1);
  float domeFade = 1.0 - smoothstep(0.72, 0.92, lvl);
  col += men * (0.7 + 0.6 * beat) * menCol * (0.45 + 0.55 * res + 0.4 * low) * domeFade;
  col += liqAvg * fullKick * 0.12;

  // ---- reservation: everything above the line is the petrified orb plate ----
  float resAmt = life ? uResL : uResR;
  float resLvl = life ? uResLvlL : uResLvlR;
  if (resAmt > 0.005 && p.y > resLvl - 0.25){
    // the stone is a sphere: its underside bows down toward the middle
    float chordR = sqrt(max(1.0 - resLvl * resLvl, 0.05));
    float midW = 1.0 - clamp(p.x * p.x / (chordR * chordR), 0.0, 1.0);
    float edgeY = resLvl;
    float dEdge = p.y - edgeY;

    // soft contact shadow cast onto the glass/liquid beneath the belly
    col *= 1.0 - 0.24 * exp(-max(-dEdge, 0.0) * 11.0) * (0.4 + 0.6 * midW) * inner;

    vec3 stCol = stoneTex + liqAvg * 0.05;
    // underside falling into shadow as it curves away from the light
    stCol *= 1.0 - 0.42 * exp(-max(dEdge, 0.0) * 11.0) * (0.40 + 0.60 * midW);
    stCol *= 1.0 - 0.15 * exp(-max(dEdge, 0.0) * 3.8) * midW;
    // thin caught-light rim tracing the curved seam
    stCol += vec3(0.32, 0.285, 0.215) * exp(-abs(dEdge) * 95.0) * 0.55;
    col = mix(col, stCol, smoothstep(-0.011, 0.011, dEdge) * inner);
  }

  // ---- bleed: rivulets running down the inside of the empty glass ----
  if (life && uBleed > 0.01 && p.y > surf){
    float colId = floor(p.x * 13.0 + 31.0);
    float colSel = step(0.55, hash12(vec2(colId, 3.7)));
    float head = fract(hash12(vec2(colId, 8.1)) + uTime * (0.05 + 0.08 * hash12(vec2(colId, 5.5))));
    float headY = mix(0.95, surf, head);
    float trail = smoothstep(headY + 0.35, headY, p.y) * step(headY, p.y);
    float lineD = abs(fract(p.x * 13.0 + 31.0) - 0.5);
    float riv = smoothstep(0.10, 0.03, lineD) * colSel * trail * smoothstep(1.0, 0.92, rr);
    float bead = exp(-(pow((p.y - headY) * 30.0, 2.0) + pow(lineD * 26.0, 2.0))) * colSel;
    col = mix(col, vec3(0.16, 0.005, 0.02), clamp(riv * 0.8 + bead, 0.0, 1.0) * uBleed * inner);
    col += vec3(0.5, 0.04, 0.04) * bead * uBleed * 0.5;
  }

  // soft fresnel of the liquid glow on the rim (the plate carries the real glass)
  float rim = pow(smoothstep(0.55, 1.0, rr), 4.0);
  col += rim * liqAvg * 0.30;

  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 art = texture(uArt, uv).rgb;
  float m  = texture(uMask, uv).r;
  vec3 empty = texture(uEmpty, uv).rgb;
  vec2 pack = texture(uPack, uv).rg;
  float thick = smoothstep(0.40, 0.98, pack.r);
  float ao = 0.30 + 0.70 * pack.g;

  // material from the roughness plate: low = skin, high = cloth/hair/pedestal
  float stoneM = smoothstep(0.05, 0.22, luma(art));
  float clothy = smoothstep(0.16, 0.52, pack.g);
  art *= mix(1.0, mix(0.82, 1.07, clothy), stoneM);  // skin darker, marble drapery lighter

  vec2 px = uv * ART;
  vec2 pL = (px - ORBL.xy) / ORBL.z;
  vec2 pR = (px - ORBR.xy) / ORBR.z;
  float rL = length(pL);
  float rR = length(pR);

  // light spill onto statues, pedestals, floor
  float beat = beatEnv(uBeat) * smoothstep(0.5, 0.1, uHP);
  vec3 avgL = mix(vec3(0.30, 0.02, 0.03), vec3(0.95, 0.13, 0.10), smoothstep(0.12, 0.85, uHP)) * (1.0 + beat * 0.5);
  avgL = mix(avgL, vec3(0.22, 0.50, 0.08), uPoison * 0.55);
  avgL *= 1.0 - 0.35 * uBleed;
  vec3 avgR = mix(vec3(0.20, 0.10, 0.05), vec3(0.16, 0.36, 1.00), smoothstep(0.10, 0.6, uMP));
  float lit = 0.3 + 0.7 * luma(art);
  vec3 spill = vec3(0.0);
  spill += avgL * exp(-max(rL - 1.0, 0.0) * 2.6) * (0.10 + 0.3 * uHP) * (1.0 + smoothstep(0.0, -0.6, pL.y) * 0.7);
  spill += avgR * exp(-max(rR - 1.0, 0.0) * 2.6) * (0.10 + 0.3 * uMP) * (1.0 + smoothstep(0.0, -0.6, pR.y) * 0.7);
  vec3 base = art + spill * lit;

  // normal-mapped relighting of the stone
  float stone = stoneM * (1.0 - max(smoothstep(1.03, 0.99, rL), smoothstep(1.03, 0.99, rR)) * m);
  if (stone > 0.001){
    vec3 nrm = normalize(texture(uNorm, uv).rgb * 2.0 - 1.0);
    float inOrb = max(smoothstep(1.02, 0.98, rL), smoothstep(1.02, 0.98, rR));
    nrm = normalize(mix(nrm, vec3(0.0, 0.0, 1.0), inOrb * 0.8));   // hands over glass: soften

    // point light per orb (in front of the glass)
    vec3 fragP = vec3(px, 0.0);
    vec3 lp1 = vec3(ORBL.x, ORBL.y + clamp(uLvlL, -0.94, 0.94) * ORBL.z * 0.65, 170.0);
    vec3 lp2 = vec3(ORBR.x, ORBR.y + clamp(uLvlR, -0.94, 0.94) * ORBR.z * 0.65, 170.0);
    vec3 l1 = normalize(lp1 - fragP);
    vec3 l2 = normalize(lp2 - fragP);
    float fall1 = exp(-max(rL - 1.0, 0.0) * 1.7);
    float fall2 = exp(-max(rR - 1.0, 0.0) * 1.7);
    float i1 = (0.25 + 0.95 * uHP) * (1.0 + beat * 1.6) + uFlashL * 2.6 + uFullL * 1.8;
    float i2 = (0.30 + 0.85 * uMP) + uFlashR * 2.6 + uFullR * 1.8;

    vec3 dl = (avgL * max(dot(nrm, l1), 0.0) * fall1 * i1
             + avgR * max(dot(nrm, l2), 0.0) * fall2 * i2) * ao;

    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 h1 = normalize(l1 + V);
    vec3 h2 = normalize(l2 + V);
    float shin  = mix(64.0, 14.0, clothy);   // skin: tight polished glints
    float gloss = mix(1.30, 0.50, clothy);   // cloth: subdued, matte
    float s1 = pow(max(dot(nrm, h1), 0.0), shin) * fall1 * (0.55 * i1) * gloss;
    float s2 = pow(max(dot(nrm, h2), 0.0), shin) * fall2 * (0.55 * i2) * gloss;
    vec3 spc = ((avgL * 0.5 + vec3(0.5)) * s1 + (avgR * 0.5 + vec3(0.5)) * s2) * ao;

    // slow travelling sheen: tight on polished skin, broad and soft on rough marble
    vec3 sd = normalize(vec3(cos(uTime * 0.22), 0.45 + 0.25 * sin(uTime * 0.13), 0.62));
    float sheenPow = mix(9.0, 4.0, clothy);
    float sheen = pow(max(dot(nrm, sd), 0.0), sheenPow)
                * (0.16 + 0.10 * sin(uTime * 0.22 + px.x * 0.004)) * ao
                * mix(1.0, 1.25, clothy);
    vec3 shc = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.88, 0.66), clothy) * sheen;

    base += (dl * (0.45 + 0.55 * luma(art)) + spc + shc) * stone;
  }

  vec3 col = base;
  float aL = m * smoothstep(1.015, 0.995, rL);
  float aR = m * smoothstep(1.015, 0.995, rR);
  vec3 stoneTex = texture(uStone, uv).rgb;
  if (aL > 0.001) col = mix(col, orbContent(pL, true,  empty, thick, stoneTex), aL);
  if (aR > 0.001) col = mix(col, orbContent(pR, false, empty, thick, stoneTex), aR);

  // gentle tone + grain
  col = col / (1.0 + col * 0.10);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.012;

  float orbAlpha = max(aL, aR);

  // The statue plate is a JPEG photographed over black: its silhouette
  // pixels are statue-times-alpha (a black matte), and JPEG noise pits the
  // key. Close pinholes with a tiny neighborhood max, key on a tight
  // near-black band so internal shadows stay opaque, then UN-MATTE — divide
  // the black-multiplied colour back out at partial alpha. Without that
  // division, semi-transparent edges composite as a dark fringe on any
  // light background.
  vec2 texel = 1.0 / vec2(textureSize(uArt, 0));
  float mv = maxChan(art);
  mv = max(mv, maxChan(texture(uArt, uv + vec2(texel.x, 0.0)).rgb));
  mv = max(mv, maxChan(texture(uArt, uv - vec2(texel.x, 0.0)).rgb));
  mv = max(mv, maxChan(texture(uArt, uv + vec2(0.0, texel.y)).rgb));
  mv = max(mv, maxChan(texture(uArt, uv - vec2(0.0, texel.y)).rgb));
  float artAlpha = smoothstep(0.06, 0.18, mv);
  float alpha = clamp(max(orbAlpha, artAlpha), 0.0, 1.0);

  float edge = (1.0 - orbAlpha) * smoothstep(0.995, 0.35, alpha);
  col = mix(col, col / max(alpha, 0.28), edge * step(0.02, alpha));

  outColor = vec4(col, alpha);
}
