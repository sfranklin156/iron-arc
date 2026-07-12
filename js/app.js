'use strict';

/* =========================================================================
   Iron Arc — app.js
   Plain vanilla JS, no build step. All data lives in localStorage.
   ========================================================================= */

/* ---------- Constants ---------- */

const STORAGE_KEY = 'ironArcData';

const RANKS = [
  { letter: 'E',  title: 'Unawakened',  min: 0 },
  { letter: 'D',  title: 'Initiate',    min: 25000 },
  { letter: 'C',  title: 'Adept',       min: 100000 },
  { letter: 'B',  title: 'Vanguard',    min: 300000 },
  { letter: 'A',  title: 'Battle-Forged', min: 750000 },
  { letter: 'S',  title: 'Ascendant',   min: 1500000 },
  { letter: 'SS', title: 'Mythic',      min: 3000000 },
];

const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Other'];
const EQUIPMENT_ABBR = { Barbell: 'BB', Dumbbell: 'DB', Machine: 'MCH', Cable: 'CBL', Other: 'OTH' };

const CUSTOM_CATEGORY_COLORS = ['#E0C87F', '#7FE0DE', '#C87FE0', '#E0947F', '#8FE07F', '#7F94E0'];

const PERMANENT_CATEGORIES = [
  { id: 'push',   name: 'Upper Body Push Day', color: '#9B7FE0' },
  { id: 'pull',   name: 'Upper Body Pull Day', color: '#7FA8E0' },
  { id: 'lower',  name: 'Lower Body Day',      color: '#7FE0B8' },
  { id: 'cardio', name: 'Cardio',              color: '#E07F94' },
];

/* ---------- Storage ---------- */

function defaultData() {
  return {
    categories: PERMANENT_CATEGORIES.map(c => ({
      id: c.id, name: c.name, color: c.color, permanent: true, exercises: [],
    })),
    workouts: [],
  };
}

let data = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed.categories || !parsed.workouts) return defaultData();
    return parsed;
  } catch (e) {
    console.error('Failed to load data, starting fresh.', e);
    return defaultData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ---------- Utilities ---------- */

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateUTCms(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDateDisplay(s) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function formatDateShort(s) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
}

function getCategory(categoryId) {
  return data.categories.find(c => c.id === categoryId);
}

function getExercise(categoryId, exerciseId) {
  const cat = getCategory(categoryId);
  return cat ? cat.exercises.find(e => e.id === exerciseId) : null;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* =========================================================================
   Rank / XP
   ========================================================================= */

function computeTotalVolume() {
  let total = 0;
  for (const w of data.workouts) {
    for (const ex of w.exercises) {
      if (ex.type !== 'weight') continue;
      for (const set of ex.sets) {
        const reps = Number(set.reps) || 0;
        const weight = Number(set.weight) || 0;
        total += reps * weight;
      }
    }
  }
  return total;
}

function getRankInfo(volume) {
  let current = RANKS[0];
  let next = RANKS[1] || null;
  for (let i = 0; i < RANKS.length; i++) {
    if (volume >= RANKS[i].min) {
      current = RANKS[i];
      next = RANKS[i + 1] || null;
    }
  }
  return { current, next };
}

function renderRankHeader() {
  const volume = computeTotalVolume();
  const { current, next } = getRankInfo(volume);

  document.getElementById('rankLetter').textContent = current.letter;
  document.getElementById('rankTitle').textContent = current.title;
  document.getElementById('rankVolume').textContent = `${Math.round(volume).toLocaleString()} lbs total volume`;

  const fill = document.getElementById('xpBarFill');
  const label = document.getElementById('xpBarLabel');

  if (next) {
    const span = next.min - current.min;
    const progressed = volume - current.min;
    const pct = span > 0 ? Math.min(100, Math.max(0, (progressed / span) * 100)) : 100;
    fill.style.width = pct + '%';
    const remaining = Math.max(0, Math.round(next.min - volume));
    label.textContent = `${remaining.toLocaleString()} lbs to ${next.title}`;
  } else {
    fill.style.width = '100%';
    label.textContent = `Mythic rank achieved — peak of the arc`;
  }
}

/* =========================================================================
   Streak
   ========================================================================= */

function computeStreak() {
  const uniqueDates = [...new Set(data.workouts.map(w => w.date))].sort();
  if (uniqueDates.length === 0) return { count: 0, broken: true };

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const diffDays = (parseDateUTCms(uniqueDates[i]) - parseDateUTCms(uniqueDates[i - 1])) / 86400000;
    streak = diffDays <= 3 ? streak + 1 : 1;
  }

  const lastDate = uniqueDates[uniqueDates.length - 1];
  const diffFromToday = (parseDateUTCms(todayStr()) - parseDateUTCms(lastDate)) / 86400000;
  if (diffFromToday > 3) {
    return { count: 0, broken: true };
  }
  return { count: streak, broken: false };
}

function renderStreak() {
  const { count, broken } = computeStreak();
  document.getElementById('streakCount').textContent = broken ? '0' : String(count);
  document.getElementById('streakBadge').style.opacity = broken ? '0.5' : '1';
}

/* =========================================================================
   Tab navigation
   ========================================================================= */

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
  if (tab === 'history') renderHistory();
  if (tab === 'progress') renderProgress();
  if (tab === 'records') renderRecords();
  if (tab === 'exercises') renderExercisesManage();
}

/* =========================================================================
   START TAB — state
   ========================================================================= */

const startState = {
  categoryId: null,
  draft: null,        // { date, categoryId, exercises: [] }
  logger: null,        // { exerciseId, name, type, equipment, sets: [], notes, isNew }
};

function renderCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = '';

  for (const cat of data.categories) {
    const tile = document.createElement('button');
    tile.className = 'category-tile';
    tile.style.setProperty('--cat-color', cat.color);
    tile.innerHTML = `
      <span class="category-tile-name">${escapeHtml(cat.name)}</span>
      <span class="category-tile-count">${cat.exercises.length} exercise${cat.exercises.length === 1 ? '' : 's'}</span>
    `;
    tile.addEventListener('click', () => openCategoryBuilder(cat.id));
    grid.appendChild(tile);
  }

  const createTile = document.createElement('button');
  createTile.className = 'category-tile create-tile';
  createTile.textContent = '+ Create a New Workout';
  createTile.addEventListener('click', createNewCategory);
  grid.appendChild(createTile);
}

function createNewCategory() {
  const name = window.prompt('Name your new workout category:');
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (data.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
    showToast('A category with that name already exists.');
    return;
  }
  const color = CUSTOM_CATEGORY_COLORS[data.categories.filter(c => !c.permanent).length % CUSTOM_CATEGORY_COLORS.length];
  const cat = { id: uid('cat'), name: trimmed, color, permanent: false, exercises: [] };
  data.categories.push(cat);
  saveData();
  renderCategoryGrid();
  openCategoryBuilder(cat.id);
}

function openCategoryBuilder(categoryId) {
  startState.categoryId = categoryId;
  if (!startState.draft || startState.draft.categoryId !== categoryId) {
    startState.draft = { date: todayStr(), categoryId, exercises: [] };
  }
  startState.logger = null;

  document.getElementById('startStep1').hidden = true;
  document.getElementById('startStep2').hidden = false;

  const cat = getCategory(categoryId);
  document.getElementById('builderCategoryName').textContent = cat.name;
  document.getElementById('workoutDate').value = startState.draft.date;

  renderWordBank();
  renderLogger();
  renderWorkoutDraft();
}

function backToCategories() {
  document.getElementById('startStep1').hidden = false;
  document.getElementById('startStep2').hidden = true;
  renderCategoryGrid();
}

function renderWordBank() {
  const cat = getCategory(startState.categoryId);
  const row = document.getElementById('wordBankChips');
  row.innerHTML = '';
  if (cat.exercises.length === 0) {
    row.innerHTML = '<span class="empty-state" style="padding:0.4rem 0;">No exercises logged yet — add one below.</span>';
    return;
  }
  for (const ex of cat.exercises) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.innerHTML = `<span>${escapeHtml(ex.name)}</span><span class="chip-type">${typeTag(ex)}</span>`;
    chip.addEventListener('click', () => startLoggingExercise(ex));
    row.appendChild(chip);
  }
}

function typeTag(ex) {
  if (ex.type === 'time') return '⏱';
  if (ex.type === 'bodyweight') return 'BW';
  return EQUIPMENT_ABBR[ex.equipment] || 'OTH';
}

function findLastLoggedSets(categoryId, exerciseId) {
  const relevant = data.workouts
    .filter(w => w.categoryId === categoryId && w.exercises.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => parseDateUTCms(b.date) - parseDateUTCms(a.date) || b.createdAt - a.createdAt);
  if (relevant.length === 0) return null;
  const entry = relevant[0].exercises.find(e => e.exerciseId === exerciseId);
  return entry ? entry.sets.map(s => ({ ...s })) : null;
}

function blankSet(type) {
  if (type === 'weight') return { reps: '', weight: '', amrap: false };
  if (type === 'bodyweight') return { reps: '', amrap: false };
  return { duration: '' };
}

function startLoggingExercise(ex) {
  const lastSets = findLastLoggedSets(startState.categoryId, ex.id);
  startState.logger = {
    exerciseId: ex.id,
    name: ex.name,
    type: ex.type,
    equipment: ex.equipment,
    sets: lastSets && lastSets.length ? lastSets : [blankSet(ex.type)],
    notes: '',
    isNew: false,
  };
  renderLogger();
  document.getElementById('exerciseLogger').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function startNewExerciseFromInput() {
  const nameInput = document.getElementById('newExerciseName');
  const name = nameInput.value.trim();
  if (!name) {
    showToast('Type an exercise name first.');
    return;
  }
  const cat = getCategory(startState.categoryId);
  const type = document.getElementById('newExerciseType').value;
  const equipment = document.getElementById('newExerciseEquipment').value;

  const existing = cat.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    startLoggingExercise(existing);
    nameInput.value = '';
    return;
  }

  const ex = { id: uid('ex'), name, type, equipment: type === 'weight' ? equipment : null };
  cat.exercises.push(ex);
  saveData();
  renderWordBank();
  renderCategoryGrid();

  startState.logger = {
    exerciseId: ex.id, name: ex.name, type: ex.type, equipment: ex.equipment,
    sets: [blankSet(ex.type)], notes: '', isNew: true,
  };
  nameInput.value = '';
  renderLogger();
}

function renderLogger() {
  const logger = startState.logger;
  const el = document.getElementById('exerciseLogger');
  if (!logger) { el.hidden = true; return; }
  el.hidden = false;

  document.getElementById('loggerExerciseName').textContent = logger.name;
  document.getElementById('loggerTypeTag').textContent =
    logger.type === 'time' ? 'Time' : logger.type === 'bodyweight' ? 'Bodyweight' : `Weight & Reps · ${logger.equipment}`;

  const rowsEl = document.getElementById('setRows');
  rowsEl.innerHTML = '';
  logger.sets.forEach((set, i) => {
    const row = document.createElement('div');
    row.className = 'set-row';
    if (logger.type === 'weight') {
      row.innerHTML = `
        <span class="set-index">${i + 1}</span>
        <input type="number" min="0" class="set-reps" placeholder="reps" value="${set.reps}">
        <input type="number" min="0" step="0.5" class="set-weight" placeholder="lbs" value="${set.weight}">
        <label class="amrap-label"><input type="checkbox" class="set-amrap" ${set.amrap ? 'checked' : ''}> AMRAP</label>
        <button class="remove-set-btn" title="Remove set">&times;</button>
      `;
    } else if (logger.type === 'bodyweight') {
      row.innerHTML = `
        <span class="set-index">${i + 1}</span>
        <input type="number" min="0" class="set-reps" placeholder="reps" value="${set.reps}">
        <label class="amrap-label"><input type="checkbox" class="set-amrap" ${set.amrap ? 'checked' : ''}> AMRAP</label>
        <button class="remove-set-btn" title="Remove set">&times;</button>
      `;
    } else {
      row.innerHTML = `
        <span class="set-index">${i + 1}</span>
        <input type="number" min="0" class="set-duration" placeholder="seconds" value="${set.duration}">
        <span style="color:var(--text-dim); font-size:0.72rem;">sec</span>
        <button class="remove-set-btn" title="Remove set">&times;</button>
      `;
    }

    row.querySelector('.set-reps')?.addEventListener('input', e => { set.reps = e.target.value; });
    row.querySelector('.set-weight')?.addEventListener('input', e => { set.weight = e.target.value; });
    row.querySelector('.set-duration')?.addEventListener('input', e => { set.duration = e.target.value; });
    row.querySelector('.set-amrap')?.addEventListener('change', e => { set.amrap = e.target.checked; });
    row.querySelector('.remove-set-btn').addEventListener('click', () => {
      logger.sets.splice(i, 1);
      renderLogger();
    });

    rowsEl.appendChild(row);
  });

  document.getElementById('exerciseNotes').value = logger.notes;
}

function addSetRow() {
  const logger = startState.logger;
  if (!logger) return;
  logger.sets.push(blankSet(logger.type));
  renderLogger();
}

function sameAsLastSet() {
  const logger = startState.logger;
  if (!logger) return;
  if (logger.sets.length === 0) {
    logger.sets.push(blankSet(logger.type));
  } else {
    logger.sets.push({ ...logger.sets[logger.sets.length - 1] });
  }
  renderLogger();
}

function cancelLogger() {
  startState.logger = null;
  renderLogger();
}

function addLoggerToWorkout() {
  const logger = startState.logger;
  if (!logger) return;
  if (logger.sets.length === 0) {
    showToast('Add at least one set first.');
    return;
  }

  logger.notes = document.getElementById('exerciseNotes').value.trim();

  startState.draft.exercises.push({
    exerciseId: logger.exerciseId,
    name: logger.name,
    type: logger.type,
    equipment: logger.equipment,
    sets: logger.sets.map(s => ({ ...s })),
    notes: logger.notes,
  });

  startState.logger = null;
  renderLogger();
  renderWorkoutDraft();
  showToast(`${logger.name} added to workout.`);
}

function renderWorkoutDraft() {
  const draft = startState.draft;
  const section = document.getElementById('thisWorkoutSection');
  if (!draft || draft.exercises.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const list = document.getElementById('workoutDraftList');
  list.innerHTML = '';
  draft.exercises.forEach((ex, i) => {
    const row = document.createElement('div');
    row.className = 'draft-exercise';
    row.innerHTML = `
      <div>
        <div class="draft-exercise-name">${escapeHtml(ex.name)}</div>
        <div class="draft-exercise-sets">${formatSetsSummary(ex)}</div>
        ${ex.notes ? `<div class="draft-exercise-notes">"${escapeHtml(ex.notes)}"</div>` : ''}
      </div>
      <button class="remove-draft-btn" title="Remove exercise">&times;</button>
    `;
    row.querySelector('.remove-draft-btn').addEventListener('click', () => {
      draft.exercises.splice(i, 1);
      renderWorkoutDraft();
    });
    list.appendChild(row);
  });
}

function formatSetsSummary(ex) {
  return ex.sets.map(s => {
    if (ex.type === 'weight') return `${s.reps || 0}×${s.weight || 0}${s.amrap ? '*' : ''}`;
    if (ex.type === 'bodyweight') return `${s.reps || 0} reps${s.amrap ? '*' : ''}`;
    return `${s.duration || 0}s`;
  }).join(', ');
}

function saveWorkout() {
  const draft = startState.draft;
  if (!draft || draft.exercises.length === 0) return;

  const workout = {
    id: uid('wkt'),
    date: draft.date,
    categoryId: draft.categoryId,
    exercises: draft.exercises,
    activeCalories: Number(document.getElementById('activeCalories').value) || 0,
    totalCalories: Number(document.getElementById('totalCalories').value) || 0,
    effort: Number(document.getElementById('effortSlider').value) || 5,
    createdAt: Date.now(),
  };
  data.workouts.push(workout);
  saveData();

  startState.draft = null;
  startState.logger = null;
  startState.categoryId = null;
  document.getElementById('activeCalories').value = '';
  document.getElementById('totalCalories').value = '';
  document.getElementById('effortSlider').value = 5;
  document.getElementById('effortValue').textContent = '5';

  renderAll();
  backToCategories();
  switchTab('history');
  showToast('Workout saved!');
}

/* =========================================================================
   HISTORY TAB
   ========================================================================= */

let expandedWorkoutId = null;

function renderHistory() {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  list.innerHTML = '';

  const sorted = [...data.workouts].sort((a, b) =>
    parseDateUTCms(b.date) - parseDateUTCms(a.date) || b.createdAt - a.createdAt);

  empty.hidden = sorted.length > 0;

  for (const w of sorted) {
    const cat = getCategory(w.categoryId);
    const item = document.createElement('div');
    item.className = 'history-item' + (expandedWorkoutId === w.id ? ' expanded' : '');
    item.style.setProperty('--cat-color', cat ? cat.color : '#9B7FE0');

    const exercisesHtml = w.exercises.map(ex => `
      <div class="history-exercise">
        <div class="history-exercise-name">${escapeHtml(ex.name)}</div>
        <div class="history-set-list">${formatHistorySets(ex)}</div>
        ${ex.notes ? `<div class="history-exercise-notes">"${escapeHtml(ex.notes)}"</div>` : ''}
      </div>
    `).join('');

    item.innerHTML = `
      <div class="history-item-header">
        <div>
          <div class="history-item-category">${escapeHtml(cat ? cat.name : 'Unknown')}</div>
          <div class="history-item-date">${formatDateDisplay(w.date)}</div>
        </div>
        <span class="link-btn">${expandedWorkoutId === w.id ? 'Hide' : 'View'}</span>
      </div>
      <div class="history-item-body">
        ${exercisesHtml}
        <div class="history-summary">
          <span>Active: ${w.activeCalories} cal</span>
          <span>Total: ${w.totalCalories} cal</span>
          <span>Effort: ${w.effort}/10</span>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-ghost btn-danger delete-workout-btn">Delete Workout</button>
        </div>
      </div>
    `;

    item.querySelector('.history-item-header').addEventListener('click', () => {
      expandedWorkoutId = expandedWorkoutId === w.id ? null : w.id;
      renderHistory();
    });
    item.querySelector('.delete-workout-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete the workout from ${formatDateDisplay(w.date)}? This cannot be undone.`)) {
        data.workouts = data.workouts.filter(x => x.id !== w.id);
        saveData();
        renderAll();
      }
    });

    list.appendChild(item);
  }
}

function formatHistorySets(ex) {
  return ex.sets.map((s, i) => {
    const amrap = s.amrap ? '<span class="amrap-tag"> AMRAP</span>' : '';
    if (ex.type === 'weight') return `${s.reps || 0} × ${s.weight || 0} lbs${amrap}`;
    if (ex.type === 'bodyweight') return `${s.reps || 0} reps${amrap}`;
    return `${s.duration || 0} sec`;
  }).join(' &nbsp;|&nbsp; ');
}

/* =========================================================================
   PROGRESS TAB
   ========================================================================= */

const progressState = { exerciseKey: null, range: 'all' };

function allLoggedExercises() {
  const map = new Map();
  for (const w of data.workouts) {
    const cat = getCategory(w.categoryId);
    for (const ex of w.exercises) {
      if (!map.has(ex.exerciseId)) {
        map.set(ex.exerciseId, { exerciseId: ex.exerciseId, name: ex.name, type: ex.type, categoryName: cat ? cat.name : '' });
      }
    }
  }
  return [...map.values()];
}

function renderProgress() {
  const select = document.getElementById('progressExerciseSelect');
  const exercises = allLoggedExercises();
  const nameCounts = {};
  exercises.forEach(e => { nameCounts[e.name] = (nameCounts[e.name] || 0) + 1; });

  const prevValue = progressState.exerciseKey;
  select.innerHTML = exercises.map(e =>
    `<option value="${e.exerciseId}">${escapeHtml(e.name)}${nameCounts[e.name] > 1 ? ` (${escapeHtml(e.categoryName)})` : ''}</option>`
  ).join('');

  if (exercises.length === 0) {
    document.getElementById('progressEmpty').hidden = false;
    document.getElementById('progressContent').hidden = true;
    return;
  }
  document.getElementById('progressEmpty').hidden = true;
  document.getElementById('progressContent').hidden = false;

  if (prevValue && exercises.some(e => e.exerciseId === prevValue)) {
    select.value = prevValue;
    progressState.exerciseKey = prevValue;
  } else {
    progressState.exerciseKey = exercises[0].exerciseId;
    select.value = progressState.exerciseKey;
  }

  renderProgressDetail();
}

function metricValue(type, set) {
  if (type === 'weight') return Number(set.weight) || 0;
  if (type === 'bodyweight') return Number(set.reps) || 0;
  return Number(set.duration) || 0;
}

function sessionVolume(type, ex) {
  return ex.sets.reduce((sum, s) => {
    if (type === 'weight') return sum + (Number(s.reps) || 0) * (Number(s.weight) || 0);
    if (type === 'bodyweight') return sum + (Number(s.reps) || 0);
    return sum + (Number(s.duration) || 0);
  }, 0);
}

function formatBestSet(type, set) {
  if (!set) return '—';
  if (type === 'weight') return `${set.weight || 0} lbs × ${set.reps || 0}${set.amrap ? '*' : ''}`;
  if (type === 'bodyweight') return `${set.reps || 0} reps${set.amrap ? '*' : ''}`;
  return `${set.duration || 0} sec`;
}

function chartUnitLabel(type) {
  if (type === 'weight') return 'Tracking heaviest weight lifted per session (lbs)';
  if (type === 'bodyweight') return 'Tracking best reps per session';
  return 'Tracking longest hold per session (sec)';
}

function rangeStartMs(range) {
  if (range === 'all') return -Infinity;
  const days = { '30': 30, '90': 90, '365': 365 }[range];
  return parseDateUTCms(todayStr()) - days * 86400000;
}

function renderProgressDetail() {
  const exerciseId = progressState.exerciseKey;
  if (!exerciseId) return;
  const startMs = rangeStartMs(progressState.range);

  const sessions = [];
  for (const w of data.workouts) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;
    if (parseDateUTCms(w.date) < startMs) continue;
    sessions.push({ date: w.date, ex, createdAt: w.createdAt });
  }
  sessions.sort((a, b) => parseDateUTCms(a.date) - parseDateUTCms(b.date) || a.createdAt - b.createdAt);

  if (sessions.length === 0) {
    document.getElementById('statPR').textContent = '—';
    document.getElementById('statCount').textContent = '0';
    document.getElementById('statRecent').textContent = '—';
    document.getElementById('chartUnitLabel').textContent = '';
    document.getElementById('progressChart').innerHTML = '<span class="empty-state">No sessions in this range.</span>';
    document.getElementById('sessionLogBody').innerHTML = '';
    return;
  }

  const type = sessions[0].ex.type;

  const sessionBests = sessions.map(s => {
    let best = s.ex.sets[0];
    let bestVal = metricValue(type, best);
    for (const set of s.ex.sets) {
      const v = metricValue(type, set);
      if (v > bestVal) { bestVal = v; best = set; }
    }
    return { date: s.date, best, bestVal, volume: sessionVolume(type, s.ex), notes: s.ex.notes };
  });

  let prSession = sessionBests[0];
  for (const s of sessionBests) if (s.bestVal > prSession.bestVal) prSession = s;

  document.getElementById('statPR').textContent = formatBestSet(type, prSession.best);
  document.getElementById('statCount').textContent = String(sessions.length);
  document.getElementById('statRecent').textContent = formatBestSet(type, sessionBests[sessionBests.length - 1].best);
  document.getElementById('chartUnitLabel').textContent = chartUnitLabel(type);

  const chart = document.getElementById('progressChart');
  const marginX = 28;
  const pointGap = 56;
  const width = Math.max(280, marginX * 2 + (sessionBests.length - 1) * pointGap);
  const height = 170;
  const plotTop = 14, plotBottom = 120, labelY = 138;
  const maxVal = Math.max(...sessionBests.map(s => s.bestVal), 1);
  const effectiveMax = maxVal * 1.15;

  const xAt = (i) => sessionBests.length === 1 ? width / 2 : marginX + i * ((width - marginX * 2) / (sessionBests.length - 1));
  const yAt = (val) => plotBottom - (val / effectiveMax) * (plotBottom - plotTop);

  const points = sessionBests.map((s, i) => ({ x: xAt(i), y: yAt(s.bestVal), s }));

  const polylinePts = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const circles = points.map(p => {
    const isBest = p.s.bestVal === prSession.bestVal;
    return `<circle class="line-chart-point${isBest ? ' best' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isBest ? 5 : 3.5}"><title>${formatDateDisplay(p.s.date)}: ${formatBestSet(type, p.s.best)}</title></circle>`;
  }).join('');
  const dateLabels = points.map(p =>
    `<text class="line-chart-label" x="${p.x.toFixed(1)}" y="${labelY}" text-anchor="middle">${formatDateShort(p.s.date)}</text>`
  ).join('');
  const bestPoint = points.find(p => p.s.bestVal === prSession.bestVal);
  const bestLabel = bestPoint
    ? `<text class="line-chart-value-label best" x="${bestPoint.x.toFixed(1)}" y="${(bestPoint.y - 9).toFixed(1)}" text-anchor="middle">${Math.round(bestPoint.s.bestVal)}</text>`
    : '';

  chart.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline class="line-chart-line" points="${polylinePts}"></polyline>
      ${circles}
      ${dateLabels}
      ${bestLabel}
    </svg>
  `;

  const body = document.getElementById('sessionLogBody');
  body.innerHTML = sessionBests.slice().reverse().map(s => `
    <tr>
      <td>${formatDateDisplay(s.date)}</td>
      <td>${formatBestSet(type, s.best)}</td>
      <td>${Math.round(s.volume).toLocaleString()}</td>
      <td>${s.notes ? escapeHtml(s.notes) : '—'}</td>
    </tr>
  `).join('');
}

/* =========================================================================
   RECORDS TAB
   ========================================================================= */

const recordsState = { categoryId: 'all' };

function renderRecordsCategoryFilter() {
  const select = document.getElementById('recordsCategoryFilter');
  const prevValue = recordsState.categoryId;
  select.innerHTML = '<option value="all">All Categories</option>' +
    data.categories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join('');

  if (prevValue !== 'all' && !data.categories.some(c => c.id === prevValue)) {
    recordsState.categoryId = 'all';
  }
  select.value = recordsState.categoryId;
}

function renderRecords() {
  renderRecordsCategoryFilter();

  const list = document.getElementById('recordsList');
  const emptyEl = document.getElementById('recordsEmpty');
  list.innerHTML = '';
  let anyRecords = false;

  const categoriesToShow = recordsState.categoryId === 'all'
    ? data.categories
    : data.categories.filter(c => c.id === recordsState.categoryId);

  for (const cat of categoriesToShow) {
    const rows = [];
    for (const ex of cat.exercises) {
      let best = null;
      let bestDate = null;
      for (const w of data.workouts.filter(w => w.categoryId === cat.id)) {
        const entry = w.exercises.find(e => e.exerciseId === ex.id);
        if (!entry) continue;
        for (const set of entry.sets) {
          const v = metricValue(ex.type, set);
          if (best === null || v > best.val || (v === best.val && parseDateUTCms(w.date) < parseDateUTCms(bestDate))) {
            best = { val: v, set };
            bestDate = w.date;
          }
        }
      }
      if (best) rows.push({ ex, best, bestDate });
    }
    if (rows.length === 0) continue;
    anyRecords = true;

    const group = document.createElement('div');
    group.className = 'records-group';
    group.innerHTML = `<div class="records-group-title">${escapeHtml(cat.name)}</div>`;
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'record-row';
      row.innerHTML = `
        <span class="record-name">${escapeHtml(r.ex.name)}</span>
        <span class="record-value">${formatBestSet(r.ex.type, r.best.set)}</span>
        <span class="record-date">${formatDateDisplay(r.bestDate)}</span>
      `;
      group.appendChild(row);
    }
    list.appendChild(group);
  }

  emptyEl.hidden = anyRecords;
  emptyEl.textContent = recordsState.categoryId === 'all'
    ? 'No records yet — log a workout to start setting them.'
    : 'No records for this category yet.';
}

/* =========================================================================
   EXERCISES TAB
   ========================================================================= */

function renderExercisesManage() {
  const list = document.getElementById('exercisesManageList');
  list.innerHTML = '';

  for (const cat of data.categories) {
    const group = document.createElement('div');
    group.className = 'exercise-manage-group';
    group.innerHTML = `
      <div class="exercise-manage-title">
        <span>${escapeHtml(cat.name)}${cat.permanent ? ' <span style="color:var(--text-dim); font-weight:400; font-size:0.75rem;">(permanent)</span>' : ''}</span>
        ${cat.permanent ? '' : '<button class="delete-category-btn">Delete Category</button>'}
      </div>
    `;

    if (cat.exercises.length === 0) {
      group.innerHTML += '<p class="empty-state" style="padding:0.5rem 0;">No exercises yet.</p>';
    } else {
      for (const ex of cat.exercises) {
        const row = document.createElement('div');
        row.className = 'exercise-manage-row';
        row.innerHTML = `
          <span class="exercise-manage-name">${escapeHtml(ex.name)} <span class="chip-type">${typeTag(ex)}</span></span>
          <span class="exercise-manage-actions"><button class="remove-exercise-btn">Remove</button></span>
        `;
        row.querySelector('.remove-exercise-btn').addEventListener('click', () => {
          if (confirm(`Remove "${ex.name}" from the ${cat.name} word bank? Past logged workouts are kept.`)) {
            cat.exercises = cat.exercises.filter(e => e.id !== ex.id);
            saveData();
            renderExercisesManage();
            renderCategoryGrid();
          }
        });
        group.appendChild(row);
      }
    }

    const deleteCatBtn = group.querySelector('.delete-category-btn');
    if (deleteCatBtn) {
      deleteCatBtn.addEventListener('click', () => {
        if (confirm(`Delete "${cat.name}"? This also deletes all workouts logged under it. This cannot be undone.`)) {
          data.categories = data.categories.filter(c => c.id !== cat.id);
          data.workouts = data.workouts.filter(w => w.categoryId !== cat.id);
          saveData();
          renderAll();
        }
      });
    }

    list.appendChild(group);
  }
}

/* =========================================================================
   IMPORT TAB
   ========================================================================= */

function findOrCreateCategoryByName(name) {
  let cat = data.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) {
    const color = CUSTOM_CATEGORY_COLORS[data.categories.filter(c => !c.permanent).length % CUSTOM_CATEGORY_COLORS.length];
    cat = { id: uid('cat'), name, color, permanent: false, exercises: [] };
    data.categories.push(cat);
  }
  return cat;
}

function findOrCreateExercise(cat, name, hintType, hintEquipment) {
  let ex = cat.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (!ex) {
    ex = { id: uid('ex'), name, type: hintType, equipment: hintType === 'weight' ? hintEquipment : null };
    cat.exercises.push(ex);
  }
  return ex;
}

function runImport() {
  const raw = document.getElementById('importTextarea').value;
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const workoutsInProgress = new Map(); // key: date|catId -> workout object (with exercises map)
  const errors = [];
  let setsImported = 0;

  function getWorkoutBucket(date, cat) {
    const key = date + '|' + cat.id;
    if (!workoutsInProgress.has(key)) {
      workoutsInProgress.set(key, {
        date, categoryId: cat.id,
        exercisesMap: new Map(),
        activeCalories: 0, totalCalories: 0, effort: 5,
      });
    }
    return workoutsInProgress.get(key);
  }

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const fields = line.split(',').map(f => f.trim());

    if (fields[0].toUpperCase() === '#SUMMARY') {
      if (fields.length < 6) { errors.push(`Line ${lineNum}: #SUMMARY needs 5 fields after the tag.`); return; }
      const [, date, catName, active, totalCal, effort] = fields;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Line ${lineNum}: bad date "${date}".`); return; }
      if (!catName) { errors.push(`Line ${lineNum}: missing category.`); return; }
      const cat = findOrCreateCategoryByName(catName);
      const bucket = getWorkoutBucket(date, cat);
      bucket.activeCalories = Number(active) || 0;
      bucket.totalCalories = Number(totalCal) || 0;
      bucket.effort = Math.min(10, Math.max(1, Number(effort) || 5));
      return;
    }

    if (fields.length !== 8) {
      errors.push(`Line ${lineNum}: expected 8 fields, got ${fields.length}.`);
      return;
    }
    let [date, catName, exName, repsField, weightField, notes, equipment, amrapField] = fields;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Line ${lineNum}: bad date "${date}".`); return; }
    if (!catName) { errors.push(`Line ${lineNum}: missing category.`); return; }
    if (!exName) { errors.push(`Line ${lineNum}: missing exercise name.`); return; }

    equipment = EQUIPMENT_OPTIONS.find(o => o.toLowerCase() === equipment.toLowerCase()) || 'Other';
    const amrap = ['yes', 'true', '1'].includes((amrapField || '').toLowerCase());

    const cat = findOrCreateCategoryByName(catName);
    const existingEx = cat.exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());

    let type;
    if (existingEx) {
      type = existingEx.type;
    } else if (weightField.toLowerCase() === 'bw') {
      type = 'bodyweight';
    } else if (repsField !== '' && weightField !== '' && Number(repsField) === Number(weightField) && !isNaN(Number(repsField))) {
      type = 'time';
    } else {
      type = 'weight';
    }

    let set;
    if (type === 'weight') {
      const reps = Number(repsField), weight = Number(weightField);
      if (isNaN(reps) || isNaN(weight)) { errors.push(`Line ${lineNum}: reps/weight must be numeric for a weight exercise.`); return; }
      set = { reps, weight, amrap };
    } else if (type === 'bodyweight') {
      const reps = Number(repsField);
      if (isNaN(reps)) { errors.push(`Line ${lineNum}: reps must be numeric for a bodyweight exercise.`); return; }
      set = { reps, amrap };
    } else {
      const duration = Number(weightField) || Number(repsField);
      if (isNaN(duration)) { errors.push(`Line ${lineNum}: duration must be numeric for a time exercise.`); return; }
      set = { duration };
    }

    const ex = findOrCreateExercise(cat, exName, type, equipment);
    const bucket = getWorkoutBucket(date, cat);
    if (!bucket.exercisesMap.has(ex.id)) {
      bucket.exercisesMap.set(ex.id, { exerciseId: ex.id, name: ex.name, type: ex.type, equipment: ex.equipment, sets: [], notes: notes || '' });
    }
    const entry = bucket.exercisesMap.get(ex.id);
    entry.sets.push(set);
    if (notes && !entry.notes) entry.notes = notes;
    setsImported++;
  });

  let workoutsImported = 0;
  for (const bucket of workoutsInProgress.values()) {
    if (bucket.exercisesMap.size === 0) continue;
    data.workouts.push({
      id: uid('wkt'),
      date: bucket.date,
      categoryId: bucket.categoryId,
      exercises: [...bucket.exercisesMap.values()],
      activeCalories: bucket.activeCalories,
      totalCalories: bucket.totalCalories,
      effort: bucket.effort,
      createdAt: Date.now(),
    });
    workoutsImported++;
  }

  saveData();
  renderAll();

  const resultEl = document.getElementById('importResult');
  resultEl.hidden = false;
  resultEl.innerHTML = `
    <strong>${workoutsImported} workout${workoutsImported === 1 ? '' : 's'}</strong> and
    <strong>${setsImported} set${setsImported === 1 ? '' : 's'}</strong> imported.
    ${errors.length ? `<div>${errors.length} line${errors.length === 1 ? '' : 's'} failed to parse:</div><div class="import-errors">${errors.map(escapeHtml).join('\n')}</div>` : ''}
  `;
  if (workoutsImported > 0) showToast('Import complete!');
}

/* =========================================================================
   Global render + init
   ========================================================================= */

function renderAll() {
  renderRankHeader();
  renderStreak();
  renderCategoryGrid();
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (activeTab === 'history') renderHistory();
  if (activeTab === 'progress') renderProgress();
  if (activeTab === 'records') renderRecords();
  if (activeTab === 'exercises') renderExercisesManage();
}

function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('backToCategories').addEventListener('click', backToCategories);
  document.getElementById('workoutDate').addEventListener('change', (e) => {
    if (startState.draft) startState.draft.date = e.target.value;
  });

  document.getElementById('startNewExerciseBtn').addEventListener('click', startNewExerciseFromInput);
  document.getElementById('newExerciseType').addEventListener('change', (e) => {
    document.getElementById('newExerciseEquipment').style.display = e.target.value === 'weight' ? '' : 'none';
  });
  document.getElementById('newExerciseEquipment').style.display = '';

  document.getElementById('addSetBtn').addEventListener('click', addSetRow);
  document.getElementById('sameAsLastBtn').addEventListener('click', sameAsLastSet);
  document.getElementById('cancelExerciseBtn').addEventListener('click', cancelLogger);
  document.getElementById('addToWorkoutBtn').addEventListener('click', addLoggerToWorkout);

  document.getElementById('effortSlider').addEventListener('input', (e) => {
    document.getElementById('effortValue').textContent = e.target.value;
  });
  document.getElementById('saveWorkoutBtn').addEventListener('click', saveWorkout);

  document.getElementById('progressExerciseSelect').addEventListener('change', (e) => {
    progressState.exerciseKey = e.target.value;
    renderProgressDetail();
  });
  document.getElementById('progressRangeToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.range-btn');
    if (!btn) return;
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    progressState.range = btn.dataset.range;
    renderProgressDetail();
  });

  document.getElementById('importBtn').addEventListener('click', runImport);

  document.getElementById('recordsCategoryFilter').addEventListener('change', (e) => {
    recordsState.categoryId = e.target.value;
    renderRecords();
  });
}

function init() {
  bindEvents();
  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
