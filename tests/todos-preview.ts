import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
const pinia = createPinia()
setActivePinia(pinia)
const fixtureContacts = localStorage.getItem('em.todo-test-contacts')
if (fixtureContacts) {
  const { useContactsStore } = await import('../src/stores/user/contacts')
  useContactsStore(pinia).setFriendList(JSON.parse(fixtureContacts))
}
const { default: Todos } = await import('../src/views/homeWindow/pages/todos.vue')
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Todos }] })
await router.push('/')
await router.isReady()
createApp(Todos).use(pinia).use(router).mount('#app')
