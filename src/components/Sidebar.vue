<template>
  <aside id="recipe-sidebar" :class="['recipe-sidebar', 'glass', { active: isOpen }]">
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <ion-icon name="restaurant-outline"></ion-icon>
        <h3>Rezepte-Bibliothek</h3>
      </div>
      <button class="btn-sidebar-toggle" title="Seitenleiste einklappen" @click="$emit('close')">
        <ion-icon name="chevron-back-outline"></ion-icon>
      </button>
    </div>

    <!-- Action: Create Recipe -->
    <div class="sidebar-actions">
      <button class="btn btn-primary btn-full-width" @click="$emit('create-recipe')">
        <ion-icon name="add-circle-outline"></ion-icon> Neues Rezept erfassen
      </button>
    </div>

    <!-- Top Tags Cloud -->
    <div class="sidebar-tags-section" v-if="topTags.length > 0">
      <span class="sidebar-tags-label">
        <ion-icon name="pricetags-outline"></ion-icon>
        Beliebte Tags
      </span>
      <div class="sidebar-tags-cloud">
        <button
          v-for="tag in topTags"
          :key="tag.name"
          class="sidebar-tag-pill"
          @click="$emit('tag-click', tag.name)"
        >
          #{{ tag.name }}
          <span class="sidebar-tag-count">{{ tag.count }}</span>
        </button>
      </div>
    </div>

    <!-- Alphabetical Recipe List with Letter Nav -->
    <div class="sidebar-recipe-list-wrapper">
      <!-- Main scrollable list -->
      <div class="sidebar-recipe-list" ref="listContainer">
        <div v-if="loading" class="sidebar-list-placeholder">
          <ion-icon name="hourglass-outline"></ion-icon>
          <p>Lade Rezepte...</p>
        </div>
        <div v-else-if="recipes.length === 0" class="sidebar-list-placeholder">
          <ion-icon name="restaurant-outline"></ion-icon>
          <p>Keine Rezepte erfasst.</p>
        </div>
        <template v-else>
          <div
            v-for="group in groupedRecipes"
            :key="group.letter"
            :ref="el => { if (el) letterRefs[group.letter] = el }"
          >
            <div class="sidebar-letter-header" :data-letter="group.letter">
              {{ group.letter }}
            </div>
            <div class="sidebar-recipe-grid">
              <div
                v-for="recipe in group.recipes"
                :key="recipe.id"
                class="sidebar-recipe-item polaroid-style"
                :data-id="recipe.id"
                draggable="true"
                @dragstart="onDragStart($event, recipe)"
                @dragend="onDragEnd"
                @click="$emit('recipe-click', recipe)"
              >
                <div class="sidebar-recipe-thumb">
                  <img
                    v-if="recipe.cover_image"
                    :src="'/' + recipe.cover_image"
                    alt=""
                    loading="lazy"
                    draggable="false"
                  />
                  <div v-else class="sidebar-recipe-thumb-placeholder">
                    <ion-icon name="restaurant-outline"></ion-icon>
                  </div>
                </div>
                <div class="sidebar-recipe-info">
                  <span class="sidebar-recipe-name">{{ recipe.title }}</span>
                </div>
                <button
                  class="btn-quick-plan-sidebar"
                  title="Schnell einplanen"
                  @click.stop="onQuickPlanClick($event, recipe)"
                >
                  <ion-icon name="calendar-outline"></ion-icon>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Vertical Letter Navigation Bar -->
      <div
        v-if="availableLetters.length > 0"
        class="sidebar-letter-nav"
        @mousedown="startLetterNavDrag"
        @touchstart.prevent="startLetterNavTouch"
      >
        <span
          v-for="letter in allLetters"
          :key="letter"
          :class="['letter-nav-item', { active: availableLetters.includes(letter), current: activeLetter === letter }]"
          :data-letter="letter"
          @click="scrollToLetter(letter)"
        >
          {{ letter }}
        </span>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  recipes: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'close',
  'create-recipe',
  'recipe-click',
  'tag-click',
  'quick-plan'
]);

const listContainer = ref(null);
const letterRefs = ref({});
const activeLetter = ref('');

const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const topTags = computed(() => {
  const tagMap = {};
  for (const recipe of props.recipes) {
    if (recipe.tags && Array.isArray(recipe.tags)) {
      for (const tag of recipe.tags) {
        const normalized = tag.trim();
        if (normalized) {
          tagMap[normalized] = (tagMap[normalized] || 0) + 1;
        }
      }
    }
  }
  return Object.entries(tagMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
});

const sortedRecipes = computed(() => {
  return [...props.recipes].sort((a, b) =>
    a.title.localeCompare(b.title, 'de', { sensitivity: 'base' })
  );
});

const groupedRecipes = computed(() => {
  const groups = {};
  for (const recipe of sortedRecipes.value) {
    const firstChar = recipe.title.charAt(0).toUpperCase();
    const letter = /[A-ZÄÖÜ]/.test(firstChar) ? (firstChar === 'Ä' ? 'A' : firstChar === 'Ö' ? 'O' : firstChar === 'Ü' ? 'U' : firstChar) : '#';
    if (!groups[letter]) {
      groups[letter] = [];
    }
    groups[letter].push(recipe);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, recipes]) => ({ letter, recipes }));
});

const availableLetters = computed(() => {
  return groupedRecipes.value.map(g => g.letter);
});

function scrollToLetter(letter) {
  if (!availableLetters.value.includes(letter)) return;
  const el = letterRefs.value[letter];
  if (el && listContainer.value) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    activeLetter.value = letter;
  }
}

// Track active letter on scroll
function onListScroll() {
  if (!listContainer.value) return;
  const container = listContainer.value;
  const headers = container.querySelectorAll('.sidebar-letter-header');
  let current = '';
  for (const header of headers) {
    const rect = header.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (rect.top <= containerRect.top + 40) {
      current = header.dataset.letter;
    }
  }
  if (current) activeLetter.value = current;
}

// Letter nav drag (mouse)
function startLetterNavDrag(e) {
  const item = document.elementFromPoint(e.clientX, e.clientY);
  if (item && item.dataset && item.dataset.letter) {
    scrollToLetter(item.dataset.letter);
  }

  function onMove(ev) {
    const item = document.elementFromPoint(ev.clientX, ev.clientY);
    if (item && item.dataset && item.dataset.letter) {
      scrollToLetter(item.dataset.letter);
    }
  }
  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// Letter nav drag (touch)
function startLetterNavTouch(e) {
  const touch = e.touches[0];
  const item = document.elementFromPoint(touch.clientX, touch.clientY);
  if (item && item.dataset && item.dataset.letter) {
    scrollToLetter(item.dataset.letter);
  }

  function onMove(ev) {
    const touch = ev.touches[0];
    const item = document.elementFromPoint(touch.clientX, touch.clientY);
    if (item && item.dataset && item.dataset.letter) {
      scrollToLetter(item.dataset.letter);
    }
  }
  function onEnd() {
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
  }
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onEnd);
}

function onDragStart(e, recipe) {
  e.dataTransfer.setData('text/plain', String(recipe.id));
  e.dataTransfer.effectAllowed = 'copyMove';
  
  if (e.dataTransfer.setDragImage) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.dataTransfer.setDragImage(e.currentTarget, x, y);
  }

  const currentTarget = e.currentTarget;
  setTimeout(() => {
    currentTarget.classList.add('dragging');
    document.body.classList.add('recipe-drag-active');
  }, 0);

  const freeSlots = document.querySelectorAll('.day-slot-dropzone:not(.filled)');
  freeSlots.forEach(slot => slot.classList.add('highlight-free'));
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.body.classList.remove('recipe-drag-active');
  
  const highlighted = document.querySelectorAll('.day-slot-dropzone.highlight-free');
  highlighted.forEach(slot => slot.classList.remove('highlight-free'));
}

function onQuickPlanClick(e, recipe) {
  const rect = e.currentTarget.getBoundingClientRect();
  emit('quick-plan', {
    recipe: recipe,
    rect: {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right
    }
  });
}

onMounted(() => {
  if (listContainer.value) {
    listContainer.value.addEventListener('scroll', onListScroll, { passive: true });
  }
});

onUnmounted(() => {
  if (listContainer.value) {
    listContainer.value.removeEventListener('scroll', onListScroll);
  }
});
</script>
