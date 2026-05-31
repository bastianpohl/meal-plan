<template>
  <div :class="['modal-overlay', { active: isOpen }]" id="recipe-form-modal" @click.self="$emit('close')">
    <div class="modal-content glass">
      <div class="modal-header">
        <h3>{{ id ? 'Rezept bearbeiten' : 'Neues Rezept erfassen' }}</h3>
        <button class="modal-close" @click="$emit('close')">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" enctype="multipart/form-data">
        <input type="hidden" v-model="id" />
        
        <div class="form-group">
          <label for="recipe-title">Titel des Gerichts *</label>
          <input
            type="text"
            id="recipe-title"
            required
            placeholder="z.B. Cremige Spaghetti Carbonara"
            v-model="title"
          />
        </div>
        
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="recipe-duration">Zubereitungszeit (Minuten)</label>
            <input
              type="number"
              id="recipe-duration"
              min="1"
              placeholder="z.B. 25"
              v-model.number="duration"
            />
          </div>
          <div class="form-group flex-1">
            <label for="recipe-category">Kategorie</label>
            <select id="recipe-category" v-model="category">
              <option value="">-- Wählen --</option>
              <option value="Pasta">Pasta</option>
              <option value="Veggie">Veggie</option>
              <option value="Fleisch">Fleisch</option>
              <option value="Fisch">Fisch</option>
              <option value="Dessert">Dessert</option>
              <option value="Anderes">Anderes</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="recipe-tags">Tags (durch Komma oder Leerzeichen trennen)</label>
          <input
            type="text"
            id="recipe-tags"
            placeholder="z.B. #schnell #italienisch #klassiker"
            v-model="tags"
          />
        </div>

        <div class="form-group">
          <label for="recipe-ingredients">Zutaten (Eine Zutat pro Zeile, ohne Mengen)</label>
          <textarea
            id="recipe-ingredients"
            rows="4"
            placeholder="z.B.&#10;Spaghetti&#10;Guanciale&#10;Pecorino Romano&#10;Eigelb"
            v-model="ingredients"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="recipe-notes">Notizen / Zubereitungsschritte / Link</label>
          <textarea
            id="recipe-notes"
            rows="3"
            placeholder="Zubereitungsdetails oder nützliche Hinweise eintragen..."
            v-model="notes"
          ></textarea>
        </div>

        <!-- Image Upload -->
        <div class="form-group">
          <label>Fotos hochladen (N Bilder möglich)</label>
          <div class="file-upload-zone" style="position: relative; cursor: pointer;">
            <input
              ref="fileInput"
              type="file"
              id="recipe-images-input"
              multiple
              accept="image/*"
              @change="handleImageSelection"
              style="position: absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;"
            />
            <div class="upload-zone-prompt">
              <ion-icon name="images-outline" style="font-size: 32px; color: var(--accent-primary);"></ion-icon>
              <span>Klicke hier oder ziehe Bilder hierher</span>
              <span class="upload-note">Das erste Bild wird automatisch das Titelbild</span>
            </div>
          </div>
          <div class="images-preview-grid" id="images-preview-grid" v-if="newImagePreviews.length > 0">
            <div
              v-for="(src, index) in newImagePreviews"
              :key="index"
              class="preview-image-item new-preview-item"
            >
              <img :src="src" alt="" />
              <div v-if="index === 0" class="preview-cover-indicator">★</div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Abbrechen</button>
          <button type="submit" class="btn btn-primary" id="recipe-submit-btn">Rezept speichern</button>
        </div>
      </form>
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
  recipeToEdit: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'recipe-saved']);

const id = ref(null);
const title = ref('');
const duration = ref('');
const category = ref('');
const tags = ref('');
const ingredients = ref('');
const notes = ref('');
const newImagePreviews = ref([]);
const fileInput = ref(null);

watch(
  [() => props.recipeToEdit, () => props.isOpen],
  ([newVal, open]) => {
    if (open) {
      newImagePreviews.value = [];
      if (fileInput.value) fileInput.value.value = '';
      
      if (newVal) {
        id.value = newVal.id;
        title.value = newVal.title || '';
        duration.value = newVal.duration || '';
        category.value = newVal.category || '';
        tags.value = newVal.tags ? newVal.tags.map(t => `#${t}`).join(' ') : '';
        ingredients.value = newVal.ingredients ? newVal.ingredients.join('\n') : '';
        notes.value = newVal.notes || '';
      } else {
        id.value = null;
        title.value = '';
        duration.value = '';
        category.value = '';
        tags.value = '';
        ingredients.value = '';
        notes.value = '';
      }
    }
  },
  { immediate: true }
);

function handleImageSelection(e) {
  newImagePreviews.value = [];
  const files = e.target.files;
  if (!files) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = (event) => {
      newImagePreviews.value.push(event.target.result);
    };
    reader.readAsDataURL(file);
  }
}

async function handleSubmit() {
  if (!title.value || !title.value.trim()) return;

  try {
    if (id.value) {
      // Edit mode (JSON PUT request)
      const res = await fetch(`/api/recipes/${id.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.value,
          duration: duration.value ? parseInt(duration.value) : null,
          category: category.value,
          tags: tags.value,
          ingredients: ingredients.value,
          notes: notes.value
        })
      });

      if (!res.ok) return;

      // Upload extra images if selected
      if (fileInput.value && fileInput.value.files && fileInput.value.files.length > 0) {
        const fileFormData = new FormData();
        for (let i = 0; i < fileInput.value.files.length; i++) {
          fileFormData.append('images', fileInput.value.files[i]);
        }
        await fetch(`/api/recipes/${id.value}/images`, {
          method: 'POST',
          body: fileFormData
        });
      }

      emit('recipe-saved');
    } else {
      // Create mode (Multipart POST Form)
      const formData = new FormData();
      formData.append('title', title.value);
      formData.append('duration', duration.value);
      formData.append('category', category.value);
      formData.append('tags', tags.value);
      formData.append('ingredients', ingredients.value);
      formData.append('notes', notes.value);

      if (fileInput.value && fileInput.value.files) {
        for (let i = 0; i < fileInput.value.files.length; i++) {
          formData.append('images', fileInput.value.files[i]);
        }
      }

      const res = await fetch('/api/recipes', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        emit('recipe-saved');
      }
    }
  } catch (err) {
    console.error('Fehler beim Speichern des Rezepts:', err);
  }
}
</script>
