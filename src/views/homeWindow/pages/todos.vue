<template>
  <section class="todos-page">
    <header class="page-header">
      <div>
        <h1>待办与会议</h1>
        <p>{{ summaryText }}</p>
      </div>
      <div class="header-actions">
        <button @click="assistantOpen = true">AI 会议助手</button>
        <button @click="enableNotifications">启用系统提醒</button>
      </div>
    </header>
    <nav class="section-switch" aria-label="待办与会议视图">
      <button :class="{ selected: section === 'todos' }" @click="section = 'todos'">待办事项</button>
      <button :class="{ selected: section === 'meetings' }" @click="section = 'meetings'">
        会议提醒
        <span v-if="upcomingMeetings.length" class="count">{{ upcomingMeetings.length }}</span>
      </button>
      <button :class="{ selected: section === 'schedule' }" @click="section = 'schedule'">日程</button>
    </nav>
    <p v-if="todoState.error || meetingState.error || error" class="error" role="alert">
      {{ todoState.error || meetingState.error || error }}
    </p>
    <p v-if="todoState.systemNotice || meetingState.systemNotice" role="status">
      {{ todoState.systemNotice || meetingState.systemNotice }}
    </p>
    <section class="daily-brief" aria-labelledby="daily-brief-title">
      <div class="brief-heading">
        <div>
          <h2 id="daily-brief-title">今日工作简报</h2>
          <p>自动整理本机个人待办与今日会议，可复制到日报或工作群。</p>
        </div>
        <button class="primary" type="button" @click="copyDailyBrief">复制简报</button>
      </div>
      <div class="brief-counts" aria-label="简报内容统计">
        <span>会议 {{ dailyBrief.meetingCount }}</span>
        <span>待处理 {{ dailyBrief.pendingCount }}</span>
        <span>今日完成 {{ dailyBrief.completedCount }}</span>
      </div>
      <details>
        <summary>预览简报内容</summary>
        <pre>{{ dailyBrief.text }}</pre>
      </details>
      <p v-if="briefNotice" role="status">{{ briefNotice }}</p>
    </section>

    <template v-if="section === 'todos'">
      <div class="todo-list-toolbar">
        <nav class="view-switch" aria-label="待办视图">
          <button :class="{ selected: view === 'received' }" @click="setView('received')">接收的待办</button>
          <button :class="{ selected: view === 'published' }" @click="setView('published')">我发布的</button>
        </nav>
        <div class="header-actions">
          <button
            v-if="view === 'received'"
            :aria-expanded="recipientFilterOpen"
            aria-controls="todo-recipient-filter"
            @click="recipientFilterOpen = !recipientFilterOpen">
            {{ recipientFilterOpen ? '收起接收人筛选' : '筛选接收联系人' }}
          </button>
          <button class="primary" aria-label="新建待办" @click="openCreate">＋ 添加待办</button>
        </div>
      </div>
      <p v-if="view === 'received'" class="recipient-scope">
        当前查看：{{ viewers.length === 1 && viewers[0] === 'self' ? '我的待办' : selectedRecipientLabel }}
      </p>
      <div v-if="view === 'received' && recipientFilterOpen" id="todo-recipient-filter" class="todo-workspace">
        <div class="viewer-label">
          <div class="viewer-heading">
            <label id="todo-viewer-label">
              查看接收人
              <span>筛选待办列表</span>
            </label>
            <div class="header-actions">
              <button @click="setViewers(['self'])">只看我</button>
              <button @click="setViewers(['all'])">查看所有</button>
              <button @click="setViewers([])">清空选择</button>
            </div>
          </div>
          <NConfigProvider abstract :theme="lightTheme" :theme-overrides="null">
            <NConfigProvider abstract :theme-overrides="{ common: recipientColors }">
              <NSelect
                :value="viewers"
                multiple
                clearable
                filterable
                :options="recipientOptions"
                :filter="filterRecipient"
                :menu-props="{
                  style: { '--bg-muted-color': '#ffffff', '--border-color': '#dce6f2', 'color-scheme': 'light' }
                }"
                :input-props="{ 'aria-label': '搜索待办接收人' }"
                :loading="contactsStore.friendListLoading"
                aria-labelledby="todo-viewer-label"
                placeholder="搜索姓名、备注、账号、部门或拼音"
                @update:value="setViewers">
                <template #empty>没有找到匹配的联系人或历史接收人</template>
              </NSelect>
            </NConfigProvider>
          </NConfigProvider>
          <small>
            可选 {{ contactCount }} 位联系人，支持多选；可按姓名、备注、账号、部门或拼音搜索，也可查找历史接收人。
          </small>
        </div>
      </div>
      <nav class="filter-nav">
        <button
          v-for="item in filters"
          :key="item.value"
          :class="{ selected: filter === item.value }"
          @click="filter = item.value">
          {{ item.label }}
        </button>
      </nav>
      <template v-if="view === 'published'">
        <p class="hint">
          按发布任务汇总；未完成表示仍有人未完成。此处只查看进度，模拟操作请切换到“接收的待办”选择成员。
        </p>
        <p v-if="!visiblePublished.length" class="empty">
          暂无匹配的已发布任务。在群聊中使用 @AI @成员 把某事项加入待办，即可在这里跟踪。
        </p>
        <article v-for="group in visiblePublished" :key="group.id" class="published-task">
          <div class="published-heading">
            <strong>{{ group.title }}</strong>
            <span>
              {{ group.completed === group.total ? '全部完成' : '进行中' }} · 已完成 {{ group.completed }}/{{
                group.total
              }}
              人
            </span>
          </div>
          <small>
            来源：{{ group.sourceName || '本地会话' }} · 发布：{{ new Date(group.createdAt).toLocaleString() }}
          </small>
          <progress :value="group.completed" :max="group.total" :aria-label="`${group.title}完成进度`" />
          <div v-for="recipient in group.items" :key="recipient.id" class="recipient-progress">
            <span>{{ recipient.assigneeName || '我' }}{{ assigneeKindLabel(recipient.assigneeId) }}</span>
            <span
              :class="{
                finished: recipient.completed,
                overdue: !recipient.completed && !!recipient.dueAt && Date.parse(recipient.dueAt) <= now
              }">
              {{
                recipient.completed
                  ? '已完成'
                  : recipient.dueAt && Date.parse(recipient.dueAt) <= now
                    ? '已到期 · 未完成'
                    : '未完成'
              }}
            </span>
            <small v-if="recipient.completed && recipient.completedAt">
              完成于 {{ new Date(recipient.completedAt).toLocaleString() }}
            </small>
            <small v-if="recipient.dueAt">结束时间：{{ new Date(recipient.dueAt).toLocaleString() }}</small>
            <small v-if="todoReminderAt(recipient)">
              提醒：{{ new Date(todoReminderAt(recipient)!).toLocaleString() }}
            </small>
            <button v-for="file in recipient.attachments || []" :key="file.id" @click="downloadAttachment(file)">
              下载附件：{{ file.name }}
            </button>
          </div>
        </article>
      </template>
      <template v-else>
        <p v-if="!visible.length" class="empty">
          <template v-if="!selectedRecipients.length">请选择一个或多个接收人。</template>
          <template v-else>
            {{ selectedRecipientLabel }}暂无{{
              filter === 'done' ? '已完成' : filter === 'pending' ? '未完成' : ''
            }}待办记录。这里查看本机保存的待办。
          </template>
        </p>
        <article v-for="item in visible" :key="item.id" :class="{ done: item.completed }">
          <input type="checkbox" :checked="item.completed" :aria-label="`完成：${item.title}`" @change="toggle(item)" />
          <div class="content">
            <strong>{{ item.title }}</strong>
            <small>接收人：{{ item.assigneeName || '我' }}{{ assigneeKindLabel(item.assigneeId) }}</small>
            <small :class="{ overdue: !item.completed && !!item.dueAt && Date.parse(item.dueAt) <= now }">
              {{ item.dueAt ? `结束时间：${new Date(item.dueAt).toLocaleString()}` : '未设置结束时间' }}
            </small>
            <small>
              {{ todoReminderAt(item) ? `提醒：${new Date(todoReminderAt(item)!).toLocaleString()}` : '未设置提醒' }}
            </small>
            <div v-if="item.attachments?.length" class="todo-attachments">
              <button v-for="file in item.attachments" :key="file.id" @click="downloadAttachment(file)">
                下载附件：{{ file.name }}
              </button>
            </div>
            <small v-if="item.sourceName">来源：{{ item.sourceName }}</small>
          </div>
          <button v-if="!item.completed" @click="snooze(item)">15 分钟后提醒</button>
          <button @click="edit(item)">编辑</button>
        </article>
      </template>
      <details class="reminder-help">
        <summary>提醒说明</summary>
        <p>
          客户端运行时每 15
          秒检查提醒；退出后不会后台提醒，下次启动补报。没有设置时间的事项仅保存，不提醒。系统提醒只提醒“我”，模拟成员状态仅供本机演示。
        </p>
      </details>
    </template>

    <template v-else-if="section === 'meetings'">
      <div class="meeting-toolbar">
        <div>
          <h2>会议提醒</h2>
          <p>查看安排和参会反馈；模拟成员的反馈可在本机切换用于演示。</p>
        </div>
        <button class="primary" @click="assistantOpen = true">＋ 发布会议</button>
      </div>
      <p v-if="calendarNotice" class="calendar-notice" role="status">{{ calendarNotice }}</p>
      <div class="meeting-filters">
        <button
          v-for="item in meetingFilters"
          :key="item.value"
          :class="{ selected: meetingFilter === item.value }"
          @click="meetingFilter = item.value">
          {{ item.label }}
        </button>
      </div>
      <p v-if="!visibleMeetings.length" class="empty">暂无会议。打开 AI 会议助手，或在群聊中选择成员发布会议。</p>
      <article
        v-for="meeting in visibleMeetings"
        :key="meeting.id"
        class="meeting-card"
        :class="{ cancelled: meeting.cancelledAt }">
        <div class="meeting-time">
          <div class="meeting-date-line">
            <strong>{{ monthDayLabel(meeting.startAt) }}</strong>
            <span>{{ weekdayLabel(meeting.startAt) }}</span>
          </div>
          <time :datetime="meeting.startAt">{{ timeLabel(meeting.startAt) }}</time>
        </div>
        <div class="meeting-main">
          <div class="meeting-title-row">
            <strong>{{ meeting.title }}</strong>
            <span v-if="meeting.cancelledAt" class="status cancelled-status">已取消</span>
            <span v-else-if="Date.parse(meeting.startAt) < now" class="status">已开始</span>
            <span v-else class="status upcoming">待开始</span>
          </div>
          <p>
            {{
              meeting.endAt ? `${timeLabel(meeting.startAt)}–${timeLabel(meeting.endAt)}` : timeLabel(meeting.startAt)
            }}
            <span v-if="meeting.location">· {{ meeting.location }}</span>
          </p>
          <p v-if="meeting.description" class="description">{{ meeting.description }}</p>
          <small>来源：{{ meeting.sourceName || 'AI 会议助手' }} · {{ responseSummary(meeting) }}</small>
          <div class="participant-list">
            <div v-for="person in meeting.participants" :key="person.id" class="participant-row">
              <span class="participant-avatar">{{ person.name.slice(0, 1) }}</span>
              <span class="participant-name">
                {{ person.name
                }}{{ person.kind === 'simulated' ? ' · 模拟成员' : person.kind === 'contact' ? ' · 联系人' : '' }}
              </span>
              <strong :class="`response-${person.response}`">{{ responseLabel(person.response) }}</strong>
              <div v-if="meetingCanChange(meeting, now)" class="response-actions">
                <button
                  :aria-label="`设为参加：${person.name}`"
                  @click="attempt(() => respondToMeeting(meeting.id, person.id, 'accepted'))">
                  参加
                </button>
                <button
                  :aria-label="`设为待定：${person.name}`"
                  @click="attempt(() => respondToMeeting(meeting.id, person.id, 'tentative'))">
                  待定
                </button>
                <button
                  :aria-label="`设为不参加：${person.name}`"
                  @click="attempt(() => respondToMeeting(meeting.id, person.id, 'declined'))">
                  不参加
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="meeting-actions">
          <button
            v-if="meetingCanChange(meeting, now)"
            class="calendar-button"
            :disabled="calendarOpeningId === meeting.id"
            title="在日历中确认导入；若取消会议，请在日历中手动删除"
            @click="addMeetingToCalendar(meeting)">
            {{ calendarOpeningId === meeting.id ? '正在打开…' : '添加到本地日历' }}
          </button>
          <button
            v-if="!meeting.cancelledAt && meeting.creatorId === 'self'"
            class="cancel-button"
            :disabled="!meetingCanChange(meeting, now)"
            :title="meetingCanChange(meeting, now) ? '取消会议' : '时间已到，只能查看历史记录'"
            @click="attempt(() => cancelMeeting(meeting.id))">
            {{ meetingCanChange(meeting, now) ? '取消会议' : '已开始或已结束 · 不可修改' }}
          </button>
        </div>
      </article>
    </template>

    <template v-else>
      <div class="schedule-heading">
        <div>
          <h2>我的日程</h2>
          <p>会议和设置了结束时间的待办会自动汇总到这里。</p>
        </div>
        <strong>{{ scheduleMonth }}</strong>
      </div>
      <p v-if="!scheduleGroups.length" class="empty">
        暂无有时间的日程。发布会议或为待办设置结束时间后，会显示在这里。
      </p>
      <section v-for="group in scheduleGroups" :key="group.date" class="schedule-day">
        <header class="schedule-date-row">
          <div class="schedule-date">
            <strong>{{ group.dateLabel }}</strong>
            <span>{{ group.weekday }}</span>
          </div>
          <small>{{ group.items.length }} 项安排</small>
        </header>
        <div class="schedule-list">
          <article v-for="item in group.items" :key="`${item.kind}-${item.id}`" class="schedule-item">
            <span class="schedule-dot" :class="item.kind" />
            <time>{{ timeLabel(item.at) }}</time>
            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.kind === 'meeting' ? `会议${item.meta ? ` · ${item.meta}` : ''}` : '待办截止' }}</small>
            </div>
            <button @click="openScheduleItem(item)">查看</button>
          </article>
        </div>
      </section>
    </template>
    <NModal v-if="editorOpen" :show="true" :mask-closable="false" @update:show="reset">
      <!-- vueuc's focus trap locates a DIV root; a SECTION redirects input focus to its hidden sentinel. -->
      <div class="todo-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="todo-editor-title">
        <header class="editor-heading">
          <div>
            <h2 id="todo-editor-title">{{ editingTodo ? '编辑待办' : '添加待办' }}</h2>
            <p>{{ editingTodo ? `接收人：${editingTodo.assigneeName || '我'}` : '添加给自己的待办' }}</p>
          </div>
          <button aria-label="关闭待办编辑" @click="reset">关闭</button>
        </header>
        <TodoEditor
          :key="editing"
          :todo="editingTodo"
          :disabled="!!todoState.error"
          @saved="onTodoSaved"
          @cancel="reset" />
      </div>
    </NModal>
    <WorkAssistantDialog
      v-if="assistantOpen"
      :participants="assistantParticipants"
      @close="assistantOpen = false"
      @published="onMeetingPublished" />
  </section>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { NConfigProvider, NModal, NSelect, lightTheme, type SelectOption } from 'naive-ui'
  import { useRoute } from 'vue-router'
  import WorkAssistantDialog from '@/components/WorkAssistantDialog.vue'
  import TodoEditor from '@/components/TodoEditor.vue'
  import { todoState, initTodos, updateTodo } from '@/stores/localTodos'
  import {
    publishedTodos,
    todoReminderAt,
    type LocalTodo,
    type TodoRecipient,
    type TodoAttachment
  } from '@/services/localTodos'
  import { downloadTodoAttachment } from '@/services/todoAttachments'
  import {
    buildTodoViewerOptions,
    matchesTodoViewer,
    normalizeTodoViewers,
    todoMatchesViewers
  } from '@/services/todoRecipients'
  import { useContactsStore } from '@/stores/user/contacts'
  import { useUserStore } from '@/stores/user/user'
  import { cancelMeeting, initMeetings, meetingState, respondToMeeting } from '@/stores/localMeetings'
  import { openMeetingInCalendar } from '@/services/meetingCalendar'
  import { meetingCanChange, meetingResponseCounts, responseLabel, type LocalMeeting } from '@/services/localMeetings'
  import { ensureNotificationPermission } from '@/utils/desktop/notification'
  import { writeText } from '@tauri-apps/plugin-clipboard-manager'
  import { buildDailyBrief } from '@/services/dailyBrief'
  defineOptions({ name: 'todos' })
  // Keep the selection and its teleported menu bright even under a dark global theme.
  const recipientColors = {
    primaryColor: '#2685ed',
    primaryColorHover: '#479af3',
    primaryColorPressed: '#176ac4',
    primaryColorSuppl: '#2685ed'
  }
  initTodos()
  initMeetings()
  const contactsStore = useContactsStore()
  const userStore = useUserStore()
  contactsStore.ensureLocalDirectory()
  onMounted(() => {
    if (userStore.authInfo.token) contactsStore.fetchFriendList()
  })
  const route = useRoute()
  const section = ref<'todos' | 'meetings' | 'schedule'>(
    route.query.view === 'meetings' ? 'meetings' : route.query.view === 'schedule' ? 'schedule' : 'todos'
  )
  watch(
    () => route.query.view,
    (value) => {
      if (value === 'meetings' || value === 'schedule' || value === 'todos') section.value = value
    }
  )
  const editorOpen = ref(false)
  const recipientFilterOpen = ref(false)
  const editing = ref(''),
    error = ref(''),
    filter = ref('pending'),
    now = ref(Date.now())
  const calendarOpeningId = ref(''),
    calendarNotice = ref('')
  const briefNotice = ref('')
  const viewers = ref<string[]>(['self']),
    view = ref<'received' | 'published'>('received'),
    assistantOpen = ref(false),
    meetingFilter = ref<'upcoming' | 'past' | 'all'>('upcoming')
  const timer = setInterval(() => {
    now.value = Date.now()
  }, 15000)
  onBeforeUnmount(() => clearInterval(timer))
  const published = computed(() => publishedTodos(todoState.items))
  const dailyBrief = computed(() => buildDailyBrief(todoState.items, meetingState.items, now.value))
  async function copyDailyBrief() {
    try {
      await writeText(dailyBrief.value.text)
      briefNotice.value = '工作简报已复制，可以粘贴到日报或工作群。'
    } catch {
      briefNotice.value = '复制失败，请展开预览后手动复制。'
    }
  }
  const editingTodo = computed(() => todoState.items.find((item) => item.id === editing.value))
  const visiblePublished = computed(() =>
    published.value.filter(
      (group) => filter.value === 'all' || (group.completed === group.total) === (filter.value === 'done')
    )
  )
  const recipientOptions = computed(() => buildTodoViewerOptions(contactsStore.friendList, todoState.items))
  const contactCount = computed(() => recipientOptions.value.filter((option) => option.kind === 'contact').length)
  const selectedRecipients = computed(() =>
    recipientOptions.value.filter((option) => viewers.value.includes(option.value))
  )
  const selectedRecipientLabel = computed(() =>
    selectedRecipients.value.length === 1
      ? selectedRecipients.value[0].name
      : `已选 ${selectedRecipients.value.length} 位接收人`
  )
  function setViewers(values: string[] | null) {
    viewers.value = normalizeTodoViewers(values || [], viewers.value)
    reset()
  }
  watch(recipientOptions, (next, previous) => {
    const retained = viewers.value.flatMap((value) => {
      if (next.some((option) => option.value === value)) return [value]
      const former = previous?.find((option) => option.value === value)
      const replacement = next.find((option) => former?.assigneeIds.some((id) => option.assigneeIds.includes(id)))
      return replacement ? [replacement.value] : []
    })
    if (retained.join('\n') !== viewers.value.join('\n')) setViewers(retained)
  })
  function assigneeKindLabel(id?: string) {
    if (!id || id === 'self') return ''
    return recipientOptions.value.some((option) => option.kind === 'contact' && option.assigneeIds.includes(id))
      ? ' · 联系人'
      : ' · 本机记录'
  }
  function filterRecipient(query: string, option: SelectOption) {
    return matchesTodoViewer(query, { searchText: String(option.searchText || '') })
  }
  const scopedItems = computed(() =>
    todoState.items.filter((item) => todoMatchesViewers(item, selectedRecipients.value))
  )
  const filters = [
    { value: 'pending', label: '未完成' },
    { value: 'done', label: '已完成' },
    { value: 'all', label: '全部' }
  ]
  const meetingFilters = [
    { value: 'upcoming' as const, label: '待开始' },
    { value: 'past' as const, label: '已开始' },
    { value: 'all' as const, label: '全部' }
  ]
  const pending = computed(() => scopedItems.value.filter((item) => !item.completed).length)
  const overdue = computed(
    () =>
      scopedItems.value.filter((item) => !item.completed && item.dueAt && Date.parse(item.dueAt) <= now.value).length
  )
  const visible = computed(() =>
    scopedItems.value
      .filter((item) => filter.value === 'all' || item.completed === (filter.value === 'done'))
      .slice()
      .sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity))
  )
  const upcomingMeetings = computed(() =>
    meetingState.items.filter((meeting) => !meeting.cancelledAt && Date.parse(meeting.startAt) >= now.value)
  )
  const visibleMeetings = computed(() =>
    meetingState.items
      .filter(
        (meeting) =>
          meetingFilter.value === 'all' ||
          (meetingFilter.value === 'upcoming') === (!meeting.cancelledAt && Date.parse(meeting.startAt) >= now.value)
      )
      .slice()
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  )
  const summaryText = computed(() =>
    section.value === 'meetings'
      ? `${upcomingMeetings.value.length} 场待开始 · ${meetingState.items.reduce((count, meeting) => count + meeting.participants.filter((person) => person.response === 'declined').length, 0)} 人次不参加`
      : section.value === 'schedule'
        ? `${scheduleItems.value.length} 项带时间的安排`
        : `${pending.value} 项未完成 · ${overdue.value} 项已到期`
  )
  const assistantParticipants = computed<TodoRecipient[]>(() => {
    const people = new Map<string, TodoRecipient>([['self', { id: 'self', name: '我', kind: 'self' }]])
    try {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1') || '{}')
      for (const chat of data.conversations || [])
        for (const person of chat.members || [])
          if (person.kind === 'simulated' && ![...people.values()].some((saved) => saved.name === person.name))
            people.set(person.id, { id: person.id, name: person.name, kind: 'simulated' })
    } catch {
      /* Personal meetings remain available. */
    }
    return [...people.values()]
  })
  interface ScheduleItem {
    id: string
    kind: 'meeting' | 'todo'
    title: string
    at: string
    meta?: string
  }
  const scheduleItems = computed<ScheduleItem[]>(() =>
    [
      ...meetingState.items
        .filter((meeting) => !meeting.cancelledAt)
        .map((meeting) => ({
          id: meeting.id,
          kind: 'meeting' as const,
          title: meeting.title,
          at: meeting.startAt,
          meta: meeting.location
        })),
      ...todoState.items
        .filter((item) => item.dueAt && !item.completed && (!item.assigneeId || item.assigneeId === 'self'))
        .map((item) => ({ id: item.id, kind: 'todo' as const, title: item.title, at: item.dueAt! }))
    ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  )
  const scheduleGroups = computed(() => {
    const groups = new Map<string, ScheduleItem[]>()
    for (const item of scheduleItems.value) {
      const value = new Date(item.at)
      const key = `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`
      groups.set(key, [...(groups.get(key) || []), item])
    }
    return [...groups.entries()].map(([dateKey, items]) => {
      const value = new Date(items[0].at)
      return {
        date: dateKey,
        items,
        dateLabel: value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
        weekday: value.toLocaleDateString('zh-CN', { weekday: 'short' })
      }
    })
  })
  const scheduleMonth = computed(() => new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }))
  function setView(next: 'received' | 'published') {
    view.value = next
    filter.value = next === 'published' ? 'all' : 'pending'
    reset()
  }
  function attempt(action: () => void) {
    try {
      action()
      error.value = ''
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '保存失败，请检查本机存储。'
    }
  }
  function reset() {
    editorOpen.value = false
    editing.value = ''
  }
  function openCreate() {
    editing.value = ''
    editorOpen.value = true
  }
  function onTodoSaved() {
    if (!editing.value) {
      section.value = 'todos'
      view.value = 'received'
      viewers.value = ['self']
      filter.value = 'pending'
    }
    reset()
  }
  function edit(item: LocalTodo) {
    editing.value = item.id
    editorOpen.value = true
  }
  async function downloadAttachment(file: TodoAttachment) {
    try {
      await downloadTodoAttachment(file)
      error.value = ''
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '附件下载失败。'
    }
  }
  function toggle(item: LocalTodo) {
    attempt(() =>
      updateTodo(item.id, { completed: !item.completed, remindedAt: item.completed ? undefined : item.remindedAt })
    )
  }
  function snooze(item: LocalTodo) {
    attempt(() =>
      updateTodo(item.id, { reminderAt: new Date(Date.now() + 900000).toISOString(), remindedAt: undefined })
    )
  }
  function monthDayLabel(value: string) {
    return new Date(value).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  }
  function weekdayLabel(value: string) {
    return new Date(value).toLocaleDateString('zh-CN', { weekday: 'short' })
  }
  function timeLabel(value: string) {
    return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  function responseSummary(meeting: LocalMeeting) {
    const counts = meetingResponseCounts(meeting)
    return `${counts.accepted} 人参加 · ${counts.tentative} 人待定 · ${counts.declined} 人不参加 · ${counts.pending} 人待反馈`
  }
  function onMeetingPublished() {
    section.value = 'meetings'
    meetingFilter.value = 'upcoming'
  }
  async function addMeetingToCalendar(meeting: LocalMeeting) {
    if (calendarOpeningId.value) return
    calendarOpeningId.value = meeting.id
    calendarNotice.value = ''
    try {
      const outcome = await openMeetingInCalendar(meeting)
      calendarNotice.value =
        outcome.status === 'opened'
          ? `已打开“${meeting.title}”的本地日历导入界面。请确认导入，日历会在会前10分钟提醒。`
          : `日历文件已保存到 ${outcome.path}，请在日历应用中导入后启用提醒。`
    } catch (cause) {
      calendarNotice.value = cause instanceof Error ? cause.message : '无法打开本地日历。'
    } finally {
      calendarOpeningId.value = ''
    }
  }
  function openScheduleItem(item: ScheduleItem) {
    if (item.kind === 'meeting') {
      section.value = 'meetings'
      meetingFilter.value = 'all'
    } else {
      section.value = 'todos'
      view.value = 'received'
      filter.value = 'all'
      viewers.value = ['self']
    }
  }
  async function enableNotifications() {
    const granted = await ensureNotificationPermission()
    const message = granted ? '系统提醒已启用。' : '未获得系统通知权限，仍会显示软件内提醒。'
    todoState.systemNotice = message
    meetingState.systemNotice = message
  }
</script>

<style scoped>
  .todos-page {
    height: 100%;
    overflow: auto;
    box-sizing: border-box;
    padding: 24px;
    background: #f6f9fe;
    color: #24354b;
  }
  .page-header,
  .meeting-toolbar,
  .schedule-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }
  .page-header h1,
  .meeting-toolbar h2,
  .schedule-heading h2 {
    margin: 0;
  }
  .page-header h1 {
    font-size: 23px;
  }
  .page-header p,
  .meeting-toolbar p,
  .schedule-heading p {
    margin: 5px 0 0;
  }
  .daily-brief {
    padding: 17px 20px;
    margin-bottom: 18px;
    border: 1px solid #cde0f7;
    border-radius: 13px;
    background: linear-gradient(120deg, #ffffff, #edf6ff);
  }
  .brief-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  .brief-heading h2 {
    margin: 0;
    font-size: 16px;
    color: #235789;
  }
  .brief-heading p {
    margin: 4px 0 0;
  }
  .brief-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 8px;
  }
  .brief-counts span {
    padding: 4px 9px;
    border-radius: 99px;
    background: #e2f0ff;
    color: #286495;
    font-size: 12px;
  }
  .daily-brief summary {
    width: fit-content;
    cursor: pointer;
    color: #2768a6;
    font-size: 12px;
  }
  .daily-brief pre {
    max-height: 300px;
    overflow: auto;
    margin: 12px 0 0;
    padding: 14px;
    border: 1px solid #e4edf7;
    border-radius: 9px;
    background: #fff;
    color: #33465f;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
    line-height: 1.7;
    user-select: text;
  }
  .daily-brief > p[role='status'] {
    margin: 8px 0 0;
    color: #286495;
  }
  .header-actions {
    display: flex;
    gap: 9px;
  }
  .section-switch {
    display: flex;
    gap: 4px;
    margin: 22px 0 18px;
    border-bottom: 1px solid #dce6f2;
  }
  .section-switch button {
    padding: 10px 16px;
    border: 0;
    border-bottom: 3px solid transparent;
    border-radius: 0;
    background: transparent;
  }
  .section-switch button.selected {
    border-bottom-color: #2685ed;
    background: transparent;
    color: #1769c6;
  }
  .count {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    margin-left: 4px;
    border-radius: 9px;
    background: #e5f1ff;
    font-size: 11px;
  }
  .view-switch,
  .filter-nav,
  .meeting-filters {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
  }
  .viewer-label {
    color-scheme: light;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .viewer-label small {
    color: #64758b;
    line-height: 1.6;
  }
  .todo-workspace {
    margin-bottom: 20px;
    padding: 20px;
    border: 1px solid #dce6f2;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 3px 14px rgba(38, 85, 145, 0.04);
  }
  .todo-list-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }
  .todo-list-toolbar .view-switch {
    margin-bottom: 0;
  }
  .todo-list-toolbar .header-actions {
    flex-wrap: wrap;
  }
  .recipient-scope {
    margin: 0 0 14px;
    color: #64758b;
    font-size: 13px;
  }
  .todo-editor-dialog {
    width: min(760px, calc(100vw - 40px));
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 24px;
    border: 1px solid #dce6f2;
    border-radius: 14px;
    background: #fff;
    color: #24354b;
    color-scheme: light;
  }
  .viewer-heading,
  .editor-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  .viewer-heading label,
  .editor-heading h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .viewer-heading label span {
    margin-left: 8px;
    font-weight: 400;
  }
  .viewer-heading label span,
  .editor-heading span,
  .reminder-help {
    color: #64758b;
    font-size: 12px;
  }
  .viewer-heading .header-actions {
    flex-wrap: wrap;
    gap: 6px;
  }
  .viewer-heading button {
    padding: 5px 9px;
    font-size: 12px;
  }
  .editor-heading {
    border-bottom: 1px solid #e8eef6;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .editor-heading p {
    margin: 6px 0 0;
    color: #64758b;
    font-size: 12px;
  }
  .todo-editor-dialog :deep(.todo-editor) {
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
  }
  .reminder-help {
    margin-top: 16px;
    line-height: 1.7;
  }
  .reminder-help summary {
    cursor: pointer;
    width: fit-content;
  }
  .reminder-help p {
    margin: 6px 0 0;
  }
  .todo-form {
    display: flex;
    gap: 12px;
    align-items: center;
    margin: 18px 0;
    padding: 18px;
    border: 1px solid #dce6f2;
    border-radius: 12px;
    background: #fff;
    flex-wrap: wrap;
  }
  .todo-form label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  .todo-form label:first-child {
    flex: 1;
    min-width: 220px;
  }
  input:not([type='checkbox']),
  select {
    padding: 10px;
    border: 1px solid #dce6f2;
    border-radius: 7px;
    color: #24354b;
    background: white;
  }
  button {
    padding: 8px 12px;
    border: 1px solid #dce6f2;
    border-radius: 7px;
    background: white;
    color: #345678;
    cursor: pointer;
  }
  .primary,
  .selected {
    background: #2685ed;
    color: white;
  }
  .todos-page > article,
  .published-task {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 16px;
    background: #fff;
    border: 1px solid #dce6f2;
    border-radius: 10px;
    margin-bottom: 10px;
  }
  .content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    overflow-wrap: anywhere;
  }
  .todo-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .todo-attachments button {
    max-width: 100%;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .done strong {
    text-decoration: line-through;
    color: #718198;
  }
  .published-task {
    flex-direction: column;
    align-items: stretch;
  }
  .published-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }
  .published-heading span {
    font-size: 12px;
    color: #1769c6;
  }
  .published-task progress {
    width: 100%;
    height: 8px;
    accent-color: #2685ed;
  }
  .recipient-progress {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 0;
    border-top: 1px solid #edf3fb;
    font-size: 13px;
  }
  .recipient-progress > span:first-child {
    flex: 1;
  }
  .finished {
    color: #168360;
  }
  .hint,
  p,
  small {
    color: #66788f;
    font-size: 12px;
    line-height: 1.7;
  }
  .overdue,
  .error {
    color: #c13c4b;
  }
  .empty {
    padding: 45px;
    text-align: center;
  }
  .meeting-toolbar {
    margin: 8px 0 18px;
  }
  .meeting-card {
    align-items: flex-start !important;
    position: relative;
  }
  .meeting-actions {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: 8px;
  }
  .calendar-button {
    border-color: #b8d5f2;
    color: #1769c6;
  }
  .calendar-notice {
    padding: 10px 12px;
    border: 1px solid #d4e5f7;
    border-radius: 8px;
    background: #edf6ff;
    color: #275982;
  }
  .meeting-time {
    box-sizing: border-box;
    flex: 0 0 124px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 12px 10px;
    border: 1px solid #d9eaff;
    border-radius: 12px;
    background: linear-gradient(145deg, #f4f9ff, #e9f4ff);
    text-align: center;
    color: #1769c6;
  }
  .meeting-date-line {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
  }
  .meeting-date-line strong {
    font-size: 14px;
    line-height: 1.3;
  }
  .meeting-date-line span {
    font-size: 12px;
    line-height: 1.3;
    color: #5b7799;
  }
  .meeting-time time {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: 0.3px;
  }
  .meeting-main {
    flex: 1;
    min-width: 0;
  }
  .meeting-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .meeting-title-row > strong {
    font-size: 16px;
  }
  .status {
    padding: 3px 8px;
    border-radius: 10px;
    background: #edf1f5;
    color: #607086;
    font-size: 11px;
  }
  .status.upcoming {
    background: #e9f7f1;
    color: #168360;
  }
  .cancelled-status {
    background: #fff0f0;
    color: #b83d49;
  }
  .description {
    white-space: pre-wrap;
  }
  .participant-list {
    margin-top: 12px;
    border-top: 1px solid #edf1f5;
  }
  .participant-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    border-bottom: 1px solid #f0f3f6;
    font-size: 12px;
  }
  .participant-avatar {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #e5f1ff;
    color: #1769c6;
  }
  .participant-name {
    flex: 1;
  }
  .response-accepted {
    color: #168360;
  }
  .response-tentative {
    color: #b27312;
  }
  .response-declined {
    color: #c13c4b;
  }
  .response-pending {
    color: #718198;
  }
  .response-actions {
    display: flex;
    gap: 5px;
  }
  .response-actions button {
    padding: 4px 7px;
    font-size: 11px;
  }
  .meeting-card.cancelled {
    opacity: 0.72;
  }
  .cancel-button {
    color: #c13c4b;
  }
  .schedule-heading {
    margin-bottom: 18px;
  }
  .schedule-heading > strong {
    padding: 6px 11px;
    border-radius: 8px;
    background: #eaf3ff;
    color: #1769c6;
    font-size: 13px;
    font-weight: 600;
  }
  .schedule-day {
    overflow: hidden;
    margin-bottom: 16px;
    border: 1px solid #dce6f2;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 4px 16px rgba(36, 72, 112, 0.05);
  }
  .schedule-date-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e8eff7;
    background: linear-gradient(90deg, #f0f6ff, #fafcff);
  }
  .schedule-date {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .schedule-date strong {
    font-size: 16px;
    line-height: 1.35;
    color: #1d426d;
  }
  .schedule-date span {
    padding: 2px 8px;
    border-radius: 999px;
    background: #dcecff;
    color: #1769c6;
    font-size: 12px;
    line-height: 1.5;
  }
  .schedule-date-row > small {
    font-size: 12px;
    color: #789;
  }
  .schedule-list {
    display: flex;
    flex-direction: column;
    padding: 3px 16px;
  }
  .schedule-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 13px;
    margin: 0 !important;
    padding: 14px 0 !important;
    border-bottom: 1px solid #edf2f7;
    background: #fff;
  }
  .schedule-item:last-child {
    border-bottom: 0;
  }
  .schedule-dot {
    flex: 0 0 9px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #2685ed;
    box-shadow: 0 0 0 4px #e8f3ff;
  }
  .schedule-dot.todo {
    background: #f29a4a;
    box-shadow: 0 0 0 4px #fff0df;
  }
  .schedule-item time {
    flex: 0 0 52px;
    color: #244f7d;
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .schedule-item > div {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }
  .schedule-item > div > strong {
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .schedule-item small {
    display: block;
    line-height: 1.5;
  }
  .schedule-item button {
    padding: 6px 12px;
    border-color: #d5e4f4;
    color: #1769c6;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid #2685ed;
    outline-offset: 2px;
  }
  @media (max-width: 760px) {
    .page-header,
    .meeting-toolbar,
    .schedule-heading {
      align-items: flex-start;
      flex-direction: column;
    }
    .meeting-card {
      flex-wrap: wrap;
    }
    .meeting-time {
      flex-basis: 116px;
    }
    .meeting-main {
      min-width: calc(100% - 132px);
    }
    .response-actions {
      width: 100%;
    }
    .schedule-date-row {
      padding: 11px 13px;
    }
    .schedule-list {
      padding: 3px 13px;
    }
    .schedule-item {
      gap: 10px;
    }
    .schedule-item time {
      flex-basis: 46px;
    }
    .schedule-item button {
      padding: 6px 9px;
    }
  }
</style>
