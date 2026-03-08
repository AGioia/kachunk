// ═══════════════════════════════════════════════════
// KaChunk — Chunk Editor
// ═══════════════════════════════════════════════════

import { loadChunks, saveChunks, genId, flattenChunk, getTotalDuration, getFlatStepCount, chunkReferencesId } from './store.js';
import { esc, formatDuration, showToast, showConfirm } from './ui.js';
import { showScreen, goHome } from './router.js';
import { ALARM_SOUNDS, BG_SOUNDS, previewSound } from './audio.js';
import { renderHome } from './home.js';

let editingId = null;
let editSteps = [];
let editChunkAudioAlarm = 'default';
let editChunkAudioBg = 'default';

// ─── Debounced Autosave ───

let autosaveTimer = null;
let editNameListenerWired = false;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(doAutosave, 300);
}

function doAutosave() {
  const name = document.getElementById('editName').value.trim();

  // For new chunks: only create once there's meaningful content
  if (!editingId) {
    const hasName = name.length > 0;
    const hasLabeledStep = editSteps.some(s => {
      if ((s.type || 'step') === 'chunk') return true;
      return s.label && s.label.trim().length > 0;
    });
    if (!hasName && !hasLabeledStep) return; // nothing meaningful yet
    // Auto-create the chunk
    editingId = genId();
  }

  // Build clean steps (keep all, including empty labels — user is mid-edit)
  const steps = editSteps.map(s => {
    if ((s.type || 'step') === 'chunk') return { ...s };
    return { ...s, minutes: Math.max(0.5, parseFloat(s.minutes) || 1) };
  });

  let chunks = loadChunks();
  const idx = chunks.findIndex(c => c.id === editingId);

  const chunkObj = {
    id: editingId,
    name: name,
    steps: steps,
    audioAlarm: editChunkAudioAlarm !== 'default' ? editChunkAudioAlarm : undefined,
    audioBg: editChunkAudioBg !== 'default' ? editChunkAudioBg : undefined,
  };

  if (idx >= 0) {
    // Preserve existing schedule and any other fields
    chunkObj.schedule = chunks[idx].schedule;
    chunks[idx] = { ...chunks[idx], ...chunkObj };
  } else {
    chunkObj.schedule = { days: [], startTime: '' };
    chunks.push(chunkObj);
  }

  saveChunks(chunks);
  showToast('\u2713 Saved');
}

function wireEditNameListener() {
  const el = document.getElementById('editName');
  if (editNameListenerWired) return;
  editNameListenerWired = true;
  el.addEventListener('input', () => scheduleAutosave());
}

// ─── Open Editor ───

export function createNewChunk() {
  editingId = null;
  document.getElementById('editName').value = '';
  editSteps = [{ label: '', minutes: 5 }];
  editChunkAudioAlarm = 'default';
  editChunkAudioBg = 'default';
  renderEditSteps();
  renderEditAudioPickers();
  showScreen('editScreen');
  wireEditNameListener();
  setTimeout(() => document.getElementById('editName').focus(), 400);
}

export function openEditor(id) {
  const chunks = loadChunks();
  const chunk = chunks.find(c => c.id === id);
  if (!chunk) return;

  editingId = chunk.id;
  document.getElementById('editName').value = chunk.name;
  editSteps = chunk.steps.map(s => ({ ...s }));
  if (editSteps.length === 0) editSteps = [{ label: '', minutes: 5 }];
  editChunkAudioAlarm = chunk.audioAlarm || 'default';
  editChunkAudioBg = chunk.audioBg || 'default';
  renderEditSteps();
  renderEditAudioPickers();
  showScreen('editScreen');
  wireEditNameListener();
}

// ─── Render Steps ───

function renderEditSteps() {
  const container = document.getElementById('editSteps');
  const allChunks = loadChunks();
  container.innerHTML = editSteps.map((s, i) => {
    const stepType = s.type || 'step';
    if (stepType === 'chunk') {
      const sub = allChunks.find(c => c.id === s.chunkId);
      if (sub) {
        const subDur = getTotalDuration(sub, allChunks);
        const subCount = getFlatStepCount(sub, allChunks);
        const previewSteps = flattenChunk(sub, allChunks);
        const previewId = 'subpreview_' + i;
        const isLocked = !!s.locked;
        const lockIcon = isLocked ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>' : '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0"/></svg>';
        const lockTitle = isLocked ? 'Locked (using snapshot)' : 'Unlocked (live reference)';
        return `
          <div class="step-item sub-chunk-item" onclick="window._kachunk.toggleSubPreview('${previewId}')">
            <div class="step-number" style="background:var(--accent)">⟁</div>
            <div class="sub-chunk-info">
              <div class="sub-chunk-name"><span class="link-icon">⟁</span> ${esc(sub.name)}</div>
              <div class="sub-chunk-meta">${subCount} step${subCount !== 1 ? 's' : ''} · ${formatDuration(subDur)}${isLocked ? ' · snapshot' : ''}</div>
              <div class="sub-chunk-preview" id="${previewId}">
                ${previewSteps.map(ps => `<div class="sub-chunk-preview-step"><span>${esc(ps.label || 'Untitled')}</span><span>${ps.minutes}m</span></div>`).join('')}
              </div>
            </div>
            <button class="lock-toggle-btn ${isLocked ? 'locked' : ''}" onclick="event.stopPropagation();window._kachunk.toggleLock(${i})" title="${lockTitle}">${lockIcon}</button>
            <div class="step-reorder">
              <button onclick="event.stopPropagation();window._kachunk.moveStep(${i},-1)" ${i === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
              <button onclick="event.stopPropagation();window._kachunk.moveStep(${i},1)" ${i === editSteps.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
            </div>
            <button class="step-delete" onclick="event.stopPropagation();window._kachunk.removeStep(${i})" ${editSteps.length <= 1 ? 'disabled style="opacity:0.15"' : ''}>✕</button>
          </div>`;
      } else {
        return `
          <div class="step-item sub-chunk-item">
            <div class="step-number" style="background:var(--danger)">✕</div>
            <div class="sub-chunk-info">
              <div class="sub-chunk-name sub-chunk-deleted">Deleted chunk</div>
              <div class="sub-chunk-meta">This chunk no longer exists</div>
            </div>
            <div class="step-reorder">
              <button onclick="window._kachunk.moveStep(${i},-1)" ${i === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
              <button onclick="window._kachunk.moveStep(${i},1)" ${i === editSteps.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
            </div>
            <button class="step-delete" onclick="window._kachunk.removeStep(${i})">✕</button>
          </div>`;
      }
    }
    return `
    <div class="step-item">
      <div class="step-number">${i + 1}</div>
      <input type="text" value="${esc(s.label)}" placeholder="Step name"
        onchange="window._kachunk.updateStepLabel(${i},this.value)" oninput="window._kachunk.updateStepLabel(${i},this.value)">
      <div class="step-duration">
        <input type="number" value="${s.minutes}" min="0.5" max="999" step="0.5"
          onchange="window._kachunk.updateStepMinutes(${i},this.value)"
          oninput="window._kachunk.updateStepMinutes(${i},this.value)">
        <span>min</span>
      </div>
      <button class="step-sound-btn ${s.sound ? 'has-sound' : ''}" onclick="window._kachunk.openStepSoundPicker(this,${i})" title="Step sound"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 2a5 5 0 00-5 5c0 4-2 5-2 5h14s-2-1-2-5a5 5 0 00-5-5z"/><path d="M8.5 17a1.5 1.5 0 003 0"/></svg></button>
      <div class="step-reorder">
        <button onclick="window._kachunk.moveStep(${i},-1)" ${i === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
        <button onclick="window._kachunk.moveStep(${i},1)" ${i === editSteps.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
      </div>
      <button class="step-delete" onclick="window._kachunk.removeStep(${i})" ${editSteps.length <= 1 ? 'disabled style="opacity:0.15"' : ''}>✕</button>
    </div>`;
  }).join('');
}

// ─── Step Operations ───

export function addStep() {
  editSteps.push({ label: '', minutes: 5 });
  renderEditSteps();
  scheduleAutosave();
  const items = document.querySelectorAll('#editSteps .step-item');
  const last = items[items.length - 1];
  if (last) {
    const input = last.querySelector('input[type="text"]');
    if (input) input.focus();
  }
}

export function removeStep(i) {
  if (editSteps.length <= 1) return;
  editSteps.splice(i, 1);
  renderEditSteps();
  scheduleAutosave();
}

export function moveStep(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= editSteps.length) return;
  [editSteps[i], editSteps[j]] = [editSteps[j], editSteps[i]];
  renderEditSteps();
  scheduleAutosave();
}

export function updateStepLabel(i, val) {
  editSteps[i].label = val;
  scheduleAutosave();
}

export function updateStepMinutes(i, val) {
  editSteps[i].minutes = parseFloat(val) || 1;
  scheduleAutosave();
}

export function toggleSubPreview(previewId) {
  const el = document.getElementById(previewId);
  if (el) el.classList.toggle('expanded');
}

// ─── Step Sound Picker ───

let stepSoundDropdownIdx = -1;

export function openStepSoundPicker(btn, stepIdx) {
  stepSoundDropdownIdx = stepIdx;
  const dropdown = document.getElementById('stepSoundDropdown');
  const rect = btn.getBoundingClientRect();
  const currentSound = editSteps[stepIdx].sound || 'default';

  dropdown.innerHTML =
    `<button class="step-sound-option ${currentSound === 'default' ? 'selected' : ''}" onclick="window._kachunk.pickStepSound('default')"><span class="opt-icon"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="6"/><circle cx="10" cy="10" r="1.5"/><path d="M10 4v2"/></svg></span> Default</button>` +
    Object.entries(ALARM_SOUNDS).map(([key, snd]) =>
      `<button class="step-sound-option ${currentSound === key ? 'selected' : ''}" onclick="window._kachunk.pickStepSound('${key}')"><span class="opt-icon">${snd.icon}</span> ${snd.label}</button>`
    ).join('');

  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
  dropdown.classList.add('show');

  setTimeout(() => {
    document.addEventListener('click', closeStepSoundDropdown, { once: true });
  }, 10);
}

function closeStepSoundDropdown() {
  document.getElementById('stepSoundDropdown').classList.remove('show');
  stepSoundDropdownIdx = -1;
}

export function pickStepSound(key) {
  if (stepSoundDropdownIdx >= 0 && stepSoundDropdownIdx < editSteps.length) {
    editSteps[stepSoundDropdownIdx].sound = key === 'default' ? undefined : key;
    renderEditSteps();
    if (key !== 'default') previewSound('alarm', key);
  }
  closeStepSoundDropdown();
}

// ─── Lock Toggle ───

export function toggleLock(stepIdx) {
  if (stepIdx < 0 || stepIdx >= editSteps.length) return;
  const step = editSteps[stepIdx];
  if ((step.type || 'step') !== 'chunk') return;

  if (step.locked) {
    // Unlock: remove snapshot
    step.locked = false;
    delete step.snapshot;
    delete step.snapshotAt;
    showToast('Unlocked');
    scheduleAutosave();
  } else {
    // Lock: take snapshot of current sub-chunk state
    const allChunks = loadChunks();
    const sub = allChunks.find(c => c.id === step.chunkId);
    if (!sub) return;
    const flat = flattenChunk(sub, allChunks);
    step.locked = true;
    step.snapshot = flat.map(s => ({
      label: s.label,
      minutes: s.minutes,
      sound: s.sound,
    }));
    step.snapshotAt = new Date().toISOString();
    showToast('Locked');
    scheduleAutosave();
  }
  renderEditSteps();
}

// ─── Chunk Picker (Add Sub-chunk) ───

export function openChunkPicker() {
  const allChunks = loadChunks();
  const listEl = document.getElementById('chunkPickerList');

  const available = allChunks.filter(c => {
    if (editingId && c.id === editingId) return false;
    if (editingId && chunkReferencesId(c, editingId, allChunks)) return false;
    return true;
  });

  if (available.length === 0) {
    listEl.innerHTML = '<div class="chunk-picker-empty">No other chunks available to add.</div>';
  } else {
    listEl.innerHTML = available.map(c => {
      const dur = getTotalDuration(c, allChunks);
      const count = getFlatStepCount(c, allChunks);
      return `
        <button class="chunk-picker-item" onclick="window._kachunk.pickSubChunk('${c.id}')">
          <div class="cpi-disc"></div>
          <div class="cpi-info">
            <div class="cpi-name">${esc(c.name || 'Untitled')}</div>
            <div class="cpi-meta">${count} step${count !== 1 ? 's' : ''} · ${formatDuration(dur)}</div>
          </div>
        </button>`;
    }).join('');
  }

  document.getElementById('chunkPickerOverlay').classList.add('show');
  document.getElementById('chunkPicker').classList.add('show');
}

export function closeChunkPicker() {
  document.getElementById('chunkPickerOverlay').classList.remove('show');
  document.getElementById('chunkPicker').classList.remove('show');
}

export function pickSubChunk(chunkId) {
  editSteps.push({ type: 'chunk', chunkId: chunkId });
  closeChunkPicker();
  renderEditSteps();
  scheduleAutosave();
}

// ─── Audio Pickers ───

function renderEditAudioPickers() {
  const alarmPicker = document.getElementById('editAlarmPicker');
  const bgPicker = document.getElementById('editBgPicker');

  alarmPicker.innerHTML =
    `<button class="sound-pill ${editChunkAudioAlarm === 'default' ? 'selected' : ''}" onclick="window._kachunk.selectEditAlarm('default')"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="6"/><circle cx="10" cy="10" r="1.5"/><path d="M10 4v2"/></svg> Default</button>` +
    Object.entries(ALARM_SOUNDS).map(([key, snd]) =>
      `<button class="sound-pill ${editChunkAudioAlarm === key ? 'selected' : ''}" onclick="window._kachunk.selectEditAlarm('${key}')">${snd.icon} ${snd.label}</button>`
    ).join('');

  bgPicker.innerHTML =
    `<button class="sound-pill ${editChunkAudioBg === 'default' ? 'selected' : ''}" onclick="window._kachunk.selectEditBg('default')"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="6"/><circle cx="10" cy="10" r="1.5"/><path d="M10 4v2"/></svg> Default</button>` +
    Object.entries(BG_SOUNDS).map(([key, snd]) =>
      `<button class="sound-pill ${editChunkAudioBg === key ? 'selected' : ''}" onclick="window._kachunk.selectEditBg('${key}')">${snd.icon} ${snd.label}</button>`
    ).join('');
}

export function selectEditAlarm(key) {
  editChunkAudioAlarm = key;
  renderEditAudioPickers();
  scheduleAutosave();
  if (key !== 'default') previewSound('alarm', key);
}

export function selectEditBg(key) {
  editChunkAudioBg = key;
  renderEditAudioPickers();
  scheduleAutosave();
  if (key !== 'default') previewSound('bg', key);
}

// ─── Delete from Editor ───

export function deleteChunkFromEditor() {
  if (!editingId) {
    // New unsaved chunk — just go back
    goHome();
    renderHome();
    return;
  }
  const chunks = loadChunks();
  const chunk = chunks.find(c => c.id === editingId);
  const name = chunk ? chunk.name : 'this chunk';
  showConfirm(`Delete "${name}"? This can't be undone.`, () => {
    const filtered = loadChunks().filter(c => c.id !== editingId);
    saveChunks(filtered);
    editingId = null;
    showToast('Deleted');
    goHome();
    renderHome();
  });
}
