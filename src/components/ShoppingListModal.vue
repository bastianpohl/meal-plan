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
              <li v-for="(ing, idx) in ingredients" :key="idx" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--border-color); gap: 12px; width: 100%;">
                <!-- Left: Checkbox & Name -->
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex-grow: 1; margin: 0; min-width: 0;">
                  <input
                    type="checkbox"
                    :checked="checkedItems.includes(ing.name.toLowerCase())"
                    @change="toggleChecked(ing.name)"
                    style="cursor: pointer; flex-shrink: 0;"
                  />
                  <span :style="{ 
                    textDecoration: checkedItems.includes(ing.name.toLowerCase()) ? 'line-through' : 'none', 
                    opacity: checkedItems.includes(ing.name.toLowerCase()) ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    wordBreak: 'break-word',
                    fontSize: '14px',
                    fontWeight: '500',
                    lineHeight: '1.4'
                  }">
                    {{ ing.name }}
                    <span v-if="ing.count > 1" style="color: var(--accent-primary); font-weight: 600; margin-left: 4px;">
                      ({{ ing.count }})
                    </span>
                  </span>
                </label>

                <!-- Right: Bring! Actions & Prefs -->
                <div v-if="isBringConfigured" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                  <!-- Quantity Preference Dropdown -->
                  <select 
                    v-if="ing.count > 1"
                    :value="getQtyPreference(ing.name)" 
                    @change="setQtyPreference(ing.name, $event.target.value)"
                    class="qty-select"
                    style="margin: 0;"
                  >
                    <option value="yes">mit Menge</option>
                    <option value="no">ohne Menge</option>
                  </select>

                  <!-- Status Badge or Action Button -->
                  <div style="display: flex; align-items: center; justify-content: flex-end; width: 95px;">
                    <span v-if="isOnBringList(ing.name)" class="bring-badge bring-active" title="Bereits auf Bring!">
                      <ion-icon name="checkmark-done-outline" style="font-size: 14px;"></ion-icon>
                      Gelistet
                    </span>
                    
                    <button 
                      v-else
                      class="bring-badge bring-inactive" 
                      title="Zu Bring! hinzufügen" 
                      @click="exportSingleToBring(ing)"
                      :disabled="exportingIngs[ing.name.toLowerCase()]"
                    >
                      <ion-icon 
                        :name="exportingIngs[ing.name.toLowerCase()] ? 'sync-outline' : 'add-outline'" 
                        :class="{ 'spin': exportingIngs[ing.name.toLowerCase()] }"
                        style="font-size: 14px;"
                      ></ion-icon>
                      Bring!
                    </button>
                  </div>
                </div>
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

// Bring! detailed list integration
const bringActiveItems = ref([]);
const loadingBringItems = ref(false);
const qtyPreferences = ref({});
const exportingIngs = ref({});

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

async function fetchBringItems() {
  if (!isBringConfigured.value) return;
  loadingBringItems.value = true;
  try {
    const res = await fetch('/api/settings/bring/items');
    if (res.ok) {
      const data = await res.json();
      bringActiveItems.value = data.items || [];
    }
  } catch (err) {
    console.error('Fehler beim Laden der Bring-Elemente:', err);
  } finally {
    loadingBringItems.value = false;
  }
}

function isOnBringList(name) {
  const lower = name.toLowerCase().trim();
  return bringActiveItems.value.some(item => item.name.toLowerCase().trim() === lower);
}

function getQtyPreference(name) {
  const lower = name.toLowerCase();
  if (qtyPreferences.value[lower] !== undefined) {
    return qtyPreferences.value[lower];
  }
  const saved = localStorage.getItem(`bring_qty_pref_${lower}`);
  const pref = saved === 'no' ? 'no' : 'yes';
  qtyPreferences.value[lower] = pref;
  return pref;
}

function setQtyPreference(name, val) {
  const lower = name.toLowerCase();
  qtyPreferences.value[lower] = val;
  localStorage.setItem(`bring_qty_pref_${lower}`, val);
}

async function exportSingleToBring(ing) {
  const lower = ing.name.toLowerCase();
  exportingIngs.value[lower] = true;
  
  const pref = getQtyPreference(ing.name);
  const spec = (pref === 'yes' && ing.count > 1) ? `${ing.count}` : '';

  try {
    const res = await fetch('/api/shopping-list/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: [{ name: ing.name, specification: spec }]
      })
    });

    if (res.ok) {
      // Add locally so green checkmark renders instantly
      bringActiveItems.value.push({ name: ing.name, specification: spec });
    }
  } catch (err) {
    console.error('Fehler beim Export der Zutat:', err);
  } finally {
    exportingIngs.value[lower] = false;
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
    bringActiveItems.value = [];
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
      if (isBringConfigured.value) {
        fetchBringItems();
      }
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
    const itemsToExport = uncheckedIngs.map(ing => {
      const pref = getQtyPreference(ing.name);
      const spec = (pref === 'yes' && ing.count > 1) ? `${ing.count}` : '';
      return { name: ing.name, specification: spec };
    });

    const res = await fetch('/api/shopping-list/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: itemsToExport
      })
    });

    const data = await res.json();
    if (res.ok) {
      exportSuccess.value = data.message || 'Erfolgreich übertragen!';
      
      // Update local active items
      for (const item of itemsToExport) {
        if (!isOnBringList(item.name)) {
          bringActiveItems.value.push(item);
        }
      }
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
  width: 540px !important;
  height: 80vh !important;
  max-height: 80vh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.shopping-list-panel .settings-body {
  flex: 1 !important;
  overflow-y: auto !important;
  padding-bottom: 32px !important;
}

.shopping-list-panel .detail-ingredients-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 0 !important;
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

.qty-select {
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  outline: none;
  cursor: pointer;
  margin-right: 4px;
  transition: all 0.2s ease;
}

.qty-select:hover {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.bring-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 99px;
  transition: all 0.2s ease;
}

.bring-badge.bring-active {
  background: rgba(46, 196, 182, 0.12);
  color: #2ec4b6;
  border: 1px solid rgba(46, 196, 182, 0.25);
}

.bring-badge.bring-inactive {
  background: rgba(230, 57, 70, 0.08);
  color: #E63946;
  border: 1px solid rgba(230, 57, 70, 0.15);
  cursor: pointer;
}

.bring-badge.bring-inactive:hover {
  background: #E63946;
  color: #ffffff;
  border-color: #E63946;
  box-shadow: 0 2px 6px rgba(230, 57, 70, 0.25);
}

.bring-badge:disabled {
  opacity: 0.6;
  pointer-events: none;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
