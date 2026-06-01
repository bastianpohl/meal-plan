<template>
  <div :class="['modal-overlay', { active: isOpen }]" id="recipe-details-modal" @click.self="$emit('close')">
    <div class="modal-content glass recipe-detail-content" v-if="localRecipe">
      <button class="modal-close floating" @click="$emit('close')">
        <ion-icon name="close-outline"></ion-icon>
      </button>
      
      <div class="recipe-detail-layout">
        <!-- Gallery section (Left side on Desktop) -->
        <div class="recipe-detail-gallery">
          <div class="main-gallery-view">
            <!-- If we have images -->
            <template v-if="localRecipe.images && localRecipe.images.length > 0">
              <img
                :src="'/' + localRecipe.images[selectedImageIndex].image_path"
                alt="Gerichtsbild"
                id="detail-main-img"
              />
              <span v-if="localRecipe.images[selectedImageIndex].is_cover === 1" class="cover-badge">
                <ion-icon name="star" style="font-size:12px; margin-right:4px; color:#fff;"></ion-icon>
                Titelbild
              </span>
            </template>
            <!-- Fallback Empty Gallery View -->
            <div v-else class="gallery-empty-ph">
              <div style="color:var(--text-muted); text-align:center; padding:40px; display:flex; flex-direction:column; align-items:center; gap:4px;">
                <ion-icon name="image-outline" style="font-size: 40px;"></ion-icon>
                <span style="font-weight:600; font-size:12px;">Keine Fotos vorhanden</span>
              </div>
            </div>
          </div>
          
          <!-- Thumbnails -->
          <div
            v-if="localRecipe.images && localRecipe.images.length > 0"
            class="thumbnail-gallery-scroll"
            id="detail-thumb-scroll"
          >
            <div
              v-for="(img, idx) in localRecipe.images"
              :key="img.id"
              :class="['detail-thumb', { active: idx === selectedImageIndex }]"
              @click="selectedImageIndex = idx"
              style="position: relative;"
            >
              <img :src="'/' + img.image_path" alt="" />
              <div
                v-if="img.is_cover === 1"
                style="position:absolute; bottom:1px; right:1px; background:var(--accent-secondary); border-radius:50%; width:10px; height:10px; display:flex; align-items:center; justify-content:center; color:white; font-size:6px; font-weight:bold;"
              >
                ★
              </div>
            </div>
          </div>
          
          <!-- Gallery Controls -->
          <div class="gallery-management-row">
            <button
              v-if="localRecipe.images && localRecipe.images.length > 0 && localRecipe.images[selectedImageIndex].is_cover !== 1"
              class="btn btn-secondary btn-small"
              @click="setCoverImage"
            >
              <ion-icon name="star-outline" style="font-size:14px;"></ion-icon> Titelbild setzen
            </button>
            <button
              v-if="localRecipe.images && localRecipe.images.length > 0"
              class="btn btn-danger btn-small"
              @click="deleteImage"
            >
              <ion-icon name="trash-outline" style="font-size:14px;"></ion-icon> Bild löschen
            </button>
            <label class="btn btn-secondary btn-small image-upload-label" style="cursor: pointer;">
              <ion-icon name="image-outline" style="font-size:14px;"></ion-icon> Fotos hinzufügen
              <input type="file" multiple accept="image/*" style="display:none;" @change="addImages" />
            </label>
          </div>
        </div>
        
        <!-- Text details section (Right side) -->
        <div class="recipe-detail-info">
          <div class="detail-header-group">
            <h2>{{ localRecipe.title }}</h2>
            <div class="detail-meta-row" v-if="localRecipe.duration">
              <span class="detail-meta-item">
                <ion-icon name="time-outline" style="font-size:16px; margin-right:4px; color:var(--accent-primary);"></ion-icon>
                <span>{{ localRecipe.duration }}</span> Min
              </span>
            </div>
            
            <!-- Tags Container -->
            <div class="tags-container-pills" v-if="parsedTags && parsedTags.length">
              <span
                v-for="tag in parsedTags"
                :key="tag"
                class="tag-pill"
                style="background-color: rgba(205,220,45,0.15); color: rgb(205,220,45); cursor: pointer;"
                @click="$emit('tag-click', tag)"
              >
                #{{ tag }}
              </span>
            </div>
          </div>
          
          <!-- Ingredients Section -->
          <div class="detail-body-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <h3 style="margin-bottom: 0;">Zutaten</h3>
              
              <!-- Reset button for custom ingredients -->
              <button 
                v-if="assignmentId && isCustomIngredients" 
                class="btn btn-secondary" 
                style="padding: 4px 10px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; border-radius: 6px; box-shadow: none; border: 1px solid var(--border-color); height: 26px;"
                @click="resetAssignmentIngredients"
              >
                <ion-icon name="reload-outline" style="font-size: 13px;"></ion-icon>
                Auf Standard zurücksetzen
              </button>
            </div>
            
            <p v-if="assignmentId" class="settings-days-hint" style="margin-top: 2px; margin-bottom: 12px; font-size: 11px; color: var(--accent-primary); display: flex; align-items: center; gap: 4px; font-weight: 500;">
              <ion-icon name="information-circle-outline" style="font-size: 14px;"></ion-icon>
              {{ isCustomIngredients ? 'Zutaten für diesen Tag angepasst.' : 'Standard-Zutaten. Ändere die Liste, um sie anzupassen.' }}
            </p>

            <!-- Loading indicator for custom ingredients -->
            <p v-if="assignmentId && loadingIngredients" style="color: var(--text-muted); font-style: italic; font-size: 13px; margin: 8px 0;">
              Zutaten werden geladen...
            </p>

            <template v-else>
              <!-- 1. Customized list mode (if assignmentId is active) -->
              <ul class="detail-ingredients-list" v-if="assignmentId && assignmentIngredients.length > 0">
                <li v-for="(ing, idx) in assignmentIngredients" :key="idx" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed var(--border-color);">
                  <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:0; flex-grow: 1;">
                    <input
                      type="checkbox"
                      :checked="ing.checked"
                      @change="toggleAssignmentIngredient(idx)"
                    />
                    <span :style="{ textDecoration: ing.checked ? 'line-through' : 'none', opacity: ing.checked ? 0.6 : 1 }">{{ ing.name }}</span>
                  </label>
                  
                  <!-- Trash Icon to delete ingredient from this planned meal -->
                  <button 
                    @click="deleteAssignmentIngredient(idx)"
                    style="background: none; border: none; padding: 4px; cursor: pointer; color: var(--text-muted); display: flex; align-items: center;"
                    title="Zutat löschen"
                  >
                    <ion-icon name="close-circle-outline" style="font-size: 18px; transition: color 0.2s;" onmouseover="this.style.color='var(--system-red)'" onmouseout="this.style.color='var(--text-muted)'"></ion-icon>
                  </button>
                </li>
              </ul>

              <!-- 2. Standard list mode (no assignmentId or fallback if no ingredients) -->
              <ul class="detail-ingredients-list" v-else-if="!assignmentId && localRecipe && localRecipe.ingredients && localRecipe.ingredients.length > 0">
                <li v-for="(ing, index) in localRecipe.ingredients" :key="index">
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom:0;">
                    <input
                      type="checkbox"
                      :checked="checkedIngredients.includes(ing)"
                      @change="toggleIngredient(ing)"
                    />
                    <span :style="{ textDecoration: checkedIngredients.includes(ing) ? 'line-through' : 'none', opacity: checkedIngredients.includes(ing) ? 0.6 : 1 }">{{ ing }}</span>
                  </label>
                </li>
              </ul>
              
              <!-- 3. Empty list mode -->
              <ul class="detail-ingredients-list" v-else>
                <li style="color:var(--text-muted); font-style:italic;">Keine Zutaten hinterlegt.</li>
              </ul>

              <!-- 4. Add Ingredient Input Field (only visible when viewing a planned meal assignment) -->
              <div v-if="assignmentId" class="add-ingredient-inline" style="display: flex; gap: 8px; margin-top: 14px; align-items: center;">
                <input 
                  type="text" 
                  v-model="newIngredientName" 
                  placeholder="Zutat hinzufügen (z. B. Salami)" 
                  class="form-control"
                  style="flex-grow: 1; height: 36px; font-size: 12px; padding: 6px 12px; border-radius: 8px; background: var(--bg-glass-light); border: 1px solid var(--border-color); color: var(--text-primary);"
                  @keydown.enter="addAssignmentIngredient"
                />
                <button 
                  class="btn btn-secondary" 
                  style="height: 36px; padding: 0 12px; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: none;"
                  @click="addAssignmentIngredient"
                >
                  <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
                  Hinzufügen
                </button>
              </div>
            </template>
          </div>
          
          <!-- Notes Section -->
          <div class="detail-body-section" v-if="localRecipe.notes && localRecipe.notes.trim().length > 0">
            <h3>Zubereitung / Notizen</h3>
            <p style="white-space: pre-wrap; word-break: break-word; line-height: 1.5;">
              <template v-for="(part, pIdx) in parsedNotes" :key="pIdx">
                <span v-if="part.type === 'text'">{{ part.content }}</span>
                <a v-else :href="part.content" target="_blank" rel="noopener noreferrer" class="note-link">
                  {{ part.content }}
                  <ion-icon name="open-outline" style="font-size: 11px; margin-left: 2px; vertical-align: middle;"></ion-icon>
                </a>
              </template>
            </p>

            <!-- Link Previews Container -->
            <div v-if="notesUrls.length > 0" class="link-previews-container" style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
              <template v-for="url in notesUrls" :key="url">
                <!-- Shimmer loading state -->
                <div v-if="loadingPreviews[url]" class="link-preview-card shimmer-loading">
                  <div class="shimmer-content">
                    <div class="shimmer-line site"></div>
                    <div class="shimmer-line title"></div>
                    <div class="shimmer-line desc"></div>
                  </div>
                  <div class="shimmer-img"></div>
                </div>

                <!-- Active preview card -->
                <a 
                  v-else-if="linkPreviews[url] && linkPreviews[url].title" 
                  :href="url" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="link-preview-card"
                >
                  <div class="preview-text">
                    <span class="preview-site">{{ linkPreviews[url].siteName }}</span>
                    <h4 class="preview-title">{{ linkPreviews[url].title }}</h4>
                    <p class="preview-desc" v-if="linkPreviews[url].description">{{ linkPreviews[url].description }}</p>
                  </div>
                  <div class="preview-img-wrapper" v-if="linkPreviews[url].image">
                    <img :src="linkPreviews[url].image" alt="Vorschau" class="preview-image" @error="linkPreviews[url].image = null" />
                  </div>
                </a>
              </template>
            </div>
          </div>

          <!-- Quick Assign slots lunch/dinner for mobile -->
          <div class="detail-assign-section glass" v-if="visibleDays && visibleDays.length > 0">
            <h3>Gericht für kommende Tage planen</h3>
            <div class="assign-slots-container">
              <div v-for="day in visibleDays.filter(d => !d.isPast)" :key="day.formattedDateStr" class="assign-slot-row">
                <span class="assign-slot-name">{{ day.name }} ({{ day.dateSubtitle }})</span>
                <div class="assign-slot-actions">
                  <button
                    :class="['btn-slot-toggle', 'btn-lunch', { assigned: isLunchAssigned(day.formattedDateStr) }]"
                    @click="$emit('toggle-assignment', { day: day.formattedDateStr, mealType: 'lunch', recipeId: localRecipe.id })"
                  >
                    Mittags
                  </button>
                  <button
                    :class="['btn-slot-toggle', 'btn-dinner', { assigned: isDinnerAssigned(day.formattedDateStr) }]"
                    @click="$emit('toggle-assignment', { day: day.formattedDateStr, mealType: 'dinner', recipeId: localRecipe.id })"
                  >
                    Abends
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Admin actions -->
          <div class="detail-admin-actions">
            <button class="btn btn-secondary" @click="$emit('edit-recipe', localRecipe)">
              <ion-icon name="create-outline" style="font-size:16px;"></ion-icon> Rezept bearbeiten
            </button>
            <button class="btn btn-danger" @click="deleteRecipe">
              <ion-icon name="trash-outline" style="font-size:16px;"></ion-icon> Rezept löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  recipe: {
    type: Object,
    default: null
  },
  assignmentId: {
    type: [Number, String],
    default: null
  },
  visibleDays: {
    type: Array,
    default: () => []
  },
  assignments: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits([
  'close',
  'recipe-updated',
  'recipe-deleted',
  'toggle-assignment',
  'tag-click',
  'edit-recipe'
]);

const DAYS_OF_WEEK = [
  { key: 'Monday', name: 'Montag' },
  { key: 'Tuesday', name: 'Dienstag' },
  { key: 'Wednesday', name: 'Mittwoch' },
  { key: 'Thursday', name: 'Donnerstag' },
  { key: 'Friday', name: 'Freitag' },
  { key: 'Saturday', name: 'Samstag' },
  { key: 'Sunday', name: 'Sonntag' }
];

const localRecipe = ref(null);
const selectedImageIndex = ref(0);
const checkedIngredients = ref([]);

// Zuweisungsspezifische Zutaten-Zustände
const assignmentIngredients = ref([]);
const isCustomIngredients = ref(false);
const newIngredientName = ref('');
const loadingIngredients = ref(false);

async function loadAssignmentIngredients() {
  if (!props.assignmentId) {
    assignmentIngredients.value = [];
    isCustomIngredients.value = false;
    return;
  }
  loadingIngredients.value = true;
  try {
    const res = await fetch(`/api/assignments/${props.assignmentId}/ingredients`);
    if (res.ok) {
      const data = await res.json();
      const rawIngs = data.ingredients || [];
      assignmentIngredients.value = [...rawIngs].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      isCustomIngredients.value = data.isCustom || false;
    }
  } catch (err) {
    console.error('Fehler beim Laden der Zuweisungs-Zutaten:', err);
  } finally {
    loadingIngredients.value = false;
  }
}

async function saveAssignmentIngredients(updatedList) {
  if (!props.assignmentId) return;
  try {
    const res = await fetch(`/api/assignments/${props.assignmentId}/ingredients`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: updatedList })
    });
    if (res.ok) {
      const data = await res.json();
      const rawIngs = data.ingredients || [];
      assignmentIngredients.value = [...rawIngs].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      isCustomIngredients.value = data.isCustom || false;
    }
  } catch (err) {
    console.error('Fehler beim Speichern der Zuweisungs-Zutaten:', err);
  }
}

function toggleAssignmentIngredient(index) {
  const list = [...assignmentIngredients.value];
  list[index].checked = !list[index].checked;
  saveAssignmentIngredients(list);
}

function addAssignmentIngredient() {
  const name = newIngredientName.value.trim();
  if (!name) return;
  const list = [...assignmentIngredients.value];
  list.push({ name, checked: false });
  saveAssignmentIngredients(list);
  newIngredientName.value = '';
}

function deleteAssignmentIngredient(index) {
  const list = [...assignmentIngredients.value];
  list.splice(index, 1);
  saveAssignmentIngredients(list);
}

async function resetAssignmentIngredients() {
  if (!props.assignmentId || !confirm('Möchtest du die Zutaten wirklich auf den Standard des Originalrezepts zurücksetzen? Alle individuellen Änderungen an diesem Tag gehen verloren!')) return;
  try {
    const res = await fetch(`/api/assignments/${props.assignmentId}/ingredients`, { method: 'DELETE' });
    if (res.ok) {
      loadAssignmentIngredients();
    }
  } catch (err) {
    console.error('Fehler beim Zurücksetzen der Zuweisungs-Zutaten:', err);
  }
}

// Watchers for props
watch(() => [props.assignmentId, props.isOpen], () => {
  if (props.isOpen && props.assignmentId) {
    loadAssignmentIngredients();
  } else {
    assignmentIngredients.value = [];
    isCustomIngredients.value = false;
  }
}, { immediate: true });

watch(() => props.recipe, (newVal) => {
  if (newVal) {
    const cloned = { ...newVal };
    if (cloned.ingredients && Array.isArray(cloned.ingredients)) {
      cloned.ingredients = [...cloned.ingredients].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    localRecipe.value = cloned;
  } else {
    localRecipe.value = null;
  }
  selectedImageIndex.value = 0;
}, { immediate: true });

// Load checklist state on recipe change
watch(() => localRecipe.value, (newRecipe) => {
  if (newRecipe && newRecipe.id) {
    const saved = localStorage.getItem(`ingredients_checked_${newRecipe.id}`);
    checkedIngredients.value = saved ? JSON.parse(saved) : [];
  } else {
    checkedIngredients.value = [];
  }
}, { immediate: true });

function toggleIngredient(ingredient) {
  const index = checkedIngredients.value.indexOf(ingredient);
  if (index > -1) {
    checkedIngredients.value.splice(index, 1);
  } else {
    checkedIngredients.value.push(ingredient);
  }
  if (localRecipe.value && localRecipe.value.id) {
    localStorage.setItem(`ingredients_checked_${localRecipe.value.id}`, JSON.stringify(checkedIngredients.value));
  }
}

// Link Preview State and Logic
const linkPreviews = ref({});
const loadingPreviews = ref({});

const notesUrls = computed(() => {
  if (!localRecipe.value || !localRecipe.value.notes) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = localRecipe.value.notes.match(urlRegex) || [];
  return [...new Set(matches.map(url => url.trim()))];
});

const parsedNotes = computed(() => {
  const text = localRecipe.value?.notes;
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const index = match.index;
    if (index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, index) });
    }
    parts.push({ type: 'link', content: url });
    lastIndex = urlRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }
  return parts;
});

async function loadLinkPreviews() {
  const urls = notesUrls.value;
  for (const url of urls) {
    if (linkPreviews.value[url] !== undefined || loadingPreviews.value[url]) continue;
    
    loadingPreviews.value[url] = true;
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        linkPreviews.value[url] = await res.json();
      } else {
        linkPreviews.value[url] = null;
      }
    } catch (err) {
      console.error('Fehler beim Laden der Linkvorschau:', err);
      linkPreviews.value[url] = null;
    } finally {
      loadingPreviews.value[url] = false;
    }
  }
}

// Watchers to trigger loading link previews
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadLinkPreviews();
  }
});

watch(notesUrls, () => {
  if (props.isOpen) {
    loadLinkPreviews();
  }
}, { deep: true });

const parsedTags = computed(() => {
  if (!localRecipe.value || !localRecipe.value.tags) return [];
  if (Array.isArray(localRecipe.value.tags)) return localRecipe.value.tags;
  return localRecipe.value.tags;
});

function isLunchAssigned(dateStr) {
  if (!props.assignments || !localRecipe.value) return false;
  const current = props.assignments[dateStr];
  return current?.lunch?.recipe?.id === localRecipe.value.id;
}

function isDinnerAssigned(dateStr) {
  if (!props.assignments || !localRecipe.value) return false;
  const current = props.assignments[dateStr];
  return current?.dinner?.recipe?.id === localRecipe.value.id;
}

// Gallery Actions
async function setCoverImage() {
  if (!localRecipe.value || !localRecipe.value.images.length) return;
  const activeImg = localRecipe.value.images[selectedImageIndex.value];
  
  try {
    const res = await fetch(`/api/recipes/${localRecipe.value.id}/images/${activeImg.id}/cover`, {
      method: 'PUT'
    });
    if (res.ok) {
      const updated = await res.json();
      localRecipe.value = updated;
      emit('recipe-updated', updated);
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteImage() {
  if (!localRecipe.value || !localRecipe.value.images.length) return;
  const activeImg = localRecipe.value.images[selectedImageIndex.value];
  
  if (!confirm('Bild dauerhaft aus dem Rezept löschen?')) return;
  
  try {
    const res = await fetch(`/api/recipes/${localRecipe.value.id}/images/${activeImg.id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const updated = await res.json();
      localRecipe.value = updated;
      selectedImageIndex.value = Math.max(0, selectedImageIndex.value - 1);
      emit('recipe-updated', updated);
    }
  } catch (err) {
    console.error(err);
  }
}

async function addImages(e) {
  if (!localRecipe.value || e.target.files.length === 0) return;
  
  const formData = new FormData();
  for (let i = 0; i < e.target.files.length; i++) {
    formData.append('images', e.target.files[i]);
  }
  
  try {
    const res = await fetch(`/api/recipes/${localRecipe.value.id}/images`, {
      method: 'POST',
      body: formData
    });
    
    if (res.ok) {
      const updated = await res.json();
      localRecipe.value = updated;
      selectedImageIndex.value = updated.images.length - 1;
      emit('recipe-updated', updated);
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteRecipe() {
  if (!localRecipe.value) return;
  if (!confirm('Rezept unwiderruflich aus dem Portfolio löschen?')) return;
  
  try {
    const res = await fetch(`/api/recipes/${localRecipe.value.id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      emit('recipe-deleted', localRecipe.value.id);
    }
  } catch (err) {
    console.error(err);
  }
}
</script>

<style scoped>
.note-link {
  color: var(--accent-primary);
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s ease;
  word-break: break-all;
}

.note-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}

.link-preview-card {
  display: flex;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.3s cubic-bezier(0.25, 1, 0.22, 1);
  max-width: 100%;
}

.link-preview-card:hover {
  transform: translateY(-2px);
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.preview-text {
  flex: 1;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.preview-site {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px 0;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-img-wrapper {
  width: 110px;
  min-height: 110px;
  flex-shrink: 0;
  border-left: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.link-preview-card:hover .preview-image {
  transform: scale(1.05);
}

/* Shimmer Loading Styles */
.shimmer-loading {
  background: var(--bg-tertiary);
  pointer-events: none;
}

.shimmer-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shimmer-line {
  height: 12px;
  background: linear-gradient(90deg, var(--border-color) 25%, var(--bg-secondary) 50%, var(--border-color) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.shimmer-line.title {
  width: 70%;
  height: 14px;
}

.shimmer-line.desc {
  width: 90%;
  height: 12px;
}

.shimmer-line.site {
  width: 40%;
  height: 10px;
}

.shimmer-img {
  width: 110px;
  height: 110px;
  background: linear-gradient(90deg, var(--border-color) 25%, var(--bg-secondary) 50%, var(--border-color) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
