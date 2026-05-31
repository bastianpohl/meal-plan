<template>
  <div
    ref="viewportRef"
    class="weekly-planner-viewport"
    :class="{ 'is-grabbing': isSwiping && isMouseDown }"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <!-- Spalten Grid mit Carousel-Feedback -->
    <div
      class="weekly-planner-grid"
      :style="{ 
        '--total-cols': visibleDays.length,
        '--visible-cols': visibleDays.length - 20,
        transform: `translateX(calc(-10 * (100% + var(--grid-gap, 8px)) / var(--total-cols) + ${translateX}px))`,
        transition: isSwiping ? 'none' : 'transform 0.38s cubic-bezier(0.25, 1, 0.22, 1)'
      }"
    >
      <div
        v-for="day in visibleDays"
        :key="day.formattedDateStr"
        :class="['planner-day-col', { 'is-today': day.isToday, 'is-past': day.isPast }]"
        :data-day="day.formattedDateStr"
      >
        <div class="day-header">
          <div class="day-header-top">
            <span class="day-title">{{ day.name }}</span>
            <span v-if="day.isToday" class="today-badge">Heute</span>
          </div>
          <span class="day-date-subtitle">{{ day.dateSubtitle }}</span>
        </div>
        
        <!-- LUNCH SLOT (MITTAGS) -->
        <div class="day-meal-section">
          <div class="slot-header lunch">
            <ion-icon name="sunny-outline"></ion-icon>
            <span>Mittags</span>
          </div>
          <div
            :class="['day-slot-dropzone', { 
              filled: getAssignments(day.formattedDateStr, 'lunch').length > 0,
              dragover: dragOverSlot === day.formattedDateStr + '-lunch',
              'is-past': day.isPast
            }]"
            :data-day="day.formattedDateStr"
            data-slot="lunch"
            @dragover="day.isPast ? null : onDragOver($event, day.formattedDateStr, 'lunch')"
            @dragleave="onDragLeave"
            @drop="day.isPast ? null : onDrop($event, day.formattedDateStr, 'lunch')"
          >
            <!-- List of Assigned Recipe Cards -->
            <div
              v-for="(asg, index) in getAssignments(day.formattedDateStr, 'lunch')"
              :key="asg.id"
              class="assigned-recipe-card polaroid-style"
              :class="{ 
                'is-read-only': day.isPast,
                'dragover-top': dragOverCard && dragOverCard.dateStr === day.formattedDateStr && dragOverCard.mealType === 'lunch' && dragOverCard.index === index && dragOverCard.position === 'top',
                'dragover-bottom': dragOverCard && dragOverCard.dateStr === day.formattedDateStr && dragOverCard.mealType === 'lunch' && dragOverCard.index === index && dragOverCard.position === 'bottom'
              }"
              :draggable="!day.isPast"
              @dragstart="onAssignmentDragStart($event, asg, day.formattedDateStr, 'lunch', index)"
              @dragend="onAssignmentDragEnd($event)"
              @dragover="day.isPast ? null : onAssignmentDragOver($event, index, day.formattedDateStr, 'lunch')"
              @dragleave="onAssignmentDragLeave($event)"
              @drop.stop="day.isPast ? null : onAssignmentDrop($event, index, day.formattedDateStr, 'lunch')"
              @click="$emit('recipe-click', asg.recipe)"
            >
              <div class="assigned-recipe-card-image">
                <img
                  v-if="asg.recipe.cover_image"
                  :src="'/' + asg.recipe.cover_image"
                  alt="Gerichtsbild"
                  draggable="false"
                />
                <div v-else class="assigned-recipe-thumb-placeholder">
                  <ion-icon name="restaurant-outline"></ion-icon>
                </div>
              </div>
              <div class="assigned-recipe-card-content">
                <div class="assigned-recipe-name" :title="asg.recipe.title">
                  {{ asg.recipe.title }}
                </div>
              </div>
              
              <!-- Reordering Control Buttons -->
              <div v-if="!day.isPast && getAssignments(day.formattedDateStr, 'lunch').length > 1" class="assigned-recipe-reorder-controls">
                <button
                  v-if="index > 0"
                  class="btn-reorder-asg up"
                  title="Nach oben verschieben"
                  @click.stop="emit('reorder-assignment', { assignmentId: asg.id, direction: 'up', dateStr: day.formattedDateStr, mealType: 'lunch' })"
                >
                  <ion-icon name="chevron-up-outline"></ion-icon>
                </button>
                <button
                  v-if="index < getAssignments(day.formattedDateStr, 'lunch').length - 1"
                  class="btn-reorder-asg down"
                  title="Nach unten verschieben"
                  @click.stop="emit('reorder-assignment', { assignmentId: asg.id, direction: 'down', dateStr: day.formattedDateStr, mealType: 'lunch' })"
                >
                  <ion-icon name="chevron-down-outline"></ion-icon>
                </button>
              </div>

              <button
                v-if="!day.isPast"
                class="btn-remove-assigned"
                title="Entfernen"
                @click.stop="$emit('remove-assignment', { assignmentId: asg.id, dateStr: day.formattedDateStr })"
              >
                <ion-icon name="close-outline"></ion-icon>
              </button>
            </div>

            <!-- Compact Add Another Button when filled -->
            <button
              v-if="getAssignments(day.formattedDateStr, 'lunch').length > 0 && !day.isPast"
              class="btn-add-another-slot"
              title="Anderes Gericht hinzufügen"
              @click.stop="onSlotPlaceholderClick($event, day.formattedDateStr, 'lunch')"
            >
              <ion-icon name="add-outline" style="font-size: 14px;"></ion-icon>
              <span>Gericht hinzufügen</span>
            </button>
            
            <!-- Empty Slot Placeholder -->
            <div
              v-if="getAssignments(day.formattedDateStr, 'lunch').length === 0 && !day.isPast"
              class="slot-placeholder-prompt"
              @click="onSlotPlaceholderClick($event, day.formattedDateStr, 'lunch')"
            >
              <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
              <span>Planen</span>
            </div>
            
            <!-- Read-Only Past Empty Slot Placeholder -->
            <div v-else-if="getAssignments(day.formattedDateStr, 'lunch').length === 0 && day.isPast" class="slot-placeholder-empty-past">
              <span class="past-text">Kein Eintrag</span>
            </div>
          </div>
        </div>

        <!-- DINNER SLOT (ABENDS) -->
        <div class="day-meal-section">
          <div class="slot-header dinner">
            <ion-icon name="moon-outline"></ion-icon>
            <span>Abends</span>
          </div>
          <div
            :class="['day-slot-dropzone', { 
              filled: getAssignments(day.formattedDateStr, 'dinner').length > 0,
              dragover: dragOverSlot === day.formattedDateStr + '-dinner',
              'is-past': day.isPast
            }]"
            :data-day="day.formattedDateStr"
            data-slot="dinner"
            @dragover="day.isPast ? null : onDragOver($event, day.formattedDateStr, 'dinner')"
            @dragleave="onDragLeave"
            @drop="day.isPast ? null : onDrop($event, day.formattedDateStr, 'dinner')"
          >
            <!-- List of Assigned Recipe Cards -->
            <div
              v-for="(asg, index) in getAssignments(day.formattedDateStr, 'dinner')"
              :key="asg.id"
              class="assigned-recipe-card polaroid-style"
              :class="{ 
                'is-read-only': day.isPast,
                'dragover-top': dragOverCard && dragOverCard.dateStr === day.formattedDateStr && dragOverCard.mealType === 'dinner' && dragOverCard.index === index && dragOverCard.position === 'top',
                'dragover-bottom': dragOverCard && dragOverCard.dateStr === day.formattedDateStr && dragOverCard.mealType === 'dinner' && dragOverCard.index === index && dragOverCard.position === 'bottom'
              }"
              :draggable="!day.isPast"
              @dragstart="onAssignmentDragStart($event, asg, day.formattedDateStr, 'dinner', index)"
              @dragend="onAssignmentDragEnd($event)"
              @dragover="day.isPast ? null : onAssignmentDragOver($event, index, day.formattedDateStr, 'dinner')"
              @dragleave="onAssignmentDragLeave($event)"
              @drop.stop="day.isPast ? null : onAssignmentDrop($event, index, day.formattedDateStr, 'dinner')"
              @click="$emit('recipe-click', asg.recipe)"
            >
              <div class="assigned-recipe-card-image">
                <img
                  v-if="asg.recipe.cover_image"
                  :src="'/' + asg.recipe.cover_image"
                  alt="Gerichtsbild"
                  draggable="false"
                />
                <div v-else class="assigned-recipe-thumb-placeholder">
                  <ion-icon name="restaurant-outline"></ion-icon>
                </div>
              </div>
              <div class="assigned-recipe-card-content">
                <div class="assigned-recipe-name" :title="asg.recipe.title">
                  {{ asg.recipe.title }}
                </div>
              </div>

              <!-- Reordering Control Buttons -->
              <div v-if="!day.isPast && getAssignments(day.formattedDateStr, 'dinner').length > 1" class="assigned-recipe-reorder-controls">
                <button
                  v-if="index > 0"
                  class="btn-reorder-asg up"
                  title="Nach oben verschieben"
                  @click.stop="emit('reorder-assignment', { assignmentId: asg.id, direction: 'up', dateStr: day.formattedDateStr, mealType: 'dinner' })"
                >
                  <ion-icon name="chevron-up-outline"></ion-icon>
                </button>
                <button
                  v-if="index < getAssignments(day.formattedDateStr, 'dinner').length - 1"
                  class="btn-reorder-asg down"
                  title="Nach unten verschieben"
                  @click.stop="emit('reorder-assignment', { assignmentId: asg.id, direction: 'down', dateStr: day.formattedDateStr, mealType: 'dinner' })"
                >
                  <ion-icon name="chevron-down-outline"></ion-icon>
                </button>
              </div>

              <button
                v-if="!day.isPast"
                class="btn-remove-assigned"
                title="Entfernen"
                @click.stop="$emit('remove-assignment', { assignmentId: asg.id, dateStr: day.formattedDateStr })"
              >
                <ion-icon name="close-outline"></ion-icon>
              </button>
            </div>

            <!-- Compact Add Another Button when filled -->
            <button
              v-if="getAssignments(day.formattedDateStr, 'dinner').length > 0 && !day.isPast"
              class="btn-add-another-slot"
              title="Anderes Gericht hinzufügen"
              @click.stop="onSlotPlaceholderClick($event, day.formattedDateStr, 'dinner')"
            >
              <ion-icon name="add-outline" style="font-size: 14px;"></ion-icon>
              <span>Gericht hinzufügen</span>
            </button>
            
            <!-- Empty Slot Placeholder -->
            <div
              v-if="getAssignments(day.formattedDateStr, 'dinner').length === 0 && !day.isPast"
              class="slot-placeholder-prompt"
              @click="onSlotPlaceholderClick($event, day.formattedDateStr, 'dinner')"
            >
              <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
              <span>Planen</span>
            </div>
            
            <!-- Read-Only Past Empty Slot Placeholder -->
            <div v-else-if="getAssignments(day.formattedDateStr, 'dinner').length === 0 && day.isPast" class="slot-placeholder-empty-past">
              <span class="past-text">Kein Eintrag</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  visibleDays: {
    type: Array,
    required: true
  },
  assignments: {
    type: Object,
    required: true
  }
});

const emit = defineEmits([
  'recipe-click',
  'remove-assignment',
  'reorder-assignment',
  'move-assignment',
  'assign-recipe',
  'open-slot-quick-assign',
  'update-start-date'
]);



const dragOverSlot = ref(null);
const isTransitioningFromSwipe = ref(false);

// Swipe & Drag gestures
const viewportRef = ref(null);
const touchStartX = ref(0);
const touchStartY = ref(0);
const translateX = ref(0);
const accumulatedX = ref(0);
const isSwiping = ref(false);
const isMouseDown = ref(false);

// Watch visibleDays to reset scroll if it changes from non-gestures (like "Heute" click)
watch(() => props.visibleDays, () => {
  if (!isTransitioningFromSwipe.value && !isSwiping.value) {
    accumulatedX.value = 0;
    translateX.value = 0;
  }
}, { deep: true });

function clampScroll(val) {
  const gridEl = document.querySelector('.weekly-planner-grid');
  const colEl = document.querySelector('.planner-day-col');
  let stepWidth = 200; // fallback
  if (gridEl && colEl) {
    const colWidth = colEl.getBoundingClientRect().width;
    const gapStr = window.getComputedStyle(gridEl).gap;
    const gap = parseFloat(gapStr) || 8;
    stepWidth = colWidth + gap;
  }
  // Clamp scrolling to the rendered 10-day buffer boundaries
  const limit = 10 * stepWidth;
  return Math.max(-limit, Math.min(limit, val));
}

function handleTouchStart(e) {
  if (isTransitioningFromSwipe.value) return;
  touchStartX.value = e.touches[0].clientX - accumulatedX.value;
  touchStartY.value = e.touches[0].clientY;
  isSwiping.value = true;
}

function handleTouchMove(e) {
  if (!isSwiping.value) return;
  
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  
  const deltaX = currentX - touchStartX.value;
  const deltaY = currentY - touchStartY.value;
  
  if (Math.abs(deltaX - accumulatedX.value) > Math.abs(deltaY)) {
    if (e.cancelable) {
      e.preventDefault();
    }
    translateX.value = clampScroll(deltaX);
  }
}

function handleTouchEnd(e) {
  handleGestureEnd();
}

function handleMouseDown(e) {
  if (isTransitioningFromSwipe.value) return;
  if (e.button !== 0) return; // Left click only
  
  // If clicked an interactive element, do not trigger swipe
  if (
    e.target.closest('.btn') || 
    e.target.closest('.assigned-recipe-card') || 
    e.target.closest('.slot-placeholder-prompt') || 
    e.target.closest('.floating-assign-dropdown') || 
    e.target.closest('.day-header') || 
    e.target.closest('.today-badge') || 
    e.target.closest('.btn-remove-assigned')
  ) {
    return;
  }
  
  isMouseDown.value = true;
  touchStartX.value = e.clientX - accumulatedX.value;
  touchStartY.value = e.clientY;
  isSwiping.value = true;
}

function handleMouseMove(e) {
  if (!isMouseDown.value || !isSwiping.value) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const deltaX = currentX - touchStartX.value;
  const deltaY = currentY - touchStartY.value;
  
  if (Math.abs(deltaX - accumulatedX.value) > Math.abs(deltaY)) {
    e.preventDefault();
    translateX.value = clampScroll(deltaX);
  }
}

function handleMouseUp(e) {
  if (!isMouseDown.value) return;
  isMouseDown.value = false;
  handleGestureEnd();
}

function handleMouseLeave(e) {
  if (!isMouseDown.value) return;
  isMouseDown.value = false;
  handleGestureEnd();
}

function handleGestureEnd() {
  if (!isSwiping.value) return;
  isSwiping.value = false;
  
  // Free scroll: let the timeline stay exactly where the user let go!
  accumulatedX.value = translateX.value;
}

function triggerSlide(offset) {
  if (isTransitioningFromSwipe.value) return;
  
  // Calculate dynamic stepWidth
  const gridEl = document.querySelector('.weekly-planner-grid');
  const colEl = document.querySelector('.planner-day-col');
  let stepWidth = 200; // fallback
  if (gridEl && colEl) {
    const colWidth = colEl.getBoundingClientRect().width;
    const gapStr = window.getComputedStyle(gridEl).gap;
    const gap = parseFloat(gapStr) || 8;
    stepWidth = colWidth + gap;
  }
  
  isSwiping.value = false; // ensure transition is active
  isTransitioningFromSwipe.value = true;
  
  if (offset > 0) {
    // Slide forward (items move left by stepWidth)
    const targetX = accumulatedX.value - stepWidth;
    translateX.value = targetX;
    
    setTimeout(() => {
      const nextDate = props.visibleDays[11].date;
      emit('update-start-date', nextDate);
      
      // Instantly compensate for the VDOM shift in accumulatedX
      isSwiping.value = true;
      accumulatedX.value = targetX + stepWidth;
      translateX.value = accumulatedX.value;
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isSwiping.value = false;
          isTransitioningFromSwipe.value = false;
        });
      });
    }, 380);
  } else {
    // Slide backward (items move right by stepWidth)
    const targetX = accumulatedX.value + stepWidth;
    translateX.value = targetX;
    
    setTimeout(() => {
      const prevDate = props.visibleDays[9].date;
      emit('update-start-date', prevDate);
      
      // Instantly compensate for the VDOM shift in accumulatedX
      isSwiping.value = true;
      accumulatedX.value = targetX - stepWidth;
      translateX.value = accumulatedX.value;
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isSwiping.value = false;
          isTransitioningFromSwipe.value = false;
        });
      });
    }, 380);
  }
}

onMounted(() => {
  if (viewportRef.value) {
    viewportRef.value.addEventListener('touchmove', handleTouchMove, { passive: false });
  }
});

onUnmounted(() => {
  if (viewportRef.value) {
    viewportRef.value.removeEventListener('touchmove', handleTouchMove);
  }
});

defineExpose({
  triggerSlide
});



function getAssignments(dateStr, slotType) {
  const current = props.assignments[dateStr];
  return current ? current[slotType] : [];
}

// Reactive state for dragging assignments and custom card drop sorting
const draggedAssignment = ref(null);
const dragOverCard = ref(null);

// Drag and drop event handlers for slots (dropzones)
function onDragOver(e, dateStr, slotType) {
  e.preventDefault();
  dragOverSlot.value = `${dateStr}-${slotType}`;
}

function onDragLeave(e) {
  const dropzone = e.currentTarget.closest('.day-slot-dropzone');
  if (dropzone && !dropzone.contains(e.relatedTarget)) {
    dragOverSlot.value = null;
  }
}

function onDrop(e, dateStr, slotType) {
  e.preventDefault();
  dragOverSlot.value = null;
  dragOverCard.value = null;
  
  // Try reading move data
  const jsonStr = e.dataTransfer.getData('application/json');
  if (jsonStr) {
    try {
      const dragData = JSON.parse(jsonStr);
      emit('move-assignment', {
        assignmentId: dragData.assignmentId,
        sourceDateStr: dragData.sourceDateStr,
        sourceMealType: dragData.sourceMealType,
        targetDateStr: dateStr,
        targetMealType: slotType
      });
    } catch (err) {
      console.error('Fehler beim Parsen der Drag-Daten:', err);
    }
  } else {
    // Standard library add from sidebar/search
    const recipeIdStr = e.dataTransfer.getData('text/plain');
    if (recipeIdStr) {
      const recipeId = parseInt(recipeIdStr);
      const existing = getAssignments(dateStr, slotType);
      const alreadyAssigned = existing.some(asg => asg.recipe.id === recipeId);
      if (alreadyAssigned) return;

      emit('assign-recipe', {
        day: dateStr,
        mealType: slotType,
        recipeId: recipeId
      });
    }
  }
}

// Drag and drop events for assigned cards (moving / sorting)
function onAssignmentDragStart(e, asg, dateStr, mealType, index) {
  draggedAssignment.value = {
    assignmentId: asg.id,
    sourceDateStr: dateStr,
    sourceMealType: mealType,
    index: index,
    recipeId: asg.recipe.id
  };
  
  e.dataTransfer.setData('application/json', JSON.stringify(draggedAssignment.value));
  e.dataTransfer.setData('text/plain', String(asg.recipe.id));
  e.dataTransfer.effectAllowed = 'move';
  
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
  }, 0);
  
  document.body.classList.add('assignment-drag-active');
  
  // Highlight all other dropzones
  const dropzones = document.querySelectorAll('.day-slot-dropzone');
  dropzones.forEach(zone => {
    zone.classList.add('highlight-drop');
  });
}

function onAssignmentDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  draggedAssignment.value = null;
  dragOverCard.value = null;
  
  document.body.classList.remove('assignment-drag-active');
  
  const dropzones = document.querySelectorAll('.day-slot-dropzone');
  dropzones.forEach(zone => {
    zone.classList.remove('highlight-drop');
  });
}

function onAssignmentDragOver(e, index, dateStr, mealType) {
  e.preventDefault();
  
  const rect = e.currentTarget.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  const position = relativeY < rect.height / 2 ? 'top' : 'bottom';
  
  dragOverCard.value = {
    dateStr,
    mealType,
    index,
    position
  };
}

function onAssignmentDragLeave(e) {
  dragOverCard.value = null;
}

function onAssignmentDrop(e, targetIndex, dateStr, slotType) {
  e.preventDefault();
  dragOverCard.value = null;
  dragOverSlot.value = null;
  
  const rect = e.currentTarget.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  const position = relativeY < rect.height / 2 ? 'top' : 'bottom';
  const finalIndex = position === 'top' ? targetIndex : targetIndex + 1;
  
  const jsonStr = e.dataTransfer.getData('application/json');
  if (jsonStr) {
    try {
      const dragData = JSON.parse(jsonStr);
      emit('move-assignment', {
        assignmentId: dragData.assignmentId,
        sourceDateStr: dragData.sourceDateStr,
        sourceMealType: dragData.sourceMealType,
        targetDateStr: dateStr,
        targetMealType: slotType,
        targetIndex: finalIndex
      });
    } catch (err) {
      console.error('Fehler beim Parsen der Drag-Daten:', err);
    }
  } else {
    const recipeIdStr = e.dataTransfer.getData('text/plain');
    if (recipeIdStr) {
      const recipeId = parseInt(recipeIdStr);
      const existing = getAssignments(dateStr, slotType);
      const alreadyAssigned = existing.some(asg => asg.recipe.id === recipeId);
      if (alreadyAssigned) return;

      emit('assign-recipe', {
        day: dateStr,
        mealType: slotType,
        recipeId: recipeId,
        targetIndex: finalIndex
      });
    }
  }
}

function onSlotPlaceholderClick(e, dateStr, slotType) {
  const rect = e.currentTarget.getBoundingClientRect();
  emit('open-slot-quick-assign', {
    dayKey: dateStr,
    slotKey: slotType,
    rect: {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right
    }
  });
}
</script>
