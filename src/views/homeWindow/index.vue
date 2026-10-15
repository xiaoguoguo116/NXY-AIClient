<template>
  <div class="home">
    <SessionLockOverlay v-if="sessionLock.locked" />
    <!-- 顶部 -->
    <ToolBar v-show="!sessionLock.locked" class="home__header" @maximized="(is) => (isMaximize = is)">
      <div class="home__brand">
        <svg viewBox="0 0 96 72" aria-hidden="true">
          <path d="M13 16 37 4l16 17-12 12 13 17-20 18H13l17-20-17-19Z" fill="#fff" />
          <path d="m83 16-24-12-16 17 12 12-13 17 20 18h21L66 48l17-19Z" fill="#fff" />
          <circle cx="48" cy="18" r="11" fill="#ff6a5d" />
        </svg>
      </div>
      <div class="home__topbar">
        <LocalGlobalSearch v-if="previewMode" @navigate="(tab) => onClickMenu({ id: tab, path: `/home/${tab}` })" />
        <button v-else class="home__global-search" style="pointer-events: auto" @click="openSearchChatRecord()">
          搜索消息记录
        </button>
        <div class="home__topbar-right">
          <button v-if="todoState.alert" style="color:#c13c4b;background:#fff3e5;border:0;border-radius:5px;padding:6px;cursor:pointer" :title="todoState.alert" @click="openTodoReminder">待办到期 · 查看</button>
          <div class="home__user-summary" @click="onUserSummaryClick">
            <span>{{ userStore.userInfo.username || 'EM 本地聊天' }}</span>
            <EmotionIcon v-if="userStore.userInfo.emotionId" :url="userStore.userInfo.emotionUrl" :size="18" />
          </div>
          <SvgIconButton href="#minimize" @click="minimizeCurrentWindow" />
          <SvgIconButton
            :href="isMaximize ? '#restore' : '#maximize'"
            @click="() => restoreOrMaximizeCurrentWindow().then((v) => (isMaximize = !v))" />
          <SvgIconButton href="#close" hover-bg="var(--red)" hover-color="#FFF" @click="onCloseMainWindow" />
        </div>
      </div>
    </ToolBar>
    <!-- 主体 -->
    <div v-show="!sessionLock.locked" class="home__layout">
      <!-- 左侧 -->
      <ToolBar class="home__sider" @maximized="(is) => (isMaximize = is)">
        <div class="home__sider-top">
          <Avatar :id="userStore.userInfo.id" class="home__sider-avatar" :profile-enabled="!previewMode" round />
          <div class="home__sider-nav">
            <n-popover v-for="item in menuOptions" :key="item.id" :show-arrow="false" placement="right" trigger="hover">
              <template #trigger>
                <n-badge
                  :show="homeNavBadgeStore.shouldShowBadge(item.id)"
                  dot
                  :color="'var(--red)'"
                  class="home__tab-badge"
                  :offset="[-2, 2]">
                  <SvgIconButton
                    :aria-label="item.label"
                    :title="item.label"
                    :size="34"
                    :radius="5"
                    :href="homeTabStore.activeTabId === item.id ? item.activeIcon : item.icon"
                    :active="item.id === homeTabStore.activeTabId"
                    color="#fff"
                    hover-color="#fff"
                    hover-bg="rgba(255,255,255,.14)"
                    icon-size="22px"
                    @click="() => onClickMenu(item)" />
                </n-badge>
              </template>
              <span class="select-none">{{ item.label }}</span>
            </n-popover>
          </div>
        </div>
        <div>
          <n-dropdown
            :z-index="100"
            :options="moreOptions"
            trigger="click"
            placement="right"
            transfer
            @select="onMoreMenuSelect">
            <n-popover :z-index="99" :show-arrow="false" placement="right" trigger="hover">
              <template #trigger>
                <n-badge :show="homeNavBadgeStore.shouldShowBadge('more')" dot :color="'var(--red)'" :offset="[-2, 2]">
                  <SvgIconButton
                    :size="34"
                    :radius="5"
                    href="#list"
                    color="#fff"
                    hover-color="#fff"
                    hover-bg="rgba(255,255,255,.14)"
                    icon-size="22px" />
                </n-badge>
              </template>
              <span class="select-none">{{ t('home.options.more.text') }}</span>
            </n-popover>
          </n-dropdown>
        </div>
      </ToolBar>
      <!-- 内容：keep-alive 缓存各子页面状态 -->
      <div class="home__content">
        <UpdateModal v-model:show="showUpdateModal" />
        <router-view v-slot="{ Component, route }">
          <keep-alive :include="HOME_PAGE_NAMES">
            <component :is="Component" v-if="Component" :key="route.name" />
          </keep-alive>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { todoState, startTodoReminders } from '@/stores/localTodos'
  const stopTodoReminders = startTodoReminders()
  onBeforeUnmount(stopTodoReminders)
  function openTodoReminder() { todoState.alert = ''; void router.push('/home/todos') }
  import UpdateModal from '@/components/Modal/UpdateModal.vue'
  import LocalGlobalSearch from '@/components/Chat/LocalGlobalSearch.vue'
  import SessionLockOverlay from '@/components/SessionLockOverlay.vue'
  import { dismissTopEscapeOverlay } from '@/composables/useEscapeOverlayStack'
  import { userApi } from '@/api'
  import { HOME_PAGE_NAMES, prefetchHomePages } from '@/router/home'
  import { useAppSettingsStore } from '@/stores/app/appSettings'
  import { useAppUpdateStore } from '@/stores/app/appUpdate'
  import { useHomeNavBadgeStore } from '@/stores/app/homeNavBadge'
  import { useSessionLockStore } from '@/stores/app/sessionLock'
  import { useShortcutConflictStore } from '@/stores/app/shortcutConflict'
  import { HOME_TAB_NAVIGATE_EVENT } from '@/constants/event'
  import { LOGIN_WINDOW_LABEL } from '@/constants/window'
  import { useHomeTabStore, type HomeTabId, type HomeTabNavigatePayload } from '@/stores/app/homeTab'
  import { useChatStore } from '@/stores/chat/chat'
  import { useSpaceDownloadStore } from '@/stores/cloudDrive/spaceDownload'
  import { useSpaceUploadStore } from '@/stores/cloudDrive/spaceUpload'
  import { useUserStore } from '@/stores/user/user'
  import { initOsFileDropListener } from '@/utils/file/nativeFileDrop'
  import { connectWebSocket, disconnectWebSocket } from '@/utils/network/websocket'
  import {
    createChangePwdWindow,
    createEmotionWinodw,
    createFeedbackWinodw,
    createPluginRuntimeWindow,
    createSetWinodw,
    exitApp,
    hideCurrentWindow,
    hideWebviewWindow,
    minimizeCurrentWindow,
    restoreOrMaximizeCurrentWindow,
    ShowCurrentWindow
  } from '@/utils/desktop/window'
  import { disposeGlobalShortcuts, initGlobalShortcuts } from '@/utils/desktop/shortcuts'
  import { openSearchChatRecord } from '@/utils/message/searchChatRecord'
  import { ensureNotificationActionListener, stopNotificationActionListener } from '@/utils/desktop/notification'
  import { listen } from '@tauri-apps/api/event'
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { storeToRefs } from 'pinia'

  const userStore = useUserStore()
  const previewMode = computed(() => !userStore.authInfo.token)
  const appSettings = useAppSettingsStore()
  const sessionLock = useSessionLockStore()
  const homeTabStore = useHomeTabStore()
  const homeNavBadgeStore = useHomeNavBadgeStore()
  const shortcutConflictStore = useShortcutConflictStore()
  const appUpdateStore = useAppUpdateStore()
  const chatStore = useChatStore()
  const spaceUploadStore = useSpaceUploadStore()
  const spaceDownloadStore = useSpaceDownloadStore()
  const { needUpdate, needForce } = storeToRefs(appUpdateStore)

  initOsFileDropListener().catch(() => undefined)

  const isMaximize = ref(false)
  const showUpdateModal = ref(false)
  let unlistenCloseRequested: (() => void) | undefined
  let unlistenHomeTabNavigate: (() => void) | undefined

  const onCloseMainWindow = () => {
    if (appSettings.general.closeMainPanelAction === 'exit') {
      exitApp()
    } else {
      hideCurrentWindow()
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return

    if (dismissTopEscapeOverlay()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    onCloseMainWindow()
  }

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()

  const menuOptions = computed(() => [
    { id: 'todos' as HomeTabId, label: '待办事项', icon: '#check', activeIcon: '#check', path: '/home/todos' },
    {
      id: 'message' as HomeTabId,
      label: t('home.options.message'),
      icon: '#message',
      activeIcon: '#message-active',
      path: '/home/message'
    },
    {
      id: 'contacts' as HomeTabId,
      label: t('home.options.contacts'),
      icon: '#user',
      activeIcon: '#user-active',
      path: '/home/contacts'
    },
    {
      id: 'ai' as HomeTabId,
      label: t('home.options.ai'),
      icon: '#ai',
      activeIcon: '#ai-active',
      path: '/home/ai'
    },
    {
      id: 'application' as HomeTabId,
      label: t('home.options.application'),
      icon: '#application',
      activeIcon: '#application-active',
      path: '/home/application'
    }
  ])

  const moreOptions = computed(() => [
    {
      label: () =>
        h(
          'span',
          {
            style: {
              position: 'relative',
              display: 'inline-block',
              alignSelf: 'center',
              lineHeight: '1.2',
              paddingRight: homeNavBadgeStore.updatePending ? '10px' : '0'
            }
          },
          [
            t('home.options.more.update'),
            homeNavBadgeStore.updatePending
              ? h('span', {
                  style: {
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--red)',
                    transform: 'translate(50%, -35%)'
                  }
                })
              : null
          ]
        ),
      key: 'update'
    },
    {
      label: () => t('home.options.more.searchChatRecord'),
      key: 'searchChatRecord'
    },
    {
      label: () => t('home.options.more.lock'),
      key: 'lock'
    },
    {
      label: () => t('home.options.more.changePwd'),
      key: 'changePwd'
    },
    {
      label: () => t('home.options.more.feedback'),
      key: 'feedback'
    },
    {
      label: () =>
        h(
          'span',
          {
            style: {
              position: 'relative',
              display: 'inline-block',
              alignSelf: 'center',
              lineHeight: '1.2',
              paddingRight: shortcutConflictStore.keys.length > 0 ? '10px' : '0'
            }
          },
          [
            t('home.options.more.setting'),
            shortcutConflictStore.keys.length > 0
              ? h('span', {
                  style: {
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--red)',
                    transform: 'translate(50%, -35%)'
                  }
                })
              : null
          ]
        ),
      key: 'setting'
    },
    {
      label: () => t('home.options.more.exit'),
      key: 'exit'
    }
  ])

  const syncMenuFromRoute = () => {
    homeTabStore.syncActiveTabFromPath(route.path)
  }

  const onMoreMenuSelect = (key: string) => {
    if (previewMode.value) {
      if (key === 'exit') exitApp()
      else if (key === 'setting') void createSetWinodw('aiModel')
      return
    }

    if (key === 'setting') {
      createSetWinodw()
    } else if (key === 'update') {
      appUpdateStore
        .check()
        .then((info) => {
          if (info.needUpdate || info.needForce) {
            showUpdateModal.value = true
          } else {
            window.$message?.success(t('update.latest'))
          }
        })
        .catch(() => {
          window.$message?.error(t('update.checkFailed'))
        })
    } else if (key === 'lock') {
      sessionLock.lock()
    } else if (key === 'changePwd') {
      void createChangePwdWindow('change')
    } else if (key === 'feedback') {
      createFeedbackWinodw()
    } else if (key === 'searchChatRecord') {
      openSearchChatRecord()
    } else if (key === 'exit') {
      exitApp()
    }
  }

  const onClickMenu = (item: { id: HomeTabId; path: string }) => {
    if (previewMode.value && !['message', 'application', 'ai', 'todos'].includes(item.id)) {
      window.$message?.info('此功能需要连接聊天服务端；本地模式可使用消息、应用和 AI Work。')
      return
    }
    if (homeTabStore.activeTabId === item.id && route.path === item.path) {
      return
    }
    homeTabStore.navigateTo(item.id)
  }

  watch(() => route.path, syncMenuFromRoute, { immediate: true })

  watch(
    () => homeTabStore.activeTabId,
    (tabId) => {
      const targetPath = menuOptions.value.find((item) => item.id === tabId)?.path
      if (targetPath && route.path !== targetPath) {
        void router.push(targetPath)
      }
    }
  )

  watch(
    () => chatStore.chatList.map((item) => item.unreadNum),
    () => {
      homeNavBadgeStore.syncMessageFromChatList(chatStore.chatList)
    },
    { immediate: true }
  )

  watch(
    [() => spaceUploadStore.tasks, () => spaceDownloadStore.tasks],
    () => {
      homeNavBadgeStore.syncDriveFromTasks(spaceUploadStore.tasks, spaceDownloadStore.tasks)
    },
    { deep: true, immediate: true }
  )

  watch(
    [needUpdate, needForce],
    ([update, force]) => {
      homeNavBadgeStore.syncMoreFromUpdate(update, force)
    },
    { immediate: true }
  )

  const onCurrentUserInfo = () => {
    if (previewMode.value) return
    userApi.currentUserInfo().then((res) => {
      if (res.code === 0 && res.data) {
        userStore.setUserInfo(res.data)
      } else {
        window.$message.error(res.msg)
      }
    })
  }

  const onUserSummaryClick = () => {
    if (previewMode.value) return
    createEmotionWinodw()
  }

  onMounted(() => {
    void ensureNotificationActionListener()
    if (!previewMode.value) {
      void connectWebSocket().catch((err) => console.error('[WebSocket] connect failed:', err))
      void createPluginRuntimeWindow()
      onCurrentUserInfo()
      void homeNavBadgeStore.refreshContactsBadges()
      prefetchHomePages(route.name as string)
      void appUpdateStore
        .check({ silent: true })
        .then((info) => {
          if (info.needUpdate || info.needForce) {
            showUpdateModal.value = true
          }
        })
        .catch(() => undefined)
    }
    window.addEventListener('keydown', onKeyDown)
    initGlobalShortcuts()
    void listen<HomeTabNavigatePayload>(HOME_TAB_NAVIGATE_EVENT, (event) => {
      if (previewMode.value && event.payload.tabId !== 'todos') return
      const { tabId, payload } = event.payload
      if (!tabId) return
      void homeTabStore.navigateTo(tabId, payload)
    }).then((unlisten) => {
      unlistenHomeTabNavigate = unlisten
    })
    void WebviewWindow.getCurrent()
      .onCloseRequested((event) => {
        event.preventDefault()
        onCloseMainWindow()
      })
      .then((unlisten) => {
        unlistenCloseRequested = unlisten
      })
    nextTick(() => {
      ShowCurrentWindow()
      // 隐藏而非销毁，保留登录历史等登录窗内状态；回登录时可直接复用
      void hideWebviewWindow(LOGIN_WINDOW_LABEL)
    })
  })

  onUnmounted(() => {
    unlistenCloseRequested?.()
    unlistenHomeTabNavigate?.()
    void stopNotificationActionListener()
    window.removeEventListener('keydown', onKeyDown)
    disposeGlobalShortcuts()
    if (!previewMode.value) {
      void disconnectWebSocket().catch((err) => console.error('[WebSocket] disconnect failed:', err))
    }
  })
</script>

<style scoped lang="scss">
  .home {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    color: var(--text-color);
    background-color: transparent;
    overflow: hidden;

    .home__header {
      height: 38px;
      display: flex;
      align-items: center;
      padding: 0 3px 0 0;
      user-select: none;
      flex-shrink: 0;
    }

    .home__layout {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      height: calc(100% - 38px);
      background-color: var(--toolbar-bg-color);
      overflow: hidden;

      .home__sider {
        width: 50px;
        background-color: transparent;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 10px 0;
        align-items: center;
        flex-shrink: 0;

        .home__sider-btn {
          height: 34px;
          width: 34px;
          text-align: center;
          border-radius: 5px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .home__tab-badge {
          display: flex;
        }
      }

      .home__content {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        background-color: var(--bg-secondary-color);
        border-radius: 5px 0 0 0;
      }
    }

    /* 参考企业 IM 的蓝白主框架 */
    .home__header {
      height: 42px;
      padding: 0;
      background: #fff;
      border-bottom: 1px solid #e4e9ef;
      box-shadow: 0 1px 3px rgba(30, 75, 110, 0.05);
    }

    .home__brand {
      width: 72px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: #2f92ed;

      svg {
        width: 34px;
        height: 27px;
      }
    }

    .home__topbar {
      flex: 1;
      min-width: 0;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      pointer-events: none;
    }

    .home__global-search {
      min-width: 260px;
      margin-left: 18px;
      display: flex;
      align-items: center;
      gap: 9px;
      color: #b1b8c1;
      font-size: 13px;

      svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
    }

    .home__topbar-right {
      display: flex;
      align-items: center;
      pointer-events: auto;
    }

    .home__user-summary {
      max-width: 180px;
      margin-right: 12px;
      display: flex;
      align-items: center;
      gap: 7px;
      color: #667282;
      font-size: 12px;
      cursor: pointer;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .home__layout {
      height: calc(100% - 42px);
      background: #f5f7fa;

      .home__sider {
        width: 72px;
        padding: 12px 0 14px;
        background: linear-gradient(180deg, #3d9cf0 0%, #2f8ce6 100%);
        box-shadow: 1px 0 4px rgba(19, 98, 166, 0.12);
      }

      .home__content {
        border-radius: 0;
        background: #f5f7fa;
      }
    }

    .home__sider-top,
    .home__sider-nav {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .home__sider-top {
      gap: 18px;
    }

    .home__sider-nav {
      gap: 10px;
    }

    .home__sider-avatar {
      width: 44px !important;
      height: 44px !important;
      border: 2px solid rgba(255, 255, 255, 0.85);
      background: #fff;
      box-shadow: 0 3px 10px rgba(25, 86, 139, 0.22);
    }

    :deep(.home__sider .icon-wrapper.is-active) {
      background: rgba(255, 255, 255, 0.22) !important;
    }

    :deep(.home__sider .icon-wrapper.is-active svg) {
      color: #fff !important;
    }
  }
</style>
