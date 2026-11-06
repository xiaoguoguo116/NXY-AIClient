<template>
  <section
    class="chat-action-card"
    :aria-label="`动作草稿：${action.kind === 'meeting' ? '会议' : action.kind === 'todo' ? '待办' : '待澄清'}`">
    <strong>
      {{ action.kind === 'meeting' ? '发布会议' : action.kind === 'todo' ? '添加待办' : '请先确认你要做什么' }}
    </strong>
    <template v-if="action.status === 'confirmed'">
      <p role="status">
        已{{ action.kind === 'meeting' ? '发布会议，已加入会议提醒与日程' : '添加待办' }}：{{ action.title }}
      </p>
      <template v-if="action.kind === 'todo'">
        <p>接收人：{{ savedRecipientNames || selectedNames }}</p>
        <small v-if="!action.participantIds.includes('self')">
          这项待办分配给了其他成员，默认“我的待办”中不会显示。
        </small>
        <div class="actions"><button @click="emit('viewTodo')">查看这项待办</button></div>
      </template>
    </template>
    <p v-else-if="action.status !== 'draft'">
      {{ action.status === 'cancelled' ? '已取消，未执行' : '已由后续补充的草稿替代，未执行' }}
    </p>
    <template v-else>
      <p>先补齐信息，再核对并确认。当前尚未创建任何事项。</p>
      <div v-if="action.kind === 'choose'" class="actions">
        <button @click="choose('meeting')">发布会议邀请</button>
        <button @click="choose('todo')">只给自己添加待办</button>
      </div>
      <template v-else-if="!reviewing">
        <label>
          {{ action.kind === 'meeting' ? '会议主题' : '事项内容' }}
          <input
            v-model="action.title"
            aria-label="动作主题"
            :maxlength="action.kind === 'meeting' ? 120 : 500"
            :disabled="disabled" />
        </label>
        <template v-if="action.kind === 'meeting'">
          <TodoDateTimePicker v-model="start" label="会议开始时间" />
          <TodoDateTimePicker v-model="end" label="会议结束时间（可选）" />
          <label>
            地点（可选）
            <input v-model="action.location" aria-label="会议地点" maxlength="120" />
          </label>
        </template>
        <template v-else>
          <TodoDateTimePicker v-model="due" label="待办截止时间（可选）" />
          <label class="check">
            <input v-model="action.needsReminder" type="checkbox" />
            设置提醒
          </label>
          <TodoDateTimePicker v-if="action.needsReminder" v-model="reminder" label="待办提醒时间" :minute-step="60" />
          <small v-else>不提醒；截止时间与提醒时间分别设置。</small>
        </template>
        <label>
          {{ action.kind === 'meeting' ? '参会人' : '负责人' }}（可从全部联系人选择）
          <input v-model="search" placeholder="搜索联系人" aria-label="搜索动作联系人" />
        </label>
        <div class="actions">
          <button @click="action.participantIds = people.filter((p) => p.conversation).map((p) => p.id)">
            当前会话全体成员
          </button>
          <button @click="action.participantIds = ['self']">仅自己</button>
        </div>
        <div class="people">
          <label v-for="person in visiblePeople" :key="person.id" class="check">
            <input v-model="action.participantIds" type="checkbox" :value="person.id" />
            {{ person.name }}
          </label>
        </div>
        <p v-if="action.unresolvedRecipients.length" role="alert">
          未找到或有重名：{{ action.unresolvedRecipients.join('、') }}。请在上方选择正确的人。
          <button @click="action.unresolvedRecipients = []">已重新选择联系人</button>
        </p>
        <small>仅本机记录，不会向其他人发送通知。</small>
      </template>
      <div v-else class="review" aria-label="执行前核对">
        <p>主题：{{ action.title }}</p>
        <p>{{ action.kind === 'meeting' ? '参会人' : '负责人' }}：{{ selectedNames }}</p>
        <template v-if="action.kind === 'meeting'">
          <p>开始：{{ format(action.startAt) }}</p>
          <p>结束：{{ format(action.endAt) }}</p>
          <p>地点：{{ action.location || '未设置' }}</p>
          <p>会前 10 分钟提醒；将加入会议提醒和日程。</p>
        </template>
        <template v-else>
          <p>截止：{{ format(action.dueAt) }}</p>
          <p>提醒：{{ action.needsReminder ? format(action.reminderAt) : '不提醒' }}</p>
        </template>
        <small>仅本机记录，不会向其他人发送通知。</small>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-else-if="missing.length && !reviewing" class="hint">请补充：{{ missing.join('；') }}。</p>
      <div class="actions">
        <button v-if="!reviewing && action.kind !== 'choose'" :disabled="disabled" @click="review">核对并继续</button>
        <button v-if="reviewing" :disabled="disabled || saving" @click="confirm">
          {{ action.kind === 'meeting' ? '确认发布会议' : '确认添加待办' }}
        </button>
        <button v-if="reviewing" @click="reviewing = false">返回修改</button>
        <button :disabled="saving || disabled" @click="action.status = 'cancelled'">取消此操作</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import TodoDateTimePicker from '@/components/TodoDateTimePicker.vue'
  import { actionMissing, type ChatActionDraft } from '@/services/chatIntent'
  import { toTodoLocalTime } from '@/services/todoTime'
  import { addMeeting } from '@/stores/localMeetings'
  import { addAssignedTodos, todoState } from '@/stores/localTodos'

  const props = defineProps<{
    action: ChatActionDraft
    people: { id: string; name: string; kind: 'self' | 'simulated' | 'contact'; conversation: boolean }[]
    sourceId: string
    sourceName: string
    disabled?: boolean
  }>()
  const emit = defineEmits<{ change: []; confirmed: []; viewTodo: [] }>()
  const savedRecipientNames = computed(() =>
    todoState.items
      .filter((t) => t.assignmentKey === props.action.id || t.sourceKey === props.action.id)
      .map((t) => t.assigneeName || '我')
      .join('、')
  )
  const reviewing = ref(false),
    saving = ref(false),
    error = ref(''),
    search = ref('')
  const visiblePeople = computed(() =>
    props.people.filter((p) => p.name.toLowerCase().includes(search.value.trim().toLowerCase()))
  )
  const selectedNames = computed(() =>
    props.people
      .filter((p) => props.action.participantIds.includes(p.id))
      .map((p) => p.name)
      .join('、')
  )
  const missing = computed(() => actionMissing(props.action))
  function timeField(field: 'startAt' | 'endAt' | 'dueAt' | 'reminderAt') {
    return computed({
      get: () => toTodoLocalTime(props.action[field]),
      set: (value: string) => {
        props.action[field] = value ? new Date(value).toISOString() : undefined
      }
    })
  }
  const start = timeField('startAt'),
    end = timeField('endAt'),
    due = timeField('dueAt'),
    reminder = timeField('reminderAt')
  const format = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未设置')
  watch(
    () => props.action,
    () => {
      reviewing.value = false
      error.value = ''
      emit('change')
    },
    { deep: true, flush: 'sync' }
  )
  function choose(kind: 'meeting' | 'todo') {
    if (kind === 'todo') {
      props.action.reminderAt ||= props.action.startAt
      props.action.needsReminder = !!props.action.reminderAt
      props.action.participantIds = ['self']
    }
    props.action.kind = kind
  }
  function validate() {
    const issues = actionMissing(props.action)
    if (props.action.participantIds.some((id) => !props.people.some((p) => p.id === id)))
      issues.push('联系人已不可用，请重新选择')
    if (issues.length) throw new Error(`请补充：${issues.join('；')}。`)
  }
  function review() {
    try {
      validate()
      error.value = ''
      reviewing.value = true
    } catch (cause) {
      error.value = (cause as Error).message
    }
  }
  function confirm() {
    if (!reviewing.value || saving.value || props.disabled || props.action.status !== 'draft') return
    saving.value = true
    try {
      validate()
      const a = props.action
      const people = props.people.filter((p) => a.participantIds.includes(p.id))
      const resultIds =
        a.kind === 'meeting'
          ? [
              addMeeting(
                { title: a.title, startAt: a.startAt!, endAt: a.endAt, location: a.location, participants: people },
                a.id,
                props.sourceName
              ).id
            ]
          : addAssignedTodos(
              { title: a.title, dueAt: a.dueAt, reminderAt: a.needsReminder ? a.reminderAt : null },
              people.map((p) => ({ ...p, kind: p.kind === 'contact' ? ('simulated' as const) : p.kind })),
              a.id,
              props.sourceId,
              props.sourceName
            ).map((t) => t.id)
      a.resultIds = resultIds
      a.status = 'confirmed'
      emit('confirmed')
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '保存失败，请重试。'
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .chat-action-card {
    margin-top: 12px;
    padding: 16px;
    border: 1px solid #bad4ef;
    border-radius: 12px;
    background: #f6faff;
    color: #24354b;
    min-width: min(360px, 65vw);
    max-width: 540px;
    font-size: 14px;
    line-height: 1.6;
  }
  p {
    margin: 8px 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 10px;
  }
  input:not([type='checkbox']) {
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid #b8ccdf;
    border-radius: 6px;
    background: white;
    color: #24354b;
  }
  .check {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    margin: 0;
  }
  .people {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    max-height: 150px;
    overflow: auto;
    margin: 10px 0;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  button {
    border: 1px solid #aac8e6;
    border-radius: 6px;
    padding: 6px 10px;
    background: white;
    color: #2168a8;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .hint,
  small {
    color: #61758b;
  }
  .error {
    color: #ad3535;
  }
  .review {
    border-left: 3px solid #4c91d5;
    padding-left: 12px;
  }
</style>
