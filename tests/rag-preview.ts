import { createApp, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { NDialogProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'
import i18n from '../src/services/i18n'
const pinia = createPinia()
setActivePinia(pinia)
const { default: Chat } = await import('../src/components/Chat/LocalChat.vue')
createApp({
  render: () => h(NDialogProvider, null, {
    default: () => h(NMessageProvider, null, {
      default: () => h(NNotificationProvider, null, { default: () => h(Chat) })
    })
  })
}).use(pinia).use(i18n).mount('#app')
