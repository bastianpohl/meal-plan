<template>
  <div :class="['modal-overlay', { active: isOpen }]" id="plan-create-modal" @click.self="$emit('close')">
    <div class="modal-content glass plan-modal-content">
      <div class="modal-header">
        <h3>Wochenplan anlegen</h3>
        <button class="modal-close" @click="$emit('close')">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="plan-date-input">Wähle einen Kalendertag *</label>
          <input
            type="date"
            id="plan-date-input"
            required
            v-model="dateVal"
            @change="handleDateChange"
          />
          <span style="font-size:11px; color:var(--text-secondary); display:block; margin-top:4px;">
            Das System ermittelt automatisch die zugehörige Kalenderwoche und den Wochenzeitraum.
          </span>
        </div>
        
        <div class="form-group">
          <label for="plan-name">Wochenplan-Name (Automatisch befüllt)</label>
          <input
            type="text"
            id="plan-name"
            required
            placeholder="z.B. KW 23"
            v-model="name"
          />
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Abbrechen</button>
          <button type="submit" class="btn btn-primary">Plan erstellen</button>
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
  }
});

const emit = defineEmits(['close', 'plan-created']);

const dateVal = ref('');
const name = ref('');

watch(() => props.isOpen, (open) => {
  if (open) {
    dateVal.value = '';
    name.value = '';
  }
});

function handleDateChange() {
  if (!dateVal.value) return;
  const date = new Date(dateVal.value);
  if (!isNaN(date)) {
    const kw = getCalenderWeekNumber(date);
    name.value = `KW ${kw}`;
  }
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getCalenderWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

async function handleSubmit() {
  if (!dateVal.value || !name.value.trim()) return;

  const monday = getMonday(new Date(dateVal.value));
  const formattedMonday = monday.toISOString().split('T')[0];

  try {
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        start_date: formattedMonday
      })
    });

    if (res.ok) {
      emit('plan-created', formattedMonday);
    } else {
      const data = await res.json();
      alert(data.error || 'Fehler beim Erstellen des Wochenplans.');
    }
  } catch (err) {
    console.error('Fehler beim Erstellen des Wochenplans:', err);
  }
}
</script>
