<template>
  <div class="app-layout">
    <!-- Collapsible Sidebar (Recipes Library) -->
    <Sidebar
      :isOpen="isSidebarOpen"
      :recipes="recipes"
      :loading="loadingRecipes"
      @close="isSidebarOpen = false"
      @create-recipe="openRecipeForm(null)"
      @recipe-click="openRecipeDetails"
      @tag-click="startTagSearch"
      @quick-plan="openQuickPlanDropdown"
    />

    <!-- Main Content (Header + Weekly Planner Grid) -->
    <main class="planner-main-content">
      <!-- Header Area -->
      <Header
        :visibleDays="visibleDays"
        :isTodayInViewport="isTodayInViewport"
        @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
        @open-search="openSearchOverlay"
        @slide-days="slideDays"
        @go-today="goToday"
        @open-settings="isSettingsOpen = true"
      />

      <!-- Spalten Grid -->
      <WeeklyPlanner
        ref="plannerRef"
        :visibleDays="renderedDays"
        :assignments="rollingAssignments"
        @recipe-click="openRecipeDetails"
        @remove-assignment="removeRecipeAssignment"
        @reorder-assignment="reorderRecipeAssignment"
        @move-assignment="moveAssignment"
        @assign-recipe="onRecipeDropped"
        @open-slot-quick-assign="openSlotQuickAssignDropdown"
        @update-start-date="updateStartDate"
      />
    </main>
  </div>

  <!-- MODALS -->
  
  <!-- Recipe Form (Create / Edit) -->
  <RecipeFormModal
    :isOpen="isRecipeFormOpen"
    :recipeToEdit="recipeToEdit"
    @close="isRecipeFormOpen = false"
    @recipe-saved="onRecipeSaved"
  />

  <!-- Recipe Details Viewer & Gallery Manager -->
  <RecipeDetailModal
    :isOpen="isRecipeDetailsOpen"
    :recipe="detailRecipe"
    :visibleDays="visibleDays"
    :assignments="rollingAssignments"
    @close="closeRecipeDetails"
    @recipe-updated="onRecipeUpdated"
    @recipe-deleted="onRecipeDeleted"
    @toggle-assignment="toggleRecipeAssignmentFromDetails"
    @tag-click="startTagSearch"
    @edit-recipe="openRecipeFormFromDetails"
  />

  <!-- Weekly Plan Creator -->
  <PlanCreateModal
    :isOpen="isPlanCreateOpen"
    @close="isPlanCreateOpen = false"
    @plan-created="onPlanCreated"
  />

  <!-- Integrated Unified Spotlight Search Overlay -->
  <SearchOverlay
    :isOpen="isSearchOpen"
    :recipes="searchResults"
    :loading="loadingSearch"
    :initialQuery="searchQuery"
    @close="isSearchOpen = false"
    @search-query-changed="onSearchQueryChanged"
    @recipe-click="openRecipeDetailsFromSearch"
    @tag-click="startTagSearch"
    @drag-start="isSidebarOpen = false"
  />

  <!-- Settings Modal -->
  <SettingsModal
    :isOpen="isSettingsOpen"
    :theme="themePreference"
    :daysCount="rollingDaysCount"
    @close="isSettingsOpen = false"
    @update:theme="applyTheme"
    @update:daysCount="changeDaysCount"
  />

  <!-- FLOATING QUICK ASSIGN DROPDOWNS -->

  <!-- Floating Quick Assign Slot Dropdown (triggers when clicking empty Slot) -->
  <div
    v-if="quickAssignSlot"
    class="floating-assign-dropdown glass"
    :style="quickAssignSlotStyle"
  >
    <span style="font-size:10px; font-weight:700; color:var(--text-secondary); padding:4px; text-transform:uppercase;">Gericht wählen:</span>
    <span v-if="recipes.length === 0" style="font-size:11px; color:var(--text-muted); padding:8px;">Keine Rezepte erfasst.</span>
    <button
      v-for="recipe in recipes"
      :key="recipe.id"
      class="btn btn-secondary btn-small"
      style="justify-content: flex-start; padding: 6px 8px; font-size:12px; text-align:left; font-weight:500;"
      @click="assignRecipeFromQuick(recipe.id)"
    >
      {{ recipe.title }}
    </button>
  </div>

  <!-- Floating Quick Plan Sidebar Recipe Dropdown (triggers when clicking calendar icon on card) -->
  <div
    v-if="quickPlanRecipe"
    class="floating-assign-dropdown glass"
    :style="quickPlanRecipeStyle"
  >
    <span style="font-size:10px; font-weight:700; color:var(--text-secondary); padding:4px; text-transform:uppercase;">Planen für:</span>
    <div
      v-for="day in visibleDays.filter(d => !d.isPast)"
      :key="day.formattedDateStr"
      style="display:flex; align-items:center; justify-content:space-between; padding:4px; font-size:12px;"
    >
      <span style="font-weight:600;">{{ day.name }} ({{ day.dateSubtitle }})</span>
      <div style="display:flex; gap:2px;">
        <button
          class="btn btn-secondary btn-small"
          :style="['padding:2px 6px; font-size:9px;', isLunchAssignedToRecipe(day.formattedDateStr, quickPlanRecipe.recipe.id) ? 'background:var(--accent-primary); color:white;' : '']"
          @click="toggleAssignmentFromQuick(day.formattedDateStr, 'lunch', quickPlanRecipe.recipe.id)"
        >
          M
        </button>
        <button
          class="btn btn-secondary btn-small"
          :style="['padding:2px 6px; font-size:9px;', isDinnerAssignedToRecipe(day.formattedDateStr, quickPlanRecipe.recipe.id) ? 'background:var(--accent-primary); color:white;' : '']"
          @click="toggleAssignmentFromQuick(day.formattedDateStr, 'dinner', quickPlanRecipe.recipe.id)"
        >
          A
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Sidebar from './components/Sidebar.vue';
import Header from './components/Header.vue';
import WeeklyPlanner from './components/WeeklyPlanner.vue';
import RecipeFormModal from './components/RecipeFormModal.vue';
import RecipeDetailModal from './components/RecipeDetailModal.vue';
import PlanCreateModal from './components/PlanCreateModal.vue';
import SearchOverlay from './components/SearchOverlay.vue';
import SettingsModal from './components/SettingsModal.vue';

const EnglishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getMidnightDate(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// REACTIVE STATE
const recipes = ref([]);
const plans = ref([]);

const loadingRecipes = ref(false);
const loadingSearch = ref(false);
const searchResults = ref([]);
const searchQuery = ref('');

// Rolling calendar timeline state
const rollingDaysCount = ref(parseInt(localStorage.getItem('rolling_days_count') || '7'));
const isSettingsOpen = ref(false);
const themePreference = ref(localStorage.getItem('theme_preference') || 'system');
const rollingStartDate = ref(getMidnightDate());
const weeklyPlansCache = ref({});

// MODALS CONTROL STATE
const isSidebarOpen = ref(false);
const isSearchOpen = ref(false);
const isRecipeDetailsOpen = ref(false);
const detailRecipe = ref(null);
const isRecipeFormOpen = ref(false);
const recipeToEdit = ref(null);
const isPlanCreateOpen = ref(false);

const plannerRef = ref(null);

// FLOATING POPUPS STATE
const quickAssignSlot = ref(null); // { dayKey, slotKey, rect }
const quickPlanRecipe = ref(null); // { recipe, rect }

// STYLES FOR FLOATING POPUPS
const quickAssignSlotStyle = computed(() => {
  if (!quickAssignSlot.value) return {};
  return {
    position: 'absolute',
    zIndex: 1000,
    background: 'var(--bg-glass-heavy)',
    border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px',
    boxShadow: 'var(--card-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '250px',
    overflowY: 'auto',
    width: '210px',
    top: `${quickAssignSlot.value.rect.bottom + window.scrollY + 4}px`,
    left: `${quickAssignSlot.value.rect.left + window.scrollX}px`
  };
});

const quickPlanRecipeStyle = computed(() => {
  if (!quickPlanRecipe.value) return {};
  return {
    position: 'absolute',
    zIndex: 1000,
    background: 'var(--bg-glass-heavy)',
    border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px',
    boxShadow: 'var(--card-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '180px',
    maxHeight: '250px',
    overflowY: 'auto',
    top: `${quickPlanRecipe.value.rect.bottom + window.scrollY + 4}px`,
    left: `${quickPlanRecipe.value.rect.left + window.scrollX - 140}px`
  };
});

let refreshIntervalId = null;

async function refreshPlanData() {
  const loadedMondays = Object.keys(weeklyPlansCache.value);
  if (loadedMondays.length === 0) return;
  
  try {
    const data = await apiFetch('/api/plans');
    if (data) {
      plans.value = data;
    }
    
    for (const M of loadedMondays) {
      const existing = plans.value.find(p => p.start_date === M);
      if (existing) {
        const fullPlan = await apiFetch(`/api/plans/${existing.id}`);
        if (fullPlan) {
          weeklyPlansCache.value[M] = fullPlan;
        }
      }
    }
  } catch (err) {
    console.error('Fehler bei der automatischen periodischen Aktualisierung der Pläne:', err);
  }
}

function startStatusRefresh() {
  stopStatusRefresh();
  refreshIntervalId = setInterval(refreshPlanData, 5000);
}

function stopStatusRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

// LIFE CYCLE HOOKS
onMounted(async () => {
  initTheme();
  await loadPlansOnly();
  loadRecipes();
  window.addEventListener('click', handleGlobalClick);
  window.addEventListener('keydown', handleGlobalKeydown);
  startStatusRefresh();
});

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick);
  window.removeEventListener('keydown', handleGlobalKeydown);
  stopStatusRefresh();
  if (systemThemeMediaQuery) {
    systemThemeMediaQuery.removeEventListener('change', onSystemThemeChange);
  }
});

// FUNCTIONS & LOGIC

// Theme management (system / light / dark)
let systemThemeMediaQuery = null;

function applyThemeToDOM(mode) {
  if (mode === 'dark') {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  }
}

function onSystemThemeChange(e) {
  if (themePreference.value === 'system') {
    applyThemeToDOM(e.matches ? 'dark' : 'light');
  }
}

function initTheme() {
  // Migrate old 'theme' key to new 'theme_preference' if needed
  const oldTheme = localStorage.getItem('theme');
  if (oldTheme && !localStorage.getItem('theme_preference')) {
    localStorage.setItem('theme_preference', oldTheme);
    localStorage.removeItem('theme');
    themePreference.value = oldTheme;
  }

  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeMediaQuery.addEventListener('change', onSystemThemeChange);

  const pref = themePreference.value;
  if (pref === 'system') {
    applyThemeToDOM(systemThemeMediaQuery.matches ? 'dark' : 'light');
  } else {
    applyThemeToDOM(pref);
  }
}

function applyTheme(newPref) {
  themePreference.value = newPref;
  localStorage.setItem('theme_preference', newPref);

  if (newPref === 'system') {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyThemeToDOM(systemPrefersDark ? 'dark' : 'light');
  } else {
    applyThemeToDOM(newPref);
  }
}

// Central API Fetch Helper
async function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`API-Fehler ${res.status}: ${errorText || res.statusText}`);
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }
  return null;
}

// Fetch APIs
async function loadRecipes(query = '') {
  loadingRecipes.value = query.length === 0;
  loadingSearch.value = query.length > 0;
  
  try {
    const url = query ? `/api/recipes?q=${encodeURIComponent(query)}` : '/api/recipes';
    const data = await apiFetch(url);
    if (query.length > 0) {
      searchResults.value = data || [];
    } else {
      recipes.value = data || [];
    }
  } catch (err) {
    console.error('Fehler beim Laden der Rezepte:', err);
  } finally {
    loadingRecipes.value = false;
    loadingSearch.value = false;
  }
}

async function loadPlansOnly() {
  try {
    const data = await apiFetch('/api/plans');
    plans.value = data || [];
  } catch (err) {
    console.error('Fehler beim Laden der Pläne:', err);
  }
}

async function ensureWeeksLoaded(mondays) {
  for (const M of mondays) {
    if (weeklyPlansCache.value[M]) continue;

    const existing = plans.value.find(p => p.start_date === M);
    if (existing) {
      try {
        const fullPlan = await apiFetch(`/api/plans/${existing.id}`);
        if (fullPlan) {
          weeklyPlansCache.value[M] = fullPlan;
        }
      } catch (err) {
        console.error(`Fehler beim Laden von Plan-Details für ${M}:`, err);
      }
    } else {
      try {
        const kw = getCalenderWeekNumber(new Date(M));
        const newPlan = await apiFetch('/api/plans', {
          method: 'POST',
          body: {
            name: `KW ${kw}`,
            start_date: M
          }
        });
        if (newPlan) {
          await loadPlansOnly();
          const fullPlan = await apiFetch(`/api/plans/${newPlan.id}`);
          if (fullPlan) {
            weeklyPlansCache.value[M] = fullPlan;
          }
        }
      } catch (err) {
        console.error(`Fehler beim automatischen Erstellen des Plans für ${M}:`, err);
      }
    }
  }
}

// Helpers for dates
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getCalenderWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

// Navigation & Config
function slideDays(offset) {
  if (plannerRef.value) {
    plannerRef.value.triggerSlide(offset);
  } else {
    const newDate = new Date(rollingStartDate.value);
    newDate.setDate(newDate.getDate() + offset);
    rollingStartDate.value = newDate;
  }
}

function updateStartDate(newDate) {
  rollingStartDate.value = newDate;
}

function goToday() {
  rollingStartDate.value = getMidnightDate();
}

function changeDaysCount(count) {
  rollingDaysCount.value = count;
  localStorage.setItem('rolling_days_count', count.toString());
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


// Date-based reactive timelines
const visibleDays = computed(() => {
  const days = [];
  const start = new Date(rollingStartDate.value);
  const today = getMidnightDate();
  const todayStr = formatDateISO(today);

  for (let i = 0; i < rollingDaysCount.value; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);

    const formattedDateStr = formatDateISO(current);
    const monday = getMonday(current);
    const mondayStr = formatDateISO(monday);
    const dayOfWeekKey = EnglishDays[current.getDay()];

    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const name = dayNames[current.getDay()];

    const day = String(current.getDate()).padStart(2, '0');
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const dateSubtitle = `${day}.${month}.`;

    days.push({
      date: current,
      formattedDateStr,
      name,
      dateSubtitle,
      mondayStr,
      dayOfWeekKey,
      isToday: formattedDateStr === todayStr,
      isPast: formattedDateStr < todayStr
    });
  }
  return days;
});

const renderedDays = computed(() => {
  const days = [];
  const start = new Date(rollingStartDate.value);
  const today = getMidnightDate();
  const todayStr = formatDateISO(today);

  // Render a 10-day buffer before and after the visible scope
  for (let i = -10; i <= rollingDaysCount.value + 9; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);

    const formattedDateStr = formatDateISO(current);
    const monday = getMonday(current);
    const mondayStr = formatDateISO(monday);
    const dayOfWeekKey = EnglishDays[current.getDay()];

    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const name = dayNames[current.getDay()];

    const day = String(current.getDate()).padStart(2, '0');
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const dateSubtitle = `${day}.${month}.`;

    days.push({
      date: current,
      formattedDateStr,
      name,
      dateSubtitle,
      mondayStr,
      dayOfWeekKey,
      isToday: formattedDateStr === todayStr,
      isPast: formattedDateStr < todayStr
    });
  }
  return days;
});

const isTodayInViewport = computed(() => {
  return visibleDays.value.some(day => day.isToday);
});

const spannedMondays = computed(() => {
  const mondays = new Set();
  const start = new Date(rollingStartDate.value);
  
  // Prefetch a 20-day look-behind and 20-day look-ahead window
  for (let i = -20; i < rollingDaysCount.value + 20; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const monday = getMonday(current);
    mondays.add(formatDateISO(monday));
  }
  return Array.from(mondays);
});

const rollingAssignments = computed(() => {
  const map = {};
  for (const day of renderedDays.value) {
    const M = day.mondayStr;
    const dayKey = day.dayOfWeekKey;
    const plan = weeklyPlansCache.value[M];
    
    const lunchAsgs = plan?.assignments?.filter(asg => asg.day_of_week === dayKey && asg.meal_type === 'lunch') || [];
    const dinnerAsgs = plan?.assignments?.filter(asg => asg.day_of_week === dayKey && asg.meal_type === 'dinner') || [];
    
    map[day.formattedDateStr] = {
      lunch: lunchAsgs,
      dinner: dinnerAsgs
    };
  }
  return map;
});

// Watcher to cache weeks
watch(spannedMondays, async (newMondays) => {
  await ensureWeeksLoaded(newMondays);
}, { immediate: true });

// HELPER FUNCTIONS FOR STRUCTURING/DESTRUCTURING WEEKLY ASSIGNMENTS
function getPlanAssignmentsMap(assignments) {
  const map = {};
  const dayKeys = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mealTypes = ['lunch', 'dinner'];
  
  for (const day of dayKeys) {
    map[day] = { lunch: [], dinner: [] };
  }
  
  for (const asg of assignments) {
    if (map[asg.day_of_week]) {
      map[asg.day_of_week][asg.meal_type].push(asg);
    }
  }
  return map;
}

function mapToFlatAssignments(map) {
  const flat = [];
  const dayKeys = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealTypes = ['lunch', 'dinner'];
  
  for (const day of dayKeys) {
    for (const mt of mealTypes) {
      for (const asg of map[day][mt]) {
        flat.push({
          day_of_week: day,
          meal_type: mt,
          recipe_id: asg.recipe.id
        });
      }
    }
  }
  return flat;
}

// Assignment management methods
async function assignRecipe({ day, mealType, recipeId, targetIndex }) {
  const targetDayObj = visibleDays.value.find(d => d.formattedDateStr === day) || {
    mondayStr: formatDateISO(getMonday(new Date(day))),
    dayOfWeekKey: EnglishDays[new Date(day).getDay()],
    isPast: day < formatDateISO(getMidnightDate())
  };

  if (targetDayObj.isPast) {
    console.warn("Zuweisung in der Vergangenheit ist blockiert.");
    return;
  }

  const M = targetDayObj.mondayStr;
  const dayOfWeekKey = targetDayObj.dayOfWeekKey;

  await ensureWeeksLoaded([M]);
  const plan = weeklyPlansCache.value[M];
  if (!plan) return;

  const map = getPlanAssignmentsMap(plan.assignments);
  const slotList = map[dayOfWeekKey][mealType];

  const alreadyExists = slotList.some(asg => asg.recipe.id === recipeId);
  if (alreadyExists) return;

  const newItem = {
    day_of_week: dayOfWeekKey,
    meal_type: mealType,
    recipe: { id: recipeId }
  };

  if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= slotList.length) {
    slotList.splice(targetIndex, 0, newItem);
  } else {
    slotList.push(newItem);
  }

  const newAssignments = mapToFlatAssignments(map);

  try {
    const data = await apiFetch(`/api/plans/${plan.id}/assignments`, {
      method: 'PUT',
      body: { assignments: newAssignments }
    });
    if (data) {
      weeklyPlansCache.value[M] = data;
    }
  } catch (err) {
    console.error('Fehler beim Zuweisen des Rezepts:', err);
  }
}

async function removeRecipeAssignment({ assignmentId, dateStr }) {
  const targetDayObj = visibleDays.value.find(d => d.formattedDateStr === dateStr) || {
    mondayStr: formatDateISO(getMonday(new Date(dateStr))),
    isPast: dateStr < formatDateISO(getMidnightDate())
  };

  if (targetDayObj.isPast) {
    console.warn("Löschen in der Vergangenheit ist blockiert.");
    return;
  }

  const M = targetDayObj.mondayStr;
  const plan = weeklyPlansCache.value[M];
  if (!plan) return;

  const freshAssignments = plan.assignments
    .filter(asg => asg.id !== assignmentId)
    .map(asg => ({
      day_of_week: asg.day_of_week,
      meal_type: asg.meal_type,
      recipe_id: asg.recipe.id
    }));

  try {
    const data = await apiFetch(`/api/plans/${plan.id}/assignments`, {
      method: 'PUT',
      body: { assignments: freshAssignments }
    });
    if (data) {
      weeklyPlansCache.value[M] = data;
    }
  } catch (err) {
    console.error('Fehler beim Entfernen des Rezepts:', err);
  }
}

async function toggleRecipeAssignment(dayKey, slotKey, recipeId) {
  const current = rollingAssignments.value[dayKey];
  const list = current ? (slotKey === 'lunch' ? current.lunch : current.dinner) : [];
  const existing = list.find(asg => asg.recipe.id === recipeId);
  
  if (existing) {
    await removeRecipeAssignment({ assignmentId: existing.id, dateStr: dayKey });
  } else {
    await assignRecipe({ day: dayKey, mealType: slotKey, recipeId });
  }
}

async function reorderRecipeAssignment({ assignmentId, direction, dateStr, mealType }) {
  const targetDayObj = visibleDays.value.find(d => d.formattedDateStr === dateStr) || {
    mondayStr: formatDateISO(getMonday(new Date(dateStr))),
    isPast: dateStr < formatDateISO(getMidnightDate())
  };

  if (targetDayObj.isPast) {
    console.warn("Verschieben in der Vergangenheit ist blockiert.");
    return;
  }

  const M = targetDayObj.mondayStr;
  const plan = weeklyPlansCache.value[M];
  if (!plan) return;

  const targetDayKey = EnglishDays[new Date(dateStr).getDay()];
  const fullAsgs = [...plan.assignments];
  
  // Find indices of assignments for this slot
  const slotIndices = [];
  for (let i = 0; i < fullAsgs.length; i++) {
    const asg = fullAsgs[i];
    if (asg.day_of_week === targetDayKey && asg.meal_type === mealType) {
      slotIndices.push(i);
    }
  }

  // Find index index
  const targetSlotIdxIndex = slotIndices.findIndex(idx => fullAsgs[idx].id === assignmentId);
  if (targetSlotIdxIndex === -1) return;

  let swapWithSlotIdxIndex = -1;
  if (direction === 'up' && targetSlotIdxIndex > 0) {
    swapWithSlotIdxIndex = targetSlotIdxIndex - 1;
  } else if (direction === 'down' && targetSlotIdxIndex < slotIndices.length - 1) {
    swapWithSlotIdxIndex = targetSlotIdxIndex + 1;
  }

  if (swapWithSlotIdxIndex === -1) return;

  const idxA = slotIndices[targetSlotIdxIndex];
  const idxB = slotIndices[swapWithSlotIdxIndex];
  
  const temp = fullAsgs[idxA];
  fullAsgs[idxA] = fullAsgs[idxB];
  fullAsgs[idxB] = temp;

  const newAssignments = fullAsgs.map(asg => ({
    day_of_week: asg.day_of_week,
    meal_type: asg.meal_type,
    recipe_id: asg.recipe.id
  }));

  try {
    const data = await apiFetch(`/api/plans/${plan.id}/assignments`, {
      method: 'PUT',
      body: { assignments: newAssignments }
    });
    if (data) {
      weeklyPlansCache.value[M] = data;
    }
  } catch (err) {
    console.error('Fehler beim Sortieren des Rezepts:', err);
  }
}

async function moveAssignment({ assignmentId, sourceDateStr, sourceMealType, targetDateStr, targetMealType, targetIndex }) {
  const sourceDayObj = renderedDays.value.find(d => d.formattedDateStr === sourceDateStr);
  const targetDayObj = renderedDays.value.find(d => d.formattedDateStr === targetDateStr);
  if (!sourceDayObj || !targetDayObj) return;

  const sourceM = sourceDayObj.mondayStr;
  const targetM = targetDayObj.mondayStr;

  if (targetDayObj.isPast) {
    console.warn("Verschieben in der Vergangenheit ist blockiert.");
    return;
  }

  if (sourceM === targetM) {
    // MOVE WITHIN THE SAME WEEK PLAN
    const plan = weeklyPlansCache.value[sourceM];
    if (!plan) return;

    const sourceDayKey = sourceDayObj.dayOfWeekKey;
    const targetDayKey = targetDayObj.dayOfWeekKey;

    const map = getPlanAssignmentsMap(plan.assignments);
    const sourceList = map[sourceDayKey][sourceMealType];
    const itemIndex = sourceList.findIndex(asg => asg.id === assignmentId);
    if (itemIndex === -1) return;

    // Remove from source list
    const [item] = sourceList.splice(itemIndex, 1);

    // Check if target already has this recipe (unless we are just sorting within the same slot)
    const targetList = map[targetDayKey][targetMealType];
    const alreadyExists = targetList.some(asg => asg.recipe.id === item.recipe.id);
    if (alreadyExists && (sourceDayKey !== targetDayKey || sourceMealType !== targetMealType)) {
      // Duplicate, restore and cancel
      sourceList.splice(itemIndex, 0, item);
      return;
    }

    // Adjust targetIndex if we are moving within the exact same slot
    let adjustedIndex = targetIndex;
    if (sourceDayKey === targetDayKey && sourceMealType === targetMealType) {
      if (itemIndex < targetIndex) {
        adjustedIndex = targetIndex - 1;
      }
    }

    // Insert into target list
    if (typeof adjustedIndex === 'number' && adjustedIndex >= 0 && adjustedIndex <= targetList.length) {
      targetList.splice(adjustedIndex, 0, item);
    } else {
      targetList.push(item);
    }

    const newAssignments = mapToFlatAssignments(map);

    try {
      const data = await apiFetch(`/api/plans/${plan.id}/assignments`, {
        method: 'PUT',
        body: { assignments: newAssignments }
      });
      if (data) {
        weeklyPlansCache.value[sourceM] = data;
      }
    } catch (err) {
      console.error('Fehler beim Verschieben des Rezepts:', err);
    }
  } else {
    // MOVE ACROSS DIFFERENT WEEK PLANS
    const sourcePlan = weeklyPlansCache.value[sourceM];
    const targetPlan = weeklyPlansCache.value[targetM];
    if (!sourcePlan || !targetPlan) return;

    const sourceDayKey = sourceDayObj.dayOfWeekKey;
    const targetDayKey = targetDayObj.dayOfWeekKey;

    const sourceMap = getPlanAssignmentsMap(sourcePlan.assignments);
    const targetMap = getPlanAssignmentsMap(targetPlan.assignments);

    const sourceList = sourceMap[sourceDayKey][sourceMealType];
    const itemIndex = sourceList.findIndex(asg => asg.id === assignmentId);
    if (itemIndex === -1) return;

    // Remove from source list
    const [item] = sourceList.splice(itemIndex, 1);

    // Check for duplicates in target slot
    const targetList = targetMap[targetDayKey][targetMealType];
    const alreadyExists = targetList.some(asg => asg.recipe.id === item.recipe.id);
    if (alreadyExists) {
      // Put back in source and exit
      sourceList.splice(itemIndex, 0, item);
      return;
    }

    // Insert into target list
    const newItem = {
      day_of_week: targetDayKey,
      meal_type: targetMealType,
      recipe: item.recipe
    };

    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= targetList.length) {
      targetList.splice(targetIndex, 0, newItem);
    } else {
      targetList.push(newItem);
    }

    const sourceAssignments = mapToFlatAssignments(sourceMap);
    const targetAssignments = mapToFlatAssignments(targetMap);

    try {
      const dataSrc = await apiFetch(`/api/plans/${sourcePlan.id}/assignments`, {
        method: 'PUT',
        body: { assignments: sourceAssignments }
      });
      const dataTgt = await apiFetch(`/api/plans/${targetPlan.id}/assignments`, {
        method: 'PUT',
        body: { assignments: targetAssignments }
      });

      if (dataSrc) weeklyPlansCache.value[sourceM] = dataSrc;
      if (dataTgt) weeklyPlansCache.value[targetM] = dataTgt;
    } catch (err) {
      console.error('Fehler beim Verschieben des Rezepts über die Wochen:', err);
    }
  }
}

// Drag start / end sidebar control
function onRecipeDropped({ day, mealType, recipeId, targetIndex }) {
  assignRecipe({ day, mealType, recipeId, targetIndex });
  isSearchOpen.value = false;
  searchQuery.value = '';
}

// Form Modals Control
function openRecipeForm(recipe = null) {
  recipeToEdit.value = recipe;
  isRecipeFormOpen.value = true;
}

function onRecipeSaved() {
  isRecipeFormOpen.value = false;
  loadRecipes();
  for (const M of spannedMondays.value) {
    const plan = weeklyPlansCache.value[M];
    if (plan) {
      apiFetch(`/api/plans/${plan.id}`).then(data => {
        if (data) weeklyPlansCache.value[M] = data;
      });
    }
  }
}

// Plan Creator Modal
function onPlanCreated(formattedMonday) {
  isPlanCreateOpen.value = false;
  loadPlansOnly().then(() => {
    ensureWeeksLoaded([formattedMonday]);
  });
}

// Details Modal
async function openRecipeDetails(recipe) {
  try {
    const data = await apiFetch(`/api/recipes/${recipe.id}`);
    if (data) {
      detailRecipe.value = data;
      isRecipeDetailsOpen.value = true;
    }
  } catch (err) {
    console.error('Fehler beim Laden der Rezeptdetails:', err);
  }
}

function closeRecipeDetails() {
  isRecipeDetailsOpen.value = false;
  detailRecipe.value = null;
}

// Form save event handlers
function onRecipeUpdated(updatedRecipe) {
  detailRecipe.value = updatedRecipe;
  loadRecipes();
}

function onRecipeDeleted(recipeId) {
  isRecipeDetailsOpen.value = false;
  detailRecipe.value = null;
  loadRecipes();
  for (const M of spannedMondays.value) {
    const plan = weeklyPlansCache.value[M];
    if (plan) {
      apiFetch(`/api/plans/${plan.id}`).then(data => {
        if (data) weeklyPlansCache.value[M] = data;
      });
    }
  }
}

function toggleRecipeAssignmentFromDetails({ day, mealType, recipeId }) {
  toggleRecipeAssignment(day, mealType, recipeId);
}

function openRecipeFormFromDetails(recipe) {
  isRecipeDetailsOpen.value = false;
  openRecipeForm(recipe);
}

// Search Overlay Actions
function openSearchOverlay() {
  searchQuery.value = '';
  searchResults.value = [];
  isSearchOpen.value = true;
}

function onSearchQueryChanged(query) {
  searchQuery.value = query;
  if (query.trim().length > 0) {
    loadRecipes(query);
  } else {
    searchResults.value = [];
  }
}

function openRecipeDetailsFromSearch(recipe) {
  openRecipeDetails(recipe);
}

function startTagSearch(tag) {
  isRecipeDetailsOpen.value = false;
  searchQuery.value = `#${tag}`;
  isSearchOpen.value = true;
}

// FLOATING POPUPS CONTROLS
function openSlotQuickAssignDropdown({ dayKey, slotKey, rect }) {
  quickPlanRecipe.value = null;
  quickAssignSlot.value = { dayKey, slotKey, rect };
}

function assignRecipeFromQuick(recipeId) {
  if (quickAssignSlot.value) {
    const { dayKey, slotKey } = quickAssignSlot.value;
    assignRecipe({ day: dayKey, mealType: slotKey, recipeId });
    quickAssignSlot.value = null;
  }
}

function openQuickPlanDropdown({ recipe, rect }) {
  quickAssignSlot.value = null;
  quickPlanRecipe.value = { recipe, rect };
}

function isLunchAssignedToRecipe(dateStr, recipeId) {
  const current = rollingAssignments.value[dateStr];
  return current?.lunch?.some(asg => asg.recipe.id === recipeId) || false;
}

function isDinnerAssignedToRecipe(dateStr, recipeId) {
  const current = rollingAssignments.value[dateStr];
  return current?.dinner?.some(asg => asg.recipe.id === recipeId) || false;
}

async function toggleAssignmentFromQuick(dayKey, slotType, recipeId) {
  await toggleRecipeAssignment(dayKey, slotType, recipeId);
}

// Global window event listeners (closing dropdowns & cmd+k)
function handleGlobalClick(e) {
  if (quickAssignSlot.value) {
    if (!e.target.closest('.floating-assign-dropdown') && !e.target.closest('.slot-placeholder-prompt')) {
      quickAssignSlot.value = null;
    }
  }
  if (quickPlanRecipe.value) {
    if (!e.target.closest('.floating-assign-dropdown') && !e.target.closest('.btn-quick-plan')) {
      quickPlanRecipe.value = null;
    }
  }
}

function handleGlobalKeydown(e) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const isHotkey = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
  
  if (isHotkey) {
    e.preventDefault();
    openSearchOverlay();
  }
}
</script>
