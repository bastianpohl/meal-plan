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

        <!-- Bring! Integration Section -->
        <section class="settings-section">
          <h3 class="settings-section-title">
            <ion-icon name="cart-outline" style="color: #E63946;"></ion-icon>
            Bring! Einkaufszettel-Kopplung
          </h3>
          <p class="settings-section-desc">Kopple die App mit deinem Bring! Account, um Zutaten per Knopfdruck dorthin zu exportieren.</p>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Bring! E-Mail</label>
              <input 
                type="email" 
                v-model="bringEmail" 
                placeholder="beispiel@mail.de" 
                class="form-control" 
                style="width: 100%;"
              />
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Bring! Passwort</label>
              <input 
                type="password" 
                v-model="bringPassword" 
                :placeholder="bringHasPassword ? '•••••••• (Gespeichert)' : 'Dein Bring! Passwort'" 
                class="form-control" 
                style="width: 100%;"
              />
            </div>

            <button 
              class="btn btn-secondary btn-full-width" 
              style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin-top: 6px;"
              @click="handleBringTest"
              :disabled="testingBring || !bringEmail"
            >
              <ion-icon name="sync-outline" :class="{ 'spin': testingBring }"></ion-icon>
              {{ testingBring ? 'Verbinde...' : 'Verbindung testen & Listen laden' }}
            </button>

            <!-- Success List Selection Dropdown -->
            <div v-if="bringLists.length > 0" style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Wähle deine Einkaufsliste</label>
              <select v-model="bringSelectedUuid" class="form-control" style="width: 100%; cursor: pointer;" @change="onListSelected">
                <option value="" disabled>Bitte eine Liste auswählen...</option>
                <option v-for="lst in bringLists" :key="lst.listUuid" :value="lst.listUuid">
                  {{ lst.name }}
                </option>
              </select>
            </div>
            
            <div v-else-if="bringSelectedName" style="margin-top: 8px; font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
              <ion-icon name="checkmark-circle-outline" style="color: var(--accent-primary); font-size: 18px;"></ion-icon>
              Gekoppelt mit Liste: <strong style="color: var(--text-primary)">{{ bringSelectedName }}</strong>
            </div>

            <!-- Save Bring settings status and action -->
            <div v-if="bringError" style="margin-top: 6px; font-size: 12px; color: var(--system-red); display: flex; align-items: center; gap: 4px;">
              <ion-icon name="alert-circle-outline"></ion-icon>
              {{ bringError }}
            </div>
            
            <div v-if="bringSuccessMessage" style="margin-top: 6px; font-size: 12px; color: var(--accent-primary); display: flex; align-items: center; gap: 4px;">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              {{ bringSuccessMessage }}
            </div>

            <button 
              v-if="bringEmail"
              class="btn btn-primary btn-full-width" 
              style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin-top: 10px;"
              @click="handleBringSave"
              :disabled="savingBring"
            >
              <ion-icon name="save-outline"></ion-icon>
              {{ savingBring ? 'Wird gespeichert...' : 'Bring! Einstellungen speichern' }}
            </button>
          </div>
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

// Bring! states
const bringEmail = ref('');
const bringPassword = ref('');
const bringHasPassword = ref(false);
const bringSelectedUuid = ref('');
const bringSelectedName = ref('');
const bringLists = ref([]);
const testingBring = ref(false);
const savingBring = ref(false);
const bringError = ref('');
const bringSuccessMessage = ref('');

// Load Bring! settings when modal is opened
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadBringSettings();
  }
});

async function loadBringSettings() {
  bringError.value = '';
  bringSuccessMessage.value = '';
  bringLists.value = [];
  try {
    const res = await fetch('/api/settings/bring');
    if (res.ok) {
      const data = await res.json();
      bringEmail.value = data.email || '';
      bringHasPassword.value = data.hasPassword || false;
      bringSelectedUuid.value = data.listUuid || '';
      bringSelectedName.value = data.listName || '';
      bringPassword.value = ''; // keep empty for editing
    }
  } catch (err) {
    console.error('Fehler beim Laden der Bring-Einstellungen:', err);
  }
}

async function handleBringTest() {
  bringError.value = '';
  bringSuccessMessage.value = '';
  testingBring.value = true;
  try {
    const res = await fetch('/api/settings/bring/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bringEmail.value,
        password: bringPassword.value || undefined
      })
    });

    const data = await res.json();
    if (res.ok) {
      bringLists.value = data.lists || [];
      bringSuccessMessage.value = data.message || 'Verbindung erfolgreich!';
    } else {
      bringError.value = data.error || 'Verbindung fehlgeschlagen.';
    }
  } catch (err) {
    console.error('Fehler beim Testen der Bring-Verbindung:', err);
    bringError.value = 'Netzwerkfehler beim Verbindungstest.';
  } finally {
    testingBring.value = false;
  }
}

function onListSelected() {
  const chosen = bringLists.value.find(l => l.listUuid === bringSelectedUuid.value);
  if (chosen) {
    bringSelectedName.value = chosen.name;
  }
}

async function handleBringSave() {
  bringError.value = '';
  bringSuccessMessage.value = '';
  savingBring.value = true;
  try {
    const res = await fetch('/api/settings/bring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bringEmail.value,
        password: bringPassword.value || undefined,
        listUuid: bringSelectedUuid.value,
        listName: bringSelectedName.value
      })
    });

    const data = await res.json();
    if (res.ok) {
      bringSuccessMessage.value = 'Einstellungen erfolgreich gespeichert!';
      bringPassword.value = '';
      bringHasPassword.value = true;
      bringLists.value = []; // clear selection list after save
    } else {
      bringError.value = data.error || 'Fehler beim Speichern.';
    }
  } catch (err) {
    console.error('Fehler beim Speichern der Bring-Einstellungen:', err);
    bringError.value = 'Netzwerkfehler beim Speichern der Einstellungen.';
  } finally {
    savingBring.value = false;
  }
}
</script>
