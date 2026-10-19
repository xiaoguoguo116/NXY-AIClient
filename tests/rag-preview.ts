import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
const pinia = createPinia()
setActivePinia(pinia)
const { default: Chat } = await import('../src/components/Chat/LocalChat.vue')
createApp(Chat).use(pinia).mount('#app')
