<template>
  <div class="local-chat">
    <aside class="conversations">
      <div class="list-head">
        <strong>本地会话</strong>
        <button @click="createChat">＋ 新建</button>
        <button @click="groupCreating = !groupCreating">＋ 建群</button>
      </div>
      <form v-if="groupCreating" class="group-create" @submit.prevent="createLocalGroup">
        <input v-model="groupName" aria-label="本地群名称" placeholder="群名称" maxlength="60" required />
        <input v-model="groupNames" aria-label="初始模拟成员" placeholder="成员姓名，用逗号分隔" />
        <small>仅本机模拟，不发送真实邀请。</small>
        <button>创建本地群</button>
      </form>
      <button
        v-for="chat in sortedChats"
        :key="chat.id"
        class="conversation"
        :class="{ selected: chat.id === data.selectedId }"
        @click="selectChat(chat.id)">
        <span class="avatar" :class="{ 'avatar--solid': !!chat.peerId }">
          {{ chat.peerId ? '' : chat.name.slice(0, 1) }}
        </span>
        <span class="summary">
          <strong>{{ chat.pinned ? '⌃ ' : '' }}{{ chat.name }}</strong>
          <small>
            {{
              chat.messages[chat.messages.length - 1]?.text || (chat.peerId ? '开始本地对话' : '输入消息，或 @AI 提问')
            }}
          </small>
        </span>
      </button>
      <p class="local-note">
        消息保存在此电脑
        <br />
        这些会话不会发送给其他联系人
      </p>
    </aside>
    <section class="session" v-if="activeChat">
      <header class="chat-header">
        <div class="chat-title">
          <span class="avatar" :class="{ 'avatar--solid': !!activeChat.peerId }">
            {{ activeChat.peerId ? '' : activeChat.name.slice(0, 1) }}
          </span>
          <strong>{{ activeChat.name }}{{ activeChat.members ? ` (${activeChat.members.length})` : '' }}</strong>
          <small v-if="activeChat.peerId">本地对话 · 消息仅保存在此设备</small>
        </div>
        <div class="header-icons">
          <button aria-label="群通知" title="群通知" @click="togglePanel('announcement')">
            <svg viewBox="0 0 24 24"><path d="M4 9h4l7-5v16l-7-5H4zM18 8q5 4 0 8" /></svg>
          </button>
          <button aria-label="消息记录" title="消息记录" @click="togglePanel('history')">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 5v7H6" />
            </svg>
          </button>
          <button aria-label="设置" title="设置" @click="togglePanel('settings')">
            <svg viewBox="0 0 24 24">
              <circle cx="4" cy="12" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="20" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </header>
      <div v-if="storageError" class="error" role="alert">
        {{ storageError }}
        <button @click="retrySave">重试保存</button>
      </div>
      <div v-if="notice" class="notice" role="status">
        {{ notice }}
        <button @click="notice = ''">×</button>
      </div>
      <div v-if="selecting" class="selection-bar">
        <span>已选 {{ selectedIds.length }} 条 · 仅发送选中记录</span>
        <button @click="selectedIds = activeChat.messages.filter((m) => m.status === 'done').map((m) => m.id)">
          全选
        </button>
        <button @click="selectedIds = []">清空</button>
        <button @click="toggleSelection">取消多选</button>
        <button
          class="primary"
          :disabled="!selectedIds.length || !!busy[activeChat.id] || !!storageError"
          @click="summarize">
          @AI 总结
        </button>
      </div>
      <main ref="messageArea" class="messages" aria-live="polite">
        <div v-if="!activeChat.messages.length" class="empty">
          <template v-if="activeChat.peerId">
            <b>和{{ activeChat.name }}开始对话</b>
            <p>消息只保存在本机，不会送达对方。也可以用 @AI 或 @AI RAG助手 提问。</p>
          </template>
          <template v-else>
            <b>开始一段新的对话</b>
            <p>输入 @AI 和问题向模型提问，或 @AI RAG助手 查询相关制度，回答直接显示在聊天中。</p>
          </template>
        </div>
        <article
          v-for="msg in activeChat.messages"
          :key="msg.id"
          :data-message-id="msg.id"
          class="message"
          :class="[
            messageSender(activeChat, msg).kind === 'self' ? 'user' : 'other',
            { highlighted: highlightedId === msg.id }
          ]"
          @contextmenu.prevent.stop="openMessageMenu($event, msg)">
          <input
            v-if="selecting"
            v-model="selectedIds"
            type="checkbox"
            :value="msg.id"
            :disabled="msg.status !== 'done'"
            :aria-label="`选择记录：${msg.text.slice(0, 40)}`" />
          <span
            class="avatar"
            :class="{ 'avatar--solid': !!activeChat.peerId }"
            :style="{ background: messageSender(activeChat, msg).color }">
            {{
              activeChat.peerId ? '' : msg.role === 'assistant' ? 'AI' : messageSender(activeChat, msg).name.slice(0, 1)
            }}
          </span>
          <div class="bubble-wrap">
            <small>
              {{ messageSender(activeChat, msg).name
              }}{{ messageSender(activeChat, msg).kind === 'simulated' ? ' · 模拟成员' : '' }} ·
              {{ formatTime(msg.createdAt) }}
            </small>
            <p class="bubble">{{ msg.status === 'pending' ? 'AI 正在思考…' : msg.text }}</p>
            <template v-if="msg.status === 'done' && msg.rag">
              <section
                v-if="msg.rag.options.length || msg.rag.needsInput"
                class="rag-clarification"
                aria-label="RAG 追问选项">
                <strong>请补充或选择你想了解的方向</strong>
                <button
                  v-for="option in msg.rag.options"
                  :key="option.id"
                  :disabled="!!busy[activeChat.id]"
                  @click="ragFollowup(msg, option)">
                  {{ option.question }}
                </button>
                <form @submit.prevent="ragCustomFollowup(msg)">
                  <input
                    v-model="ragClarificationDrafts[msg.id]"
                    aria-label="补充 RAG 问题"
                    placeholder="也可以补充具体业务、对象或范围…"
                    :disabled="!!busy[activeChat.id]" />
                  <button :disabled="!!busy[activeChat.id] || !ragClarificationDrafts[msg.id]?.trim()">继续提问</button>
                </form>
              </section>
              <div v-if="msg.rag.contacts?.length" class="rag-contact-cards">
                <article v-for="contact in msg.rag.contacts" :key="contact.userId" class="rag-contact-card">
                  <span class="rag-contact-card__avatar" />
                  <div class="rag-contact-card__body">
                    <strong>{{ contact.name }}</strong>
                    <small>{{ contact.department }}</small>
                    <p>{{ contact.responsibility }}</p>
                    <div class="rag-contact-card__actions">
                      <button type="button" @click="openContactCard(contact.userId)">查看名片</button>
                      <button type="button" @click="messageContact(contact.userId, contact.name)">发送消息</button>
                    </div>
                  </div>
                </article>
              </div>
              <details v-if="msg.rag.references.length" class="source-records">
                <summary>
                  {{ msg.rag.contacts?.length ? '职责依据' : '制度依据' }}（{{ msg.rag.references.length }}）
                </summary>
                <p v-for="(source, index) in msg.rag.references" :key="index">
                  {{ index + 1 }}. {{ source.name }}
                  <br />
                  {{ source.text }}
                </p>
              </details>
            </template>
            <div v-if="msg.status === 'done' && msg.todoSuggestions?.length" class="todo-followups">
              <strong>是否将以下事项添加到待办？</strong>
              <div v-for="suggestion in groupedSuggestions(msg)" :key="suggestion.indexes[0]">
                <template v-if="!suggestion.dismissed">
                  <p>{{ suggestion.title }}</p>
                  <small>
                    {{
                      suggestion.dueAt
                        ? `建议结束时间：${new Date(suggestion.dueAt).toLocaleString()}`
                        : '未明确时间，添加后可在待办页设置提醒。'
                    }}
                  </small>
                  <span v-if="suggestion.added">已添加为一项待办 ✓</span>
                  <small>参与人：{{ suggestion.recipients.map((person) => person.name).join('、') || '待确认' }}</small>
                  <template v-if="suggestion.added">
                    <small>
                      已完成 {{ suggestionProgress(msg, suggestion).filter((item) => item.completed).length }}/{{
                        suggestionProgress(msg, suggestion).length
                      }}
                      人 · 可在“待办事项 → 我发布的”查看进度
                    </small>
                    <small v-for="item in suggestionProgress(msg, suggestion)" :key="item.id">
                      {{ item.assigneeName || '我' }}：{{ item.completed ? '已完成' : '未完成' }}
                    </small>
                  </template>
                  <template v-else>
                    <small v-if="suggestion.recipientError" role="alert">{{ suggestion.recipientError }}</small>
                    <small v-else-if="suggestion.recipients.length > 1">一项任务，分别记录每个人的完成进度。</small>
                    <small>仅本机演示，不会通知其他人。</small>
                    <button :disabled="!!suggestion.recipientError" @click="acceptTodo(msg, suggestion)">
                      添加到待办
                    </button>
                    <button @click="dismissTodo(msg, suggestion)">暂不添加</button>
                  </template>
                </template>
                <small v-else>已忽略：{{ suggestion.title }}</small>
              </div>
            </div>
            <blockquote v-if="msg.quoteId" class="quote-saved">
              回复：{{ activeChat.messages.find((item) => item.id === msg.quoteId)?.text || '原消息不可用' }}
            </blockquote>
            <details v-if="msg.summarySourceIds?.length" class="source-records">
              <summary>总结来源：{{ msg.summarySourceIds.length }} 条记录</summary>
              <p
                v-for="source in activeChat.messages.filter((m) => msg.summarySourceIds?.includes(m.id))"
                :key="source.id">
                {{ formatTime(source.createdAt) }} · {{ messageSender(activeChat, source).name }}：{{ source.text }}
              </p>
            </details>
            <div v-if="msg.status === 'error'" class="message-error">
              {{ msg.error }}
              <button :disabled="!!busy[activeChat.id] || !!storageError" @click="retry(msg)">重试</button>
            </div>
          </div>
        </article>
      </main>
      <footer>
        <div v-if="quotedMessage" class="quote-draft">
          <span>回复：{{ quotedMessage.text }}</span>
          <button aria-label="取消回复" @click="quoteId = ''">×</button>
        </div>
        <div class="tools">
          <button class="assistant-shortcut" title="通用模型问答，使用 AI 模型设置" @click="mention">
            @AI
            <small>通用助手</small>
          </button>
          <button
            class="assistant-shortcut rag-shortcut"
            title="查询制度知识库，使用总设置中的 RAGFlow 配置"
            @click="mentionRag">
            @AI RAG助手
            <small>制度问答</small>
          </button>
          <button
            class="assistant-shortcut meeting-shortcut"
            title="向全体或指定成员发布会议"
            @click="meetingAssistantOpen = true">
            📅
            <small>发布会议</small>
          </button>
          <span>{{ config.model ? `模型：${config.model}` : '尚未配置模型' }}</span>
          <span>最近 {{ config.contextCount }} 条 + 本次提问</span>
          <span v-if="activeChat.peerId">本地演示会话 · 消息不会送达对方</span>
        </div>
        <div class="mention-composer">
          <div v-if="mentionOpen" class="mention-popup" role="listbox" aria-label="选择群成员">
            <button
              v-for="(member, index) in mentionOptions"
              :key="member.id"
              type="button"
              role="option"
              :aria-selected="index === mentionIndex"
              :class="{ selected: index === mentionIndex }"
              @mousedown.prevent="chooseMention(member.name)">
              {{ member.name }}
              <small>
                {{
                  member.id === 'ragflow'
                    ? '制度知识问答'
                    : member.id === 'ai'
                      ? '聊天助手'
                      : member.id === 'all'
                        ? '当前全体成员'
                        : '群成员'
                }}
              </small>
            </button>
            <p v-if="!mentionOptions.length">没有匹配的成员</p>
          </div>
          <textarea
            ref="input"
            v-model="drafts[activeChat.id]"
            aria-label="消息输入框"
            :placeholder="
              activeChat.peerId ? '输入消息，或 @AI 提问（仅保存在本机）…' : '输入消息，或 @AI RAG助手 查询制度…'
            "
            :disabled="loadFailed"
            :aria-expanded="mentionOpen"
            @input="updateMention"
            @click="updateMention"
            @keyup.left="updateMention"
            @keyup.right="updateMention"
            @blur="mentionOpen = false"
            @keydown="composerKeyDown" />
        </div>
        <div class="send-row">
          <span>Enter 发送 · Ctrl / Shift + Enter 换行</span>
          <button v-if="busy[activeChat.id]" @click="cancel(activeChat.id)">停止 AI</button>
          <button
            class="primary"
            :disabled="loadFailed || !!storageError || !drafts[activeChat.id]?.trim()"
            @click="send">
            发送
          </button>
        </div>
      </footer>
      <LocalChatDrawer
        v-if="panel"
        :key="`${activeChat.id}-${panel}`"
        :chat="activeChat"
        :mode="panel"
        @close="panel = null"
        @save="persist"
        @export="exportChats"
        @locate="locateMessage" />
    </section>
    <div v-else class="empty">
      <p>{{ storageError }}</p>
      <button @click="exportChats">导出原始记录</button>
    </div>
    <n-dropdown
      :show="messageMenu.show"
      :x="messageMenu.x"
      :y="messageMenu.y"
      trigger="manual"
      :options="messageMenuOptions"
      @select="onMessageMenuSelect"
      @clickoutside="messageMenu.show = false" />
    <WorkAssistantDialog
      v-if="meetingAssistantOpen && activeChat"
      :participants="todoMembers"
      :source-id="activeChat.id"
      :source-name="activeChat.name"
      @close="meetingAssistantOpen = false"
      @published="onChatMeetingPublished" />
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
  import LocalChatDrawer from './LocalChatDrawer.vue'
  import { withExampleConversations } from '@/services/localChatExamples'
  import WorkAssistantDialog from '@/components/WorkAssistantDialog.vue'
  import { meetingState } from '@/stores/localMeetings'
  import { ragQuestion, requestRag } from '@/services/ragChat'
  import { answerFromContactKnowledge } from '@/services/contactKnowledge'
  import { useHomeTabStore } from '@/stores/app/homeTab'
  const homeTabStore = useHomeTabStore()
  function openContactCard(userId: string) {
    void homeTabStore.navigateTo('contacts', { peerId: userId })
  }
  function messageContact(userId: string, name: string) {
    localChatTarget.value = { peerId: userId, peerName: name }
  }
  let pendingRagFollowup: LocalMessage['ragFollowup']
  const ragClarificationDrafts = reactive<Record<string, string>>({})
  async function ragCustomFollowup(msg: LocalMessage) {
    const question = ragClarificationDrafts[msg.id]?.trim()
    if (!question || !msg.rag || !activeChat.value || busy[activeChat.value.id]) return
    pendingRagFollowup = { previous: msg.rag }
    drafts[activeChat.value.id] = `@AI RAG助手 ${question}`
    try {
      await send()
      ragClarificationDrafts[msg.id] = ''
    } finally {
      pendingRagFollowup = undefined
    }
  }
  function mentionRag() {
    if (!activeChat.value) return
    drafts[activeChat.value.id] = `@AI RAG助手 ${drafts[activeChat.value.id] || ''}`
    input.value?.focus()
  }
  async function ragFollowup(msg: LocalMessage, option: { id: string; question: string }) {
    if (!activeChat.value || !msg.rag || busy[activeChat.value.id]) return
    pendingRagFollowup = {
      previous: msg.rag,
      ...(msg.rag.cacheId && msg.rag.mode !== 'intent'
        ? { selection: { cache_id: msg.rag.cacheId, option_id: option.id } }
        : {})
    }
    drafts[activeChat.value.id] = `@AI RAG助手 ${option.question}`
    try {
      await send()
    } finally {
      pendingRagFollowup = undefined
    }
  }
  import {
    parseAssignedCommand,
    resolveRecipients,
    parseTodoSuggestions,
    todoPrompt,
    type TodoRecipient
  } from '@/services/localTodos'
  function mentionedRecipients(text: string, members: TodoRecipient[]) {
    const names = [...text.matchAll(/(?:^|\s)@([^\s@，,。！？?!；;：:]+)/g)]
      .map((match) => match[1])
      .filter((name) => !/^ai(?:助手)?$/i.test(name))
    return resolveRecipients(
      members,
      names.map((name) => {
        if (name === '全体成员') return 'all'
        if (name === '自己' || name === '我') return 'self'
        const matches = members.filter((member) => member.name === name && member.kind !== 'ai')
        if (matches.length !== 1) throw new Error(`无法唯一找到群成员“${name}”，请从群成员中选择。`)
        return matches[0].id
      })
    )
  }
  import { addAssignedTodos, initTodos, todoState } from '@/stores/localTodos'
  import { groupChatTodoSuggestions, type GroupedTodoSuggestion } from '@/services/chatTodoSuggestions'
  initTodos()
  const groupCreating = ref(false),
    groupName = ref(''),
    groupNames = ref('')
  const meetingAssistantOpen = ref(false)
  const mentionOpen = ref(false),
    mentionQuery = ref(''),
    mentionIndex = ref(0)
  let mentionStart = 0,
    mentionEnd = 0
  const mentionOptions = computed(() => {
    const candidates = [
      { id: 'ai', name: 'AI' },
      { id: 'ragflow', name: 'AI RAG助手' },
      ...(activeChat.value?.members ? [{ id: 'all', name: '全体成员' }, ...todoMembers.value] : [])
    ]
    const query = mentionQuery.value.toLowerCase()
    return candidates.filter((m) => {
      let i = 0
      for (const c of m.name.toLowerCase()) if (c === query[i]) i++
      return i === query.length
    })
  })
  function updateMention() {
    const el = input.value
    if (!el || el.selectionStart !== el.selectionEnd) {
      mentionOpen.value = false
      return
    }
    const before = el.value.slice(0, el.selectionStart)
    const match = /(?:^|\s)@([^\s@，,：:。！？]*)$/.exec(before)
    mentionOpen.value = !!match
    if (match) {
      mentionQuery.value = match[1]
      mentionStart = before.lastIndexOf('@')
      mentionEnd = el.selectionStart
      mentionIndex.value = 0
    }
  }
  async function chooseMention(name: string) {
    if (!activeChat.value || !input.value) return
    const el = input.value
    const value = el.value.slice(0, mentionStart) + `@${name} ` + el.value.slice(mentionEnd)
    drafts[activeChat.value.id] = value
    mentionOpen.value = false
    await nextTick()
    el.focus()
    el.setSelectionRange(mentionStart + name.length + 2, mentionStart + name.length + 2)
  }
  function composerKeyDown(event: KeyboardEvent) {
    if (event.isComposing) return
    if (mentionOpen.value) {
      if (event.key === 'Escape') {
        event.preventDefault()
        mentionOpen.value = false
        return
      }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        const n = mentionOptions.value.length
        if (n) mentionIndex.value = (mentionIndex.value + (event.key === 'ArrowDown' ? 1 : n - 1)) % n
        return
      }
      if (['Enter', 'Tab'].includes(event.key)) {
        event.preventDefault()
        const member = mentionOptions.value[mentionIndex.value]
        if (member) void chooseMention(member.name)
        return
      }
    }
    onKeyDown(event)
  }
  const todoMembers = computed(() =>
    (activeChat.value?.members || [{ id: 'self', name: '我', kind: 'self' as const }]).filter((m) => m.kind !== 'ai')
  )
  function onChatMeetingPublished(meetingId: string) {
    const chat = activeChat.value
    const meeting = meetingState.items.find((item) => item.id === meetingId)
    if (!chat || !meeting) return
    chat.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      text: `会议已发布：${meeting.title}\n时间：${new Date(meeting.startAt).toLocaleString()}${meeting.location ? `\n地点：${meeting.location}` : ''}\n参会人：${meeting.participants.map((person) => person.name).join('、')}\n可在“待办事项 → 会议提醒”查看反馈，在“日程”查看安排。`,
      createdAt: new Date().toISOString(),
      status: 'done'
    })
    persist()
  }
  function createLocalGroup() {
    if (loadFailed.value || storageError.value) return
    const names = groupNames.value
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (
      !groupName.value.trim() ||
      names.length > 50 ||
      new Set(names).size !== names.length ||
      names.some((n) => n.length > 30 || /[\s@]/.test(n) || ['我', '自己', '全体成员', 'AI'].includes(n))
    ) {
      notice.value = '请填写群名称；成员名须唯一，不含空格或 @，且不能使用我、自己、全体成员、AI。最多 50 人。'
      return
    }
    const chat = newConversation(groupName.value.trim())
    chat.members = [
      { id: 'self', name: '我', color: '#2685ed', kind: 'self' },
      ...names.map((name) => ({ id: crypto.randomUUID(), name, color: '#5b9fbb', kind: 'simulated' as const })),
      { id: 'ai', name: 'AI 助手', color: '#7865c4', kind: 'ai' }
    ]
    const previous = data.selectedId
    data.conversations.push(chat)
    data.selectedId = chat.id
    if (!persist()) {
      data.conversations.pop()
      data.selectedId = previous
      return
    }
    groupCreating.value = false
    groupName.value = ''
    groupNames.value = ''
    notice.value = '本地演示群已创建，可在设置 → 群管理中添加或移除模拟成员。'
  }
  function groupedSuggestions(msg: LocalMessage) {
    const request = activeChat.value?.messages.find((m) => m.id === msg.replyTo)
    const source = activeChat.value?.messages.find((m) => m.id === request?.quoteId)
    // Older requests stored ['self'] even when no person was mentioned. Do not let that override named owners.
    const hasExplicitMention = [...(request?.text || '').matchAll(/(?:^|\s)@([^\s@，,。！？?!；;：:]+)/g)].some(
      (match) => !/^ai(?:助手)?$/i.test(match[1])
    )
    let explicitIds: string[] | undefined
    try {
      if (hasExplicitMention)
        explicitIds = mentionedRecipients(request!.text, todoMembers.value).map((person) => person.id)
    } catch {
      explicitIds = ['unresolved-recipient']
    }
    return groupChatTodoSuggestions(msg.todoSuggestions || [], todoMembers.value, {
      explicitIds,
      fallbackIds: (msg.todoRecipients || request?.todoRecipients)?.map((person) => person.id),
      quoteAuthorId: source && activeChat.value ? messageSender(activeChat.value, source).id : undefined,
      addedIndexes: (msg.todoSuggestions || []).flatMap((_, index) =>
        todoState.items.some((t) => t.sourceKey === `${msg.id}:${index}` || t.assignmentKey === `${msg.id}:${index}`)
          ? [index]
          : []
      )
    })
  }
  function suggestionProgress(msg: LocalMessage, suggestion: GroupedTodoSuggestion) {
    return todoState.items.filter((item) =>
      suggestion.indexes.some(
        (index) => item.assignmentKey === `${msg.id}:${index}` || item.sourceKey === `${msg.id}:${index}`
      )
    )
  }
  function acceptTodo(msg: LocalMessage, suggestion: GroupedTodoSuggestion) {
    try {
      if (suggestion.recipientError) throw new Error(suggestion.recipientError)
      const recipients = suggestion.recipients
      addAssignedTodos(
        suggestion,
        recipients,
        `${msg.id}:${suggestion.indexes[0]}`,
        activeChat.value!.id,
        activeChat.value!.name
      )
      // Keep the accepted candidate at its original index; suppress its merged duplicates without shifting storage keys.
      Object.assign(msg.todoSuggestions![suggestion.indexes[0]], {
        title: suggestion.title,
        assigneeIds: recipients.map((person) => person.id)
      })
      for (const index of suggestion.indexes.slice(1)) msg.todoSuggestions![index].mergedInto = suggestion.indexes[0]
      persist()
      notice.value = `已添加 1 项待办，参与人：${recipients.map((m) => m.name).join('、')}；可在“我发布的”分别查看完成进度。`
    } catch (error) {
      notice.value = error instanceof Error ? error.message : '待办保存失败。'
    }
  }
  function dismissTodo(msg: LocalMessage, suggestion: GroupedTodoSuggestion) {
    for (const index of suggestion.indexes) msg.todoSuggestions![index].dismissed = true
    persist()
  }
  import { localChatTarget } from '@/services/localChatNavigation'
  import {
    CHAT_KEY,
    API_KEY_KEY,
    CONFIG_KEY,
    DEFAULT_CONFIG,
    buildContext,
    ensureDirectConversation,
    loadChats,
    mentionsAi,
    newConversation,
    messageSender,
    requestAi,
    saveChats,
    validateConfig,
    type AiConfig,
    type LocalChatData,
    type LocalMessage
  } from '@/services/localChat'

  const storageError = ref('')
  const loadFailed = ref(false)
  let initial: LocalChatData = { version: 1, selectedId: '', conversations: [] }
  try {
    initial = loadChats(localStorage)
  } catch {
    storageError.value = '无法读取本地聊天记录。原始数据已保留，请导出备份。'
    loadFailed.value = true
  }
  if (!loadFailed.value) {
    const supplemented = withExampleConversations(initial)
    if (supplemented !== initial) {
      try {
        // Save the addition and its version together. A failed write leaves
        // the original snapshot and selected conversation untouched.
        saveChats(localStorage, supplemented)
        initial = supplemented
      } catch {
        storageError.value = '示例群聊未能保存，原有聊天记录未改动。请检查存储空间后重新打开。'
      }
    }
  }
  const data = reactive(initial)
  const activeChat = computed(() => data.conversations.find((chat) => chat.id === data.selectedId))
  const sortedChats = computed(() => [...data.conversations].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)))
  const panel = ref<'settings' | 'announcement' | 'history' | null>(null)
  const highlightedId = ref('')
  function togglePanel(value: 'settings' | 'announcement' | 'history') {
    panel.value = panel.value === value ? null : value
  }
  async function locateMessage(id: string) {
    panel.value = null
    highlightedId.value = id
    await nextTick()
    Array.from(messageArea.value?.querySelectorAll<HTMLElement>('[data-message-id]') || [])
      .find((el) => el.dataset.messageId === id)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  const drafts = reactive<Record<string, string>>({})
  const selecting = ref(false)
  const selectedIds = ref<string[]>([])
  const quoteId = ref('')
  const quotedMessage = computed(() => activeChat.value?.messages.find((msg) => msg.id === quoteId.value))
  const messageMenu = reactive({ show: false, x: 0, y: 0, id: '' })
  const messageMenuOptions = [
    { label: '回复', key: 'reply' },
    { label: '回复并 @AI', key: 'ai' },
    { label: '多选', key: 'select' },
    { type: 'divider', key: 'delete-divider' },
    { label: '删除', key: 'delete', props: { class: 'menu-item--danger' } }
  ]
  const dialog = useDialog()
  function openMessageMenu(event: MouseEvent, msg: LocalMessage) {
    if (msg.status !== 'done') return
    Object.assign(messageMenu, { show: true, x: event.clientX, y: event.clientY, id: msg.id })
  }
  function onMessageMenuSelect(key: string) {
    messageMenu.show = false
    const chat = activeChat.value
    const message = chat?.messages.find((msg) => msg.id === messageMenu.id && msg.status === 'done')
    if (!chat || !message) return
    if (key === 'delete') {
      dialog.warning({
        title: '删除聊天记录',
        content: '确定删除这条记录吗？此操作无法撤销。',
        positiveText: '删除',
        negativeText: '取消',
        showIcon: false,
        positiveButtonProps: { type: 'error' },
        onPositiveClick: () => {
          const index = chat.messages.findIndex((msg) => msg.id === message.id)
          if (index < 0) return
          const [deleted] = chat.messages.splice(index, 1)
          if (quoteId.value === deleted.id) quoteId.value = ''
          selectedIds.value = selectedIds.value.filter((id) => id !== deleted.id)
          if (!persist()) {
            chat.messages.splice(index, 0, deleted)
            return
          }
          notice.value = '聊天记录已删除。'
        }
      })
      return
    }
    if (key === 'select') {
      quoteId.value = ''
      selecting.value = true
      if (!selectedIds.value.includes(messageMenu.id)) selectedIds.value.push(messageMenu.id)
      return
    }
    selecting.value = false
    selectedIds.value = []
    quoteId.value = messageMenu.id
    if (key === 'ai' && !mentionsAi(drafts[chat.id] || '')) drafts[chat.id] = `@AI ${drafts[chat.id] || ''}`
    nextTick(() => input.value?.focus())
  }
  function toggleSelection() {
    selecting.value = !selecting.value
    selectedIds.value = []
    quoteId.value = ''
  }
  watch(
    () => data.selectedId,
    () => {
      selecting.value = false
      selectedIds.value = []
      quoteId.value = ''
      messageMenu.show = false
      panel.value = null
      highlightedId.value = ''
    }
  )
  function summarize() {
    if (!activeChat.value || !selectedIds.value.length) return
    if (!drafts[activeChat.value.id]?.trim())
      drafts[activeChat.value.id] = '@AI 请总结选中的聊天记录，列出主要结论、待办事项和未解决问题。'
    if (!mentionsAi(drafts[activeChat.value.id])) drafts[activeChat.value.id] = `@AI ${drafts[activeChat.value.id]}`
    void send()
  }
  const busy = reactive<Record<string, boolean>>({})
  const requests = new Map<string, AbortController>()
  const config = reactive<AiConfig>({ ...DEFAULT_CONFIG })
  const apiKey = ref(localStorage.getItem(API_KEY_KEY) || '')
  const notice = ref('')
  const messageArea = ref<HTMLElement>()
  const input = ref<HTMLTextAreaElement>()
  watch(
    localChatTarget,
    async (target) => {
      if (!target) return
      if ('peerId' in target) {
        if (loadFailed.value || storageError.value) return
        const chat = ensureDirectConversation(data, target.peerId, target.peerName)
        selectChat(chat.id)
        localChatTarget.value = null
        await nextTick()
        input.value?.focus()
        return
      }
      if (!data.conversations.some((chat) => chat.id === target.chatId)) return
      selectChat(target.chatId)
      localChatTarget.value = null
      await nextTick()
      if (target.messageId) await locateMessage(target.messageId)
    },
    { immediate: true }
  )
  try {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) Object.assign(config, validateConfig(JSON.parse(saved)))
  } catch {
    notice.value = 'AI 配置无法读取，请重新填写；聊天记录不受影响。'
  }

  function persist() {
    if (loadFailed.value) return false
    try {
      saveChats(localStorage, data)
      storageError.value = ''
      return true
    } catch {
      storageError.value = '消息保存失败（可能存储空间已满）。当前内容仍在窗口中，请导出记录或重试保存后再关闭。'
      return false
    }
  }
  function retrySave() {
    persist()
  }
  function selectChat(id: string) {
    mentionOpen.value = false
    data.selectedId = id
    persist()
  }
  function createChat() {
    if (loadFailed.value || storageError.value) return
    const chat = newConversation(`本地会话 ${data.conversations.length + 1}`)
    data.conversations.push(chat)
    data.selectedId = chat.id
    persist()
  }
  const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })
  function mention() {
    if (!activeChat.value) return
    drafts[activeChat.value.id] = `@AI ${drafts[activeChat.value.id] || ''}`
    input.value?.focus()
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const textarea = event.target as HTMLTextAreaElement
      textarea.setRangeText('\n', textarea.selectionStart, textarea.selectionEnd, 'end')
      if (activeChat.value) drafts[activeChat.value.id] = textarea.value
      return
    }
    if (event.shiftKey || event.altKey) return
    event.preventDefault()
    void send()
  }
  function refreshGlobalAiSettings() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      Object.assign(config, saved ? validateConfig(JSON.parse(saved)) : DEFAULT_CONFIG)
      apiKey.value = localStorage.getItem(API_KEY_KEY) || ''
    } catch {
      Object.assign(config, DEFAULT_CONFIG)
      apiKey.value = ''
      notice.value = '全局 AI 设置无法读取，请到总设置 → AI 模型检查。'
    }
  }
  function onGlobalAiSettingsChanged(event: StorageEvent) {
    if (event.key === null || event.key === CONFIG_KEY || event.key === API_KEY_KEY) refreshGlobalAiSettings()
  }
  window.addEventListener('storage', onGlobalAiSettingsChanged)
  window.addEventListener('focus', refreshGlobalAiSettings)
  function friendlyError(error: unknown) {
    // Never expose raw transport errors: some providers echo request data or keys.
    if (
      error instanceof Error &&
      /^(模型接口|接口路径|请求过于|接口没有|请输入|云端接口|请填写|上下文|接口地址|找不到)/.test(error.message)
    )
      return error.message
    return '无法连接模型服务，请检查网络、接口地址和模型名称。'
  }
  async function send() {
    const chat = activeChat.value
    const text = chat && drafts[chat.id]?.trim()
    if (!chat || !text || loadFailed.value || storageError.value) return
    const rag = ragQuestion(text)
    const ask = rag !== null || mentionsAi(text)
    if (rag !== null && !rag) {
      notice.value = '请在 @AI RAG助手 后输入制度问题。'
      return
    }
    let recipients
    try {
      recipients = ask && rag === null ? mentionedRecipients(text, todoMembers.value) : undefined
    } catch (error) {
      notice.value = error instanceof Error ? error.message : '请重新选择群成员'
      return
    }
    let todoCommand
    try {
      todoCommand =
        rag === null && !selecting.value && !quotedMessage.value ? parseAssignedCommand(text, todoMembers.value) : null
    } catch (error) {
      notice.value = error instanceof Error ? error.message : '待办内容无效。'
      return
    }
    if (ask) {
      if (busy[chat.id]) {
        notice.value = '此会话的 AI 正在回复，请等待或停止后再提问。'
        return
      }
      if (!text.replace(/@ai/gi, '').trim()) {
        notice.value = '请在 @AI 后输入问题。'
        return
      }
      try {
        if (!todoCommand && rag === null) {
          refreshGlobalAiSettings()
          validateConfig(config)
        }
      } catch {
        notice.value = '请先在总设置 → AI 模型中配置一次；所有会话共用。你的提问仍保留在输入框中。'
        return
      }
    }
    const msg: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
      status: 'done'
    }
    if (recipients) msg.todoRecipients = recipients
    if (rag !== null && pendingRagFollowup) {
      msg.ragFollowup = pendingRagFollowup
      pendingRagFollowup = undefined
    }
    if (quotedMessage.value) msg.quoteId = quotedMessage.value.id
    if (ask && rag === null && selecting.value) {
      const sources = chat.messages.filter((item) => selectedIds.value.includes(item.id) && item.status === 'done')
      if (!sources.length) {
        notice.value = '请先选择要总结的记录，或取消多选后普通提问。'
        return
      }
      msg.summarySourceIds = sources.map((item) => item.id)
    }
    chat.messages.push(msg)
    if (!persist()) {
      chat.messages.pop()
      return
    }
    drafts[chat.id] = ''
    mentionOpen.value = false
    notice.value = ''
    quoteId.value = ''
    if (msg.summarySourceIds) {
      selecting.value = false
      selectedIds.value = []
    }
    if (todoCommand) {
      try {
        const todos = addAssignedTodos(
          todoCommand.draft,
          todoCommand.recipients,
          `${msg.id}:command`,
          chat.id,
          chat.name
        )
        const todo = todos[0]
        chat.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `已添加到待办：${todo.title}\n分配给：${todos.map((t) => t.assigneeName).join('、')}（仅本机演示，不向其他人发送）\n${todo.dueAt ? `结束时间：${new Date(todo.dueAt).toLocaleString()}（默认届时提醒）` : '未识别到明确的未来结束时间，已保存为无时间待办，请在左侧“待办事项”中设置。'}`,
          createdAt: new Date().toISOString(),
          status: 'done',
          replyTo: msg.id
        })
        persist()
      } catch (error) {
        notice.value = error instanceof Error ? error.message : '待办保存失败，请重试。'
      }
    } else if (ask) await runAi(chat.id, msg.id)
  }
  async function runAi(chatId: string, requestId: string, existing?: LocalMessage) {
    const chat = data.conversations.find((item) => item.id === chatId)
    if (!chat || busy[chatId]) return
    const request = chat.messages.find((item) => item.id === requestId)
    const question = request ? ragQuestion(request.text) : null
    const answer: LocalMessage = existing || {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: '',
      createdAt: new Date().toISOString(),
      status: 'pending',
      replyTo: requestId
    }
    if (!existing) chat.messages.push(answer)
    // Retrieve the reactive proxy so completion updates render even after switching conversations.
    const target = chat.messages.find((item) => item.id === answer.id)!
    if (question !== null) target.assistant = 'ragflow'
    target.status = 'pending'
    target.error = undefined
    target.text = ''
    if (!persist()) {
      target.status = 'error'
      target.error = '保存失败，未调用模型。'
      return
    }
    const controller = new AbortController()
    requests.set(chatId, controller)
    busy[chatId] = true
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 120000)
    try {
      if (question !== null) {
        const result =
          answerFromContactKnowledge(question) ?? (await requestRag(question, controller.signal, request?.ragFollowup))
        if (controller.signal.aborted) throw new Error('cancelled')
        target.text = result.text
        target.rag = result
        target.status = 'done'
        if (chat.notifications !== false) notice.value = `「${chat.name}」知识助手回复已完成。`
        return
      }
      target.text = await requestAi(
        { ...config },
        apiKey.value,
        [
          ...buildContext(chat, requestId, config.contextCount),
          todoPrompt(new Date(), chat.members || [{ id: 'self', name: '我', kind: 'self' }])
        ],
        controller.signal
      )
      if (controller.signal.aborted) throw new Error('cancelled')
      const extracted = parseTodoSuggestions(target.text)
      target.text = extracted.text
      target.todoSuggestions = extracted.suggestions
      target.todoRecipients = chat.messages.find((m) => m.id === requestId)?.todoRecipients
      target.status = 'done'
      if (chat.notifications !== false) notice.value = `「${chat.name}」AI 回复已完成。`
    } catch (error) {
      target.status = 'error'
      target.error = controller.signal.aborted
        ? timedOut
          ? '请求超时，请稍后重试。'
          : '已停止，可以重试。'
        : question !== null
          ? error instanceof Error && error.message.startsWith('RAGFlow：')
            ? error.message
            : 'RAGFlow：连接失败，请检查应用中心的地址和服务状态。'
          : friendlyError(error)
    } finally {
      clearTimeout(timer)
      requests.delete(chatId)
      busy[chatId] = false
      persist()
    }
  }
  function retry(msg: LocalMessage) {
    if (activeChat.value && msg.replyTo) void runAi(activeChat.value.id, msg.replyTo, msg)
  }
  function cancel(id: string) {
    requests.get(id)?.abort()
  }
  async function exportChats() {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const path = await save({ defaultPath: 'EM-聊天记录.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
      if (!path) return
      await writeTextFile(path, loadFailed.value ? localStorage.getItem(CHAT_KEY) || '' : JSON.stringify(data, null, 2))
      notice.value = '聊天记录已导出。'
    } catch {
      notice.value = '导出失败，请检查文件路径和写入权限。'
    }
  }
  watch(
    () => [
      data.selectedId,
      activeChat.value?.messages.length,
      activeChat.value?.messages[activeChat.value.messages.length - 1]?.status
    ],
    async () => {
      await nextTick()
      messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight })
    },
    { immediate: true }
  )
  onBeforeUnmount(() => {
    requests.forEach((controller) => controller.abort())
    apiKey.value = ''
    window.removeEventListener('focus', refreshGlobalAiSettings)
    window.removeEventListener('storage', onGlobalAiSettingsChanged)
  })
  if (!loadFailed.value) persist()
</script>

<style scoped>
  .rag-contact-cards {
    display: grid;
    gap: 10px;
    margin: 13px 0;
    max-width: 550px;
  }
  .rag-contact-card {
    display: flex;
    gap: 12px;
    padding: 15px;
    border: 1px solid #d7e6f7;
    border-radius: 12px;
    background: #f8fbff;
  }
  .rag-contact-card__avatar {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 9px;
    background: #6aa7e8;
  }
  .rag-contact-card__body {
    flex: 1;
    min-width: 0;
  }
  .rag-contact-card__body strong {
    display: block;
    color: #243b5a;
    font-size: 15px;
  }
  .rag-contact-card__body small {
    display: block;
    margin-top: 3px;
    color: #7889a0;
  }
  .rag-contact-card__body p {
    margin: 9px 0;
    color: #50637c;
    font-size: 12px;
    line-height: 1.6;
  }
  .rag-contact-card__actions {
    display: flex;
    gap: 8px;
  }
  .rag-contact-card__actions button {
    padding: 7px 10px;
    border: 1px solid #b8d5f5;
    border-radius: 6px;
    color: #276fbf;
    background: white;
    cursor: pointer;
    font-size: 12px;
  }
  .rag-contact-card__actions button:last-child {
    border-color: #347ad9;
    color: white;
    background: #347ad9;
  }
  .rag-clarification {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 12px 0;
    padding: 14px;
    border: 1px solid #cbdff8;
    border-radius: 12px;
    background: #f3f8ff;
    color: #29496d;
  }
  .rag-clarification > button {
    text-align: left;
    padding: 10px 12px;
    border: 1px solid #cbdff8;
    border-radius: 8px;
    background: white;
    color: #226db9;
    cursor: pointer;
  }
  .rag-clarification form {
    display: flex;
    gap: 8px;
  }
  .rag-clarification input {
    flex: 1;
    min-width: 0;
    padding: 9px;
    border: 1px solid #cbdff8;
    border-radius: 8px;
    background: white;
    color: #29496d;
  }
  .rag-clarification form button {
    border: 0;
    border-radius: 8px;
    padding: 8px 12px;
    background: #2784ed;
    color: white;
    cursor: pointer;
  }
  .rag-clarification button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .mention-composer {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .mention-composer textarea {
    width: 100%;
  }
  .mention-popup {
    position: absolute;
    bottom: 100%;
    left: 12px;
    z-index: 50;
    width: 260px;
    max-height: 240px;
    overflow: auto;
    background: white;
    color: #24354b;
    border: 1px solid #dce6f2;
    border-radius: 8px;
    box-shadow: 0 5px 20px #24354b22;
    padding: 5px;
  }
  .mention-popup button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 9px;
    border: 0;
    background: white;
    color: #24354b;
    cursor: pointer;
  }
  .mention-popup button.selected,
  .mention-popup button:hover {
    background: #e5f0ff;
  }
  .mention-popup small {
    color: #718198;
  }
  .group-create {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #f0f5fc;
  }
  .group-create input,
  .todo-followups select {
    padding: 7px;
    border: 1px solid #dce6f2;
    border-radius: 5px;
    background: white;
    color: #24354b;
  }
  .todo-followups select {
    display: block;
    width: 100%;
    min-height: 80px;
  }
  .todo-followups {
    margin-top: 10px;
    padding: 14px;
    border: 1px solid #dce6f2;
    border-radius: 10px;
    background: #f5f9ff;
    color: #24354b;
    max-width: 520px;
  }
  .todo-followups > div {
    border-top: 1px solid #e3ebf5;
    margin-top: 10px;
    padding-top: 8px;
  }
  .todo-followups p {
    margin: 4px 0;
    white-space: pre-wrap;
  }
  .todo-followups small,
  .todo-followups span {
    display: block;
    color: #66788f;
    margin: 6px 0;
  }
  .todo-followups button {
    padding: 6px 10px;
    margin: 6px 8px 0 0;
    border: 1px solid #b9d5f5;
    border-radius: 5px;
    background: white;
    color: #1769c6;
    cursor: pointer;
  }
  .session {
    position: relative;
  }
  .chat-title {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  .chat-title strong {
    font-size: 18px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chat-header {
    background: #f7f7f7;
    flex-wrap: nowrap;
  }
  .header-icons {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }
  .header-icons button {
    border: 0;
    background: transparent;
    padding: 6px;
    color: #929292;
  }
  .header-icons svg {
    width: 25px;
    height: 25px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .message.highlighted .bubble {
    outline: 2px solid #56b6ee;
  }
  .members-panel {
    padding: 12px 20px;
    border-bottom: 1px solid #e4e8ed;
    max-height: 180px;
    overflow: auto;
    flex-shrink: 0;
  }
  .member-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
  }
  .member-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    min-width: 52px;
    font-size: 12px;
  }
  .members-panel p {
    color: #8b98a6;
    font-size: 11px;
    margin: 10px 0 0;
  }
  header {
    gap: 10px;
    flex-wrap: wrap;
  }
  header .actions {
    flex-wrap: wrap;
  }
  .quote-draft {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 18px;
    background: #edf5fc;
    font-size: 12px;
    color: #617b91;
  }
  .quote-draft span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .quote-saved {
    margin: 6px 0;
    padding: 6px 10px;
    border-left: 3px solid #8bbce7;
    font-size: 12px;
    color: #65788a;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 100px;
    overflow: auto;
  }
  .selection-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 16px;
    background: #eaf5ff;
    font-size: 12px;
  }
  .message input[type='checkbox'] {
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    margin-top: 12px;
    accent-color: #2f92ed;
    cursor: pointer;
  }
  .source-records {
    margin-top: 8px;
    font-size: 12px;
    color: #667a8f;
    max-height: 220px;
    overflow: auto;
  }
  .source-records summary {
    cursor: pointer;
  }
  .source-records p {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 8px 0;
  }
  .local-chat {
    display: flex;
    width: 100%;
    height: 100%;
    color: #354456;
    background: #fff;
    font:
      14px 'Microsoft YaHei',
      sans-serif;
  }
  button,
  input,
  textarea {
    font: inherit;
  }
  button {
    cursor: pointer;
    border: 1px solid #dce4eb;
    border-radius: 4px;
    padding: 7px 12px;
    color: #45617c;
    background: #fff;
  }
  button:hover {
    background: #edf6ff;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    color: white;
    background: #2f92ed;
    border-color: #2f92ed;
  }
  .primary:hover {
    background: #217ed3;
  }
  .conversations {
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid #e4e8ed;
    overflow: auto;
  }
  .list-head {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #edf0f3;
  }
  .conversation {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 0;
    border-bottom: 1px solid #edf0f3;
    border-radius: 0;
    width: 100%;
    padding: 18px 15px;
    text-align: left;
  }
  .conversation.selected {
    background: #e8f1f9;
    box-shadow: inset 3px 0 #2f92ed;
  }
  .avatar {
    display: grid;
    place-items: center;
    flex: 0 0 38px;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    color: white;
    background: #2f92ed;
  }
  .avatar--solid {
    background: #6aa7e8;
  }
  .summary {
    min-width: 0;
  }
  .summary strong,
  .summary small {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  small {
    font-size: 11px;
    color: #8b98a6;
  }
  .summary small {
    margin-top: 8px;
  }
  .local-note {
    margin: 20px;
    color: #94a0ac;
    font-size: 12px;
    line-height: 1.8;
  }
  .session {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  header {
    flex-shrink: 0;
    min-height: 65px;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e4e8ed;
  }
  header small {
    display: block;
    margin-top: 6px;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .messages {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 25px;
    background: #f4f6f8;
  }
  .empty {
    margin: auto;
    padding: 45px 20px;
    text-align: center;
    color: #8090a1;
    line-height: 1.8;
  }
  .empty p {
    margin: 16px 0;
  }
  .message {
    display: flex;
    gap: 10px;
    margin-bottom: 22px;
  }
  .message.user {
    flex-direction: row-reverse;
  }
  .bubble-wrap {
    max-width: 80%;
    min-width: 0;
  }
  .user .bubble-wrap > small {
    display: block;
    text-align: right;
  }
  .bubble {
    margin: 6px 0 0;
    padding: 12px 15px;
    border: 1px solid #e1e7ed;
    border-radius: 9px;
    background: white;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.7;
    user-select: text;
  }
  .user .bubble {
    background: #cfebff;
    border-color: #bbdef8;
  }
  .message-error {
    color: #b14d48;
    font-size: 12px;
    margin-top: 8px;
  }
  .message-error button {
    margin-left: 8px;
  }
  footer {
    height: 185px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #e4e8ed;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 18px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .assistant-shortcut {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    border: 1px solid #b5d2ef;
    border-radius: 6px;
    background: #eef6ff;
    color: #2168a8;
    cursor: pointer;
    white-space: nowrap;
  }
  .assistant-shortcut small {
    font-size: 11px;
    opacity: 0.8;
  }
  .rag-shortcut {
    background: #edf8f3;
    color: #23795d;
    border-color: #a5d2c0;
  }
  .tools span,
  .send-row span {
    color: #94a0ad;
    font-size: 11px;
  }
  textarea {
    resize: none;
    flex: 1;
    min-height: 30px;
    border: 0;
    outline: 0;
    padding: 5px 20px;
    background: white;
    color: #354456;
  }
  .send-row {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
    padding: 8px 18px;
  }
  .notice,
  .error {
    padding: 10px 18px;
    background: #eef7ff;
    color: #45779f;
    font-size: 12px;
  }
  .error {
    color: #ac4039;
    background: #fff0ee;
  }
  .notice button,
  .error button {
    margin-left: 8px;
    padding: 2px 7px;
  }
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: #142b4b66;
    display: grid;
    place-items: center;
    z-index: 1000;
  }
  .settings {
    width: 480px;
    max-height: 90vh;
    overflow: auto;
    padding: 26px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 16px 60px #1234;
  }
  .settings h2 {
    margin: 0 0 12px;
    font-size: 20px;
  }
  .settings > p {
    line-height: 1.7;
    margin: 12px 0;
    color: #738498;
  }
  .settings label {
    display: block;
    margin: 16px 0;
  }
  .settings input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    margin-top: 8px;
    padding: 10px;
    border: 1px solid #d5dfe9;
    border-radius: 4px;
    background: #fff;
    color: #354456;
  }
  .settings-help {
    font-size: 12px;
  }
</style>
