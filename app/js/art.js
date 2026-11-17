/* ------------------------------------------------------------------
   art.js — the window panel, composed from the generated images in
   app/img (one PNG per piece, see docs/ART_ASSETS.md). The numbers
   decide which image shows, how far it is filled, and where it sits;
   all motion is CSS (styles.css, "window scene" section).
   ------------------------------------------------------------------ */

const IMG = "img/";
const img = (file, x, y, w, h, attrs = "") => `<image href="${IMG}${file}.png" x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;

/* frame sequence: every frame stacked in place, CSS shows one at a time.
   `--i` is the frame index. The avatar is never animated. */
const frames = (base, n, x, y, w, h) => Array.from({ length: n }, (_, i) =>
  img(`${base}-${String(i + 1).padStart(2, "0")}`, x, y, w, h, `class="fr" style="--i:${i}"`)).join("");

/* ---------- avatar: male or female set, 6 moods (320 x 448 images) ---------- */
let AVATAR_SET = "f"; // "m" | "f", chosen in the window's customise menu
const avatarMood = (mood, calm) => calm && (mood === "stressed" || mood === "worried") ? "calm" : mood;
const avatarLabel = m => `Avatar looking ${m === "calm" ? "concerned and supportive" : m}`;

function avatarSvg(mood, { size = 80, calm = false } = {}) {
  const m = avatarMood(mood, calm);
  return `<svg class="avatar-svg" viewBox="0 0 80 112" width="${size}" height="${size * 1.4}" role="img" aria-label="${avatarLabel(m)}">${img(`avatar-${AVATAR_SET}-${m}`, 0, 0, 80, 112)}</svg>`;
}

/* ---------- protection shields (144 x 168 images, drawn in a 36 x 42 box) ---------- */
// emergency fund: warning below a quarter, otherwise the green fill rises over the grey base
function emergencyShield(state, pctFunded, id) {
  if (state === "warning") return img("shield-emergency-warning", 0, 0, 36, 42);
  const y = 2 + 38 * (1 - clamp(pctFunded, 0, 1));
  return `${img("shield-emergency-empty", 0, 0, 36, 42)}
    <clipPath id="${id}"><rect x="0" y="${y.toFixed(1)}" width="36" height="42" data-anim="${id}" data-prop="y" data-to="${y.toFixed(1)}px"/></clipPath>
    <g clip-path="url(#${id})">${img("shield-emergency-fill", 0, 0, 36, 42)}</g>
    ${state === "full" ? "" : WARN_BADGE}`;
}
// red "!" badge, top-right of a 36 x 42 shield: shown whenever the protection is not complete
const WARN_BADGE = `<g class="warn-badge"><circle cx="29" cy="8" r="6.5" fill="#e11d2e" stroke="#ffffff" stroke-width="1.5"/><rect x="28" y="4" width="2" height="5.2" rx="1" fill="#ffffff"/><circle cx="29" cy="11.2" r="1.1" fill="#ffffff"/></g>`;
function shieldSvg(state, pctFunded, size = 30) {
  const label = `Emergency fund ${state === "full" ? "fully funded" : state === "warning" ? "below a quarter" : "partly funded"}`;
  return `<svg class="${state === "full" ? "protected" : ""}" viewBox="0 0 36 42" width="${size}" height="${size * 42 / 36}" role="img" aria-label="${label}">${emergencyShield(state, pctFunded, "sh-solo-" + Math.round(pctFunded * 1000))}</svg>`;
}

/* ---------- goals ---------- */
const HERO_GOAL_TYPES = new Set(["car", "house", "bike"]); // have their own picture
const COIN_KEYS = new Set(["entertainment", "electronics", "travel", "education", "gift", "tech", "home", "health", "wedding", "baby", "pet"]);
const COIN_HUE = {
  entertainment: "#e34948", electronics: "#2a78d6", travel: "#1baf7a", education: "#6250d6", gift: "#e87ba4", tech: "#1e9e5a",
  home: "#eda100", health: "#1b9ea6", wedding: "#d6468f", baby: "#f0a23a", pet: "#eb6834", generic: "#c79a14",
};
const coinKey = goal => COIN_KEYS.has(goal.cat) ? goal.cat : "generic";

// goal picture: grey base, colour copy revealed left to right by % saved
function goalPicture(goal, x, y, w, h, id, gs) {
  const cw = w * clamp(goal.done ? 1 : goal.pct, 0, 1);
  return `
    <g filter="url(#${gs})">${img("goal-" + goal.type, x, y, w, h)}</g>
    <clipPath id="${id}"><rect x="${x}" y="${y}" width="${cw.toFixed(1)}" height="${h}" data-anim="${id}" data-prop="width" data-to="${cw.toFixed(1)}px"/></clipPath>
    <g clip-path="url(#${id})">${img("goal-" + goal.type, x, y, w, h)}</g>
    ${goal.done ? `<g class="pop-in">${img("check-badge", x + w / 2 - 9, y - 6, 18, 18)}</g>` : ""}`;
}

// holiday trip: one picture near the top, grey base with colour revealed left to right by % saved
function tripPicture(goal, id, gs) {
  const x = 128, y = 6, w = 76, h = 53, p = clamp(goal.done ? 1 : goal.pct, 0, 1);
  return `
    <g filter="url(#${gs})">${img("trip-destination", x, y, w, h)}</g>
    <clipPath id="${id}"><rect x="${x}" y="${y}" width="${(w * p).toFixed(1)}" height="${h}" data-anim="${id}" data-prop="width" data-to="${(w * p).toFixed(1)}px"/></clipPath>
    <g clip-path="url(#${id})">${img("trip-destination", x, y, w, h)}</g>
    ${goal.done ? `<g class="pop-in">${img("check-badge", x + w - 12, y - 2, 16, 16)}</g>` : ""}
    <title>${esc(goal.name)} · ${goal.done ? "achieved" : Math.round(p * 100) + "% saved"}</title>`;
}

// any other goal: its category coin, floating with a glow in the coin's colour
const COIN_ANCHORS = [[82, 128], [254, 126], [32, 156], [304, 104], [150, 76]];
const COIN_ANCHORS_LEFT = [[82, 128], [32, 158], [40, 96], [106, 82]]; // used when a picture goal takes the right side
const COIN_R = 19;
function floatCoin(goal, i, uid, gs, anchors = COIN_ANCHORS) {
  const key = coinKey(goal), [cx, cy] = anchors[i % anchors.length];
  const p = clamp(goal.done ? 1 : goal.pct, 0, 1), id = `clip-coin-${goal.id}-${uid}`, y = (cy + COIN_R - 2 * COIN_R * p).toFixed(1);
  const coin = img("coin-" + key, cx - COIN_R, cy - COIN_R, 2 * COIN_R, 2 * COIN_R);
  return `<g class="fcoin ${goal.done ? "achieved" : ""}" style="--glow:${COIN_HUE[key]};animation-delay:${(-i * 1.1).toFixed(1)}s" data-action="open-goal" data-id="${esc(goal.id)}">
    <g filter="url(#${gs})">${coin}</g>
    <clipPath id="${id}"><rect x="${cx - COIN_R}" y="${y}" width="${2 * COIN_R}" height="${2 * COIN_R}" data-anim="${id}" data-prop="y" data-to="${y}px"/></clipPath>
    <g clip-path="url(#${id})">${coin}</g>
    ${goal.done ? `<g class="pop-in">${img("check-badge", cx + 7, cy - 22, 15, 15)}</g>` : ""}
    <title>${esc(goal.name)} · ${goal.done ? "achieved" : Math.round(p * 100) + "% saved"}</title></g>`;
}

/* ---------- background: one of five illustrated scenes, chosen by the customer.
   Each already has its own sky, so mood only adds a light tint (and sparkles when thriving). ---------- */
const BACKGROUNDS = [["abstract", "Abstract"], ["beach", "Beach"], ["city", "City"], ["countryside", "Countryside"], ["forest", "Forest"]];
let SCENE_BG = "abstract"; // set by app.js: random on first visit, then whatever the customer picks
const SCENE_MOOD = {
  thriving: { tint: "#ffd76a", a: 0.14, sun: true, clouds: 0, sparkles: true },
  happy:    { tint: "#ffffff", a: 0.10, sun: true, clouds: 1 },
  okay:     { tint: "#ffffff", a: 0,    sun: true, clouds: 2 },
  worried:  { tint: "#6f7391", a: 0.16, sun: false, clouds: 2 },
  stressed: { tint: "#3d4160", a: 0.30, sun: false, clouds: 3, dark: true },
  calm:     { tint: "#7fd0cf", a: 0.16, sun: false, clouds: 1 },
};
function backdrop(mood) {
  const m = SCENE_MOOD[mood];
  const sparkles = m.sparkles ? [[104, 96, 11], [232, 84, 9], [258, 162, 8], [54, 118, 8]]
    .map(([x, y, s], i) => `<g class="twinkle" style="animation-delay:${(i * 0.45).toFixed(2)}s">${img("bg-sparkle", x, y, s, s)}</g>`).join("") : "";
  return `${img("bg-" + SCENE_BG, 0, 0, 340, 270, `preserveAspectRatio="xMidYMid slice"`)}
    <rect width="340" height="270" fill="${m.tint}" opacity="${m.a}"/>${sparkles}`;
}

/* ---------- the whole window scene (340 x 270: taller, so every piece is drawn larger) ---------- */
function sceneSvg(fv, { show, calm = false, uid = "w", insured = true, quests = null, tapAvatar = true, frame = false }) {
  const mood = avatarMood(fv.mood.mood, calm);
  const gs = `gs-${uid}`;
  const hero = fv.hero, goals = [hero].concat(fv.others).filter(Boolean);
  const shown = g => g === hero ? show.hero : show.others;

  // data-pop always sits on a group with no transform of its own, so the pop animation cannot move it
  // the hero goal's picture sits bottom-left; any other picture goal (a house, a bike...) stacks on the right, above the safe
  let extra = 0;
  const pictures = goals.filter(g => HERO_GOAL_TYPES.has(g.type) && shown(g)).map((g, i) => {
    const box = g === hero ? [4, 186, 136, 58] : [234, 102 - 48 * extra++, 100, 43];
    return `<g data-pop="goal-${g.id}" data-val="${g.done ? 1 : 0}" data-action="open-goal" data-id="${esc(g.id)}" class="tap">${goalPicture(g, ...box, `clip-g${i}-${uid}`, gs)}</g>`;
  }).join("");
  const trip = goals.find(g => g.type === "vacation" && shown(g));
  const tripArt = trip ? `<g data-pop="goal-${trip.id}" data-val="${trip.done ? 1 : 0}" data-action="open-goal" data-id="${esc(trip.id)}" class="tap">${tripPicture(trip, `clip-trip-${uid}`, gs)}</g>` : "";
  const coins = goals.filter(g => !HERO_GOAL_TYPES.has(g.type) && g.type !== "vacation" && shown(g)).map((g, i) => floatCoin(g, i, uid, gs, extra ? COIN_ANCHORS_LEFT : COIN_ANCHORS)).join("");

  const efFull = fv.shield === "full";
  const shields = show.shield ? `
    <g transform="translate(8 8)"><g data-pop="shield" data-val="${fv.shield}" data-action="jump" data-id="ef" class="tap ${efFull ? "protected" : ""}">${emergencyShield(fv.shield, fv.snap.ef.pct, `clip-sh-${uid}`)}<title>Emergency fund: ${efFull ? "fully funded" : fv.shield === "warning" ? "below a quarter" : "partly funded"}</title></g></g>
    <g transform="translate(50 8)"><g data-pop="insured" data-val="${insured ? 1 : 0}" data-action="jump" data-id="protection" class="tap ${insured ? "protected" : ""}">${img(insured ? "shield-insurance-on" : "shield-insurance-warning", 0, 0, 36, 42)}<title>Insurance: ${insured ? "covered" : "no cover"}</title></g></g>` : "";

  const tier = clamp(fv.vaultTier, 1, 4);
  const vault = show.vault ? `
    <g data-pop="vault" data-val="${tier}" data-action="jump" data-id="bank" class="tap">
      ${img("safe-open", 252, 156, 84, 92)}
      ${img(["vault-coins", "vault-notes", "vault-bars", "vault-chest"][tier - 1], 270, 194, 48, 27)}
      <title>Bank balance</title>
    </g>
    <g class="tierfx" data-pop="tierfx" data-val="${tier}">
      <g class="seq4 door">${frames("safe-door", 3, 252, 156, 84, 92)}</g>
      <g class="seq4 burst">${frames("burst", 4, 255, 128, 78, 78)}</g>
    </g>` : "";
  // loan: grey icon, with colour covering the share still owing, so the colour drains away as it is repaid
  const owing = clamp(fv.loanRatio, 0, 1), ly = (212 + 36 * (1 - owing)).toFixed(1), lid = `clip-loan-${uid}`;
  const loan = show.loan && fv.loanRatio > 0 ? `
    <g data-pop="loan" data-val="${Math.round(owing * 20)}" data-action="open-loans" class="tap">
      <g filter="url(#${gs})">${img("loan-icon", 214, 212, 36, 36)}</g>
      <clipPath id="${lid}"><rect x="214" y="${ly}" width="36" height="36" data-anim="${lid}" data-prop="y" data-to="${ly}px"/></clipPath>
      <g clip-path="url(#${lid})">${img("loan-icon", 214, 212, 36, 36)}</g>
      <title>Loan · ${Math.round(owing * 100)}% still owing</title>
    </g>` : "";

  const avatar = show.avatar ? `
    <g data-action="jump" data-id="mood" class="tap">
      <g class="moodfx" data-pop="mood-${uid}" data-val="${mood}">
        <g class="cele-still">${img(`avatar-${AVATAR_SET}-${mood}`, 112, 108, 116, 162)}</g>
        ${mood === "thriving" ? `<g class="celebrate">${frames(`avatar-${AVATAR_SET}-celebrate`, 6, 112, 108, 116, 162)}</g>` : ""}
      </g>
      <rect x="126" y="112" width="88" height="158" fill="transparent"/>
      <title>How future you is feeling, and why</title>
    </g>` : "";
  // quests from the letter: a notification in the top-right corner with the number still open
  const questNote = quests != null && !calm ? `
    <g data-action="open-quests" class="tap quest-note">
      ${img("quest-highlight", 294, 4, 42, 42).replace(".png", ".gif")}
      ${quests > 0 ? `<circle cx="329" cy="11" r="7.5" fill="#e11d2e" stroke="#ffffff" stroke-width="1.5"/><text x="329" y="14.6" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">${quests}</text>` : `<g>${img("check-badge", 322, 4, 15, 15)}</g>`}
      <title>${quests > 0 ? quests + " quests to do" : "All quests done"}</title>
    </g>` : "";
  const bubble = calm && show.avatar ? `
    <g data-action="calm-talk" class="tap bubble" transform="translate(4 36)">
      <path d="M188,36 h134 a8,8 0 0 1 8,8 v16 a8,8 0 0 1 -8,8 h-116 l-12,11 l3,-11 h-9 a8,8 0 0 1 -8,-8 v-16 a8,8 0 0 1 8,-8 z" fill="#ffffff" stroke="#8e2de2" stroke-width="1.5"/>
      <text x="255" y="56" text-anchor="middle" font-size="10.5" font-weight="600" fill="#1f1c4f">Want to talk to someone?</text>
    </g>` : "";
  return `
    <svg class="scene" viewBox="0 0 340 270" width="100%" role="img" aria-label="Window onto your money: ${avatarLabel(mood)}" data-action="open-main">
      <defs><filter id="${gs}"><feColorMatrix type="saturate" values="0"/></filter></defs>
      ${backdrop(mood)}
      ${tripArt}${pictures}${shields}${vault}${loan}${coins}${avatar}${questNote}${bubble}
      ${frame ? `<rect x="3" y="3" width="334" height="264" rx="12" fill="none" stroke="#f2c230" stroke-width="6"/><rect x="6.5" y="6.5" width="327" height="257" rx="9" fill="none" stroke="#fff3b0" stroke-width="1.5"/>` : ""}
    </svg>`;
}
