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
          <p class="settings-section-hint">
            <ion-icon name="phone-portrait-outline"></ion-icon>
            Auf Smartphones wird immer nur ein Tag angezeigt. Diese Einstellung gilt nur für Tablets und Desktop.
          </p>

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

        <!-- Developer Functions (Only visible in dev environment) -->
        <section class="settings-section dev-section" v-if="isDevMode">
          <h3 class="settings-section-title dev-title" style="color: var(--accent-primary);">
            <ion-icon name="code-working-outline"></ion-icon>
            Entwickler-Optionen
          </h3>
          <p class="settings-section-desc">Werkzeuge für die Entwicklung und lokale Tests.</p>
          
          <button 
            class="btn btn-danger btn-full-width" 
            style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.15); margin-top: 12px;"
            @click="handleDbReset" 
            :disabled="isResetting"
          >
            <ion-icon name="refresh-circle-outline" style="font-size: 18px;"></ion-icon>
            {{ isResetting ? 'Wird zurückgesetzt...' : 'Datenbank zurücksetzen' }}
          </button>
          <p class="settings-days-hint" style="margin-top: 6px; font-size: 11px;">
            Setzt die gesamte lokale Datenbank (Rezepte, Pläne, Bilder) in den geseedeten Auslieferungszustand zurück.
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
const isDevMode = ref(import.meta.env.DEV);
const isResetting = ref(false);

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

async function handleDbReset() {
  if (!confirm('Möchtest du die lokale Datenbank wirklich in den Auslieferungszustand zurücksetzen? Alle selbsterstellten Daten und Bilder gehen verloren!')) {
    return;
  }

  isResetting.value = true;
  try {
    const res = await fetch('/api/dev/reset', {
      method: 'POST'
    });

    if (res.ok) {
      alert('Datenbank erfolgreich zurückgesetzt! Die Seite wird nun neu geladen.');
      window.location.reload();
    } else {
      const data = await res.json();
      alert('Fehler beim Zurücksetzen: ' + (data.error || 'Unbekannter Fehler'));
    }
  } catch (err) {
    console.error(err);
    alert('Netzwerkfehler beim Zurücksetzen der Datenbank.');
  } finally {
    isResetting.value = false;
  }
}
</script>
