<template>
  <NModal :show="true" :mask-closable="false" @update:show="emit('close')">
    <!-- Keep a DIV root: vueuc uses it to identify the focus-trap boundary. -->
    <div class="reminder-dialog" role="dialog" aria-modal="true" aria-labelledby="todo-reminder-title">
      <header>
        <h2 id="todo-reminder-title">设置提醒</h2>
        <button type="button" aria-label="关闭提醒设置" @click="emit('close')">关闭</button>
      </header>
      <p class="task-title">{{ todo.title }}</p>
      <p class="hint">
        截止时间：{{
          todo.dueAt ? new Date(todo.dueAt).toLocaleString('zh-CN', { hour12: false }) : '未设置'
        }}（不会被修改）
      </p>
      <form @submit.prevent="save(false)">
        <label class="field-label">提醒日期和时间（本机时区）</label>
        <TodoDateTimePicker v-model="reminder" label="待办提醒时间" :minute-step="60" />
        <button class="quick-choice" type="button" @click="chooseNextFriday">下周五 17:00</button>
        <p class="hint">可选择未来任意日期，时间精确到整点。选择后点击“保存提醒”生效。</p>
        <p class="hint">客户端运行时检查并发送提醒；退出期间不会后台提醒，再次启动会补报。系统通知仅发送给“我”。</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <footer>
          <button v-if="todoReminderAt(todo)" type="button" :disabled="!!todoState.error" @click="save(true)">
            取消提醒
          </button>
          <button type="button" @click="emit('close')">取消</button>
          <button class="primary" type="submit" :disabled="!!todoState.error">保存提醒</button>
        </footer>
      </form>
    </div>
  </NModal>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { NModal } from 'naive-ui'
  import TodoDateTimePicker from '@/components/TodoDateTimePicker.vue'
  import { todoReminderAt, type LocalTodo } from '@/services/localTodos'
  import { toTodoLocalTime } from '@/services/todoTime'
  import { todoState, updateTodo } from '@/stores/localTodos'
  const props = defineProps<{ todo: LocalTodo }>()
  const emit = defineEmits<{ close: []; saved: [message: string] }>()
  const reminder = ref(toTodoLocalTime(todoReminderAt(props.todo)))
  const error = ref('')
  function chooseNextFriday() {
    const date = new Date()
    const mondayOffset = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - mondayOffset + 11)
    date.setHours(17, 0, 0, 0)
    reminder.value = toTodoLocalTime(date.toISOString())
    error.value = ''
  }
  function save(disable: boolean) {
    error.value = ''
    try {
      const current = todoState.items.find((item) => item.id === props.todo.id)
      if (!current || current.completed) throw new Error('待办已完成或不存在，请关闭窗口后刷新列表。')
      const at = Date.parse(reminder.value)
      if (!disable && (!Number.isFinite(at) || at <= Date.now()))
        throw new Error('请选择晚于当前时间的提醒日期和整点时间。')
      updateTodo(current.id, { reminderAt: disable ? null : new Date(at).toISOString() })
      emit(
        'saved',
        disable
          ? `已取消“${current.title}”的提醒。`
          : `提醒已保存：${new Date(at).toLocaleString('zh-CN', { hour12: false })}。`
      )
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '提醒保存失败，请重试。'
    }
  }
</script>

<style scoped>
  .reminder-dialog {
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 24px;
    border: 1px solid #dce6f2;
    border-radius: 16px;
    background: #fff;
    color: #24354b;
    color-scheme: light;
  }
  header,
  footer {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  header {
    justify-content: space-between;
  }
  footer {
    justify-content: flex-end;
    margin-top: 20px;
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  .task-title {
    font-size: 15px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .field-label {
    display: block;
    margin: 20px 0 10px;
    font-size: 14px;
  }
  .hint {
    font-size: 12px;
    line-height: 1.8;
    color: #64758b;
  }
  button {
    padding: 8px 12px;
    background: #fff;
    color: #365477;
    border: 1px solid #dce6f2;
    border-radius: 8px;
    font: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .quick-choice {
    margin-top: 12px;
    font-size: 13px;
    background: #f0f6ff;
  }
  .primary {
    color: #fff;
    background: #2685ed;
    border-color: #2685ed;
  }
  .error {
    color: #b42318;
    font-size: 13px;
  }
</style>
