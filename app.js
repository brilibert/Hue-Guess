"use strict";

const colorSwatch = document.getElementById("colorSwatch");
const graySwatch  = document.getElementById("graySwatch");

const scaleBar    = document.getElementById("scaleBar");
const slider      = document.getElementById("slider");
const sliderVal   = document.getElementById("sliderVal");

const submitBtn   = document.getElementById("submitBtn");
const nextBtn     = document.getElementById("nextBtn");

const resultEl    = document.getElementById("result");
const roundsEl    = document.getElementById("rounds");
const avgOffEl    = document.getElementById("avgOff");
const lastOffEl   = document.getElementById("lastOff");
const resetStatsBtn = document.getElementById("resetStatsBtn");

const appRoot = document.querySelector(".app");

let current = null;
let selectedGuess = 5;
let revealed = false;

const STATS_KEY = "valueGuessStats_v4";
let stats = loadStats();

/* init */
buildScaleButtons();
syncStats();
newRound();

/* events */
slider.addEventListener("input", () => setGuess(+slider.value));
submitBtn.addEventListener("click", () => !revealed && reveal());
nextBtn.addEventListener("click", () => revealed && newRound());

function buildScaleButtons(){
  scaleBar.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement("button");
    b.className = "scaleBtn";
    b.textContent = i;
    b.onclick = () => setGuess(i);
    scaleBar.appendChild(b);
  }
}
resetStatsBtn.addEventListener("click", () => {
  stats = { rounds: 0, totalOff: 0, lastOff: null };
  saveStats(stats);
  syncStats();
});

function setGuess(v){
  selectedGuess = v;
  slider.value = v;
  sliderVal.textContent = v;
  highlight();
}

function highlight(){
  [...scaleBar.children].forEach((b, i) => {
    b.classList.toggle("selected", i + 1 === selectedGuess && !revealed);
  });
}

function newRound(){
  revealed = false;
  appRoot.classList.remove("revealed");
  resultEl.textContent = "";
  clearMarks();

  const targetBin = randInt(1, 10);
  current = generateColorForBin(targetBin);

  colorSwatch.style.background = current.hex;

  // While not revealed, keep grayscale swatch "normal" (solid actual grayscale),
  // but it's hidden by CSS anyway until reveal.
  graySwatch.style.background = current.grayHex;

  highlight();
}

function reveal(){
  revealed = true;
  appRoot.classList.add("revealed");

  const off = Math.abs(selectedGuess - current.bin);

  stats.rounds++;
  stats.totalOff += off;
  stats.lastOff = off;
  saveStats(stats);
  syncStats();

  markBins();

  // NEW FEATURE:
  // On reveal, split grayscale swatch vertically (top/bottom):
  // top = your guessed value in grayscale, bottom = actual grayscale.
  const guessedGray = grayForBin(selectedGuess); // anchor grayscale for guessed bin
  const actualGray  = current.grayHex;

  graySwatch.style.background =
    `linear-gradient(to bottom, ${guessedGray} 0%, ${guessedGray} 50%, ${actualGray} 50%, ${actualGray} 100%)`;

  resultEl.innerHTML =
    `<strong>You guessed:</strong> ${selectedGuess} ·
     <strong>Actual:</strong> ${current.bin} ·
     <strong>Off by:</strong> ${off}`;
}

function markBins(){
  [...scaleBar.children].forEach((b, i) => {
    const v = i + 1;
    if (v === current.bin) b.classList.add("correct");
    if (v === selectedGuess && v !== current.bin) b.classList.add("wrong");
  });
}

function clearMarks(){
  [...scaleBar.children].forEach(b => {
    b.classList.remove("correct", "wrong", "selected");
  });
}

function syncStats(){
  roundsEl.textContent = stats.rounds;
  lastOffEl.textContent = stats.lastOff ?? "–";
  avgOffEl.textContent = stats.rounds
    ? Math.round((stats.totalOff / stats.rounds) * 10) / 10
    : "–";
}

/* -------------------------------
   VALUE LOGIC
   1 = WHITE (lightest)
   10 = BLACK (darkest)
-------------------------------- */

function luminanceToBin(L){
  // L = 1 → white → bin 1
  // L = 0 → black → bin 10
  return 1 + Math.round((1 - clamp01(L)) * 9);
}

// Grayscale for a given bin (uses the bin's anchor luminance to match the binning logic)
function grayForBin(bin){
  const b = clampInt(bin, 1, 10);
  // Bin anchors correspond to darkness d=(b-1)/9, luminance L = 1 - d
  const L = 1 - (b - 1) / 9;
  return grayFromLum(L);
}

/* color generation */
function generateColorForBin(targetBin){
  for (let i = 0; i < 2000; i++) {
    const h = Math.random() * 360;
    const s = 0.25 + Math.random() * 0.75;
    const l = Math.random();

    const rgb = hslToRgb(h, s, l);
    const L   = relLum(rgb.r, rgb.g, rgb.b);
    const bin = luminanceToBin(L);

    if (bin === targetBin) {
      return {
        hex: rgbToHex(rgb),
        grayHex: grayFromLum(L),
        bin
      };
    }
  }

  // fallback (rare)
  const Lmid = 1 - (targetBin - 1) / 9;
  return {
    hex: grayFromLum(Lmid),
    grayHex: grayFromLum(Lmid),
    bin: targetBin
  };
}

/* math utils */
function relLum(r, g, b){
  r = srgb(r); g = srgb(g); b = srgb(b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function srgb(u){
  u /= 255;
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
}

function grayFromLum(L){
  const v = linToSrgb(L);
  return `#${v}${v}${v}`;
}

function linToSrgb(L){
  const u = L <= 0.0031308
    ? 12.92 * L
    : 1.055 * Math.pow(L, 1 / 2.4) - 0.055;
  return Math.round(u * 255).toString(16).padStart(2, "0");
}

function hslToRgb(h, s, l){
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)       [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else              [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function rgbToHex({ r, g, b }){
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

function randInt(a, b){
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function clamp01(x){
  return Math.min(1, Math.max(0, x));
}

function clampInt(x, min, max){
  return Math.min(max, Math.max(min, x | 0));
}

/* storage */
function loadStats(){
  try{
    return JSON.parse(localStorage.getItem(STATS_KEY))
      || { rounds: 0, totalOff: 0, lastOff: null };
  } catch {
    return { rounds: 0, totalOff: 0, lastOff: null };
  }
}

function saveStats(s){
  try{
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {}
}


