import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '../src/services/i18n'

const pinia = createPinia()
setActivePinia(pinia)
const { default: View } = new URLSearchParams(location.search).get('view') === 'model'
  ? await import('../src/views/SetWindow/pages/ai-model.vue')
  : await import('../src/views/feedbackWindow/index.vue')
createApp(View).use(pinia).use(i18n).mount('#app')
