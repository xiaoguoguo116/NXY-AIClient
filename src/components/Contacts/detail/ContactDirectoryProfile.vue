<template>
  <aside class="directory-profile" aria-label="联系人资料">
    <header class="directory-profile__hero">
      <button type="button" class="directory-profile__close" aria-label="关闭资料" @click="emit('close')">×</button>
      <Avatar class="directory-profile__avatar" :id="userId" />
      <div class="directory-profile__identity">
        <h2>{{ displayName }}</h2>
        <span>{{ isSelf ? '我的主页' : profile?.account || '本地联系人' }}</span>
      </div>
      <p>{{ isSelf ? '在这里维护自己的工作职责' : profile?.tag || '协作示例组织' }}</p>
    </header>

    <div class="directory-profile__scroll">
      <div class="directory-profile__status">
        <span />
        {{ isSelf ? '我的资料' : '组织成员' }}
      </div>
      <section class="directory-profile__section">
        <h3>基本资料</h3>
        <dl>
          <div>
            <dt>组织</dt>
            <dd>协作示例组织</dd>
          </div>
          <div>
            <dt>部门</dt>
            <dd>{{ isSelf ? '个人主页' : profile?.tag || '—' }}</dd>
          </div>
          <div>
            <dt>岗位</dt>
            <dd>{{ isSelf ? '由本人维护' : jobTitle }}</dd>
          </div>
          <div v-if="!isSelf">
            <dt>手机</dt>
            <dd>{{ profile?.phone || '—' }}</dd>
          </div>
          <div v-if="!isSelf">
            <dt>邮箱</dt>
            <dd>{{ profile?.email || '—' }}</dd>
          </div>
          <div v-if="!isSelf">
            <dt>地点</dt>
            <dd>{{ profile?.location || '—' }}</dd>
          </div>
        </dl>
      </section>

      <section class="directory-profile__section directory-profile__knowledge">
        <div class="directory-profile__section-title">
          <h3>工作职责</h3>
          <span>人员职责知识库 · 本机</span>
        </div>
        <template v-if="isSelf">
          <p class="directory-profile__hint">写清楚你负责的业务、系统和可协助开通的权限，AI RAG 可据此推荐联系人。</p>
          <textarea
            v-model="draft"
            aria-label="编辑我的工作职责"
            maxlength="2000"
            placeholder="例如：负责数据库访问权限审批、账号开通和数据表授权…" />
          <div class="directory-profile__save-row">
            <span>{{ draft.length }}/2000</span>
          </div>
          <p v-if="saveStatus" role="status" class="directory-profile__saved">{{ saveStatus }}</p>
        </template>
        <p v-else class="directory-profile__work">{{ responsibility || '暂未填写工作职责。' }}</p>
      </section>
    </div>

    <footer class="directory-profile__footer">
      <button v-if="isSelf" type="button" @click="saveWork">保存到职责知识库</button>
      <button v-else type="button" @click="sendMessage">发送消息</button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
  import { getResponsibility, LOCAL_SELF_ID, saveSelfResponsibility } from '@/services/contactKnowledge'
  import { getLocalEnterpriseDepartments, getLocalUser, LOCAL_ENTERPRISE_ID } from '@/services/localContacts'
  import { localChatTarget } from '@/services/localChatNavigation'
  import { useHomeTabStore } from '@/stores/app/homeTab'
  import { useUserStore } from '@/stores/user/user'

  const props = defineProps<{ userId: string }>()
  const emit = defineEmits<{ close: [] }>()
  const homeTabStore = useHomeTabStore()
  const userStore = useUserStore()
  const isSelf = computed(() => props.userId === LOCAL_SELF_ID)
  const profile = computed(() => getLocalUser(props.userId))
  const displayName = computed(() =>
    isSelf.value ? userStore.userInfo.username || '我' : profile.value?.username || '联系人'
  )
  const jobTitle = computed(
    () =>
      getLocalEnterpriseDepartments(LOCAL_ENTERPRISE_ID)
        ?.flatMap((department) => department.members || [])
        .find((member) => member.userId === props.userId)?.jobTitle || '—'
  )
  const responsibility = ref('')
  const draft = ref('')
  const saveStatus = ref('')

  watch(
    () => props.userId,
    (id) => {
      responsibility.value = getResponsibility(id)
      draft.value = responsibility.value
      saveStatus.value = ''
    },
    { immediate: true }
  )

  function saveWork() {
    try {
      responsibility.value = saveSelfResponsibility(draft.value)
      saveStatus.value = '已保存到本机人员职责知识库，AI RAG 现在可以检索。'
    } catch (error) {
      saveStatus.value = error instanceof Error ? error.message : '保存失败，请检查本机存储。'
    }
  }

  function sendMessage() {
    localChatTarget.value = { peerId: props.userId, peerName: displayName.value }
    void homeTabStore.applyNavigate('message')
  }
</script>

<style scoped lang="scss">
  .directory-profile {
    display: flex;
    flex: 0 0 clamp(330px, 33%, 420px);
    min-width: 0;
    height: 100%;
    flex-direction: column;
    border-left: 1px solid #e5ecf5;
    background: #fff;
    color: #17243b;

    &__hero {
      position: relative;
      min-height: 174px;
      padding: 26px 24px 18px;
      box-sizing: border-box;
      background: #f2f7ff;
    }
    &__close {
      position: absolute;
      top: 16px;
      right: 18px;
      border: 0;
      background: transparent;
      color: #718096;
      cursor: pointer;
      font-size: 25px;
    }
    &__avatar {
      width: 58px;
      height: 58px;
      border-radius: 12px;
      float: right;
      margin: 23px 2px 0 10px;
    }
    &__identity {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding-top: 20px;
    }
    &__identity h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 650;
    }
    &__identity span,
    &__hero p {
      color: #718096;
      font-size: 12px;
    }
    &__hero p {
      margin: 18px 0 0;
    }
    &__scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 0 24px 20px;
    }
    &__status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 18px 0;
      color: #718096;
      font-size: 12px;
    }
    &__status span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #47b489;
    }
    &__section {
      padding: 12px 0 20px;
      border-top: 1px solid #e9eef5;
    }
    &__section h3 {
      margin: 0 0 17px;
      font-size: 14px;
    }
    &__section dl {
      margin: 0;
    }
    &__section dl div {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 10px;
      margin: 0 0 18px;
      font-size: 13px;
    }
    &__section dt {
      color: #8896a9;
    }
    &__section dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    &__section-title {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    &__section-title span,
    &__hint,
    &__save-row span {
      color: #8896a9;
      font-size: 11px;
    }
    &__work {
      margin: 0;
      color: #34455e;
      font-size: 13px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    &__hint {
      line-height: 1.6;
    }
    &__knowledge textarea {
      width: 100%;
      min-height: 142px;
      box-sizing: border-box;
      resize: vertical;
      padding: 11px;
      border: 1px solid #d9e4f2;
      border-radius: 8px;
      outline-color: #6aa7e8;
      color: #17243b;
      background: #fbfdff;
      font: inherit;
      font-size: 13px;
      line-height: 1.6;
    }
    &__save-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
    }
    &__footer button {
      border: 0;
      border-radius: 7px;
      background: #347ad9;
      color: white;
      cursor: pointer;
      padding: 10px 14px;
      font-size: 13px;
    }
    &__saved {
      color: #23825e;
      font-size: 12px;
    }
    &__footer {
      padding: 16px 24px;
      border-top: 1px solid #e9eef5;
    }
    &__footer button {
      width: 100%;
      font-size: 14px;
    }
  }
</style>
