import { createApp, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { NDialogProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '../src/services/i18n'
const pinia = createPinia()
setActivePinia(pinia)
const { default: Chat } = await import('../src/components/Chat/LocalChat.vue')
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Chat }] })
await router.push('/')
await router.isReady()
createApp({
  render: () =>
    h(NDialogProvider, null, {
      default: () =>
        h(NMessageProvider, null, {
          default: () => h(NNotificationProvider, null, { default: () => h(Chat) })
        })
    })
})
  .use(pinia)
  .use(router)
  .use(i18n)
  .mount('#app')
