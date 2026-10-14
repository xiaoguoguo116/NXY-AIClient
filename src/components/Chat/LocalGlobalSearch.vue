<template>
  <div class="global-search" @mousedown.stop @keydown.esc.stop="open = false">
    <svg viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </svg>
    <input
      v-model="query"
      aria-label="全局搜索"
      placeholder="搜索联系人、群组和应用"
      @focus="refresh"
      @input="refresh"
      @keydown.enter.prevent="choose(results[0])" />
    <button
      v-if="query"
      aria-label="清空搜索"
      @click="
        query = ''
        open = false
      ">
      ×
    </button>
    <div v-if="open && query.trim()" class="search-results">
      <p v-if="error" role="alert">{{ error }}</p>
      <button v-for="(item, index) in results" :key="index" @click="choose(item)">
        <small>{{ item.kind }}</small>
        <strong>{{ item.title }}</strong>
        <span>{{ item.detail }}</span>
      </button>
      <p v-if="!results.length && !error">没有找到匹配结果</p>
      <p>搜索本机群聊、模拟成员、消息和功能入口（最多显示 40 项）</p>
      <button class="close-search" @click="open = false">关闭搜索</button>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { loadChats, messageSender, type LocalConversation } from '@/services/localChat'
  import { localChatTarget } from '@/services/localChatNavigation'
  type Result = {
    kind: string
    title: string
    detail: string
    tab: 'message' | 'application' | 'ai'
    chatId?: string
    messageId?: string
  }
  const emit = defineEmits<{ navigate: [tab: 'message' | 'application' | 'ai'] }>()
  const query = ref(''),
    open = ref(false),
    error = ref('')
  const chats = ref<LocalConversation[]>([])
  function refresh() {
    open.value = true
    error.value = ''
    try {
      chats.value = loadChats(localStorage).conversations
    } catch {
      error.value = '本地记录无法读取，原始数据未修改。'
      chats.value = []
    }
  }
  const results = computed(() => {
    const q = query.value.trim().toLowerCase()
    if (!q) return []
    const matches: Result[] = []
    for (const [title, tab, detail] of [
      ['应用', 'application', '本地应用与插件管理'],
      ['AI Work', 'ai', 'AI 工作台']
    ] as const) {
      if (`${title} ${detail}`.toLowerCase().includes(q)) matches.push({ kind: '功能', title, tab, detail })
    }
    if ('ragflow 知识助手 追问'.includes(q))
      matches.push({
        kind: '应用',
        title: 'RAGFlow 知识助手',
        detail: '应用中心 · 升级版知识库与追问',
        tab: 'application'
      })
    for (const chat of chats.value) {
      if (chat.name.toLowerCase().includes(q))
        matches.push({
          kind: '会话',
          title: chat.name,
          detail: `${chat.messages.length} 条消息`,
          tab: 'message',
          chatId: chat.id
        })
      for (const member of chat.members || [])
        if (member.name.toLowerCase().includes(q))
          matches.push({ kind: '成员', title: member.name, detail: chat.name, tab: 'message', chatId: chat.id })
      for (const msg of chat.messages)
        if (msg.text.toLowerCase().includes(q))
          matches.push({
            kind: '消息',
            title: `${messageSender(chat, msg).name} · ${chat.name}`,
            detail: msg.text.slice(0, 160),
            tab: 'message',
            chatId: chat.id,
            messageId: msg.id
          })
    }
    return matches.slice(0, 40)
  })
  function choose(item?: Result) {
    if (!item) return
    if (item.chatId) localChatTarget.value = { chatId: item.chatId, messageId: item.messageId }
    emit('navigate', item.tab)
    open.value = false
  }
</script>
<style scoped>
  .global-search {
    position: relative;
    display: flex;
    align-items: center;
    gap: 9px;
    width: 310px;
    margin-left: 18px;
    pointer-events: auto;
    color: #9ba9b7;
  }
  svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    flex-shrink: 0;
  }
  input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    font:
      13px 'Microsoft YaHei',
      sans-serif;
    color: #42556b;
  }
  input::placeholder {
    color: #aab4c0;
  }
  button {
    border: 0;
    background: white;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  .search-results {
    position: absolute;
    top: 30px;
    left: 0;
    width: 430px;
    max-width: 70vw;
    max-height: 65vh;
    overflow: auto;
    z-index: 200;
    background: white;
    box-shadow: 0 6px 25px #1233;
    border: 1px solid #e3e9ef;
    border-radius: 6px;
    color: #40546b;
  }
  .search-results > button {
    display: block;
    text-align: left;
    width: 100%;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
  }
  .search-results > button:hover {
    background: #eff7ff;
  }
  small {
    color: #299ce4;
    margin-right: 10px;
  }
  strong {
    font-weight: 500;
  }
  span {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #8794a3;
    font-size: 12px;
    margin-top: 6px;
  }
  p {
    padding: 10px 16px;
    font-size: 12px;
    color: #8b98a6;
  }
  .close-search {
    text-align: center !important;
  }
</style>
