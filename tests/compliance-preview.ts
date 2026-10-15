import { createApp, h, ref } from 'vue'
import ComplianceWorkbench from '../src/components/AI/ComplianceWorkbench.vue'
import { MODE_LABELS, type WorkMode } from '../src/services/compliance'
createApp({ setup() {
  const mode = ref<WorkMode>('policy')
  return () => h('div', {style:'height:100vh;display:flex;flex-direction:column;font-family:Microsoft YaHei,sans-serif'}, [
    h('nav', {style:'display:flex;gap:16px;padding:12px'}, Object.entries(MODE_LABELS).map(([key,label])=>h('button',{onClick:()=>mode.value=key as WorkMode},label))),
    h(ComplianceWorkbench,{mode:mode.value,style:'flex:1;min-height:0'})])
}}).mount('#app')
