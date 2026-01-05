"use strict";

const colorSwatch = document.getElementById("colorSwatch");
const graySwatch  = document.getElementById("graySwatch");
const grayWrap    = document.getElementById("grayWrap");

const scaleBar    = document.getElementById("scaleBar");
const slider      = document.getElementById("slider");
const sliderVal   = document.getElementById("sliderVal");

const submitBtn   = document.getElementById("submitBtn");
const nextBtn     = document.getElementById("nextBtn");

const resultEl    = document.getElementById("result");
const roundsEl    = document.getElementById("rounds");
const avgOffEl    = document.getElementById("avgOff");
const lastOffEl   = document.getElementById("lastOff");

const appRoot = document.querySelector(".app");

let current = null;
let selectedGuess = 5;
let revealed = false;

const STATS_KEY = "valueGuessStats_v3";
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
  for(let i = 1; i <= 10; i++){
    const b = document.createElement("button");
    b.className = "scaleBtn";
    b.textContent = i;
    b.onclick = () => setGuess(i);
    scaleBar.appendChild(b);
  }
}

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
  graySwatch.style.background  = current.grayHex;
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
  resultEl.innerHTML =
    `<strong>You guessed:</strong> ${selectedGuess} ·
     <strong>Actual:</strong> ${current.bin} ·
     <strong>Off by:</strong> ${off}`;
}

function markBins(){
  [...scaleBar.children].forEach((b, i) => {
    const v = i + 1;
    if(v === current.bin) b.classList.add("correct");
    if(v === selectedGuess && v !== current.bin) b.classList.add("wrong");
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

/* color generation */
function generateColorForBin(targetBin){
  for(let i = 0; i < 2000; i++){
    const h = Math.random() * 360;
    const s = 0.25 + Math.random() * 0.75;
    const l = Math.random();

    const rgb = hslToRgb(h, s, l);
    const L   = relLum(rgb.r, rgb.g, rgb.b);
    const bin = luminanceToBin(L);

    if(bin === targetBin){
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
  const m = l - c / 2
