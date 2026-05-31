<template>
  <!-- OVERLAY CARD STRUCTURE (Spotlight / iTunes Cover Flow Search) -->
  <div
    v-if="isOverlay"
    class="overlay-recipe-card"
    :data-id="recipe.id"
    :draggable="isDraggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="$emit('click', recipe)"
  >
    <div class="overlay-recipe-card-image">
      <img
        v-if="recipe.cover_image"
        :src="'/' + recipe.cover_image"
        class="overlay-recipe-card-image-el"
        alt="Gerichtsbild"
        loading="lazy"
        draggable="false"
      />
      <div v-else class="recipe-card-img-placeholder" style="height: 100%; display: flex; align-items: center; justify-content: center;">
        <ion-icon name="restaurant-outline" style="font-size: 48px;"></ion-icon>
      </div>
    </div>
    
    <div
      class="overlay-recipe-card-content"
      @mouseenter="isDraggable = false"
      @mouseleave="isDraggable = true"
    >
      <h3 class="overlay-recipe-card-title">
        <span>{{ recipe.title }}</span>
        <button class="recipe-info-btn" title="Rezept-Details anzeigen" @click.stop="$emit('click', recipe)">
          <ion-icon name="information-circle-outline"></ion-icon>
        </button>
      </h3>
      
      <!-- Tags List -->
      <div
        class="overlay-recipe-card-tags"
        v-if="parsedTags && parsedTags.length"
        @click="onTagsContainerClick"
      >
        <span
          v-for="tag in parsedTags"
          :key="tag"
          class="overlay-tag-pill"
        >
          #{{ tag }}
        </span>
      </div>
    </div>
  </div>

  <!-- STANDARD LIBRARY CARD STRUCTURE (Sidebar / Planner) -->
  <div
    v-else
    class="recipe-card"
    :data-id="recipe.id"
    :draggable="isDraggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="$emit('click', recipe)"
  >
    <!-- Cover Image / Fallback Icon -->
    <div class="recipe-card-img-container">
      <img
        v-if="recipe.cover_image"
        :src="'/' + recipe.cover_image"
        class="recipe-card-img"
        alt="Gerichtsbild"
        loading="lazy"
      />
      <div v-else class="recipe-card-img-placeholder">
        <ion-icon name="restaurant-outline"></ion-icon>
      </div>
      
      <!-- Duration Badge -->
      <span v-if="recipe.duration" class="duration-badge">
        <ion-icon name="time-outline"></ion-icon>
        {{ recipe.duration }} Min
      </span>

      <!-- Quick Assign Button (Only shown in sidebar library card) -->
      <button
        class="btn-quick-plan"
        title="Gericht schnell einplanen"
        @click.stop="onQuickPlanClick"
        ref="quickPlanBtn"
      >
        <ion-icon name="calendar-outline"></ion-icon>
      </button>
    </div>

    <!-- Text Info -->
    <div
      class="recipe-card-content"
      @mouseenter="isDraggable = false"
      @mouseleave="isDraggable = true"
    >

      <h4 class="recipe-card-title">{{ recipe.title }}</h4>
      
      <!-- Tags List -->
      <div
        class="recipe-card-tags"
        v-if="parsedTags && parsedTags.length"
        @click="onTagsContainerClick"
      >
        <span
          v-for="tag in parsedTags"
          :key="tag"
          class="tag-pill"
        >
          #{{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  recipe: {
    type: Object,
    required: true
  },
  isOverlay: {
    type: Boolean,
    default: false
  }
});

const isDraggable = ref(true);

const emit = defineEmits(['click', 'tag-click', 'quick-plan', 'drag-start', 'drag-end']);

const quickPlanBtn = ref(null);



const parsedTags = computed(() => {
  if (!props.recipe.tags) return [];
  if (Array.isArray(props.recipe.tags)) return props.recipe.tags;
  return props.recipe.tags
    .split(/[\s,]+/)
    .map(t => t.trim().replace(/^#/, ''))
    .filter(t => t.length > 0);
});

function onDragStart(e) {
  e.dataTransfer.setData('text/plain', String(props.recipe.id));
  e.dataTransfer.effectAllowed = 'copyMove';
  
  // Explicitly set the drag image for macOS Safari compatibility
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
    if (props.isOverlay) {
      document.body.classList.add('search-drag-active');
    }
  }, 0);


  // Highlight all FREE slots in the weekly planner grid
  const freeSlots = document.querySelectorAll('.day-slot-dropzone:not(.filled)');
  freeSlots.forEach(slot => {
    slot.classList.add('highlight-free');
  });

  emit('drag-start', props.recipe.id);
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.body.classList.remove('recipe-drag-active');
  document.body.classList.remove('search-drag-active');
  
  const highlighted = document.querySelectorAll('.day-slot-dropzone.highlight-free');
  highlighted.forEach(slot => {
    slot.classList.remove('highlight-free');
  });

  emit('drag-end');
}

function onQuickPlanClick() {
  const rect = quickPlanBtn.value.getBoundingClientRect();
  emit('quick-plan', {
    recipe: props.recipe,
    rect: {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right
    }
  });
}

function onTagClick(tag) {
  emit('tag-click', tag);
}

function onTagsContainerClick(e) {
  e.stopPropagation();
  
  let pill = e.target.closest('.overlay-tag-pill, .tag-pill');
  
  if (!pill && e.clientX && e.clientY) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) {
      pill = el.closest('.overlay-tag-pill, .tag-pill');
    }
  }
  
  if (pill) {
    const tagText = pill.textContent.trim().replace(/^#/, '');
    emit('tag-click', tagText);
  }
}
</script>
