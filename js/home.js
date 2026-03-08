// ═══════════════════════════════════════════════════
// KaChunk — Chunk Drawer (Home Screen)
// Tap chrono = open player, arrow = edit, delete in editor
// ═══════════════════════════════════════════════════

import { loadChunks, getTotalDuration, getFlatStepCount, hasSubChunks } from './store.js';
import { esc, formatDuration, formatTime12 } from './ui.js';
import { showScreen, goHome } from './router.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

    return `
      <div class="chunk-card" data-chunk-id="${c.id}">
        <div class="card-content">
          <button class="chrono-thumb" onclick="window._kachunk.playChunk('${c.id}')" aria-label="Play ${esc(c.name)}">
            <svg viewBox="0 0 44 44">
              <circle fill="none" stroke="rgba(26,22,19,0.04)" stroke-width="2" cx="22" cy="22" r="19"/>
              <circle fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" cx="22" cy="22" r="19"
                stroke-dasharray="119.4" stroke-dashoffset="${119.4 * (1 - Math.min(stepCount / 10, 1))}"
                transform="rotate(-90 22 22)"/>
            </svg>
            <div class="ct-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </button>
          <div class="card-info" onclick="window._kachunk.playChunk('${c.id}')">
            <div class="card-name">${esc(c.name || 'Untitled')}${hasSubs ? '<span class="card-has-subchunks"> &#x27C1;</span>' : ''}</div>
            <div class="card-meta">
              <span>${stepCount} step${stepCount !== 1 ? 's' : ''}</span>
              <span class="dot">·</span>
              <span>${formatDuration(totalMin)}</span>
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

// ─── Card Actions ───

export function playChunk(chunkId) {
  console.log('[KaChunk] playChunk:', chunkId);
  const fn = window._kachunk._startPlayer;
  if (fn) fn(chunkId);
}

export function editChunk(chunkId) {
  console.log('[KaChunk] editChunk:', chunkId);
  const fn = window._kachunk._openEditor;
  if (fn) fn(chunkId);
}
