<template>
  <section class="todos-page">
    <header><div><h1>待办事项</h1><p v-if="view === 'received'">本机保存 · {{ pending }} 项未完成 · {{ overdue }} 项已到期</p><p v-else>我发布给他人的 {{ published.length }} 项任务 · {{ published.filter(g => g.completed === g.total).length }} 项全部完成</p></div><button @click="enableNotifications">启用系统提醒</button></header>
    <nav class="view-switch" aria-label="待办视图"><button :class="{selected:view==='received'}" @click="setView('received')">接收的待办</button><button :class="{selected:view==='published'}" @click="setView('published')">我发布的</button></nav>
    <p class="hint">客户端运行时每 15 秒检查提醒；退出后不会后台提醒，下次启动补报。没有设置时间的事项仅保存，不提醒。</p>
    <label v-if="view === 'received'">查看接收人<select v-model="viewer" aria-label="查看待办接收人" @change="reset"><option value="self">我（默认）</option><option value="all">所有接收人 · 本机演示</option><option v-for="person in recipients" :key="person.id" :value="person.id">{{ person.name }} · 模拟成员</option></select></label>
    <p class="hint">仅本机分配演示，其他人不会收到。模拟成员的完成状态由你在此演示操作；系统提醒只提醒“我”。手动新增默认分配给自己。</p>
    <p v-if="todoState.error || error" role="alert">{{ todoState.error || error }}</p>
    <p v-if="todoState.systemNotice" role="status">{{ todoState.systemNotice }}</p>
    <form v-if="view === 'received'" @submit.prevent="save">
      <label>事项<input v-model="title" maxlength="500" required placeholder="例如：提交接口联调报告" aria-label="待办事项内容" /></label>
      <label>提醒时间（本机时区）<input v-model="date" type="datetime-local" aria-label="待办提醒时间" /></label>
      <button class="primary" :disabled="!!todoState.error">{{ editing ? '保存修改' : '添加待办' }}</button>
      <button v-if="editing" type="button" @click="reset">取消</button>
    </form>
    <nav><button v-for="item in filters" :key="item.value" :class="{selected: filter === item.value}" @click="filter = item.value">{{ item.label }}</button></nav>
    <template v-if="view === 'published'">
      <p class="hint">按发布任务汇总；未完成表示仍有人未完成。此处只查看进度，模拟操作请切换到“接收的待办”选择成员。</p>
      <p v-if="!visiblePublished.length" class="empty">暂无匹配的已发布任务。在群聊中使用 @AI @成员 把某事项加入待办，即可在这里跟踪。</p>
      <article v-for="group in visiblePublished" :key="group.id" class="published-task">
        <div class="published-heading"><strong>{{ group.title }}</strong><span>{{ group.completed === group.total ? '全部完成' : '进行中' }} · 已完成 {{ group.completed }}/{{ group.total }} 人</span></div>
        <small>来源：{{ group.sourceName || '本地会话' }} · 发布：{{ new Date(group.createdAt).toLocaleString() }}</small>
        <progress :value="group.completed" :max="group.total" :aria-label="`${group.title}完成进度`" />
        <div v-for="recipient in group.items" :key="recipient.id" class="recipient-progress">
          <span>{{ recipient.assigneeName || '我' }}{{ recipient.assigneeId !== 'self' ? ' · 模拟成员' : '' }}</span>
          <span :class="{finished:recipient.completed,overdue:!recipient.completed && !!recipient.dueAt && Date.parse(recipient.dueAt)<=now}">{{ recipient.completed ? '已完成' : (recipient.dueAt && Date.parse(recipient.dueAt)<=now ? '已到期 · 未完成' : '未完成') }}</span>
          <small v-if="recipient.completed && recipient.completedAt">完成于 {{ new Date(recipient.completedAt).toLocaleString() }}</small>
          <small v-else-if="recipient.dueAt">提醒：{{ new Date(recipient.dueAt).toLocaleString() }}</small>
        </div>
      </article>
    </template>
    <template v-else>
    <p v-if="!visible.length" class="empty">暂无{{ filter === 'done' ? '已完成' : '' }}事项。也可以在聊天中输入“@AI 把明天下午3点提交报告加入待办”。</p>
    <article v-for="item in visible" :key="item.id" :class="{done:item.completed}">
      <input type="checkbox" :checked="item.completed" :aria-label="`完成：${item.title}`" @change="toggle(item)" />
      <div class="content"><strong>{{ item.title }}</strong><small>接收人：{{ item.assigneeName || '我' }}{{ item.assigneeId && item.assigneeId !== 'self' ? '（本机模拟）' : '' }}</small><small :class="{overdue: !item.completed && !!item.dueAt && Date.parse(item.dueAt) <= now}">{{ item.dueAt ? `提醒：${new Date(item.dueAt).toLocaleString()}` : '未设置提醒时间' }}</small><small v-if="item.sourceName">来源：{{ item.sourceName }}</small></div>
      <button v-if="!item.completed" @click="snooze(item)">10 分钟后提醒</button><button @click="edit(item)">编辑</button>
    </article>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { todoState, initTodos, addTodo, updateTodo } from '@/stores/localTodos'
import { publishedTodos, type LocalTodo } from '@/services/localTodos'
import { ensureNotificationPermission } from '@/utils/desktop/notification'
defineOptions({ name: 'todos' })
initTodos()
const title = ref(''), date = ref(''), editing = ref(''), error = ref(''), filter = ref('pending'), now = ref(Date.now())
const viewer = ref('self')
const view = ref<'received'|'published'>('received')
const published = computed(() => publishedTodos(todoState.items))
const visiblePublished = computed(() => published.value.filter(g => filter.value === 'all' || (g.completed === g.total) === (filter.value === 'done')))
function setView(next: 'received'|'published') { view.value = next; filter.value = next === 'published' ? 'all' : 'pending'; reset() }
const recipients = computed(() => [...new Map(todoState.items.filter(t => t.assigneeId && t.assigneeId !== 'self').map(t => [t.assigneeId!, { id: t.assigneeId!, name: t.assigneeName || t.assigneeId! }])).values()])
const scopedItems = computed(() => todoState.items.filter(t => viewer.value === 'all' || (t.assigneeId || 'self') === viewer.value))
const timer = setInterval(() => { now.value = Date.now() }, 15000)
onBeforeUnmount(() => clearInterval(timer))
const filters = [{value:'pending',label:'未完成'},{value:'done',label:'已完成'},{value:'all',label:'全部'}]
const pending = computed(() => scopedItems.value.filter(t => !t.completed).length)
const overdue = computed(() => scopedItems.value.filter(t => !t.completed && t.dueAt && Date.parse(t.dueAt) <= now.value).length)
const visible = computed(() => scopedItems.value.filter(t => filter.value === 'all' || t.completed === (filter.value === 'done')).slice().sort((a,b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity)))
function attempt(action: () => void) { try { action(); error.value = '' } catch(e) { error.value = e instanceof Error ? e.message : '保存失败，请检查本机存储。' } }
function reset() { title.value = ''; date.value = ''; editing.value = '' }
function save() { attempt(() => { const draft = { title: title.value, dueAt: date.value ? new Date(date.value).toISOString() : undefined }; if(editing.value) updateTodo(editing.value, {...draft, remindedAt:undefined}); else addTodo(draft); reset() }) }
function edit(item: LocalTodo) { title.value=item.title; editing.value=item.id; if(item.dueAt) { const d=new Date(item.dueAt); date.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16) } else date.value='' }
function toggle(item: LocalTodo) { attempt(() => updateTodo(item.id,{completed:!item.completed, remindedAt: item.completed ? undefined : item.remindedAt})) }
function snooze(item: LocalTodo) { attempt(() => updateTodo(item.id,{dueAt:new Date(Date.now()+600000).toISOString(),remindedAt:undefined})) }
async function enableNotifications() { const granted=await ensureNotificationPermission(); todoState.systemNotice=granted?'系统提醒已启用。':'未获得系统通知权限，仍会显示软件内提醒。' }
</script>
<style scoped>
.view-switch{margin-top:16px}.published-task{display:flex;flex-direction:column;align-items:stretch;gap:10px}.published-heading{display:flex;justify-content:space-between;gap:16px}.published-heading span{font-size:12px;color:#1769c6}.published-task progress{width:100%;height:8px;accent-color:#2685ed}.recipient-progress{display:flex;align-items:center;gap:16px;padding:10px 0;border-top:1px solid #edf3fb;font-size:13px}.recipient-progress>span:first-child{flex:1}.recipient-progress .finished{color:#168360}
.todos-page{height:100%;overflow:auto;box-sizing:border-box;padding:24px;background:#f6f9fe;color:#24354b}header,form,article,nav{display:flex;gap:12px;align-items:center}header{justify-content:space-between}h1{margin:0;font-size:23px}p,.hint,small{color:#66788f;font-size:12px;line-height:1.7}form{margin:22px 0;background:#fff;padding:18px;border:1px solid #dce6f2;border-radius:12px;flex-wrap:wrap}label{display:flex;flex-direction:column;gap:6px;font-size:12px}label:first-child{flex:1;min-width:220px}input:not([type=checkbox]){padding:10px;border:1px solid #dce6f2;border-radius:7px;color:#24354b;background:white}button{padding:8px 12px;border:1px solid #dce6f2;border-radius:7px;background:white;color:#345678;cursor:pointer}.primary,.selected{background:#2685ed;color:white}nav{margin-bottom:16px}article{padding:16px;background:#fff;border:1px solid #dce6f2;border-radius:10px;margin-bottom:10px}.content{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;overflow-wrap:anywhere}.done strong{text-decoration:line-through;color:#718198}.overdue,[role=alert]{color:#c13c4b}.empty{padding:45px;text-align:center}button:focus-visible,input:focus-visible{outline:2px solid #2685ed;outline-offset:2px}
</style>
