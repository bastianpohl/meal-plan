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

    <!-- Recipe Carousel/List Container -->
    <div class="carousel-outer-wrapper">
      <button class="carousel-control-btn prev" aria-label="Zurück" @click="scrollPrev">
        <ion-icon name="chevron-back-outline"></ion-icon>
      </button>
      
      <div class="recipe-carousel" ref="carousel">
        <div v-if="loading" class="carousel-placeholder">
          <p>Lade Rezepte...</p>
        </div>
        <div v-else-if="recipes.length === 0" class="carousel-placeholder">
          <p>Keine Rezepte erfasst.</p>
        </div>
        <RecipeCard
          v-for="recipe in recipes"
          :key="recipe.id"
          :recipe="recipe"
          @click="$emit('recipe-click', $event)"
          @tag-click="$emit('tag-click', $event)"
          @quick-plan="$emit('quick-plan', $event)"
        />
      </div>
      
      <button class="carousel-control-btn next" aria-label="Weiter" @click="scrollNext">
        <ion-icon name="chevron-forward-outline"></ion-icon>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
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
  }
});

const emit = defineEmits([
  'close',
  'create-recipe',
  'recipe-click',
  'tag-click',
  'quick-plan'
]);

const carousel = ref(null);

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

function scrollPrev() {
  if (carousel.value) {
    carousel.value.scrollBy({ left: -296, behavior: 'smooth' });
  }
}

function scrollNext() {
  if (carousel.value) {
    carousel.value.scrollBy({ left: 296, behavior: 'smooth' });
  }
}
</script>

