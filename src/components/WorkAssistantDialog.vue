<template>
  <div
    class="assistant-backdrop"
    role="presentation"
    @mousedown.self="$emit('close')"
    @keydown.esc.stop="$emit('close')">
    <section class="assistant-dialog" role="dialog" aria-modal="true" aria-labelledby="work-assistant-title">
      <header>
        <div class="bot-avatar">AI</div>
        <div>
          <h2 id="work-assistant-title">AI 会议助手</h2>
          <p>{{ sourceName ? `当前发布到：${sourceName}` : '创建会议提醒或给自己添加待办' }}</p>
        </div>
        <button class="close" aria-label="关闭 AI 会议助手" type="button" @click="$emit('close')">×</button>
      </header>

      <main class="assistant-thread" aria-live="polite">
        <div class="assistant-message">
          <span class="mini-avatar">AI</span>
          <div>
            <p>你好，我可以帮你发布会议，也可以把事项加入你的个人待办。请选择要做的事。</p>
            <div class="quick-actions">
              <button type="button" :class="{ active: mode === 'meeting' }" @click="mode = 'meeting'">发布会议</button>
              <button type="button" :class="{ active: mode === 'todo' }" @click="mode = 'todo'">添加个人待办</button>
            </div>
          </div>
        </div>

        <form v-if="mode === 'meeting'" class="work-card" @submit.prevent="publishMeeting">
          <h3>会议信息</h3>
          <label>
            会议主题
            <input
              v-model="meeting.title"
              maxlength="120"
              required
              placeholder="例如：产品方案评审会"
              aria-label="会议主题" />
          </label>
          <div class="field-grid time-grid">
            <fieldset class="time-field">
              <legend>开始时间</legend>
              <div class="time-pickers">
                <input
                  v-model="startDate"
                  type="date"
                  required
                  aria-label="会议开始日期"
                  @input="startConfirmed = false" />
                <select v-model="startTime" required aria-label="会议开始时刻" @change="startConfirmed = false">
                  <option value="" disabled>选择时间</option>
                  <option v-for="option in timeOptions" :key="option" :value="option">{{ option }}</option>
                </select>
              </div>
              <button type="button" :class="{ confirmed: startConfirmed }" @click="confirmStartTime">
                {{ startConfirmed ? '✓ 开始时间已确认' : '确认开始时间' }}
              </button>
            </fieldset>
            <fieldset class="time-field">
              <legend>结束时间（可选）</legend>
              <div class="time-pickers">
                <input v-model="endDate" type="date" aria-label="会议结束日期" @input="endConfirmed = false" />
                <select v-model="endTime" aria-label="会议结束时刻" @change="endConfirmed = false">
                  <option value="">不设置</option>
                  <option v-for="option in timeOptions" :key="option" :value="option">{{ option }}</option>
                </select>
              </div>
              <button type="button" :class="{ confirmed: endConfirmed && !!meeting.endAt }" @click="confirmEndTime">
                {{ endConfirmed ? (meeting.endAt ? '✓ 结束时间已确认' : '✓ 不设置结束时间') : '确认结束时间' }}
              </button>
            </fieldset>
          </div>
          <label>
            会议地点
            <input v-model="meeting.location" maxlength="120" placeholder="会议室或线上链接" aria-label="会议地点" />
          </label>
          <label>
            会议说明
            <textarea
              v-model="meeting.description"
              maxlength="1000"
              placeholder="补充议程、材料或注意事项"
              aria-label="会议说明" />
          </label>
          <fieldset class="participant-field">
            <legend>参会人</legend>
            <p class="participant-hint">可直接从全部联系人中选择，无需建立共同群聊。</p>
            <input v-model="participantQuery" type="search" placeholder="搜索姓名或备注" aria-label="搜索全部联系人" />
            <div class="participant-tools">
              <button v-if="conversationPeople.length > 1" type="button" @click="selectConversationPeople">
                当前会话全员
              </button>
              <button type="button" :disabled="!contactPeople.length" @click="selectAllContacts">全部联系人</button>
              <button type="button" @click="selectedIds = ['self']">仅自己</button>
              <span>已选 {{ selectedIds.length }} 人</span>
            </div>
            <div class="participant-list" aria-label="可选参会人">
              <label v-for="person in visiblePeople" :key="person.id" class="participant">
                <input
                  v-model="selectedIds"
                  type="checkbox"
                  :value="person.id"
                  :aria-label="`选择参会人：${person.name}`" />
                <span class="participant-avatar">{{ person.name.slice(0, 1) }}</span>
                <span class="participant-name">{{ person.name }}</span>
                <small>{{ participantKindLabel(person) }}</small>
              </label>
              <p v-if="contactsStore.friendListLoading && !contactPeople.length" class="participant-empty">
                正在加载联系人…
              </p>
              <p v-else-if="!visiblePeople.length" class="participant-empty">没有找到匹配的联系人。</p>
            </div>
          </fieldset>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button class="primary" type="submit">确认发布会议</button>
          <small>会议保存在本机；联系人选择用于安排与反馈跟踪，当前不会发送真实邀请。</small>
        </form>

        <form v-else class="work-card" @submit.prevent="saveTodo">
          <h3>个人待办</h3>
          <label>
            事项
            <input
              v-model="todo.title"
              maxlength="500"
              required
              placeholder="例如：准备评审会材料"
              aria-label="助手待办事项" />
          </label>
          <label>
            提醒时间
            <input v-model="todo.dueAt" type="datetime-local" aria-label="助手待办提醒时间" />
          </label>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button class="primary" type="submit">添加到我的待办</button>
        </form>

        <div v-if="result" class="assistant-message result-message">
          <span class="mini-avatar">AI</span>
          <p>{{ result }}</p>
        </div>
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { addMeeting } from '@/stores/localMeetings'
  import { addTodo } from '@/stores/localTodos'
  import { useContactsStore } from '@/stores/user/contacts'
  import type { TodoRecipient } from '@/services/localTodos'
  import type { MeetingRecipient } from '@/services/localMeetings'

  const props = withDefaults(
    defineProps<{ participants?: TodoRecipient[]; sourceId?: string; sourceName?: string }>(),
    {
      participants: () => [{ id: 'self', name: '我', kind: 'self' }]
    }
  )
  const emit = defineEmits<{ close: []; published: [meetingId: string] }>()
  const contactsStore = useContactsStore()

  const conversationPeople = computed<MeetingRecipient[]>(() => {
    const people: MeetingRecipient[] = []
    for (const person of props.participants) {
      if (person.kind !== 'ai') people.push({ id: person.id, name: person.name, kind: person.kind })
    }
    return people.some((person) => person.id === 'self')
      ? people
      : [{ id: 'self', name: '我', kind: 'self' as const }, ...people]
  })
  const contactPeople = computed<MeetingRecipient[]>(() =>
    contactsStore.friendList.map((contact) => ({
      id: `contact:${contact.peerId || contact.userId || contact.id}`,
      name: contact.remark?.trim() || contact.username?.trim() || '未命名联系人',
      kind: 'contact'
    }))
  )
  const availablePeople = computed(() => {
    const people = new Map<string, MeetingRecipient>()
    for (const person of [...conversationPeople.value, ...contactPeople.value]) people.set(person.id, person)
    return [...people.values()]
  })
  const mode = ref<'meeting' | 'todo'>('meeting')
  const selectedIds = ref(conversationPeople.value.map((person) => person.id))
  const participantQuery = ref('')
  const visiblePeople = computed(() => {
    const query = participantQuery.value.trim().toLocaleLowerCase()
    return query
      ? availablePeople.value.filter((person) => person.name.toLocaleLowerCase().includes(query))
      : availablePeople.value
  })
  const error = ref('')
  const result = ref('')
  const meeting = reactive({ title: '', startAt: '', endAt: '', location: '', description: '' })
  const timeOptions = Array.from(
    { length: 96 },
    (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`
  )
  const startDate = ref(''),
    startTime = ref(''),
    endDate = ref(''),
    endTime = ref('')
  const startConfirmed = ref(false),
    endConfirmed = ref(false)
  const todo = reactive({ title: '', dueAt: '' })

  onMounted(() => {
    if (!contactsStore.friendList.length) contactsStore.fetchFriendList()
  })

  function selectConversationPeople() {
    selectedIds.value = conversationPeople.value.map((person) => person.id)
  }

  function selectAllContacts() {
    selectedIds.value = [...new Set(['self', ...contactPeople.value.map((person) => person.id)])]
  }

  function participantKindLabel(person: MeetingRecipient) {
    if (person.kind === 'self') return '组织者'
    if (person.kind === 'contact') return '联系人'
    return '当前会话'
  }

  function confirmStartTime() {
    if (!startDate.value || !startTime.value) {
      startConfirmed.value = false
      error.value = '请选择会议开始日期和时间。'
      return
    }
    meeting.startAt = `${startDate.value}T${startTime.value}`
    startConfirmed.value = true
    error.value = ''
  }

  function confirmEndTime() {
    if (!endTime.value) {
      meeting.endAt = ''
      endConfirmed.value = true
      error.value = ''
      return
    }
    if (!endDate.value) {
      endConfirmed.value = false
      error.value = '选择结束时间后，还需要选择结束日期。'
      return
    }
    meeting.endAt = `${endDate.value}T${endTime.value}`
    endConfirmed.value = true
    error.value = ''
  }

  function publishMeeting() {
    try {
      if (!startConfirmed.value || !meeting.startAt) throw new Error('请先确认会议开始时间。')
      if ((endDate.value || endTime.value) && !endConfirmed.value) throw new Error('结束时间已修改，请先确认结束时间。')
      const selected = availablePeople.value.filter((person) => selectedIds.value.includes(person.id))
      const created = addMeeting(
        {
          title: meeting.title,
          startAt: new Date(meeting.startAt).toISOString(),
          ...(meeting.endAt ? { endAt: new Date(meeting.endAt).toISOString() } : {}),
          location: meeting.location,
          description: meeting.description,
          participants: selected
        },
        props.sourceId ? `${props.sourceId}:${crypto.randomUUID()}` : undefined,
        props.sourceName || 'AI 会议助手'
      )
      result.value = `会议“${created.title}”已发布，已加入会议提醒与日程。参会人：${created.participants.map((person) => person.name).join('、')}。`
      error.value = ''
      emit('published', created.id)
      Object.assign(meeting, { title: '', startAt: '', endAt: '', location: '', description: '' })
      startDate.value = ''
      startTime.value = ''
      endDate.value = ''
      endTime.value = ''
      startConfirmed.value = false
      endConfirmed.value = false
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '会议发布失败，请检查填写内容。'
    }
  }

  function saveTodo() {
    try {
      const created = addTodo(
        {
          title: todo.title,
          ...(todo.dueAt ? { dueAt: new Date(todo.dueAt).toISOString() } : {})
        },
        undefined,
        'AI 会议助手'
      )
      result.value = `已添加到你的待办：“${created.title}”${created.dueAt ? `，提醒时间为 ${new Date(created.dueAt).toLocaleString()}` : '。'}`
      error.value = ''
      Object.assign(todo, { title: '', dueAt: '' })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '待办添加失败，请重试。'
    }
  }
</script>

<style scoped>
  .assistant-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #10203366;
  }
  .assistant-dialog {
    width: min(760px, 94vw);
    max-height: 90vh;
    overflow: hidden;
    border-radius: 16px;
    background: #f4f7fb;
    box-shadow: 0 22px 70px #10203345;
    color: #24354b;
  }
  .assistant-dialog > header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: white;
    border-bottom: 1px solid #e5ebf2;
  }
  .assistant-dialog h2 {
    margin: 0;
    font-size: 18px;
  }
  .assistant-dialog header p {
    margin: 3px 0 0;
    color: #718198;
    font-size: 12px;
  }
  .bot-avatar,
  .mini-avatar {
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, #3a92ed, #7a67c7);
    color: white;
    font-weight: 700;
  }
  .bot-avatar {
    width: 42px;
    height: 42px;
  }
  .mini-avatar {
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    font-size: 11px;
  }
  .close {
    margin-left: auto;
    border: 0;
    background: transparent;
    font-size: 25px;
    color: #718198;
    cursor: pointer;
  }
  .assistant-thread {
    max-height: calc(90vh - 75px);
    overflow: auto;
    padding: 20px;
  }
  .assistant-message {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .assistant-message > div,
  .assistant-message > p {
    max-width: 85%;
    margin: 0;
    padding: 12px 14px;
    border-radius: 3px 12px 12px;
    background: white;
    box-shadow: 0 2px 9px #24354b10;
  }
  .assistant-message p {
    margin: 0;
    line-height: 1.6;
  }
  .quick-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .quick-actions button,
  .participant-tools button {
    padding: 7px 11px;
    border: 1px solid #b8d5f2;
    border-radius: 7px;
    background: white;
    color: #2168a8;
    cursor: pointer;
  }
  .quick-actions .active {
    background: #2685ed;
    color: white;
  }
  .work-card {
    display: flex;
    flex-direction: column;
    gap: 13px;
    margin: 16px 0 16px 40px;
    padding: 18px;
    border: 1px solid #dce6f2;
    border-radius: 12px;
    background: white;
  }
  .work-card h3 {
    margin: 0;
    font-size: 16px;
  }
  .work-card label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  .work-card input,
  .work-card select,
  .work-card textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 9px 10px;
    border: 1px solid #cedae7;
    border-radius: 7px;
    background: white;
    color: #24354b;
  }
  .work-card textarea {
    min-height: 70px;
    resize: vertical;
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .work-card fieldset {
    border: 1px solid #dce6f2;
    border-radius: 8px;
  }
  .time-field {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 10px;
  }
  .time-pickers {
    display: grid;
    grid-template-columns: minmax(130px, 1fr) 100px;
    gap: 8px;
  }
  .time-field button {
    align-self: flex-start;
    padding: 7px 10px;
    border: 1px solid #b8d5f2;
    border-radius: 7px;
    background: white;
    color: #2168a8;
    cursor: pointer;
  }
  .time-field button.confirmed {
    border-color: #b8dfcf;
    background: #eef9f4;
    color: #168360;
  }
  .participant-field {
    padding: 10px;
  }
  .participant-hint {
    margin: 0 0 9px;
    color: #60748b;
    font-size: 12px;
  }
  .participant-tools {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 9px 0;
    flex-wrap: wrap;
  }
  .participant-tools button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .participant-tools span {
    margin-left: auto;
    color: #718198;
    font-size: 12px;
  }
  .participant-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    max-height: 190px;
    overflow: auto;
    border: 1px solid #e4ebf3;
    border-radius: 8px;
    background: #f9fbfe;
  }
  .work-card label.participant {
    display: grid;
    grid-template-columns: 18px 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 9px 10px;
    border-bottom: 1px solid #edf2f7;
    cursor: pointer;
  }
  .work-card label.participant:nth-child(odd) {
    border-right: 1px solid #edf2f7;
  }
  .participant input {
    width: auto;
  }
  .participant-avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e5f1ff;
    color: #1769c6;
    font-size: 12px;
  }
  .participant-name {
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .participant small {
    font-size: 11px;
    white-space: nowrap;
  }
  .participant-empty {
    grid-column: 1/-1;
    margin: 0;
    padding: 22px;
    text-align: center;
    color: #718198;
    font-size: 12px;
  }
  .primary {
    align-self: flex-start;
    padding: 9px 16px;
    border: 0;
    border-radius: 7px;
    background: #2685ed;
    color: white;
    cursor: pointer;
  }
  .work-card small {
    color: #718198;
  }
  .error {
    margin: 0;
    color: #c13c4b;
  }
  .result-message {
    margin-top: 12px;
  }
  .result-message > p {
    white-space: pre-wrap;
  }
  @media (max-width: 640px) {
    .field-grid,
    .participant-list {
      grid-template-columns: 1fr;
    }
    .work-card {
      margin-left: 0;
    }
    .time-pickers {
      grid-template-columns: 1fr;
    }
    .work-card label.participant:nth-child(odd) {
      border-right: 0;
    }
    .participant-tools span {
      width: 100%;
      margin-left: 0;
    }
  }
</style>
