/* Value Guess Trainer
   - Computes perceived luminance correctly (sRGB -> linear -> Rec.709 luminance).
   - Maps luminance to nearest 1–10 bin (1 darkest, 10 lightest).
   - Generates colors by picking a target bin first, then rejection-sampling random HSL until it matches.
   - Stores simple stats in localStorage (optional but handy; still static-site friendly).
*/

"use strict";

// ---------- DOM ----------
const colorSwatch = document.getElementById("colorSwatch");
const graySwatch  = document.getElementById("graySwatch");
const grayWrap    = document.getElementById("grayWrap");

const scaleBar    = document.getElementById("scaleBar");
const slider      = document.getElementById("slider");
const sliderVal   = document.getElementById("sliderVal");

const submitBtn   = document.getElementById("submitBtn");
const nextBtn     = document.getElementById("nextBtn");
const resetStatsBtn = document.getElementById("resetStatsBtn");

const resultEl    = document.getElementById("result");
const roundsEl    = document.getElementById("rounds");
const avgOffEl    = document.getElementById("avgOff");
const lastOffEl   = document.getElementById("lastOff");

const appRoot = document.querySelector(".app");

// ---------- State ----------
let current = null; // { rgb:{r,g,b}, hex, L, bin, grayHex }
let selectedGuess = 5;
let revealed = false;

// Stats persisted locally
const STATS_KEY = "valueGuessStats_v1";
let stats = loadStats();

// ---------- Init ----------
buildScaleButtons();
syncUIFromStats();
setSelectedGuess(5);
newRound();

// ---------- Events ----------
slider.addEventListener("input", () => {
  setSelectedGuess(parseInt(slider.value, 10));
});

submitBtn.addEventListener("click", () => {
  if (revealed) return;
  revealAndScore();
});

nextBtn.addEventListener("click", () => {
  if (!revealed) return;
  newRound();
});

resetStatsBtn.addEventListener("click", () => {
  stats = { rounds: 0, totalOff: 0, lastOff: null };
  saveStats(stats);
  syncUIFromStats();
  resultEl.textContent = "";
});

// keyboard shortcuts: 1-9,0 => 10 ; Enter submit/next ; R => new
window.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "9") {
    setSelectedGuess(parseInt(e.key, 10));
    return;
  }
  if (e.key === "0") {
    setSelectedGuess(10);
    return;
  }
  if (e.key === "Enter") {
    if (!revealed) revealAndScore();
    else newRound();
    return;
  }
  if (e.key.toLowerCase() === "r") {
    newRound();
  }
});

// ---------- UI helpers ----------
function buildScaleButtons() {
  scaleBar.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.className = "scaleBtn";
    btn.type = "button";
    btn.textContent = String(i);
    btn.setAttribute("aria-label", `Value ${i}`);
    btn.addEventListener("click", () => setSelectedGuess(i));
    scaleBar.appendChild(btn);
  }
}

function setSelectedGuess(n) {
  selectedGuess = clampInt(n, 1, 10);
  slider.value = String(selectedGuess);
  sliderVal.textContent = String(selectedGuess);
  highlightSelectedButton();
}

function highlightSelectedButton() {
  const btns = [...scaleBar.querySelectorAll(".scaleBtn")];
  btns.forEach((b, idx) => {
    const val = idx + 1;
    b.classList.toggle("selected", val === selectedGuess && !revealed);
  });
}

function setRevealedUI(on) {
  revealed = on;
  appRoot.classList.toggle("revealed", on);
  grayWrap.setAttribute("aria-hidden", on ? "false" : "true");
  submitBtn.disabled = on;
  nextBtn.setAttribute("aria-hidden", on ? "false" : "true");
  // nextBtn visibility handled by CSS .revealed .revealOnly
}

function clearScaleMarks() {
  const btns = [...scaleBar.querySelectorAll(".scaleBtn")];
  btns.forEach((b) => {
    b.classList.remove("selected", "correct", "wrong");
  });
}

function markScaleAfterReveal(correctBin) {
  const btns = [...scaleBar.querySelectorAll(".scaleBtn")];
  btns.forEach((b, idx) => {
    const val = idx + 1;
    if (val === correctBin) b.classList.add("correct");
    if (val === selectedGuess && val !== correctBin) b.classList.add("wrong");
    if (val === selectedGuess) b.classList.add("selected");
  });
}

function syncUIFromStats() {
  roundsEl.textContent = String(stats.rounds);
  lastOffEl.textContent = stats.lastOff === null ? "–" : String(stats.lastOff);
  avgOffEl.textContent =
    stats.rounds === 0 ? "–" : String(Math.round((stats.totalOff / stats.rounds) * 10) / 10);
}

// ---------- Core flow ----------
function newRound() {
  setRevealedUI(false);
  clearScaleMarks();
  resultEl.textContent = "";

  // target bins evenly (true coverage)
  const targetBin = randInt(1, 10);
  current = generateColorForBin(targetBin);

  colorSwatch.style.background = current.hex;
  graySwatch.style.background = current.grayHex;

  // keep current selection but re-highlight
  highlightSelectedButton();
}

function revealAndScore() {
  if (!current) return;

  const off = Math.abs(selectedGuess - current.bin);

  // update stats
  stats.rounds += 1;
  stats.totalOff += off;
  stats.lastOff = off;
  saveStats(stats);
  syncUIFromStats();

  // show reveal
  setRevealedUI(true);
  markScaleAfterReveal(current.bin);

  // blunt result message
  resultEl.innerHTML = `
    <strong>You guessed:</strong> ${selectedGuess} ·
    <strong>Actual:</strong> ${current.bin} ·
    <strong>Off by:</strong> ${off}
    <span class="subtle"> (nearest bin)</span>
  `;
}

// ---------- Color math ----------
function generateColorForBin(targetBin) {
  // Rejection sampling: try random HSL colors, accept if luminance maps to target bin.
  // To ensure variety: vary saturation widely, and use full hue range.
  const maxTries = 2500;
  for (let i = 0; i < maxTries; i++) {
    const h = Math.random() * 360;
    const s = lerp(0.25, 1.0, Math.random());  // avoid too many near-grays by default
    const l = Math.random();                   // full lightness range

    const rgb = hslToRgb(h, s, l);             // 0..255 ints
    const L = relativeLuminance(rgb.r, rgb.g, rgb.b); // 0..1
    const bin = luminanceToBin(L);

    if (bin === targetBin) {
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      const gray = grayscaleFromLuminance(L);        // grayscale hex matching luminance
      return { rgb, hex, L, bin, grayHex: gray };
    }
  }

  // Fallback: if we fail (unlikely), force a grayscale swatch in the bin, then tint slightly.
  const Lmid = binToLuminanceMidpoint(targetBin);
  const gray = grayscaleFromLuminance(Lmid);
  // slight hue tint around gray
  const h = Math.random() * 360;
  const s = 0.15 + Math.random() * 0.15;
  const l = Lmid; // roughly align with luminance, not perfect but close
  const rgb = hslToRgb(h, s, l);
  const L = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const bin = luminanceToBin(L);
  return { rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b), L, bin, grayHex: grayscaleFromLuminance(L) };
}

// Perceived luminance (relative luminance) using linearized sRGB and Rec.709 coefficients.
function relativeLuminance(r8, g8, b8) {
  const r = srgb8ToLinear(r8);
  const g = srgb8ToLinear(g8);
  const b = srgb8ToLinear(b8);
  // Rec.709 / sRGB luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Map luminance [0..1] to nearest bin 1..10.
function luminanceToBin(L) {
  const v = clamp01(L);
  // nearest of 10 evenly spaced points between 0 and 1
  const bin = 1 + Math.round(v * 9);
  return clampInt(bin, 1, 10);
}

// Midpoint luminance for a bin (useful for fallback or future calibration).
function binToLuminanceMidpoint(bin) {
  const b = clampInt(bin, 1, 10);
  const a = (b - 1) / 9; // bin anchor
  // midpoint between anchors; for edges, keep inside [0,1]
  const prev = (b - 2) / 9;
  const next = b / 9;
  const mid = (Math.max(0, prev) + Math.min(1, next)) / 2;
  return clamp01(mid);
}

// Convert luminance to a grayscale sRGB hex that matches that luminance.
// We set linear RGB = L for all channels, then gamma-encode to sRGB.
function grayscaleFromLuminance(L) {
  const lin = clamp01(L);
  const s8 = linearToSrgb8(lin);
  return rgbToHex(s8, s8, s8);
}

// sRGB 8-bit to linear 0..1
function srgb8ToLinear(u8) {
  const u = clamp01(u8 / 255);
  return (u <= 0.04045) ? (u / 12.92) : Math.pow((u + 0.055) / 1.055, 2.4);
}

// linear 0..1 to sRGB 8-bit
function linearToSrgb8(lin) {
  const x = clamp01(lin);
  const u = (x <= 0.0031308) ? (12.92 * x) : (1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  return clampInt(Math.round(u * 255), 0, 255);
}

// HSL to RGB (h in degrees, s/l in 0..1). Returns ints 0..255.
function hslToRgb(h, s, l) {
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const Hp = (h % 360) / 60;
  const X = C * (1 - Math.abs((Hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;

  if (0 <= Hp && Hp < 1) [r1, g1, b1] = [C, X, 0];
  else if (1 <= Hp && Hp < 2) [r1, g1, b1] = [X, C, 0];
  else if (2 <= Hp && Hp < 3) [r1, g1, b1] = [0, C, X];
  else if (3 <= Hp && Hp < 4) [r1, g1, b1] = [0, X, C];
  else if (4 <= Hp && Hp < 5) [r1, g1, b1] = [X, 0, C];
  else if (5 <= Hp && Hp < 6) [r1, g1, b1] = [C, 0, X];

  const m = l - C / 2;
  const r = clampInt(Math.round((r1 + m) * 255), 0, 255);
  const g = clampInt(Math.round((g1 + m) * 255), 0, 255);
  const b = clampInt(Math.round((b1 + m) * 255), 0, 255);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

// ---------- Storage ----------
function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { rounds: 0, totalOff: 0, lastOff: null };
    const obj = JSON.parse(raw);
    if (typeof obj.rounds !== "number" || typeof obj.totalOff !== "number") {
      return { rounds: 0, totalOff: 0, lastOff: null };
    }
    return { rounds: obj.rounds, totalOff: obj.totalOff, lastOff: obj.lastOff ?? null };
  } catch {
    return { rounds: 0, totalOff: 0, lastOff: null };
  }
}

function saveStats(s) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    // ignore (private mode etc.)
  }
}

// ---------- Utils ----------
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function clampInt(x, min, max) { return Math.min(max, Math.max(min, x | 0)); }
function lerp(a, b, t) { return a + (b - a) * t; }
