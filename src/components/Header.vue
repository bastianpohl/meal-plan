<template>
  <header class="main-header glass">
    <!-- Sidebar Trigger & Title Info -->
    <div class="header-left-group">
      <button class="btn-header-action" title="Rezept-Bibliothek ein-/ausblenden" @click="$emit('toggle-sidebar')">
        <ion-icon name="book-outline"></ion-icon>
        <span class="btn-text">Rezepte</span>
      </button>
      
      <div class="week-title-area">
        <h1 id="current-plan-title">Essensplan</h1>
        <span class="week-dates-subtitle" id="current-plan-subtitle">
          {{ activePlanRange }}
        </span>
      </div>
    </div>
    
    <!-- Central Search Trigger -->
    <div class="header-center-group">
      <button class="search-trigger-btn" title="Suche öffnen (⌘K)" @click="$emit('open-search')">
        <ion-icon name="search-outline" class="search-icon"></ion-icon>
        <span class="search-trigger-text">Rezepte, Zutaten, #Tags suchen...</span>
        <kbd class="search-trigger-kbd">{{ isMac ? '⌘K' : 'Strg+K' }}</kbd>
      </button>
    </div>

    <!-- Plan selection controls -->
    <div class="header-right-group">
      <div class="plan-navigator">
        <button class="btn-nav" title="1 Tag zurück" @click="$emit('slide-days', -1)">
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        
        <button
          v-if="!isTodayInViewport"
          class="btn btn-secondary btn-today"
          title="Zurück zu Heute"
          style="padding: 4px 10px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; border-radius: var(--radius-sm);"
          @click="$emit('go-today')"
        >
          <ion-icon name="arrow-undo-outline" style="font-size: 12px;"></ion-icon>
          <span>Heute</span>
        </button>

        <div class="days-select-wrapper">
          <ion-icon name="options-outline" class="select-icon"></ion-icon>
          <select
            :value="visibleDaysCount"
            @change="$emit('change-days-count', parseInt($event.target.value))"
          >
            <option v-for="n in 10" :key="n" :value="n">
              {{ n }} {{ n === 1 ? 'Tag' : 'Tage' }}
            </option>
          </select>
        </div>
        
        <button class="btn-nav" title="1 Tag vorwärts" @click="$emit('slide-days', 1)">
          <ion-icon name="chevron-forward-outline"></ion-icon>
        </button>
      </div>

      <!-- Theme toggle -->
      <button class="theme-toggle-btn" aria-label="Design umschalten" @click="$emit('toggle-theme')">
        <ion-icon name="sunny-outline" class="sun-icon"></ion-icon>
        <ion-icon name="moon-outline" class="moon-icon"></ion-icon>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';

const props = defineProps({
  visibleDays: {
    type: Array,
    required: true
  },
  isTodayInViewport: {
    type: Boolean,
    required: true
  },
  visibleDaysCount: {
    type: Number,
    required: true
  }
});

defineEmits([
  'toggle-sidebar',
  'open-search',
  'slide-days',
  'go-today',
  'change-days-count',
  'toggle-theme'
]);

const isMac = ref(true);

onMounted(() => {
  isMac.value = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
});

const activePlanRange = computed(() => {
  if (props.visibleDays.length === 0) return 'Lade...';
  
  const first = props.visibleDays[0];
  const last = props.visibleDays[props.visibleDays.length - 1];
  
  return `${first.dateSubtitle}${first.date.getFullYear()} - ${last.dateSubtitle}${last.date.getFullYear()}`;
});
</script>
