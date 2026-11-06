import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useAiWorkNavigation() {
  const route = useRoute(),
    router = useRouter()
  const compareMode = computed(() => route.path === '/home/ai' && route.query.view === 'compare')
  function selectSection(view: 'tasks' | 'compare') {
    if (route.path !== '/home/ai' || route.query.view !== view) {
      void router.replace({ path: '/home/ai', query: { view } })
    }
  }
  // KeepAlive retains watchers after deactivation. Normalize only our own route;
  // other modules may also use a query parameter named "view".
  watch(
    () => [route.path, route.query.view] as const,
    ([path, view]) => {
      if (path === '/home/ai' && view !== 'tasks' && view !== 'compare') selectSection('tasks')
    },
    { immediate: true }
  )
  return { compareMode, selectSection }
}
