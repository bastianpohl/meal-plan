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

    <!-- Search and Filters -->
    <div class="sidebar-search-filter">
      <div class="category-pills">
        <button
          v-for="cat in categories"
          :key="cat.key"
          :class="['filter-pill', { active: activeCategory === cat.key }]"
          @click="selectCategory(cat.key)"
        >
          {{ cat.name }}
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
        <div v-else-if="filteredRecipes.length === 0" class="carousel-placeholder">
          <p>Keine Rezepte in dieser Kategorie gefunden.</p>
        </div>
        <RecipeCard
          v-for="recipe in filteredRecipes"
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
  activeCategory: {
    type: String,
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
  'update:activeCategory',
  'recipe-click',
  'tag-click',
  'quick-plan'
]);

const carousel = ref(null);

const categories = [
  { key: 'All', name: 'Alle' },
  { key: 'Pasta', name: 'Pasta' },
  { key: 'Veggie', name: 'Veggie' },
  { key: 'Fleisch', name: 'Fleisch' },
  { key: 'Fisch', name: 'Fisch' },
  { key: 'Dessert', name: 'Dessert' }
];

const filteredRecipes = computed(() => {
  if (props.activeCategory === 'All') {
    return props.recipes;
  }
  return props.recipes.filter(r => r.category === props.activeCategory);
});

function selectCategory(cat) {
  emit('update:activeCategory', cat);
}

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
