<template>
  <div class="work-settings">
    <h2>{{ t('settings.work.title') }}</h2>
    <p>任务助手自动使用全局模型设置中的接口地址、模型和 API 密钥。</p>
    <SettingCard>
      <SettingRow label="全局模型" :desc="store.activeModel || '尚未配置'">
        <n-button size="small" @click="createSetWinodw('aiModel')">打开全局模型设置</n-button>
      </SettingRow>
      <SettingRow label="办公文件处理" :desc="runtime?.installed ? '已就绪' : '尚未安装文件处理依赖'">
        <n-button
          v-if="!runtime?.installed"
          size="small"
          :loading="installing"
          :disabled="sessionStore.busy"
          @click="onInstall">
          {{ t('settings.work.runtime.install') }}
        </n-button>
        <n-button v-else size="small" :loading="loading" @click="onRefresh">
          {{ t('settings.work.runtime.detect') }}
        </n-button>
      </SettingRow>
      <SettingRow :label="t('settings.work.model.workMode')" :desc="t('settings.work.model.workModeDesc')">
        <n-select
          class="work-settings__select"
          :value="store.workMode"
          :options="workModeOptions"
          :disabled="sessionStore.busy"
          @update:value="(workMode: WorkMode) => savePolicy({ workMode })" />
      </SettingRow>
      <SettingRow
        :label="t('settings.work.model.approval')"
        :desc="t('settings.work.model.approvalDesc')"
        :border="false">
        <n-select
          class="work-settings__select"
          :value="store.approvalMode"
          :options="approvalOptions"
          :disabled="sessionStore.busy"
          @update:value="(approvalMode: WorkApprovalMode) => savePolicy({ approvalMode })" />
      </SettingRow>
    </SettingCard>
    <n-progress v-if="installing" type="line" :percentage="Math.round(installProgress * 100)" />
  </div>
</template>

<script setup lang="ts">
  import type { UnlistenFn } from '@tauri-apps/api/event'
  import SettingCard from '@/components/Set/SettingCard.vue'
  import SettingRow from '@/components/Set/SettingRow.vue'
  import * as workService from '@/services/workService'
  import { parseWorkError } from '@/services/workError'
  import { useWorkAssistantStore } from '@/stores/app/workAssistant'
  import { useWorkSessionStore } from '@/stores/app/workSession'
  import type { WorkApprovalMode, WorkMode, WorkPreferencesInput } from '@/types/cmd/work'
  import { createSetWinodw } from '@/utils/desktop/window'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n()
  const store = useWorkAssistantStore()
  const sessionStore = useWorkSessionStore()
  const runtime = computed(() => store.runtimes.find((item) => item.id === 'office'))
  const installing = ref(false),
    loading = ref(false),
    installProgress = ref(0)
  const workModeOptions = computed(() =>
    ['economy', 'balanced', 'delivery'].map((value) => ({ label: t(`settings.work.model.workModes.${value}`), value }))
  )
  const approvalOptions = computed(() =>
    ['ask', 'auto', 'yolo'].map((value) => ({ label: t(`settings.work.model.approvalModes.${value}`), value }))
  )
  const showError = (error: unknown) => window.$message?.error(t(parseWorkError(error).key))
  const savePolicy = async (input: Partial<WorkPreferencesInput>) => {
    try {
      await sessionStore.closeBoundSession('office')
      await store.savePreferences(input)
    } catch (error) {
      showError(error)
    }
  }
  const onRefresh = async () => {
    loading.value = true
    try {
      await store.refreshStatus()
    } catch (error) {
      showError(error)
    } finally {
      loading.value = false
    }
  }
  const onInstall = async () => {
    installing.value = true
    installProgress.value = 0
    try {
      await workService.installRuntime()
      await store.refreshStatus()
      window.$message?.success(t('settings.work.runtime.ready'))
    } catch (error) {
      showError(error)
    } finally {
      installing.value = false
    }
  }
  let unlisten: UnlistenFn | undefined
  let disposed = false
  const refreshGlobalModel = () => store.refreshGlobalModel()
  onMounted(async () => {
    window.addEventListener('storage', refreshGlobalModel)
    window.addEventListener('focus', refreshGlobalModel)
    try {
      await store.initialize()
      const stop = await workService.onWorkEvent((event) => {
        if (event.runtimeId === 'office' && event.kind === 'install_progress') {
          installProgress.value = Number(event.payload.progress) || 0
        }
      })
      if (disposed) stop()
      else unlisten = stop
    } catch (error) {
      showError(error)
    }
  })
  onBeforeUnmount(() => {
    disposed = true
    unlisten?.()
    window.removeEventListener('storage', refreshGlobalModel)
    window.removeEventListener('focus', refreshGlobalModel)
  })
</script>

<style scoped>
  .work-settings {
    padding: 20px 24px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 18px;
  }
  p {
    margin: 0 0 20px;
    color: var(--text-secondary-color);
    font-size: 13px;
  }
  .work-settings__select {
    width: 190px;
  }
</style>
