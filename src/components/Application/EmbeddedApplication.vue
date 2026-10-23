<template>
  <section class="embedded-application">
    <div v-if="!compact || error" class="embedded-toolbar">
      <button v-if="closable" @click="$emit('close')">返回应用中心</button>
      <strong>{{ title }}</strong>
      <small>{{ url }}</small>
      <button @click="reload">重新加载</button>
    </div>
    <div ref="host" class="embedded-host">
      <p v-if="error" role="alert">
        {{ error }}
        <br />
        请确认 {{ title }} 的服务（{{ url }}）已经启动，再点击重新加载。
      </p>
      <p v-else>正在软件内加载 {{ title }}…</p>
    </div>
  </section>
</template>
<script setup lang="ts">
  import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
  import { Webview } from '@tauri-apps/api/webview'
  import { getCurrentWindow } from '@tauri-apps/api/window'
  import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'
  import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
  import { validateApplicationUrl } from '@/services/localApplications'
  const props = withDefaults(defineProps<{ url: string; title?: string; viewLabel?: string; closable?: boolean; compact?: boolean }>(), {
    title: 'RAGFlow 知识助手',
    viewLabel: 'ragflow-embedded',
    closable: false,
    compact: false
  })
  defineEmits<{ close: [] }>()
  const host = ref<HTMLElement>(),
    error = ref('')
  let view: Webview | undefined,
    observer: ResizeObserver | undefined,
    active = true,
    disposed = false,
    creating = false
  let probe: AbortController | undefined
  async function resize() {
    if (!view || !host.value || !active) return
    const rect = host.value.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    await view.setPosition(new LogicalPosition(rect.x, rect.y))
    await view.setSize(new LogicalSize(rect.width, rect.height))
  }
  async function reload() {
    if (creating || disposed) return
    creating = true
    error.value = ''
    try {
      if (view) {
        await view.close()
        view = undefined
      }
      const url = validateApplicationUrl(props.url)
      const controller = new AbortController()
      probe = controller
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          nativeFetch(url, { method: 'HEAD', headers: { Origin: '' }, signal: controller.signal })
            .then(response => response.arrayBuffer()),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort()
              reject(new Error('服务连接超时。'))
            }, 8000)
          })
        ])
      } catch {
        throw new Error(`无法连接${props.title}服务。`)
      } finally {
        if (timer) clearTimeout(timer)
        probe = undefined
      }
      if (disposed) return
      await nextTick()
      const rect = host.value!.getBoundingClientRect()
      // WebView2 views sharing the main profile must use identical browser arguments.
      const options = {
        url,
        x: rect.x,
        y: rect.y,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        dragDropEnabled: false,
        additionalBrowserArgs:
          '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --use-fake-ui-for-media-stream'
      }
      const candidate = new Webview(getCurrentWindow(), props.viewLabel, options)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          void candidate.close().catch(() => undefined)
          reject(new Error('内嵌页面创建超时。'))
        }, 15000)
        void candidate.once('tauri://created', () => {
          clearTimeout(timer)
          resolve()
        })
        void candidate.once('tauri://error', () => {
          clearTimeout(timer)
          reject(new Error('内嵌页面创建失败。'))
        })
      })
      if (disposed) {
        await candidate.close()
        return
      }
      view = candidate
      if (!active) await view.hide()
      else await resize()
    } catch (cause) {
      if (!disposed) error.value = cause instanceof Error ? cause.message : '内嵌页面加载失败。'
    } finally {
      creating = false
    }
  }
  onMounted(() => {
    observer = new ResizeObserver(() => {
      void resize().catch(() => undefined)
    })
    if (host.value) observer.observe(host.value)
    window.addEventListener('resize', onResize)
    void reload()
  })
  function onResize() {
    void resize().catch(() => undefined)
  }
  onDeactivated(() => {
    active = false
    void view?.hide().catch(() => undefined)
  })
  onActivated(() => {
    active = true
    void nextTick(async () => {
      if (view) {
        await resize()
        await view.show()
      }
    })
  })
  onBeforeUnmount(() => {
    disposed = true
    probe?.abort()
    observer?.disconnect()
    window.removeEventListener('resize', onResize)
    void view?.close().catch(() => undefined)
  })
</script>
<style scoped>
  .embedded-application {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary-color);
    color: var(--text-color);
  }
  .embedded-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 54px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .embedded-toolbar small {
    color: var(--text-muted-color);
    flex: 1;
  }
  .embedded-toolbar button {
    padding: 7px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: transparent;
    color: var(--text-color);
    cursor: pointer;
  }
  .embedded-host {
    flex: 1;
    min-height: 0;
    background: #fff;
    position: relative;
  }
  .embedded-host p {
    padding: 30px;
    color: #738498;
    line-height: 2;
  }
</style>
