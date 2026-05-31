<template>
  <div :class="['unified-search-overlay', { active: isOpen }]">
    <div class="unified-search-backdrop" @click="$emit('close')"></div>
    <div class="unified-search-panel">
      <div class="unified-search-bar">
        <div class="search-bar-top-row">
          <ion-icon name="search-outline" class="unified-search-icon"></ion-icon>
          <input
            ref="searchInput"
            type="text"
            v-model="query"
            placeholder="Rezepte, Zutaten, #Tags suchen..."
            autocomplete="off"
            @keydown.esc="$emit('close')"
            @keydown="handleKeyNavigation"
          />
          <button
            v-show="query.trim().length > 0 || activeTags.length > 0"
            class="unified-search-clear"
            title="Suche leeren"
            @click="clearSearch"
          >
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>
        
        <!-- Active Tag Chips -->
        <div class="search-active-chips" v-if="activeTags.length > 0">
          <span
            v-for="tag in activeTags"
            :key="tag"
            class="search-tag-chip"
          >
            #{{ tag }}
            <button class="btn-remove-chip" title="Tag entfernen" @click="removeTagChip(tag)">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </span>
        </div>
      </div>

      <div class="unified-search-hint">
        <span>Drücke <kbd>ESC</kbd> zum Schließen</span>
      </div>
      <div class="unified-search-results">
        <div class="unified-search-carousel-wrapper">
          <button class="carousel-control-btn prev" aria-label="Zurück" @click="prevCard">
            <ion-icon name="chevron-back-outline"></ion-icon>
          </button>
          
          <div class="overlay-recipe-carousel" id="overlay-recipe-carousel">
            <div v-if="loading" class="carousel-placeholder">
              <p>Suche Rezepte...</p>
            </div>
            <div v-else-if="recipes.length === 0" class="carousel-placeholder">
              <p>Keine passende Gerichte gefunden.</p>
            </div>
            <RecipeCard
              v-for="(recipe, index) in recipes"
              :key="recipe.id"
              :recipe="recipe"
              :isOverlay="true"
              :style="getCardStyle(index)"
              :class="{ 'active-cover': index === activeIndex }"
              @click="onCardClick(recipe, index)"
              @tag-click="onTagClickInSearch"
              @drag-start="$emit('drag-start')"
              @drag-end="$emit('drag-end')"
            />
          </div>
          
          <button class="carousel-control-btn next" aria-label="Weiter" @click="nextCard">
            <ion-icon name="chevron-forward-outline"></ion-icon>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import RecipeCard from './RecipeCard.vue';

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
  },
  initialQuery: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'close',
  'search-query-changed',
  'recipe-click',
  'tag-click',
  'drag-start',
  'drag-end'
]);

const query = ref('');
const searchInput = ref(null);
const activeIndex = ref(0);
const activeTags = ref([]);
let debounceTimer = null;
let isInternalQueryChange = false;

function triggerSearch() {
  const tagParts = activeTags.value.map(t => `#${t}`).join(' ');
  const textPart = query.value.trim();
  const fullQuery = [tagParts, textPart].filter(Boolean).join(' ');
  
  isInternalQueryChange = true;
  emit('search-query-changed', fullQuery);
  activeIndex.value = 0;
}

function addTagChip(tag) {
  const cleanedTag = tag.trim().replace(/^#/, '');
  if (cleanedTag && !activeTags.value.includes(cleanedTag)) {
    activeTags.value.push(cleanedTag);
    triggerSearch();
  }
}

function removeTagChip(tag) {
  activeTags.value = activeTags.value.filter(t => t !== tag);
  triggerSearch();
}

function parseInitialQuery(q) {
  activeTags.value = [];
  if (!q) {
    query.value = '';
    return;
  }
  
  const tokens = q.split(/\s+/).filter(Boolean);
  const remainingTokens = [];
  
  for (const token of tokens) {
    if (token.startsWith('#')) {
      const tag = token.slice(1).trim();
      if (tag && !activeTags.value.includes(tag)) {
        activeTags.value.push(tag);
      }
    } else {
      remainingTokens.push(token);
    }
  }
  
  query.value = remainingTokens.join(' ');
}

// Watch query for debounced search emission and hashtag space extraction
watch(query, (newVal) => {
  const match = newVal.match(/#([a-zA-Z0-9_-ßäöüÄÖÜ]+)\s/);
  if (match) {
    const tag = match[1].trim();
    if (tag) {
      addTagChip(tag);
      query.value = newVal.replace(/#[a-zA-Z0-9_-ßäöüÄÖÜ]+\s/, '');
      return;
    }
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerSearch();
  }, 300);
});

// Watch isOpen to focus input
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    parseInitialQuery(props.initialQuery);
    activeIndex.value = 0;
    setTimeout(() => {
      if (searchInput.value) {
        searchInput.value.focus();
      }
    }, 100);
  }
});

// Watch initialQuery to sync query value when tag is clicked from inside/outside search
watch(() => props.initialQuery, (newVal) => {
  if (isInternalQueryChange) {
    isInternalQueryChange = false;
    return;
  }
  parseInitialQuery(newVal);
});

// Watch recipes length to keep activeIndex clamped
watch(() => props.recipes, (newRecipes) => {
  if (activeIndex.value >= newRecipes.length) {
    activeIndex.value = Math.max(0, newRecipes.length - 1);
  }
}, { deep: true });

function clearSearch() {
  query.value = '';
  activeTags.value = [];
  triggerSearch();
  if (searchInput.value) searchInput.value.focus();
}

function prevCard() {
  if (activeIndex.value > 0) {
    activeIndex.value--;
  }
}

function nextCard() {
  if (activeIndex.value < props.recipes.length - 1) {
    activeIndex.value++;
  }
}

function handleKeyNavigation(e) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevCard();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nextCard();
  } else if (e.key === 'Enter') {
    if (props.recipes.length > 0 && props.recipes[activeIndex.value]) {
      e.preventDefault();
      emit('recipe-click', props.recipes[activeIndex.value]);
    }
  }
}

function onCardClick(recipe, index) {
  if (index === activeIndex.value) {
    emit('recipe-click', recipe);
  } else {
    activeIndex.value = index;
  }
}

function onTagClickInSearch(tag) {
  query.value = `#${tag}`;
  emit('tag-click', tag);
}

function getCardStyle(index) {
  if (index === activeIndex.value) {
    return {
      transform: 'translateX(0) translateZ(200px) rotateY(0deg) scale(1.20)',
      zIndex: 35,
      opacity: 1,
      pointerEvents: 'auto'
    };
  } else if (index < activeIndex.value) {
    const diff = activeIndex.value - index;
    const isVisible = diff <= 3;
    return {
      transform: `translateX(calc(-210px - 58px * ${diff})) translateZ(calc(120px - 40px * ${diff})) rotateY(38deg) scale(0.88)`,
      zIndex: 20 - diff,
      opacity: isVisible ? 1 : 0,
      pointerEvents: isVisible ? 'auto' : 'none'
    };
  } else {
    const diff = index - activeIndex.value;
    const isVisible = diff <= 3;
    return {
      transform: `translateX(calc(210px + 58px * ${diff})) translateZ(calc(120px - 40px * ${diff})) rotateY(-38deg) scale(0.88)`,
      zIndex: 20 - diff,
      opacity: isVisible ? 1 : 0,
      pointerEvents: isVisible ? 'auto' : 'none'
    };
  }
}

// Bind global keyboard shortcuts (Arrow Keys) when overlay is active
function onGlobalKeyDown(e) {
  if (!props.isOpen) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevCard();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nextCard();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
});
</script>
