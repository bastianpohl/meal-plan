<template>
  <div :class="['settings-overlay', { active: isOpen }]" @click.self="$emit('close')">
    <div class="settings-panel shopping-list-panel">
      <div class="settings-header">
        <h2>
          <ion-icon name="cart-outline"></ion-icon>
          Zutaten-Zusammenfassung
        </h2>
        <button class="btn-close-settings" title="Schließen" @click="$emit('close')">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <div class="settings-body">
        <section class="settings-section">
          <h3 class="settings-section-title">
            <ion-icon name="calendar-outline"></ion-icon>
            Zeitraum (Vorausschau)
          </h3>
          <p class="settings-section-desc">Für wie viele Tage im Voraus möchtest du die Zutaten zusammenfassen?</p>

          <div class="settings-days-grid" style="grid-template-columns: repeat(5, 1fr); gap: 6px;">
            <button
              v-for="n in 10"
              :key="n"
              :class="['days-option-btn', { active: daysCount === n }]"
              @click="changeDaysCount(n)"
              style="padding: 10px 0; font-size: 14px;"
            >
              {{ n }}
            </button>
          </div>
          <p class="settings-days-hint">
            Zutaten der nächsten {{ daysCount === 1 ? '1 Tag' : `${daysCount} Tage` }} (inkl. heute)
          </p>
        </section>

        <section class="settings-section">
          <h3 class="settings-section-title">
            <ion-icon name="list-outline"></ion-icon>
            Zutatenliste
          </h3>

          <!-- Export to Bring! button -->
          <div v-if="ingredients.length > 0 && isBringConfigured" style="margin-bottom: 16px;">
            <button 
              class="btn btn-primary btn-full-width" 
              style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; background-color: #E63946; border-color: #E63946;"
              @click="exportToBring"
              :disabled="exporting"
            >
              <ion-icon :name="exporting ? 'sync-outline' : 'paper-plane-outline'" :class="{ 'spin': exporting }"></ion-icon>
              {{ exporting ? 'Wird übertragen...' : 'An Bring! senden' }}
            </button>
            <p v-if="exportError" style="font-size: 11px; color: var(--system-red); margin-top: 6px; display: flex; align-items: center; gap: 4px; margin-bottom: 0;">
              <ion-icon name="alert-circle-outline"></ion-icon>
              {{ exportError }}
            </p>
            <p v-if="exportSuccess" style="font-size: 11px; color: var(--accent-primary); margin-top: 6px; display: flex; align-items: center; gap: 4px; margin-bottom: 0;">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              {{ exportSuccess }}
            </p>
          </div>

          <div v-if="loading" class="shopping-list-loading" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div class="loading-spinner" style="margin-bottom: 10px;"></div>
            Zutaten werden berechnet...
          </div>

          <div v-else-if="ingredients.length === 0" style="text-align: center; padding: 40px; color: var(--text-muted); font-style: italic;">
            Keine eingeplanten Gerichte oder Zutaten im gewählten Zeitraum.
          </div>

          <div v-else class="shopping-ingredients-list-container">
            <ul class="detail-ingredients-list" style="margin: 0; padding: 0;">
              <li v-for="(ing, idx) in ingredients" :key="idx" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--border-color);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex-grow: 1; margin: 0;">
                  <input
                    type="checkbox"
                    :checked="checkedItems.includes(ing.name.toLowerCase())"
                    @change="toggleChecked(ing.name)"
                  />
                  <span :style="{ 
                    textDecoration: checkedItems.includes(ing.name.toLowerCase()) ? 'line-through' : 'none', 
                    opacity: checkedItems.includes(ing.name.toLowerCase()) ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }">
                    {{ ing.name }}
                    <span v-if="ing.count > 1" style="color: var(--accent-primary); font-weight: 600; margin-left: 4px;">
                      ({{ ing.count }})
                    </span>
                  </span>
                </label>
              </li>
            </ul>
          </div>
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
  todayStr: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close']);

const daysCount = ref(7);
const ingredients = ref([]);
const loading = ref(false);
const checkedItems = ref([]); // temporary checked off items while modal is open
const isBringConfigured = ref(false);
const exporting = ref(false);
const exportError = ref('');
const exportSuccess = ref('');

async function fetchShoppingList() {
  if (!props.isOpen || !props.todayStr) return;
  loading.value = true;
  try {
    const res = await fetch(`/api/shopping-list?startDate=${props.todayStr}&days=${daysCount.value}`);
    if (res.ok) {
      ingredients.value = await res.json();
    }
  } catch (err) {
    console.error('Fehler beim Laden der Einkaufsliste:', err);
  } finally {
    loading.value = false;
  }
}

function changeDaysCount(n) {
  daysCount.value = n;
  fetchShoppingList();
}

function toggleChecked(name) {
  const lower = name.toLowerCase();
  const idx = checkedItems.value.indexOf(lower);
  if (idx > -1) {
    checkedItems.value.splice(idx, 1);
  } else {
    checkedItems.value.push(lower);
  }
}

// Reset checklist and fetch when modal opens
watch(() => props.isOpen, (isOpenVal) => {
  if (isOpenVal) {
    checkedItems.value = [];
    exportError.value = '';
    exportSuccess.value = '';
    checkBringConfig();
    fetchShoppingList();
  }
});

async function checkBringConfig() {
  try {
    const res = await fetch('/api/settings/bring');
    if (res.ok) {
      const data = await res.json();
      isBringConfigured.value = !!(data.email && data.listUuid);
    }
  } catch (err) {
    console.error('Fehler beim Prüfen der Bring-Konfiguration:', err);
  }
}

async function exportToBring() {
  exportError.value = '';
  exportSuccess.value = '';
  
  // We only export UNCHECKED ingredients! High usability detail!
  const uncheckedIngs = ingredients.value.filter(ing => !checkedItems.value.includes(ing.name.toLowerCase()));
  
  if (uncheckedIngs.length === 0) {
    exportError.value = 'Keine offenen Zutaten zum Exportieren vorhanden.';
    return;
  }

  exporting.value = true;
  try {
    const res = await fetch('/api/shopping-list/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: uncheckedIngs.map(ing => ing.name)
      })
    });

    const data = await res.json();
    if (res.ok) {
      exportSuccess.value = data.message || 'Erfolgreich übertragen!';
    } else {
      exportError.value = data.error || 'Fehler beim Export.';
    }
  } catch (err) {
    console.error('Fehler beim Export an Bring!:', err);
    exportError.value = 'Netzwerkfehler beim Export.';
  } finally {
    exporting.value = false;
  }
}

// Re-fetch if todayStr changes while open
watch(() => props.todayStr, () => {
  if (props.isOpen) {
    fetchShoppingList();
  }
});
</script>

<style scoped>
.shopping-list-panel {
  width: 500px !important;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
