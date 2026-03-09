// ═══════════════════════════════════════════════════
// KaChunk — Chunk Drawer (Home Screen)
// Chrono thumb = play/pause, card body = open player, arrow = edit
// ═══════════════════════════════════════════════════

import { loadChunks, getTotalDuration, getFlatStepCount, hasSubChunks } from './store.js';
import { esc, formatDuration, formatTime12 } from './ui.js';
import { playUiSound, vibrateDevice } from './audio.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Simple in-memory play state tracker
// (Lightweight — the real state lives in the player module)
const activeChunks = new Set();

export function isChunkActive(id) { return activeChunks.has(id); }

// ─── Render Home ───

export function renderHome() {
  const chunks = loadChunks();
  const list = document.getElementById('chunkList');

  if (chunks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-chrono"></div>
        <h2>No Chunks Yet</h2>
        <p>Create your first chunk — a sequence of timed steps to guide your rhythm.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = chunks.map(c => {
    const totalMin = getTotalDuration(c, chunks);
    const stepCount = getFlatStepCount(c, chunks);
    const hasSubs = hasSubChunks(c);
    const schedText = getScheduleText(c.schedule);
    const isActive = activeChunks.has(c.id);

    return `
      <div class="chunk-card ${isActive ? 'active-chunk' : ''}" data-chunk-id="${c.id}">
        <div class="card-content">
          <button class="chrono-thumb ${isActive ? 'is-active' : ''}"
            ontouchstart="window._kachunk.chronoTouchStart('${c.id}')"
            ontouchend="window._kachunk.chronoTouchEnd('${c.id}')"
            onmousedown="window._kachunk.chronoTouchStart('${c.id}')"
            onmouseup="window._kachunk.chronoTouchEnd('${c.id}')"
            onclick="return false"
            aria-label="${isActive ? 'Pause' : 'Play'} ${esc(c.name)}">
            <svg viewBox="0 0 44 44">
              <circle fill="none" stroke="rgba(26,22,19,0.04)" stroke-width="2" cx="22" cy="22" r="19"/>
              <circle fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" cx="22" cy="22" r="19"
                stroke-dasharray="119.4" stroke-dashoffset="${119.4 * (1 - Math.min(stepCount / 10, 1))}"
                transform="rotate(-90 22 22)"/>
            </svg>
            <div class="ct-icon">
              ${isActive
                ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="6" width="3" height="12" rx="1"/><rect x="14" y="6" width="3" height="12" rx="1"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
              }
            </div>
          </button>
          <div class="card-info" onclick="window._kachunk.openPlayer('${c.id}')">
            <div class="card-name">${esc(c.name || 'Untitled')}${hasSubs ? '<span class="card-has-subchunks"> &#x27C1;</span>' : ''}</div>
            <div class="card-meta">
              <span>${stepCount} step${stepCount !== 1 ? 's' : ''}</span>
              <span class="dot">·</span>
              <span>${formatDuration(totalMin)}</span>
              ${isActive ? '<span class="dot">·</span><span class="card-status playing">Active</span>' : ''}
            </div>
            ${schedText ? `<div class="card-schedule"><span class="sched-dot"></span> ${schedText}</div>` : ''}
          </div>
          <button class="card-edit-btn" onclick="window._kachunk.editChunk('${c.id}')" aria-label="Edit ${esc(c.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getScheduleText(sched) {
  if (!sched || !sched.days || sched.days.length === 0) return '';
  const dayStr = sched.days.map(d => DAY_NAMES[d]).join(', ');
  const timeStr = formatTime12(sched.startTime);
  return `${dayStr} at ${timeStr}`;
}

// ─── Long-press detection for schedule ───

let longPressTimer = null;
let longPressTriggered = false;

export function chronoTouchStart(chunkId) {
  longPressTriggered = false;
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    vibrateDevice([30]);
    const fn = window._kachunk._openSchedule;
    if (fn) fn(chunkId);
  }, 500);
}

export function chronoTouchEnd(chunkId) {
  clearTimeout(longPressTimer);
  if (longPressTriggered) return; // schedule already opened
  // Short tap — toggle play/pause
  toggleChunkFromDrawer(chunkId);
}

// ─── Chrono thumb: toggle play/pause from drawer ───

export function toggleChunkFromDrawer(chunkId) {
  if (activeChunks.has(chunkId)) {
    // Pause — remove from active set
    activeChunks.delete(chunkId);
    playUiSound('clickPause');
    vibrateDevice([10]);
  } else {
    // Start/resume
    activeChunks.add(chunkId);
    playUiSound('clickPlay');
    vibrateDevice([10, 20, 40]);
    // Make sure the player module is initialized for this chunk
    const fn = window._kachunk._startPlayer;
    if (fn) fn(chunkId);
  }
  renderHome();
}

// ─── Card body: open player view ───

export function openPlayer(chunkId) {
  // Ensure chunk is active
  if (!activeChunks.has(chunkId)) {
    activeChunks.add(chunkId);
  }
  const fn = window._kachunk._startPlayer;
  if (fn) fn(chunkId);
}

// ─── Arrow: open editor ───

export function editChunk(chunkId) {
  const fn = window._kachunk._openEditor;
  if (fn) fn(chunkId);
}
