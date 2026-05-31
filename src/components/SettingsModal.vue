<template>
  <div :class="['settings-overlay', { active: isOpen }]" @click.self="$emit('close')">
    <div class="settings-panel">
      <div class="settings-header">
        <h2>
          <ion-icon name="settings-outline"></ion-icon>
          Einstellungen
        </h2>
        <button class="btn-close-settings" title="Schließen" @click="$emit('close')">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <div class="settings-body">
        <!-- Theme Section -->
        <section class="settings-section">
          <h3 class="settings-section-title">
            <ion-icon name="color-palette-outline"></ion-icon>
            Erscheinungsbild
          </h3>
          <p class="settings-section-desc">Wähle, wie die App dargestellt werden soll.</p>

          <div class="settings-theme-options">
            <button
              :class="['theme-option-card', { active: currentTheme === 'system' }]"
              @click="setTheme('system')"
            >
              <div class="theme-preview theme-preview-system">
                <div class="preview-half light"></div>
                <div class="preview-half dark"></div>
              </div>
              <span class="theme-option-label">System</span>
            </button>

            <button
              :class="['theme-option-card', { active: currentTheme === 'light' }]"
              @click="setTheme('light')"
            >
              <div class="theme-preview theme-preview-light">
                <div class="preview-bar"></div>
                <div class="preview-content">
                  <div class="preview-line"></div>
                  <div class="preview-line short"></div>
                </div>
              </div>
              <span class="theme-option-label">Hell</span>
            </button>

            <button
              :class="['theme-option-card', { active: currentTheme === 'dark' }]"
              @click="setTheme('dark')"
            >
              <div class="theme-preview theme-preview-dark">
                <div class="preview-bar"></div>
                <div class="preview-content">
                  <div class="preview-line"></div>
                  <div class="preview-line short"></div>
                </div>
              </div>
              <span class="theme-option-label">Dunkel</span>
            </button>
          </div>
        </section>

        <!-- Days Count Section -->
        <section class="settings-section">
          <h3 class="settings-section-title">
            <ion-icon name="calendar-outline"></ion-icon>
            Kalenderansicht
          </h3>
          <p class="settings-section-desc">Lege fest, wie viele Tage gleichzeitig angezeigt werden.</p>

          <div class="settings-days-grid">
            <button
              v-for="n in 10"
              :key="n"
              :class="['days-option-btn', { active: currentDaysCount === n }]"
              @click="setDaysCount(n)"
            >
              {{ n }}
            </button>
          </div>
          <p class="settings-days-hint">
            {{ currentDaysCount === 1 ? '1 Tag' : `${currentDaysCount} Tage` }} werden angezeigt
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  theme: {
    type: String, // 'system' | 'light' | 'dark'
    required: true
  },
  daysCount: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['close', 'update:theme', 'update:daysCount']);

const currentTheme = ref(props.theme);
const currentDaysCount = ref(props.daysCount);

watch(() => props.theme, (val) => { currentTheme.value = val; });
watch(() => props.daysCount, (val) => { currentDaysCount.value = val; });

function setTheme(theme) {
  currentTheme.value = theme;
  emit('update:theme', theme);
}

function setDaysCount(count) {
  currentDaysCount.value = count;
  emit('update:daysCount', count);
}
</script>
