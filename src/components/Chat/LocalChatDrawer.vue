<template>
  <aside class="chat-drawer" aria-label="聊天侧面板" @keydown.esc="$emit('close')">
    <div class="drawer-head">
      <span>{{ title }}</span>
      <button aria-label="关闭面板" @click="$emit('close')">×</button>
    </div>
    <div class="drawer-content">
      <template v-if="mode === 'settings'">
        <div class="group-profile">
          <span class="group-avatar">{{ chat.name.slice(0, 1) }}</span>
          <strong>{{ chat.name }}</strong>
        </div>
        <div class="members-head">
          <span>群成员 {{ members.length }} 人</span>
          <div>
            <button aria-label="添加本地模拟成员" @click="adding = !adding">＋</button>
            <button aria-label="搜索群成员" @click="searching = !searching">⌕</button>
          </div>
        </div>
        <input v-if="searching" v-model="memberQuery" aria-label="搜索成员姓名" placeholder="搜索成员姓名" />
        <form v-if="adding" class="inline-form" @submit.prevent="addMember">
          <input v-model="newName" aria-label="模拟成员姓名" placeholder="模拟成员姓名" maxlength="30" required />
          <button>添加</button>
        </form>
        <div class="member-grid">
          <div v-for="member in visibleMembers" :key="member.id" class="member-card">
            <span class="member-avatar" :style="{ background: member.color }">
              {{ member.kind === 'ai' ? 'AI' : member.name.slice(0, 1) }}
              <i v-if="member.kind === 'self'">群主</i>
            </span>
            <span :title="member.name">{{ member.name }}</span>
            <button
              v-if="manage && member.kind === 'simulated'"
              :aria-label="`移除成员 ${member.name}`"
              @click="removeId = member.id">
              移除
            </button>
          </div>
        </div>
        <div v-if="removeId" class="edit-block" role="alert">
          <p>
            确认移除
            {{ members.find((m) => m.id === removeId)?.name }}？历史消息和已分配待办保留，今后不再参与全体分配。
          </p>
          <button @click="removeMember">确认移除</button>
          <button @click="removeId = ''">取消</button>
        </div>
        <button v-if="filteredMembers.length > 10" class="load-more" @click="expanded = !expanded">
          {{ expanded ? '收起' : '加载更多' }}
        </button>
        <button class="setting-row" @click="manage = !manage">
          群管理
          <span>›</span>
        </button>
        <form v-if="manage" class="edit-block" @submit.prevent="rename">
          <label>
            群名称
            <input v-model="nameDraft" maxlength="60" required />
          </label>
          <button>保存群名称</button>
          <p>本地群管理，不同步到其他设备。</p>
        </form>
        <button class="setting-row" @click="share">
          分享
          <span>›</span>
        </button>
        <label class="setting-row">
          允许消息通知
          <input
            class="switch"
            type="checkbox"
            role="switch"
            :checked="chat.notifications !== false"
            @change="setPreference('notifications', $event)" />
        </label>
        <label class="setting-row">
          置顶会话
          <input
            class="switch"
            type="checkbox"
            role="switch"
            :checked="!!chat.pinned"
            @change="setPreference('pinned', $event)" />
        </label>
        <button class="setting-row" @click="$emit('export')">
          导出聊天记录
          <span>›</span>
        </button>
        <p class="hint">
          本地测试群：成员为模拟成员；分享仅复制群信息，不生成入群邀请。消息通知仅提示本机 AI 回复完成。
        </p>
      </template>
      <template v-else-if="mode === 'announcement'">
        <p class="hint">群通知保存在此电脑，不会推送给其他真人。</p>
        <p class="announcement">{{ chat.announcement || '暂无群通知' }}</p>
        <form class="edit-block" @submit.prevent="saveAnnouncement">
          <label>
            编辑群通知
            <textarea v-model="announcementDraft" maxlength="5000" placeholder="填写群通知内容" />
          </label>
          <button>保存群通知</button>
        </form>
      </template>
      <template v-else>
        <input v-model="query" aria-label="搜索消息记录" placeholder="搜索消息内容或发言人" />
        <label class="date-filter">
          日期
          <input v-model="date" type="date" aria-label="筛选消息日期" />
        </label>
        <p class="hint">共 {{ history.length }} 条记录 · 点击定位原消息</p>
        <button v-for="msg in history" :key="msg.id" class="history-item" @click="$emit('locate', msg.id)">
          <small>{{ messageSender(chat, msg).name }} · {{ new Date(msg.createdAt).toLocaleString('zh-CN') }}</small>
          <p>{{ msg.text || msg.error || 'AI 正在思考…' }}</p>
        </button>
        <p v-if="!history.length" class="hint">没有匹配的消息</p>
      </template>
      <p v-if="feedback" role="status" class="hint">{{ feedback }}</p>
    </div>
  </aside>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { messageSender, type LocalConversation } from '@/services/localChat'
  const props = defineProps<{ chat: LocalConversation; mode: 'settings' | 'announcement' | 'history' }>()
  const emit = defineEmits<{ close: []; save: []; export: []; locate: [id: string] }>()
  function setPreference(key: 'notifications' | 'pinned', event: Event) {
    const checked = (event.target as HTMLInputElement).checked
    if (key === 'notifications') props.chat.notifications = checked
    else props.chat.pinned = checked
    emit('save')
  }
  function saveAnnouncement() {
    props.chat.announcement = announcementDraft.value.trim()
    emit('save')
    feedback.value = '群通知已保存'
  }
  const title = computed(() => ({ settings: '设置', announcement: '群通知', history: '消息记录' })[props.mode])
  const members = computed(
    () =>
      props.chat.members ?? [
        messageSender(props.chat, { role: 'user' } as any),
        messageSender(props.chat, { role: 'assistant' } as any)
      ]
  )
  const searching = ref(false),
    adding = ref(false),
    expanded = ref(false),
    manage = ref(false)
  const memberQuery = ref(''),
    newName = ref(''),
    query = ref(''),
    date = ref(''),
    feedback = ref('')
  const removeId = ref('')
  function removeMember() {
    const member = members.value.find((m) => m.id === removeId.value && m.kind === 'simulated')
    if (!member) return
    props.chat.archivedMembers = [...(props.chat.archivedMembers || []), member]
    props.chat.members = members.value.filter((m) => m.id !== member.id)
    removeId.value = ''
    emit('save')
    feedback.value = '已移除本地模拟成员；历史消息和待办保留。'
  }
  const nameDraft = ref(props.chat.name),
    announcementDraft = ref(props.chat.announcement || '')
  const filteredMembers = computed(() =>
    members.value.filter((m) => m.name.toLowerCase().includes(memberQuery.value.trim().toLowerCase()))
  )
  const visibleMembers = computed(() => (expanded.value ? filteredMembers.value : filteredMembers.value.slice(0, 10)))
  const history = computed(() =>
    props.chat.messages
      .filter((m) => {
        const time = new Date(m.createdAt)
        const localDate = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`
        return (
          (!date.value || localDate === date.value) &&
          `${m.text} ${messageSender(props.chat, m).name}`.toLowerCase().includes(query.value.trim().toLowerCase())
        )
      })
      .slice()
      .reverse()
  )
  function addMember() {
    const name = newName.value.trim()
    if (!name) return
    if (/[\s@]/.test(name) || ['我', '自己', '全体成员', 'AI'].includes(name)) {
      feedback.value = '成员名不能含空格或 @，也不能使用系统保留名称。'
      return
    }
    if (members.value.some((m) => m.name === name)) {
      feedback.value = '该成员名称已存在'
      return
    }
    props.chat.members = [...members.value, { id: crypto.randomUUID(), name, color: '#5b9fbb', kind: 'simulated' }]
    emit('save')
    newName.value = ''
    feedback.value = '已添加本地模拟成员'
    expanded.value = true
  }
  function rename() {
    if (nameDraft.value.trim()) {
      props.chat.name = nameDraft.value.trim()
      emit('save')
      feedback.value = '群名称已保存'
    }
  }
  async function share() {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
      await writeText(
        `本地群：${props.chat.name}\n成员：${members.value.map((m) => m.name).join('、')}\n仅本机演示，不是入群邀请链接。`
      )
      feedback.value = '已复制群信息'
    } catch {
      feedback.value = '复制失败，请检查剪贴板权限'
    }
  }
</script>
<style scoped>
  .chat-drawer {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 440px;
    max-width: 100%;
    z-index: 20;
    background: #fff;
    box-shadow: -4px 0 14px #00000014;
    display: flex;
    flex-direction: column;
    color: #555;
  }
  .drawer-head {
    height: 65px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    border-bottom: 1px solid #eee;
    font-size: 17px;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    background: white;
    border: 0;
  }
  button:hover {
    background: #f4f8fb;
  }
  .drawer-head button {
    font-size: 28px;
    color: #999;
  }
  .drawer-content {
    padding: 0 24px 24px;
    overflow: auto;
    flex: 1;
  }
  .group-profile {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 28px 0;
    border-bottom: 1px solid #eee;
    font-size: 18px;
  }
  .group-profile strong {
    overflow-wrap: anywhere;
  }
  .group-avatar {
    display: grid;
    place-items: center;
    background: #1aa6ed;
    color: #fff;
    border-radius: 50%;
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    font-size: 28px;
  }
  .members-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0;
    font-size: 16px;
  }
  .members-head button {
    font-size: 25px;
    color: #999;
    margin-left: 8px;
  }
  .member-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 22px 10px;
    padding: 8px 0 22px;
  }
  .member-card {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    font-size: 12px;
  }
  .member-card > span:last-child {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .member-avatar {
    position: relative;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    color: #fff;
    font-size: 18px;
  }
  .member-avatar i {
    position: absolute;
    right: -9px;
    top: -5px;
    background: #fff0d8;
    color: #d9a04e;
    font: 10px sans-serif;
    padding: 2px;
    border-radius: 3px;
  }
  .load-more {
    display: block;
    margin: 0 auto 20px;
    color: #29a5e5;
  }
  .setting-row {
    box-sizing: border-box;
    width: 100%;
    min-height: 66px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #eee;
    font-size: 16px;
    text-align: left;
  }
  .setting-row span {
    font-size: 28px;
    color: #aaa;
  }
  input:not(.switch),
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font: inherit;
    color: #555;
    background: white;
    margin: 8px 0;
  }
  .switch {
    appearance: none;
    width: 44px;
    height: 24px;
    border-radius: 20px;
    background: #ccc;
    position: relative;
    cursor: pointer;
  }
  .switch:checked {
    background: #159eff;
  }
  .switch:after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.15s;
  }
  .switch:checked:after {
    transform: translateX(20px);
  }
  .hint {
    font-size: 12px;
    color: #999;
    line-height: 1.8;
    margin: 16px 0;
  }
  .inline-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .edit-block {
    padding: 15px 0;
  }
  .edit-block button {
    padding: 8px 12px;
    background: #159eff;
    color: white;
    border-radius: 3px;
  }
  .edit-block p {
    font-size: 12px;
    color: #999;
  }
  .edit-block textarea {
    height: 150px;
    resize: vertical;
  }
  .announcement {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.8;
  }
  .date-filter {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .date-filter input {
    flex: 1;
  }
  .history-item {
    display: block;
    width: 100%;
    text-align: left;
    border-bottom: 1px solid #eee;
    padding: 14px 0;
  }
  .history-item small {
    color: #999;
    font-size: 11px;
  }
  .history-item p {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.7;
    margin: 8px 0;
    max-height: 160px;
    overflow: auto;
  }
</style>
