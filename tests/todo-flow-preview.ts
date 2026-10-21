import { createApp, defineComponent, h, onBeforeUnmount, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { NDialogProvider } from 'naive-ui'
const pinia = createPinia()
setActivePinia(pinia)
const { default: LocalChat } = await import('../src/components/Chat/LocalChat.vue')
const { default: Todos } = await import('../src/views/homeWindow/pages/todos.vue')
const { startTodoReminders, todoState } = await import('../src/stores/localTodos')
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Todos }] })
await router.push('/')
await router.isReady()

const App = defineComponent({
  setup() {
    const tab = ref<'chat' | 'todos'>('chat')
    const stopReminders = startTodoReminders()
    onBeforeUnmount(stopReminders)
    return () =>
      h('div', { style: 'height: 100vh; display: flex; flex-direction: column' }, [
        h('nav', { style: 'padding: 8px; display: flex; gap: 8px' }, [
          h('button', { 'aria-label': '测试切换到对话', onClick: () => (tab.value = 'chat') }, '对话'),
          h('button', { 'aria-label': '测试切换到待办', onClick: () => (tab.value = 'todos') }, '待办事项')
        ]),
        todoState.alert ? h('div', { role: 'alert' }, todoState.alert) : null,
        h('div', { style: { flex: '1', minHeight: '0', display: tab.value === 'chat' ? '' : 'none' } }, [h(LocalChat)]),
        h('div', { style: { flex: '1', minHeight: '0', display: tab.value === 'todos' ? '' : 'none' } }, [h(Todos)])
      ])
  }
})

createApp({ render: () => h(NDialogProvider, null, { default: () => h(App) }) })
  .use(pinia)
  .use(router)
  .mount('#app')
