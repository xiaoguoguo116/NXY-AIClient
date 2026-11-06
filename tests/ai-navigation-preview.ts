import { createApp, defineComponent, h, KeepAlive } from 'vue'
import { createMemoryHistory, createRouter, RouterView, useRoute } from 'vue-router'
import { useAiWorkNavigation } from '../src/services/aiWorkNavigation'

const Ai = defineComponent({
  name: 'CachedAi',
  setup() {
    const { compareMode, selectSection } = useAiWorkNavigation()
    return () =>
      h('section', { id: 'ai' }, [
        h('span', compareMode.value ? 'compare' : 'tasks'),
        h('button', { onClick: () => selectSection('compare') }, 'compare')
      ])
  }
})
const Other = defineComponent({
  setup() {
    const route = useRoute()
    return () => h('section', { id: 'other' }, route.fullPath)
  }
})
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/home/ai', component: Ai },
    ...['todos', 'message', 'contacts', 'application', 'drive'].map((name) => ({
      path: `/home/${name}`,
      component: Other
    }))
  ]
})
const app = createApp({
  setup() {
    return () => h(RouterView, {}, { default: ({ Component }: any) => h(KeepAlive, {}, () => h(Component)) })
  }
})
app.use(router)
await router.push('/home/ai')
await router.isReady()
app.mount('#app')
Object.assign(window, { testRouter: router })
