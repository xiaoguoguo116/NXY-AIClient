<template>
  <div class="todo-datetime">
    <input
      type="date"
      :value="day"
      :aria-label="`${label}日期`"
      @input="setDay(($event.target as HTMLInputElement).value)" />
    <select :value="clock" :aria-label="`${label}时刻`" @change="setClock(($event.target as HTMLSelectElement).value)">
      <option value="" disabled>选择时刻</option>
      <option v-if="clock && !TODO_TIME_OPTIONS.includes(clock)" :value="clock">{{ clock }}（原时间）</option>
      <option v-for="time in TODO_TIME_OPTIONS" :key="time" :value="time">{{ time }}</option>
    </select>
    <button v-if="day || clock" type="button" :aria-label="`清除${label}`" @click="clear">清除</button>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { TODO_TIME_OPTIONS, toTodoLocalTime } from '@/services/todoTime'
  const props = defineProps<{ modelValue: string; label: string }>()
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
  const day = ref(''),
    clock = ref('')
  watch(
    () => props.modelValue,
    (value) => {
      ;[day.value, clock.value] = value ? value.split('T') : ['', '']
    },
    { immediate: true }
  )
  function publish() {
    emit('update:modelValue', day.value && clock.value ? `${day.value}T${clock.value}` : '')
  }
  function setDay(value: string) {
    day.value = value
    if (value && !clock.value) clock.value = '09:00'
    publish()
  }
  function setClock(value: string) {
    clock.value = value
    if (!day.value) day.value = toTodoLocalTime(new Date().toISOString()).slice(0, 10)
    publish()
  }
  function clear() {
    day.value = ''
    clock.value = ''
    publish()
  }
</script>

<style scoped>
  .todo-datetime {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  input,
  select,
  button {
    padding: 9px;
    border: 1px solid #dce6f2;
    border-radius: 7px;
    color: #24354b;
    background: white;
    font: inherit;
  }
  input {
    min-width: 145px;
  }
  button {
    cursor: pointer;
  }
</style>
