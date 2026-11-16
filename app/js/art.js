/* ------------------------------------------------------------------
   art.js — inline SVG art for the window panel. No images, no numbers.
   Avatar (5 moods + a calm, supportive variant), goal scenes that fill
   from grey to colour, emergency-fund shield, vault tiers, loan weight.
   ------------------------------------------------------------------ */

const SCENE_SKY = {
  thriving: { sky: "#bfe3ff", ground: "#8fcf8a", deco: "sun" },
  happy:    { sky: "#d2ebff", ground: "#a3d49e", deco: "sun" },
  okay:     { sky: "#e3edf4", ground: "#b7d2b2", deco: "suncloud" },
  worried:  { sky: "#d9dee4", ground: "#b5c2b1", deco: "cloud" },
  stressed: { sky: "#c9ced5", ground: "#a8b1a6", deco: "cloud2" },
  calm:     { sky: "#d9ecf0", ground: "#b3cfc8", deco: "none" },
};

/* ---------- goal artwork, each drawn in a 140 x 60 box ---------- */
const GOAL_ART = {
  car: `
    <path d="M1,25 h13 v3 h-9 v6 h-4 z" fill="#35505f"/>
    <path d="M4,42 L9,31 Q30,25 47,23 L63,12 Q79,6 97,10 L113,21 Q129,25 134,31 L137,41 Q137,45 132,45 L8,45 Q4,45 4,42 Z" fill="#4aa8d8"/>
    <path d="M65,14 Q79,9 95,12 L105,21 L59,22 Z" fill="#e3f4fb"/>
    <rect x="9" y="36" width="124" height="3.5" fill="#f08a24"/>
    <circle cx="80" cy="29" r="6" fill="#ffffff"/>
    <ellipse cx="132" cy="33" rx="3" ry="2.2" fill="#fff3b0"/>
    <rect x="4" y="33" width="5" height="3" rx="1" fill="#d8372e"/>
    <circle cx="32" cy="45" r="10" fill="#2b2b2b"/><circle cx="32" cy="45" r="4.5" fill="#cfd4d8"/>
    <circle cx="108" cy="45" r="10" fill="#2b2b2b"/><circle cx="108" cy="45" r="4.5" fill="#cfd4d8"/>`,
  vacation: `
    <circle cx="122" cy="12" r="8" fill="#e8413a"/>
    <path d="M18,56 L62,10 L106,56 Z" fill="#6b8fd6"/>
    <path d="M51,22 L62,10 L73,22 L67,27 L62,22 L57,27 Z" fill="#ffffff"/>
    <rect x="112" y="32" width="4" height="24" fill="#d8372e"/><rect x="128" y="32" width="4" height="24" fill="#d8372e"/>
    <rect x="106" y="27" width="32" height="4" rx="1" fill="#d8372e"/><rect x="109" y="36" width="26" height="3" fill="#d8372e"/>
    <rect x="9" y="38" width="3" height="18" fill="#7a5236"/>
    <circle cx="10" cy="31" r="9" fill="#f6a5c0"/><circle cx="3" cy="37" r="5" fill="#f6a5c0"/><circle cx="18" cy="36" r="6" fill="#f6a5c0"/>
    <rect x="0" y="55" width="140" height="3" fill="#7fb77e"/>`,
  other: `
    <rect x="50" y="26" width="40" height="30" rx="3" fill="#7b61d6"/>
    <rect x="46" y="18" width="48" height="10" rx="2" fill="#9179e6"/>
    <rect x="67" y="18" width="6" height="38" fill="#ffd166"/>
    <circle cx="63" cy="14" r="6" fill="none" stroke="#ffd166" stroke-width="3"/><circle cx="77" cy="14" r="6" fill="none" stroke="#ffd166" stroke-width="3"/>
    <path d="M112,8 l2.5,6 6.5,0.5 -5,4.2 1.6,6.3 -5.6,-3.5 -5.6,3.5 1.6,-6.3 -5,-4.2 6.5,-0.5 z" fill="#ffd166"/>`,
};

const CHECK_BADGE = `<circle r="9" fill="#1a9c6b" stroke="#ffffff" stroke-width="2"/><path d="M-4,0 l3,3.2 l5.5,-6" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;

// The unfinished part is a greyscale copy; the finished part is a colour copy clipped by percent saved.
function goalArt(type, pctSaved, done, id, gsFilter) {
  const art = GOAL_ART[type] || GOAL_ART.other;
  const w = 140 * clamp(done ? 1 : pctSaved, 0, 1);
  return `
    <clipPath id="${id}"><rect x="0" y="-4" width="${w.toFixed(1)}" height="68" data-anim="${id}" data-prop="width" data-to="${w.toFixed(1)}px"/></clipPath>
    <g filter="url(#${gsFilter})" opacity="0.5">${art}</g>
    <g clip-path="url(#${id})">${art}</g>
    ${done ? `<g transform="translate(44 4)"><g class="pop-in">${CHECK_BADGE}</g></g>` : ""}`;
}

/* ---------- avatar, drawn in an 80 x 112 box ---------- */
function avatarParts(mood) {
  const skin = "#ffcf5c", edge = "#e3a934", hair = "#3b2f2f", ink = "#2d2a26";
  const top = mood === "calm" ? "#0f6a8a" : "#d5002b";
  const arms = {
    thriving: [["M25,57 Q9,45 8,27", 8, 27], ["M55,57 Q71,45 72,27", 72, 27]],
    happy:    [["M25,58 Q13,67 13,81", 13, 81], ["M55,57 Q70,53 72,38", 72, 38]],
    okay:     [["M25,58 Q14,69 15,83", 15, 83], ["M55,58 Q66,69 65,83", 65, 83]],
    worried:  [["M25,58 Q15,67 21,79", 21, 79], ["M55,58 Q68,62 54,49", 54, 49]],
    stressed: [["M25,57 Q5,47 21,24", 21, 24], ["M55,57 Q75,47 59,24", 59, 24]],
    calm:     [["M25,58 Q14,69 15,83", 15, 83], ["M55,58 Q65,71 47,67", 47, 67]],
  }[mood];
  const brows = {
    thriving: "", happy: "", okay: "",
    worried: `<path d="M28,23 L36,20 M44,20 L52,23" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    stressed: `<path d="M27,24 L37,19 M43,19 L53,24" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    calm: `<path d="M29,22 Q33,19.5 36,21 M44,21 Q47,19.5 51,22" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
  }[mood];
  const eyes = {
    thriving: `<path d="M29,28 q4,-5 8,0 M43,28 q4,-5 8,0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`,
    stressed: `<circle cx="33" cy="28" r="3.6" fill="#ffffff" stroke="${ink}" stroke-width="1"/><circle cx="47" cy="28" r="3.6" fill="#ffffff" stroke="${ink}" stroke-width="1"/><circle cx="33" cy="28.5" r="1.5" fill="${ink}"/><circle cx="47" cy="28.5" r="1.5" fill="${ink}"/>`,
  }[mood] || `<circle cx="33" cy="28" r="2.3" fill="${ink}"/><circle cx="47" cy="28" r="2.3" fill="${ink}"/>`;
  const mouth = {
    thriving: `<path d="M31,35 Q40,47 49,35 Z" fill="#8a2f2f" stroke="${ink}" stroke-width="1"/>`,
    happy: `<path d="M32,35 Q40,43 48,35" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`,
    okay: `<path d="M34,37.5 Q40,40 46,37.5" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    worried: `<path d="M34,40 Q40,35.5 46,40" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    stressed: `<path d="M32,40 q4,-4 8,0 q4,4 8,0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    calm: `<path d="M35,37.5 Q40,40.5 45,37.5" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
  }[mood];
  const drop = (x, y) => `<path d="M${x},${y} q3.2,5.2 0,8.2 q-3.2,-3 0,-8.2 z" fill="#6bb8f0"/>`;
  const spark = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0,-5 L1.5,-1.5 L5,0 L1.5,1.5 L0,5 L-1.5,1.5 L-5,0 L-1.5,-1.5 Z" fill="#ffc531"/>`;
  const extras = {
    thriving: spark(4, 12) + spark(76, 10, 0.8) + spark(72, 56, 0.7) + spark(10, 52, 0.6),
    happy: "", okay: "",
    worried: drop(62, 15),
    stressed: drop(63, 13) + drop(15, 15),
    calm: `<path d="M40,60 c-2.6,-3.6 -8,-0.8 -5,3.4 l5,4.6 l5,-4.6 c3,-4.2 -2.4,-7 -5,-3.4 z" fill="#f7a8c0"/>`,
  }[mood];
  const cheeks = mood === "thriving" || mood === "happy" ? `<circle cx="27" cy="34" r="3" fill="#ff9d7a" opacity="0.55"/><circle cx="53" cy="34" r="3" fill="#ff9d7a" opacity="0.55"/>` : "";
  return `
    <ellipse cx="40" cy="108" rx="24" ry="3.5" fill="#000000" opacity="0.12"/>
    <rect x="29" y="84" width="9" height="20" rx="3" fill="#37474f"/><rect x="42" y="84" width="9" height="20" rx="3" fill="#37474f"/>
    <ellipse cx="32.5" cy="105" rx="7" ry="3.2" fill="#263238"/><ellipse cx="47.5" cy="105" rx="7" ry="3.2" fill="#263238"/>
    <rect x="22" y="48" width="36" height="42" rx="13" fill="${top}"/>
    ${extras && mood === "calm" ? extras : ""}
    ${arms.map(([d, hx, hy]) => `<path d="${d}" fill="none" stroke="${top}" stroke-width="8" stroke-linecap="round"/><circle cx="${hx}" cy="${hy}" r="5" fill="${skin}" stroke="${edge}" stroke-width="1"/>`).join("")}
    <circle cx="40" cy="28" r="20" fill="${skin}" stroke="${edge}" stroke-width="1.5"/>
    <path d="M20.5,25 Q23,6 40,6.5 Q57,6 59.5,25 Q51,14 40,15 Q29,14 20.5,25 Z" fill="${hair}"/>
    ${cheeks}${brows}${eyes}${mouth}
    ${mood === "calm" ? "" : extras}`;
}

function avatarSvg(mood, { size = 80, calm = false } = {}) {
  const m = calm && (mood === "stressed" || mood === "worried") ? "calm" : mood;
  return `<svg class="avatar-svg" viewBox="0 0 80 112" width="${size}" height="${size * 1.4}" role="img" aria-label="Avatar looking ${m === "calm" ? "concerned and supportive" : m}"><g data-pop="avatar-solo" data-val="${m}">${avatarParts(m)}</g></svg>`;
}

/* ---------- emergency fund: shield, partial shield, or warning (36 x 42 box) ---------- */
const SHIELD_PATH = "M18,2 L33,8 V20 C33,30 26,37 18,40 C10,37 3,30 3,20 V8 Z";
function shieldParts(state, pctFunded, id) {
  if (state === "warning") {
    return `<path d="M18,4 L34,37 H2 Z" fill="#f4b400" stroke="#b07d00" stroke-width="2" stroke-linejoin="round"/><rect x="16.4" y="14" width="3.2" height="13" rx="1.6" fill="#3b2f00"/><circle cx="18" cy="32" r="2" fill="#3b2f00"/>`;
  }
  if (state === "full") {
    return `<path d="${SHIELD_PATH}" fill="#1a9c6b" stroke="#127a53" stroke-width="2" stroke-linejoin="round"/><path d="M11,21 l5,5.2 l9.5,-10.5" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const y = 2 + 38 * (1 - clamp(pctFunded, 0, 1));
  return `
    <clipPath id="${id}"><rect x="0" y="${y.toFixed(1)}" width="36" height="42" data-anim="${id}" data-prop="y" data-to="${y.toFixed(1)}px"/></clipPath>
    <path d="${SHIELD_PATH}" fill="#eef1f4" stroke="#7a8794" stroke-width="2" stroke-linejoin="round"/>
    <path d="${SHIELD_PATH}" fill="#35b384" clip-path="url(#${id})"/>
    <path d="${SHIELD_PATH}" fill="none" stroke="#7a8794" stroke-width="2" stroke-linejoin="round"/>`;
}
function shieldSvg(state, pctFunded, size = 30) {
  return `<svg viewBox="0 0 36 42" width="${size}" height="${size * 42 / 36}" role="img" aria-label="Emergency fund ${state === "full" ? "fully funded" : state === "warning" ? "below a quarter" : "partly funded"}">${shieldParts(state, pctFunded, "sh-solo-" + Math.round(pctFunded * 1000))}</svg>`;
}

/* ---------- vault: 4 tiers by total savings, plus the loan weight (100 x 76 box) ---------- */
function vaultParts(tier, loanRatio, showVault, showLoan) {
  const coin = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="3.6" fill="#f2c230" stroke="#c79a14" stroke-width="1"/><ellipse cx="${x}" cy="${y - 1.4}" rx="8" ry="3.6" fill="#ffd95a" stroke="#c79a14" stroke-width="1"/>`;
  const note = (x, y) => `<rect x="${x}" y="${y}" width="32" height="8" rx="1.5" fill="#7cc47c" stroke="#4d9a4d" stroke-width="1"/><circle cx="${x + 16}" cy="${y + 4}" r="2.4" fill="#4d9a4d" opacity="0.6"/>`;
  const bar = (x, y) => `<path d="M${x},${y} l4,-10 h14 l4,10 z" fill="#f2c230" stroke="#c79a14" stroke-width="1"/><path d="M${x + 5},${y - 8} h12" stroke="#fff3b0" stroke-width="1.6" stroke-linecap="round"/>`;
  const gem = (x, y) => `<path d="M${x},${y - 5} l4.5,5 l-4.5,5.5 l-4.5,-5.5 z" fill="#7ee0f5" stroke="#37b5d1" stroke-width="1"/>`;
  const items = [
    "",
    coin(12, 70) + coin(26, 72) + coin(19, 64),
    note(2, 64) + note(5, 57) + note(3, 50) + coin(40, 72),
    bar(0, 74) + bar(19, 74) + bar(9.5, 63) + note(2, 46),
    `<path d="M2,56 Q20,34 38,56 Z" fill="#a66e37" stroke="#5e3c1a" stroke-width="1.2"/><ellipse cx="20" cy="56" rx="16" ry="5" fill="#ffd95a" stroke="#c79a14" stroke-width="1"/>${gem(12, 50)}${gem(27, 49)}${gem(20, 44)}<rect x="2" y="56" width="36" height="18" rx="3" fill="#8b5a2b" stroke="#5e3c1a" stroke-width="1.2"/><rect x="17" y="60" width="6" height="7" rx="1" fill="#f2c230"/>${coin(46, 73)}`,
  ][clamp(tier, 1, 4)];
  const r = 5 + 10 * clamp(loanRatio, 0, 1);
  const weight = showLoan && loanRatio > 0 ? `
    <g class="loan-weight" data-pop="loan" data-val="${Math.round(loanRatio * 20)}">
      <path d="M82,62 Q93,${64 - r} 88,${73 - 2 * r}" fill="none" stroke="#3a3f45" stroke-width="${(2 + 1.6 * loanRatio).toFixed(1)}" stroke-dasharray="3.2 2.4" stroke-linecap="round"/>
      <circle cx="88" cy="${74 - r}" r="${r.toFixed(1)}" fill="#3a3f45"/>
      <circle cx="${(88 - r * 0.35).toFixed(1)}" cy="${(74 - r * 1.35).toFixed(1)}" r="${(r * 0.22).toFixed(1)}" fill="#7d858d"/>
    </g>` : "";
  const safe = `
    <rect x="42" y="66" width="8" height="6" fill="#4f5b66"/><rect x="82" y="66" width="8" height="6" fill="#4f5b66"/>
    <rect x="36" y="6" width="60" height="62" rx="7" fill="#6c7a89"/>
    <rect x="42" y="12" width="48" height="50" rx="5" fill="#8a99a8"/>
    <circle cx="66" cy="37" r="11" fill="#d5dde4" stroke="#4f5b66" stroke-width="2"/>
    <path d="M66,28 V46 M57,37 H75" stroke="#4f5b66" stroke-width="2" stroke-linecap="round"/>`;
  return showVault ? `${safe}<g data-pop="vault" data-val="${tier}">${items}</g>${weight}` : weight;
}

/* ---------- the whole window scene (340 x 200) ---------- */
function sceneSvg(fv, { show, calm = false, uid = "w" }) {
  const raw = fv.mood.mood;
  const mood = calm && (raw === "stressed" || raw === "worried") ? "calm" : raw;
  const sk = SCENE_SKY[mood];
  const gs = `gs-${uid}`;
  const cloud = (x, y, s, fill) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}"><ellipse cx="0" cy="0" rx="20" ry="9"/><ellipse cx="-12" cy="-5" rx="11" ry="8"/><ellipse cx="7" cy="-8" rx="13" ry="10"/></g>`;
  const sun = `<circle cx="296" cy="30" r="15" fill="#ffd54a"/><circle cx="296" cy="30" r="21" fill="#ffd54a" opacity="0.25"/>`;
  const deco = { sun, suncloud: sun + cloud(282, 40, 0.9, "#ffffff"), cloud: cloud(286, 32, 1, "#f1f3f5") + cloud(226, 22, 0.6, "#f1f3f5"), cloud2: cloud(284, 32, 1.05, "#aab1b9") + cloud(222, 24, 0.7, "#b7bdc4"), none: cloud(292, 28, 0.7, "#ffffff") }[sk.deco];
  const hero = fv.hero;
  const heroIsCar = hero && hero.type === "car";
  const road = heroIsCar && show.hero ? `<rect x="0" y="150" width="340" height="14" fill="#8d959c"/><path d="M8,157 H332" stroke="#eef0f2" stroke-width="1.6" stroke-dasharray="12 10"/>` : "";
  // data-pop always sits on an inner group with no transform attribute, so the pop animation cannot move it
  const heroArt = hero && show.hero ? `<g transform="translate(8 ${heroIsCar ? 102 : 96})"><g data-pop="hero-done" data-val="${hero.done ? 1 : 0}">${goalArt(hero.type, hero.pct, hero.done, `clip-hero-${uid}`, gs)}</g></g>` : "";
  const others = show.others ? fv.others.map((g, i) => `
    <g transform="translate(${60 + i * 56} 12) rotate(${i % 2 ? 4 : -4} 25 18)">
      <rect x="0" y="0" width="50" height="36" rx="3" fill="#ffffff" stroke="#c9ced3" stroke-width="1"/>
      <g transform="translate(3.5 6) scale(0.307)">${goalArt(g.type, g.pct, g.done, `clip-o${i}-${uid}`, gs)}</g>
    </g>`).join("") : "";
  const shield = show.shield ? `<g transform="translate(12 10)"><g data-pop="shield" data-val="${fv.shield}">${shieldParts(fv.shield, fv.snap.ef.pct, `clip-sh-${uid}`)}</g></g>` : "";
  const vault = show.vault || show.loan ? `<g transform="translate(236 98)">${vaultParts(fv.vaultTier, fv.loanRatio, show.vault, show.loan)}</g>` : "";
  const avatar = show.avatar ? `<g transform="translate(132 70)" data-action="avatar-tap" class="tap"><g data-pop="avatar" data-val="${mood}">${avatarParts(mood)}</g><rect x="6" y="2" width="68" height="108" fill="transparent"/></g>` : "";
  const bubble = calm && show.avatar ? `
    <g data-action="calm-talk" class="tap bubble">
      <path d="M188,36 h134 a8,8 0 0 1 8,8 v16 a8,8 0 0 1 -8,8 h-116 l-12,11 l3,-11 h-9 a8,8 0 0 1 -8,-8 v-16 a8,8 0 0 1 8,-8 z" fill="#ffffff" stroke="#0f6a8a" stroke-width="1.5"/>
      <text x="255" y="56" text-anchor="middle" font-size="10.5" font-weight="600" fill="#0f6a8a">Want to talk to someone?</text>
    </g>` : "";
  const label = `Window onto your money: avatar looks ${mood === "calm" ? "concerned and supportive" : mood}`;
  return `
    <svg class="scene" viewBox="0 0 340 200" width="100%" role="img" aria-label="${label}" data-action="open-main">
      <defs><filter id="${gs}"><feColorMatrix type="saturate" values="0"/></filter></defs>
      <rect width="340" height="200" fill="${sk.sky}"/>
      ${calm ? "" : deco}
      <rect x="0" y="146" width="340" height="54" fill="${sk.ground}"/>
      ${road}${heroArt}${others}${shield}${vault}${avatar}${bubble}
    </svg>`;
}
