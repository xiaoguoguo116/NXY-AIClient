<template>
  <form class="todo-editor" @submit.prevent="save">
    <fieldset :disabled="saving || disabled">
      <label class="todo-title">
        事项
        <input
          v-model="title"
          maxlength="500"
          required
          placeholder="例如：明天下午三点提交报告"
          aria-label="待办事项内容"
          @blur="inferDate()" />
      </label>
      <div class="time-fields">
        <div>
          <span class="field-label">结束时间（截止时间，本机时区）</span>
          <TodoDateTimePicker
            v-model="deadline"
            label="待办结束时间"
            @update:model-value="
              deadlineTouched = true
              timeNotice = ''
            " />
          <button type="button" class="infer-button" @click="inferDate(true)">从事项识别时间</button>
        </div>
        <div>
          <label>
            提醒方式
            <select v-model="reminderMode" aria-label="待办提醒方式">
              <option value="due">结束时提醒</option>
              <option value="custom">自定义提醒时间</option>
              <option value="off">不提醒</option>
            </select>
          </label>
          <TodoDateTimePicker v-if="reminderMode === 'custom'" v-model="reminder" label="待办提醒时间" />
        </div>
      </div>
      <p v-if="timeNotice" class="hint" role="status">{{ timeNotice }}</p>
      <p class="hint">日期可选未来任意一天；时刻每 15 分钟一档。结束时间用于判断是否逾期，提醒时间可独立设置。</p>
      <label>
        文档附件
        <input type="file" multiple :accept="TODO_ATTACHMENT_ACCEPT" aria-label="待办文档附件" @change="chooseFiles" />
      </label>
      <p class="hint">
        支持 Word、PDF、表格、演示文稿、文本和图片；最多 10 个，每个不超过 20 MB，总计不超过 50 MB。附件保存在本机。
      </p>
      <ul v-if="attachments.length || pending.length" class="attachment-list">
        <li v-for="file in attachments" :key="file.id">
          <span>{{ file.name }} · {{ sizeLabel(file.size) }}</span>
          <button
            type="button"
            :aria-label="`移除附件：${file.name}`"
            @click="attachments = attachments.filter((a) => a.id !== file.id)">
            移除
          </button>
        </li>
        <li v-for="(file, index) in pending" :key="index">
          <span>{{ file.name }} · {{ sizeLabel(file.size) }} · 待保存</span>
          <button type="button" :aria-label="`移除附件：${file.name}`" @click="pending.splice(index, 1)">移除</button>
        </li>
      </ul>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="editor-actions">
        <button type="submit" class="primary">{{ saving ? '正在保存…' : todo ? '保存修改' : '添加待办' }}</button>
        <button v-if="todo" type="button" @click="emit('cancel')">取消</button>
      </div>
    </fieldset>
  </form>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import TodoDateTimePicker from '@/components/TodoDateTimePicker.vue'
  import { addTodo, updateTodo, todoState } from '@/stores/localTodos'
  import { type LocalTodo, type TodoAttachment, validDraft } from '@/services/localTodos'
  import { inferTodoDeadline, toTodoLocalTime } from '@/services/todoTime'
  import {
    TODO_ATTACHMENT_ACCEPT,
    validateTodoAttachments,
    saveTodoAttachments,
    deleteTodoAttachments
  } from '@/services/todoAttachments'
  const props = defineProps<{ todo?: LocalTodo; disabled?: boolean; sourceName?: string }>()
  const emit = defineEmits<{ saved: [todo: LocalTodo]; cancel: [] }>()
  const title = ref(''),
    deadline = ref(''),
    reminder = ref(''),
    error = ref(''),
    timeNotice = ref('')
  const reminderMode = ref<'due' | 'custom' | 'off'>('due')
  const attachments = ref<TodoAttachment[]>([]),
    pending = ref<File[]>([]),
    saving = ref(false)
  const deadlineTouched = ref(false)
  watch(
    () => props.todo,
    (todo) => {
      title.value = todo?.title || ''
      deadline.value = toTodoLocalTime(todo?.dueAt)
      reminder.value = toTodoLocalTime(todo?.reminderAt || undefined)
      reminderMode.value = todo?.reminderAt === null ? 'off' : todo?.reminderAt ? 'custom' : 'due'
      attachments.value = (todo?.attachments || []).map((file) => ({ ...file }))
      deadlineTouched.value = !!todo
      pending.value = []
      error.value = ''
      timeNotice.value = ''
    },
    { immediate: true }
  )
  function inferDate(force = false) {
    if ((deadline.value || deadlineTouched.value) && !force) return
    const inferred = inferTodoDeadline(title.value)
    if (inferred) {
      deadline.value = toTodoLocalTime(inferred)
      timeNotice.value = `已识别结束时间：${new Date(inferred).toLocaleString('zh-CN', { hour12: false })}，可手动调整。`
    } else if (force) timeNotice.value = '未识别到明确的未来日期和时刻，请手动选择结束时间。'
  }
  function sizeLabel(size: number) {
    return size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`
  }
  function chooseFiles(event: Event) {
    const input = event.target as HTMLInputElement
    try {
      const files = [...pending.value, ...Array.from(input.files || [])]
      validateTodoAttachments(files, attachments.value)
      pending.value = files
      error.value = ''
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法添加附件。'
    }
    input.value = ''
  }
  async function save() {
    if (saving.value) return
    saving.value = true
    error.value = ''
    let added: TodoAttachment[] = []
    let committed = false
    const originalTodo = props.todo
    try {
      inferDate()
      if (
        reminderMode.value === 'custom' &&
        (!reminder.value ||
          (Date.parse(reminder.value) <= Date.now() &&
            reminder.value !== toTodoLocalTime(originalTodo?.reminderAt || undefined)))
      )
        throw new Error('请选择晚于当前时间的提醒日期和时刻。')
      const draft = validDraft({
        title: title.value,
        dueAt: deadline.value || undefined,
        reminderAt: reminderMode.value === 'off' ? null : reminderMode.value === 'custom' ? reminder.value : undefined
      })
      validateTodoAttachments(pending.value, attachments.value)
      added = await saveTodoAttachments(pending.value)
      const files = [...attachments.value, ...added]
      let saved: LocalTodo
      if (originalTodo) {
        updateTodo(originalTodo.id, { ...draft, dueAt: draft.dueAt, reminderAt: draft.reminderAt, attachments: files })
        saved = todoState.items.find((item) => item.id === originalTodo.id)!
      } else saved = addTodo({ ...draft, dueAt: draft.dueAt, attachments: files }, undefined, props.sourceName)
      committed = true
      const removed = (originalTodo?.attachments || []).filter(
        (file) => !todoState.items.some((item) => item.attachments?.some((a) => a.id === file.id))
      )
      if (removed.length)
        void deleteTodoAttachments(removed.map((file) => file.id)).catch(() => {
          /* Unreferenced blobs can be reclaimed later. */
        })
      title.value = ''
      deadline.value = ''
      reminder.value = ''
      reminderMode.value = 'due'
      attachments.value = []
      pending.value = []
      timeNotice.value = ''
      deadlineTouched.value = false
      emit('saved', saved)
    } catch (cause) {
      if (!committed && added.length) await deleteTodoAttachments(added.map((file) => file.id)).catch(() => {})
      error.value = cause instanceof Error ? cause.message : '保存失败，请检查本机存储。'
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .todo-editor {
    margin: 18px 0;
    padding: 18px;
    border: 1px solid #dce6f2;
    border-radius: 12px;
    background: #fff;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-bottom: 12px;
    font-size: 13px;
  }
  .field-label {
    display: block;
    margin-bottom: 7px;
    font-size: 13px;
  }
  .time-fields {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .time-fields > div {
    flex: 1;
    min-width: 250px;
  }
  input,
  select,
  button {
    padding: 9px 12px;
    border: 1px solid #dce6f2;
    border-radius: 7px;
    background: #fff;
    color: #24354b;
    font: inherit;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .primary {
    background: #2685ed;
    color: #fff;
  }
  .hint {
    color: #64758b;
    font-size: 12px;
    line-height: 1.7;
  }
  .error {
    color: #b42318;
  }
  .infer-button {
    margin-top: 8px;
    padding: 5px 9px;
    font-size: 12px;
  }
  .editor-actions {
    display: flex;
    gap: 10px;
    margin-top: 12px;
  }
  .attachment-list {
    padding: 0;
    list-style: none;
  }
  .attachment-list li {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    overflow-wrap: anywhere;
  }
</style>
