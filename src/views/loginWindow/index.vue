<template>
  <div class="login">
    <ToolBar class="login__toolbar">
      <div class="login__toolbar-title">登录</div>
      <div class="login__toolbar-actions">
        <SvgIconButton
          href="#refresh"
          color="#fff"
          hover-color="#fff"
          hover-bg="rgba(255,255,255,.16)"
          @click="refreshCaptcha" />
        <n-dropdown :options="setttngsOptions" trigger="click">
          <SvgIconButton href="#settings" color="#fff" hover-color="#fff" hover-bg="rgba(255,255,255,.16)" />
        </n-dropdown>
        <SvgIconButton
          href="#minimize"
          color="#fff"
          hover-color="#fff"
          hover-bg="rgba(255,255,255,.16)"
          @click="minimizeCurrentWindow" />
        <SvgIconButton href="#close" color="#fff" hover-bg="var(--red)" hover-color="#fff" @click="exitApp" />
      </div>
    </ToolBar>

    <div class="login__content">
      <template v-if="versionChecking">
        <div class="login__loading">
          <n-spin size="medium" />
          <div>{{ t('update.checking') }}</div>
        </div>
      </template>
      <template v-else-if="showNetworkSettings">
        <div class="login__network">
          <div class="login__network-header">
            <SvgIconButton href="#left-arrow" @click="onCancelNetworkSettings" />
            <div class="login__network-title">{{ t('login.networkSettings.title') }}</div>
            <div class="size-28px" />
          </div>
          <div class="login__network-form">
            <div class="login__network-field">
              <div class="login__network-label">{{ t('login.networkSettings.serviceUrl') }}</div>
              <n-input
                v-model:value="networkServiceUrlDraft"
                clearable
                :placeholder="t('login.networkSettings.serviceUrlPlaceholder')" />
            </div>
            <div class="login__network-actions">
              <n-button type="primary" @click="onConfirmNetworkSettings">
                {{ t('login.networkSettings.confirm') }}
              </n-button>
              <n-button class="login__network-cancel" @click="onCancelNetworkSettings">
                {{ t('login.networkSettings.cancel') }}
              </n-button>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="login__panel">
          <div class="login__brand">
            <div class="login__brand-mark" aria-label="农信银支付清算中心 Logo">
              <svg viewBox="0 0 96 72" role="img">
                <path d="M13 16 37 4l16 17-12 12 13 17-20 18H13l17-20-17-19Z" fill="#158650" />
                <path d="m83 16-24-12-16 17 12 12-13 17 20 18h21L66 48l17-19Z" fill="#158650" />
                <circle cx="48" cy="18" r="11" fill="#e44738" />
                <path d="m44 18 5-5 4 4-4 4 4 4-4 4-9-9Z" fill="#fff" />
              </svg>
            </div>
            <div class="login__brand-name">农信银支付清算中心</div>
          </div>

          <div class="login__form">
            <div ref="accountInputRef" class="login__field login__account-input">
              <svg class="login__field-icon"><use href="#user" /></svg>
              <n-input
                v-model:value="accountInfo.account"
                class="login__field-input"
                type="text"
                :placeholder="t('login.input.account')"
                clearable>
                <template v-if="loginHistoryStore.accounts.length" #suffix>
                  <div class="n-input__eye" @click.stop="toggleAccountHistory">
                    <i class="n-base-icon">
                      <svg
                        class="login__account-chevron size-16px"
                        :class="{ 'login__account-chevron--open': accountHistoryVisible }">
                        <use href="#left-arrow" />
                      </svg>
                    </i>
                  </div>
                </template>
              </n-input>
              <div v-if="accountHistoryVisible && loginHistoryStore.accounts.length" class="login__account-history">
                <div class="login__account-history__scroll">
                  <div
                    v-for="item in loginHistoryStore.accounts"
                    :key="item.account"
                    class="login__account-history__item"
                    @click="onSelectHistoryAccount(item)">
                    <Avatar :id="item.userId" :size="28" round />
                    <span class="login__account-history__text">{{ item.account }}</span>
                    <button
                      type="button"
                      class="login__account-history__remove"
                      @click.stop="onRemoveHistoryAccount(item.account)">
                      <svg class="size-12px"><use href="#close" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="login__field">
              <svg class="login__field-icon"><use href="#lock" /></svg>
              <n-input
                class="login__field-input"
                type="password"
                :show-password-on="passwordFreeMode ? undefined : 'click'"
                :readonly="passwordFreeMode"
                :value="accountInfo.password"
                :placeholder="t('login.input.password')"
                clearable
                @update:value="onPasswordUpdate" />
            </div>

            <div class="login__field login__verify-field">
              <svg class="login__field-icon"><use href="#verify-code" /></svg>
              <n-input
                v-model:value="verificationCode"
                class="login__field-input"
                maxlength="4"
                placeholder="请输入验证码"
                @keyup.enter="onAccountLogin" />
              <button class="login__captcha" type="button" title="点击更换验证码" @click="refreshCaptcha">
                <span v-for="(digit, index) in captchaCode" :key="`${digit}-${index}`">{{ digit }}</span>
              </button>
            </div>

            <div class="login__options">
              <label class="login__keep">
                <n-checkbox size="small" :checked="keepLoginChecked" @update:checked="onKeepLoginChange" />
                <span>{{ t('login.keepLogin') }}</span>
              </label>
              <button type="button" class="login__text-button" @click="onForgotPassword">
                {{ t('login.forgotPassword') }}
              </button>
            </div>

            <n-button
              class="login__btn-gradient"
              type="primary"
              :loading="loginLoading"
              :disabled="loginButtonDisabled"
              @click="onAccountLogin">
              {{ loginText }}
            </n-button>

            <div class="login__terms">
              <n-checkbox v-model:checked="termsChecked" size="small" />
              <i18n-t scope="global" keypath="login.terms.text1" tag="div">
                <template #text2>
                  <span class="login__link" @click="onOpenTerms">{{ t('login.terms.text2') }}</span>
                </template>
                <template #text3>
                  <span class="login__link" @click="onOpenPrivacy">{{ t('login.terms.text3') }}</span>
                </template>
              </i18n-t>
            </div>
            <div class="login__other">
              <button type="button" title="扫码登录" @click="() => onOauth2Login('scan')">
                <svg><use href="#scanqr" /></svg>
              </button>
              <button type="button" title="GitHub 登录" @click="() => onOauth2Login('github')">
                <svg><use href="#github" /></svg>
              </button>
              <button type="button" title="Gitee 登录" @click="() => onOauth2Login('gitee')">
                <svg><use href="#gitee" /></svg>
              </button>
            </div>
          </div>

          <button type="button" class="login__server" @click="onOpenNetworkSettings">切换服务器</button>
          <div class="login__register">
            <span>{{ t('login.register.tip') }}</span>
            <button type="button" class="login__text-button" @click="onGoRegister">
              {{ t('login.register.text') }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <div data-tauri-drag-region class="login__footer">
      <div>Copyright © 农信银支付清算中心</div>
      <div class="login__footer-support" @click="onOpenSupport">{{ t('login.footer.support') }}</div>
    </div>

    <ForceUpdatePanel v-model:show="showForceUpdate" />
  </div>
</template>

<script setup lang="tsx">
  import SvgIconButton from '@/components/SvgIconButton.vue'
  import Avatar from '@/components/Avatar.vue'
  import ForceUpdatePanel from '@/components/Modal/ForceUpdatePanel.vue'
  import { authApi, oauth2Api } from '@/api'
  import { initDatabase } from '@/db'
  import { useAppUpdateStore } from '@/stores/app/appUpdate'
  import {
    closeWebviewWindow,
    createChangePwdWindow,
    createHomeWinodw,
    createRegisterWindow,
    exitApp,
    hideCurrentWindow,
    minimizeCurrentWindow,
    ShowCurrentWindow
  } from '@/utils/desktop/window'
  import { CHANGE_PWD_WINDOW_LABEL, REGISTER_WINDOW_LABEL } from '@/constants/window'
  import { useI18n } from 'vue-i18n'
  import { useUserStore } from '@/stores/user/user'
  import { useLoginHistoryStore, type LoginHistoryItem } from '@/stores/user/loginHistory'
  import { invoke } from '@tauri-apps/api/core'
  import { openUrl } from '@/utils/desktop/open'
  import { once } from '@tauri-apps/api/event'
  import { OAuth2LoginPayload } from '@/types/cmd/login'
  import { LoginResult } from '@/types/api/auth'
  import { useSystemSettingStore } from '@/stores/app/systemSetting'
  import { isValidServiceUrl, PRIVACY_POLICY_URL, PRICING_URL, TERMS_OF_SERVICE_URL } from '@/constants/network'
  import { LangEnum, ThemePatternEnum } from '@/constants/system'
  import { onClickOutside } from '@vueuse/core'
  import { computed, nextTick, onMounted, ref, watch, watchEffect } from 'vue'

  const FAKE_PASSWORD = '********'

  const { t } = useI18n()
  const userStore = useUserStore()
  const loginHistoryStore = useLoginHistoryStore()
  const systemSetting = useSystemSettingStore()
  const appUpdateStore = useAppUpdateStore()
  const showForceUpdate = ref(false)
  const versionChecking = ref(true)

  const accountInputRef = ref<HTMLElement>()
  const accountHistoryVisible = ref(false)
  const showNetworkSettings = ref(false)
  const networkServiceUrlDraft = ref('')

  const accountInfo = ref({ account: '', password: '' })
  const verificationCode = ref('')
  const captchaCode = ref('')
  const loginLoading = ref(false)
  const loginButtonDisabled = ref(true)
  const termsChecked = ref(false)
  const keepLoginChecked = ref(false)
  const passwordFreeMode = ref(false)

  const setttngsOptions = [
    {
      label: () => t('login.settings.theme.text'),
      key: 'pattern',
      children: [
        {
          label: () => renderThemeColorOptions(ThemePatternEnum.LIGHT, t('login.settings.theme.light')),
          key: 'light',
          props: {
            onClick: () => onSetThemeColor(ThemePatternEnum.LIGHT)
          }
        },
        {
          label: () => renderThemeColorOptions(ThemePatternEnum.DARK, t('login.settings.theme.dark')),
          key: 'dark',
          props: {
            onClick: () => onSetThemeColor(ThemePatternEnum.DARK)
          }
        },
        {
          label: () => renderThemeColorOptions(ThemePatternEnum.OS, t('login.settings.theme.system')),
          key: 'system',
          props: {
            onClick: () => onSetThemeColor(ThemePatternEnum.OS)
          }
        }
      ]
    },
    {
      label: () => t('login.settings.language'),
      key: 'language',
      children: [
        {
          label: () => renderLanguageOptions(LangEnum.ZH, '中文'),
          key: 'zh',
          props: {
            onClick: () => onSetLanguage(LangEnum.ZH)
          }
        },
        {
          label: () => renderLanguageOptions(LangEnum.EN, 'English'),
          key: 'en',
          props: {
            onClick: () => onSetLanguage(LangEnum.EN)
          }
        }
      ]
    },
    {
      label: () => t('login.settings.network'),
      key: 'network',
      props: {
        onClick: () => onOpenNetworkSettings()
      }
    }
  ]

  const loginText = computed(() => {
    if (loginLoading.value) {
      return t('login.text.loading')
    }
    return t('login.text.default')
  })

  const refreshCaptcha = () => {
    captchaCode.value = String(Math.floor(1000 + Math.random() * 9000))
    verificationCode.value = ''
  }

  const renderLanguageOptions = (lang: LangEnum, langName: string) => {
    return (
      <div class="flex items-center justify-between">
        <p>{langName}</p>
        {lang === systemSetting.preferences.lang && (
          <svg class="size-16px m-l-5px text-[var(--primary-color)]">
            <use href="#check"></use>
          </svg>
        )}
      </div>
    )
  }

  const renderThemeColorOptions = (themeColor: ThemePatternEnum, themeColorName: string) => {
    return (
      <div class="flex items-center justify-between">
        <p>{themeColorName}</p>
        {themeColor === systemSetting.themes.pattern && (
          <svg class="size-16px m-l-5px text-[var(--primary-color)]">
            <use href="#check"></use>
          </svg>
        )}
      </div>
    )
  }

  const onSetThemeColor = (pattern: ThemePatternEnum) => {
    systemSetting.setThemePattern(pattern)
  }

  const onOpenNetworkSettings = () => {
    networkServiceUrlDraft.value = systemSetting.network?.serviceUrl || ''
    showNetworkSettings.value = true
    accountHistoryVisible.value = false
  }

  const onCancelNetworkSettings = () => {
    showNetworkSettings.value = false
    networkServiceUrlDraft.value = systemSetting.network?.serviceUrl || ''
  }

  const onConfirmNetworkSettings = () => {
    const nextUrl = networkServiceUrlDraft.value.trim()
    if (nextUrl && !isValidServiceUrl(nextUrl)) {
      window.$message.error(t('login.networkSettings.invalidUrl'))
      return
    }
    systemSetting.setNetworkServiceUrl(nextUrl)
    showNetworkSettings.value = false
  }

  const onSetLanguage = (lang: LangEnum) => {
    systemSetting.setLang(lang)
  }

  const onOpenTerms = () => {
    void openUrl(TERMS_OF_SERVICE_URL)
  }

  const onOpenPrivacy = () => {
    void openUrl(PRIVACY_POLICY_URL)
  }

  const onOpenSupport = () => {
    void openUrl(PRICING_URL)
  }

  const applyAccountKeepLoginState = (account: string) => {
    const item = loginHistoryStore.findByAccount(account.trim())
    if (item?.keepLogin && item.token) {
      keepLoginChecked.value = true
      passwordFreeMode.value = true
      accountInfo.value.password = FAKE_PASSWORD
      return
    }
    keepLoginChecked.value = !!item?.keepLogin
    passwordFreeMode.value = false
    accountInfo.value.password = ''
  }

  const exitPasswordFreeMode = () => {
    if (!passwordFreeMode.value) return
    passwordFreeMode.value = false
    accountInfo.value.password = ''
  }

  const loginSuccess = (info: LoginResult, fallbackAccount = '') => {
    const account = String(info.account || fallbackAccount || accountInfo.value.account || '').trim()
    console.info('[login] loginSuccess account=', account, 'apiAccount=', info.account)

    if (account) {
      loginHistoryStore.addAccount({
        account,
        userId: info.userId,
        keepLogin: keepLoginChecked.value,
        token: keepLoginChecked.value ? info.token : undefined
      })
    } else {
      console.warn('[login] loginSuccess missing account, history not saved', info)
    }

    userStore.setAuthInfo({ token: info?.token || '', userId: info?.userId || '' })
    initDatabase()
      .then(() => {
        createHomeWinodw()
        void closeWebviewWindow(REGISTER_WINDOW_LABEL)
        void closeWebviewWindow(CHANGE_PWD_WINDOW_LABEL)
        void hideCurrentWindow()
      })
      .catch((error) => {
        console.error('[login] initDatabase failed:', error)
        userStore.removeAuthInfo()
        const detail = error instanceof Error ? error.message : String(error || '')
        window.$message.error(detail ? `${t('login.dbInitFailed')}（${detail}）` : t('login.dbInitFailed'))
      })
  }

  const toggleAccountHistory = () => {
    accountHistoryVisible.value = !accountHistoryVisible.value
  }

  const onSelectHistoryAccount = (item: LoginHistoryItem) => {
    accountInfo.value.account = item.account
    accountHistoryVisible.value = false
    applyAccountKeepLoginState(item.account)
  }

  const onRemoveHistoryAccount = (account: string) => {
    loginHistoryStore.removeAccount(account)
    if (accountInfo.value.account === account) {
      const nextAccount = loginHistoryStore.accounts[0]?.account || ''
      accountInfo.value.account = nextAccount
      if (nextAccount) {
        applyAccountKeepLoginState(nextAccount)
      } else {
        keepLoginChecked.value = false
        passwordFreeMode.value = false
        accountInfo.value.password = ''
      }
    }
    if (!loginHistoryStore.accounts.length) {
      accountHistoryVisible.value = false
    }
  }

  const onPasswordUpdate = (val: string) => {
    if (passwordFreeMode.value) {
      if (val !== FAKE_PASSWORD) {
        exitPasswordFreeMode()
      }
      return
    }
    accountInfo.value.password = val
  }

  const onKeepLoginChange = (val: boolean) => {
    keepLoginChecked.value = val
    const account = accountInfo.value.account.trim()
    if (!val && account) {
      loginHistoryStore.clearKeepLogin(account)
      exitPasswordFreeMode()
    }
  }

  const onKeepLoginExpired = (account: string, message?: string) => {
    loginHistoryStore.clearKeepLogin(account)
    keepLoginChecked.value = false
    passwordFreeMode.value = false
    accountInfo.value.password = ''
    window.$message.error(message || t('login.keepLoginExpired'))
  }

  const onAccountLogin = () => {
    loginLoading.value = true
    const account = accountInfo.value.account.trim()

    if (passwordFreeMode.value) {
      const item = loginHistoryStore.findByAccount(account)
      const token = item?.token
      if (!token) {
        loginLoading.value = false
        onKeepLoginExpired(account)
        return
      }
      userStore.$patch((state) => {
        state.authInfo.token = token
      })
      authApi.tokenReset().then((res) => {
        loginLoading.value = false
        if (res.code === 0 && res.data) {
          loginSuccess(res.data, account)
        } else {
          onKeepLoginExpired(account, res.msg || t('login.keepLoginExpired'))
        }
      })
      return
    }

    authApi.accountLogin({ account, password: accountInfo.value.password }).then((res) => {
      loginLoading.value = false
      if (res.code === 0 && res.data) {
        loginSuccess(res.data, account)
      } else {
        window.$message.error(res.msg)
      }
    })
  }

  const onOauth2Login = async (oauthType: string) => {
    const urlInfo = await oauth2Api.oauth2Url({ type: oauthType })
    await invoke('start_oauth_server', { oauthType, redirectUrl: urlInfo.data?.redirectUrl || '' })
    await openUrl(urlInfo.data?.authUrl || '')
    await once<OAuth2LoginPayload>('oauth-code', (event) => {
      loginLoading.value = true
      authApi.oauth2Login({ code: event.payload.code, type: oauthType }).then((res) => {
        loginLoading.value = false
        if (res.code === 0 && res.data) {
          loginSuccess(res.data, res.data.account || '')
        } else {
          window.$message.error(res.msg)
        }
      })
    })
  }

  const onGoRegister = () => {
    void createRegisterWindow()
  }

  const onForgotPassword = () => {
    void createChangePwdWindow('recover')
  }

  onClickOutside(accountInputRef, () => {
    accountHistoryVisible.value = false
  })

  watch(
    () => accountInfo.value.account,
    (account) => {
      accountHistoryVisible.value = false
      applyAccountKeepLoginState(account)
    }
  )

  onMounted(() => {
    refreshCaptcha()
    const syncHistoryToForm = () => {
      const latestAccount = loginHistoryStore.accounts[0]
      if (!latestAccount) return
      // 仅在输入框为空时回填，避免覆盖用户正在输入
      if (!accountInfo.value.account.trim()) {
        accountInfo.value.account = latestAccount.account
        applyAccountKeepLoginState(latestAccount.account)
      }
    }

    void loginHistoryStore.hydrate().then(() => {
      syncHistoryToForm()
      console.info(
        '[loginHistory] hydrated',
        loginHistoryStore.accounts.map((a) => a.account)
      )
    })

    versionChecking.value = true
    appUpdateStore
      .check({ silent: true })
      .then((info) => {
        showForceUpdate.value = info.needForce
        versionChecking.value = false
      })
      .catch((error: Error) => {
        console.error('[AppUpdate] login check failed:', error)
        showForceUpdate.value = false
        versionChecking.value = false
      })
    nextTick(() => {
      ShowCurrentWindow()
    })
  })

  watchEffect(() => {
    const hasAccount = accountInfo.value.account.trim() !== ''
    const hasPassword = passwordFreeMode.value || accountInfo.value.password !== ''
    const captchaPassed = verificationCode.value.trim() === captchaCode.value
    loginButtonDisabled.value =
      !hasAccount || !hasPassword || !captchaPassed || loginLoading.value || !termsChecked.value
  })
</script>

<style scoped lang="scss">
  .login {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    color: var(--text-color);
    user-select: none;

    .login__toolbar {
      height: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 10px;
    }

    .login__content {
      flex: 1;
      background-color: var(--bg-secondary-color);
      padding: 0 20px;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -30%;
        width: 500px;
        height: 500px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(var(--primary-rgb), 0.05), transparent 70%);
        pointer-events: none;
        animation: float-1 12s ease-in-out infinite;
      }

      &::after {
        content: '';
        position: absolute;
        bottom: -30%;
        left: -20%;
        width: 400px;
        height: 400px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(var(--primary-rgb), 0.03), transparent 60%);
        pointer-events: none;
        animation: float-2 15s ease-in-out infinite;
      }

      @keyframes float-1 {
        0%,
        100% {
          transform: translate(0, 0) scale(1) rotate(0deg);
        }
        25% {
          transform: translate(-30px, 40px) scale(1.1) rotate(5deg);
        }
        50% {
          transform: translate(-50px, 20px) scale(1.05) rotate(-3deg);
        }
        75% {
          transform: translate(-20px, -10px) scale(1.15) rotate(2deg);
        }
      }

      @keyframes float-2 {
        0%,
        100% {
          transform: translate(0, 0) scale(1) rotate(0deg);
        }
        33% {
          transform: translate(40px, -30px) scale(1.1) rotate(-4deg);
        }
        66% {
          transform: translate(20px, 20px) scale(1.08) rotate(6deg);
        }
      }

      .login__avatar-wrapper {
        position: relative;
        width: 72px;
        height: 72px;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 4px 24px rgba(var(--primary-rgb), 0.25);
        border: 1px solid var(--primary-color);

        &::after {
          content: '';
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(var(--primary-rgb), 0.3), transparent 70%);
          z-index: -1;
        }
      }

      .other-login__button {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        transition: all 0.3s ease;

        &:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        &:active {
          transform: scale(0.95);
        }
      }

      .login__btn-gradient {
        width: 100%;
        height: 38px;
        background: linear-gradient(to right, var(--primary-color), var(--primary-strong-color));

        &:not(.n-button--disabled):hover {
          background: linear-gradient(to right, var(--primary-soft-color), var(--primary-strong-color));
        }
      }

      .login__network {
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding-top: 12px;
      }

      .login__network-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 -10px 24px;
      }

      .login__network-title {
        flex: 1;
        text-align: center;
        font-size: 15px;
        font-weight: 600;
        color: var(--text-color);
        user-select: none;
      }

      .login__network-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .login__network-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .login__network-label {
        font-size: 13px;
        color: var(--text-secondary-color);
        user-select: none;
      }

      .login__network-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .login__network-cancel {
        color: var(--text-color);
        background-color: var(--button-soft-bg) !important;
        border: 1px solid var(--border-color);

        &:hover {
          color: var(--text-color);
          background-color: var(--button-soft-bg) !important;
          border-color: var(--border-color);
          filter: brightness(1.05);
        }
      }

      .login__account-input {
        position: relative;
        width: 100%;
        z-index: 2;
      }

      .login__account-chevron {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        transform: rotate(-90deg);
        transition: transform 0.2s ease;

        &--open {
          transform: rotate(90deg);
        }
      }

      .login__account-history {
        position: absolute;
        top: calc(100% + 5px);
        left: 0;
        right: 0;
        z-index: 10;
        padding: 4px;
        border-radius: 8px;
        background-color: var(--bg-primary-color);
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);

        &__scroll {
          max-height: 182px;
          overflow-y: auto;
        }

        &__item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;

          &:hover {
            background-color: var(--button-soft-bg);

            .login__account-history__remove {
              opacity: 1;
              pointer-events: auto;
            }
          }

          & + & {
            margin-top: 2px;
          }
        }

        &__text {
          flex: 1;
          min-width: 0;
          font-size: 14px;
          color: var(--text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        &__remove {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--text-secondary-color);
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transition:
            opacity 0.2s ease,
            color 0.2s ease;

          &:hover {
            color: var(--text-color);
          }
        }
      }
    }

    .login__footer {
      height: 32px;
      background-color: var(--toolbar-bg-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 10px;
      font-size: 12px;
      color: var(--text-muted-color);
      user-select: none;
    }

    :deep(.n-input) {
      .n-input__input-el {
        padding: 0;
        height: 40px;
        line-height: 40px;
        user-select: text;
      }
    }

    /* 农信银企业客户端视觉层 */
    & {
      color: #344255;
      background: #ffffff;
      border: 1px solid #cbd9e8;
    }

    .login__toolbar {
      height: 44px;
      padding: 0 6px 0 14px;
      background: linear-gradient(90deg, #1198e9 0%, #0788dc 100%);
      box-shadow: 0 1px 4px rgba(17, 114, 182, 0.22);
    }

    .login__toolbar-title {
      color: #fff;
      font-size: 16px;
      font-weight: 500;
      letter-spacing: 1px;
    }

    .login__toolbar-actions {
      display: flex;
      align-items: center;
    }

    .login__content {
      padding: 0 34px;
      background: #fff;

      &::before,
      &::after {
        display: none;
      }
    }

    .login__loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #8793a2;
      font-size: 12px;
    }

    .login__panel {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .login__brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 48px 0 34px;
    }

    .login__brand-mark {
      width: 76px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        width: 76px;
        height: 60px;
        filter: drop-shadow(0 2px 2px rgba(16, 101, 62, 0.14));
      }
    }

    .login__brand-name {
      margin-top: 16px;
      color: #43505d;
      font-size: 20px;
      font-weight: 500;
      letter-spacing: 1px;
    }

    .login__form {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .login__field {
      position: relative;
      display: flex;
      align-items: center;
      height: 54px;
      border-bottom: 1px solid #d7dde5;
    }

    .login__field:focus-within {
      border-bottom-color: #3e83ef;
    }

    .login__field-icon {
      width: 21px;
      height: 21px;
      margin: 0 13px 0 2px;
      color: #4f8ff3;
      fill: currentColor;
      flex-shrink: 0;
    }

    .login__field-input {
      flex: 1;
      min-width: 0;
    }

    .login__verify-field .login__field-input {
      padding-right: 8px;
    }

    .login__captcha {
      width: 112px;
      height: 38px;
      padding: 0 8px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      border: 1px solid #c8d9c2;
      border-radius: 2px;
      color: #273340;
      background: repeating-linear-gradient(-14deg, transparent 0 10px, rgba(78, 133, 67, 0.14) 11px 12px), #e8f0df;
      cursor: pointer;
      overflow: hidden;

      span {
        font-family: Georgia, serif !important;
        font-size: 24px;
        font-style: italic;
        transform: rotate(-8deg);
      }

      span:nth-child(even) {
        transform: rotate(9deg) translateY(2px);
      }
    }

    .login__options {
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #7c8795;
      font-size: 12px;
    }

    .login__keep {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .login__text-button,
    .login__server {
      padding: 0;
      border: 0;
      color: #3d7fec;
      background: transparent;
      cursor: pointer;
    }

    .login__btn-gradient {
      width: 100%;
      height: 46px;
      margin-top: 5px;
      border-radius: 1px;
      font-size: 18px;
      letter-spacing: 8px;
      background: linear-gradient(90deg, #477cf2 0%, #3c72e7 100%);
      box-shadow: 0 4px 10px rgba(54, 110, 221, 0.18);

      &:not(.n-button--disabled):hover {
        background: linear-gradient(90deg, #568bf8 0%, #4279eb 100%);
      }
    }

    .login__terms {
      min-height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #9aa4b0;
      font-size: 11px;
    }

    .login__other {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      height: 28px;

      button {
        width: 24px;
        height: 24px;
        padding: 4px;
        border: 0;
        border-radius: 50%;
        color: #8e9aaa;
        background: transparent;
        cursor: pointer;

        &:hover {
          color: #2f86df;
          background: #edf5fd;
        }
      }

      svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
    }

    .login__link {
      color: #3d7fec;
      cursor: pointer;
    }

    .login__server {
      margin-top: auto;
      font-size: 14px;
    }

    .login__register {
      margin: 12px 0 14px;
      display: flex;
      align-items: center;
      gap: 4px;
      color: #9aa4b0;
      font-size: 12px;
    }

    .login__network {
      width: 100%;
      padding-top: 24px;
    }

    .login__footer {
      height: 30px;
      justify-content: center;
      gap: 8px;
      padding: 0;
      color: #b0b7bf;
      font-size: 10px;
      background: #fff;
    }

    .login__footer-support {
      color: #5f8fdc;
      cursor: pointer;
    }

    :deep(.login__field .n-input) {
      --n-border: none !important;
      --n-border-hover: none !important;
      --n-border-focus: none !important;
      --n-box-shadow-focus: none !important;
      --n-color: transparent !important;
      --n-color-focus: transparent !important;
      --n-color-disabled: transparent !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    :deep(.login__field .n-input__border),
    :deep(.login__field .n-input__state-border) {
      display: none;
    }

    :deep(.login__field .n-input__input-el) {
      height: 52px;
      color: #3e4854;
      font-size: 15px;
      line-height: 52px;
    }
  }
</style>
