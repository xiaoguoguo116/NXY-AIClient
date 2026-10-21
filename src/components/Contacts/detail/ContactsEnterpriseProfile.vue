<template>
  <n-spin :show="loading" class="organization-spin">
    <div class="organization-directory" :class="{ 'organization-directory--profile': !!$slots.profile }">
      <header class="organization-header">
        <Avatar class="organization-header__avatar" type="enterprise" :id="enterpriseId" />
        <div class="organization-header__main">
          <div class="organization-header__title-row">
            <h1>{{ enterpriseInfo?.name || '-' }}</h1>
            <span class="organization-header__tag">{{ enterpriseInfo?.enterpriseTag || '-' }}</span>
          </div>
          <p>
            {{ enterpriseInfo?.location || '-' }}
            <span>·</span>
            {{ t('contacts.enterprise.labels.memberTotal', { count: enterpriseInfo?.memberNum ?? 0 }) }}
          </p>
        </div>
        <div v-if="isLocalEnterprise" class="organization-header__local-badge">
          <span class="organization-header__local-dot" />
          {{ t('contacts.enterprise.labels.localDirectory') }}
        </div>
        <button
          v-if="isLocalEnterprise"
          type="button"
          class="organization-header__my-profile"
          @click="emit('selfSelected')">
          我的主页
        </button>
      </header>

      <div class="organization-body">
        <aside class="organization-tree-pane">
          <div class="organization-tree-pane__title">
            <span>{{ t('contacts.enterprise.labels.organization') }}</span>
            <span>{{ departments.length }}</span>
          </div>
          <label class="organization-search">
            <svg><use href="#search" /></svg>
            <input
              v-model="departmentQuery"
              type="search"
              :placeholder="t('contacts.enterprise.placeholders.searchDepartment')" />
          </label>

          <div class="organization-tree-scroll">
            <button class="organization-root" type="button" @click="rootExpanded = !rootExpanded">
              <svg class="organization-arrow" :class="{ expanded: rootExpanded }">
                <use href="#right-arrow" />
              </svg>
              <span class="organization-root__icon">
                <svg><use href="#home" /></svg>
              </span>
              <span class="organization-tree__name">{{ enterpriseInfo?.name || '-' }}</span>
              <span class="organization-tree__count">{{ enterpriseInfo?.memberNum ?? 0 }}</span>
            </button>

            <template v-if="rootExpanded">
              <button
                v-for="row in visibleDepartmentRows"
                :key="row.department.id"
                type="button"
                class="organization-tree__row"
                :class="{ active: currentDepartmentId === row.department.id }"
                :style="{ paddingLeft: `${12 + row.depth * 22}px` }"
                @click="onSelectDepartment(row.department.id)">
                <span
                  class="organization-tree__arrow-slot"
                  @click.stop="row.hasChildren && toggleDepartment(row.department.id)">
                  <svg
                    v-if="row.hasChildren"
                    class="organization-arrow"
                    :class="{ expanded: isDepartmentExpanded(row.department.id) }">
                    <use href="#right-arrow" />
                  </svg>
                </span>
                <svg class="organization-tree__folder"><use href="#folder" /></svg>
                <span class="organization-tree__name">{{ row.department.name }}</span>
                <span class="organization-tree__count">{{ row.department.memberNum }}</span>
              </button>
              <div v-if="visibleDepartmentRows.length === 0" class="organization-tree__empty">
                {{ t('contacts.enterprise.emptyDepartments') }}
              </div>
            </template>
          </div>
        </aside>

        <main class="organization-members-pane">
          <template v-if="currentDepartment">
            <div class="organization-members-pane__head">
              <div class="organization-members-pane__heading">
                <div class="organization-members-pane__path">{{ currentDepartmentPath }}</div>
                <div class="organization-members-pane__title-row">
                  <h2>{{ currentDepartment.name }}</h2>
                  <span>{{ t('contacts.enterprise.labels.memberTotal', { count: visibleMembers.length }) }}</span>
                </div>
              </div>
              <label class="organization-search organization-member-search">
                <svg><use href="#search" /></svg>
                <input
                  v-model="memberQuery"
                  type="search"
                  :placeholder="t('contacts.enterprise.placeholders.searchMember')" />
              </label>
            </div>

            <n-scrollbar class="organization-members-scroll" :theme-overrides="{ width: '6px' }">
              <div v-if="filteredMembers.length" class="organization-member-list">
                <button
                  v-for="member in filteredMembers"
                  :key="member.id"
                  type="button"
                  class="organization-member"
                  :class="{ active: selectedMemberId === member.userId }"
                  @click="onSelectMember(member.userId)">
                  <Avatar class="organization-member__avatar" :id="member.userId" />
                  <span class="organization-member__info">
                    <span class="organization-member__name-row">
                      <strong>{{ member.memberName || member.username || '-' }}</strong>
                      <span v-if="getRoleTagLabel(member.roles)" class="organization-member__role">
                        {{ getRoleTagLabel(member.roles) }}
                      </span>
                    </span>
                    <span class="organization-member__meta">
                      {{ member.jobTitle || '-' }}
                      <span v-if="member.departmentName">· {{ member.departmentName }}</span>
                    </span>
                  </span>
                  <span class="organization-member__contact">
                    <span v-if="member.email">{{ member.email }}</span>
                    <span v-if="member.phone">{{ member.phone }}</span>
                  </span>
                  <span class="organization-member__action">{{ t('contacts.actions.viewProfile') }}</span>
                </button>
              </div>
              <div v-else class="organization-empty">
                <svg><use href="#user" /></svg>
                <p>{{ t('contacts.enterprise.emptyMembers') }}</p>
              </div>
            </n-scrollbar>
          </template>

          <div v-else class="organization-empty organization-empty--select">
            <svg><use href="#group" /></svg>
            <p>{{ t('contacts.enterprise.selectDepartment') }}</p>
          </div>
        </main>
        <slot name="profile" />
      </div>
    </div>
  </n-spin>
</template>

<script setup lang="ts">
  import { enterpriseApi } from '@/api'
  import { hasEnterpriseMemberRoleTag } from '@/constants/enterprise'
  import { getLocalEnterpriseDepartments, LOCAL_ENTERPRISE_ID } from '@/services/localContacts'
  import { usePeerInfoStore } from '@/stores/user/peerInfo'
  import type { EnterprisInfo } from '@/types/api/enterprise'
  import type { EnterpriseDepartment } from '@/types/api/enterpriseDepartment'
  import type { EnterpriseMember } from '@/types/api/enterpriseMember'
  import { useI18n } from 'vue-i18n'

  type DepartmentRow = {
    department: EnterpriseDepartment
    depth: number
    hasChildren: boolean
  }

  const props = defineProps<{
    enterpriseId: string
    selectedMemberId?: string
  }>()

  const emit = defineEmits<{
    memberSelected: [userId: string]
    selfSelected: []
    departmentSelected: []
  }>()

  const { t } = useI18n()
  const peerInfoStore = usePeerInfoStore()
  const enterpriseInfo = computed(() => peerInfoStore.read(props.enterpriseId, 'enterprise') as EnterprisInfo | null)
  const departments = ref<EnterpriseDepartment[]>([])
  const currentDepartmentId = ref('')
  const departmentLoading = ref(false)
  const rootExpanded = ref(true)
  const expandedDepartmentIds = ref(new Set<string>())
  const departmentQuery = ref('')
  const memberQuery = ref('')

  const loading = computed(() => (!!props.enterpriseId && !enterpriseInfo.value) || departmentLoading.value)
  const isLocalEnterprise = computed(() => props.enterpriseId === LOCAL_ENTERPRISE_ID)

  const childDepartments = computed(() => {
    const children = new Map<string, EnterpriseDepartment[]>()
    for (const department of departments.value) {
      const siblings = children.get(department.parentId || '') ?? []
      siblings.push(department)
      children.set(department.parentId || '', siblings)
    }
    for (const siblings of children.values()) siblings.sort((a, b) => a.sort - b.sort)
    return children
  })

  const initializeDepartments = (list: EnterpriseDepartment[]) => {
    departments.value = list
    expandedDepartmentIds.value = new Set(
      list.filter((item) => list.some((candidate) => candidate.parentId === item.id)).map((item) => item.id)
    )
    const firstRoot = [...list].sort((a, b) => a.sort - b.sort).find((item) => !item.parentId)
    currentDepartmentId.value = firstRoot?.id || ''
    memberQuery.value = ''
  }

  const fetchDepartments = (enterpriseId: string) => {
    const localDepartments = getLocalEnterpriseDepartments(enterpriseId)
    if (localDepartments) {
      initializeDepartments(localDepartments)
      departmentLoading.value = false
      return
    }

    departmentLoading.value = true
    enterpriseApi
      .getEnterpriseDepartment({ enterpriseId })
      .then((res) => {
        if (res.code === 0 && res.data) initializeDepartments(res.data)
        else window.$message.error(res.msg)
      })
      .catch(() => window.$message.error(t('http.networkError')))
      .finally(() => {
        departmentLoading.value = false
      })
  }

  const fetchEnterpriseProfile = () => {
    if (!props.enterpriseId) return
    departments.value = []
    currentDepartmentId.value = ''
    departmentQuery.value = ''
    memberQuery.value = ''
    peerInfoStore.get(props.enterpriseId, 'enterprise')
    fetchDepartments(props.enterpriseId)
  }

  watch(
    () => props.enterpriseId,
    () => fetchEnterpriseProfile(),
    { immediate: true }
  )

  const currentDepartment = computed(() => departments.value.find((item) => item.id === currentDepartmentId.value))

  watch(
    () => [props.selectedMemberId, departments.value] as const,
    ([userId, list]) => {
      if (!userId) return
      const department = list.find((item) => item.members?.some((member) => member.userId === userId))
      if (department) currentDepartmentId.value = department.id
    },
    { immediate: true }
  )

  const matchingDepartmentIds = computed(() => {
    const query = departmentQuery.value.trim().toLocaleLowerCase()
    if (!query) return null

    const byId = new Map(departments.value.map((item) => [item.id, item] as const))
    const ids = new Set<string>()
    for (const department of departments.value) {
      if (!department.name.toLocaleLowerCase().includes(query)) continue
      let cursor: EnterpriseDepartment | undefined = department
      while (cursor && !ids.has(cursor.id)) {
        ids.add(cursor.id)
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
      }
    }
    return ids
  })

  const visibleDepartmentRows = computed<DepartmentRow[]>(() => {
    const rows: DepartmentRow[] = []
    const matchingIds = matchingDepartmentIds.value

    const append = (parentId: string, depth: number) => {
      for (const department of childDepartments.value.get(parentId) ?? []) {
        if (matchingIds && !matchingIds.has(department.id)) continue
        const children = childDepartments.value.get(department.id) ?? []
        rows.push({ department, depth, hasChildren: children.length > 0 })
        if (children.length && (matchingIds || expandedDepartmentIds.value.has(department.id))) {
          append(department.id, depth + 1)
        }
      }
    }

    append('', 0)
    return rows
  })

  const allMembers = computed(() => {
    const byId = new Map<string, EnterpriseMember>()
    for (const member of enterpriseInfo.value?.userEnterpriseMembers ?? []) byId.set(member.id, member)
    for (const department of departments.value) {
      for (const member of department.members ?? []) byId.set(member.id, member)
    }
    return [...byId.values()]
  })

  const branchDepartmentIds = computed(() => {
    const ids = new Set<string>()
    if (!currentDepartment.value) return ids
    ids.add(currentDepartment.value.id)
    let foundChild = true
    while (foundChild) {
      foundChild = false
      for (const department of departments.value) {
        if (ids.has(department.parentId) && !ids.has(department.id)) {
          ids.add(department.id)
          foundChild = true
        }
      }
    }
    return ids
  })

  const visibleMembers = computed(() =>
    allMembers.value.filter((member) => branchDepartmentIds.value.has(member.departmentId))
  )

  const filteredMembers = computed(() => {
    const query = memberQuery.value.trim().toLocaleLowerCase()
    if (!query) return visibleMembers.value
    return visibleMembers.value.filter((member) =>
      [member.memberName, member.username, member.jobTitle, member.departmentName, member.email, member.phone].some(
        (value) => value?.toLocaleLowerCase().includes(query)
      )
    )
  })

  const currentDepartmentPath = computed(() => {
    if (!currentDepartment.value) return ''
    const byId = new Map(departments.value.map((item) => [item.id, item] as const))
    const names: string[] = []
    const visited = new Set<string>()
    let cursor: EnterpriseDepartment | undefined = currentDepartment.value
    while (cursor && !visited.has(cursor.id)) {
      names.unshift(cursor.name)
      visited.add(cursor.id)
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    }
    names.unshift(enterpriseInfo.value?.name || '-')
    return names.join(' / ')
  })

  const isDepartmentExpanded = (id: string) => !!matchingDepartmentIds.value || expandedDepartmentIds.value.has(id)

  const toggleDepartment = (id: string) => {
    const next = new Set(expandedDepartmentIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    expandedDepartmentIds.value = next
  }

  const onSelectDepartment = (id: string) => {
    currentDepartmentId.value = id
    memberQuery.value = ''
    emit('departmentSelected')
  }

  const onSelectMember = (userId: string) => emit('memberSelected', userId)

  const getRoleTagLabel = (role?: string) => {
    if (!hasEnterpriseMemberRoleTag(role)) return ''
    return t(`contacts.enterprise.roles.${role}`)
  }
</script>

<style scoped lang="scss">
  .organization-spin {
    width: 100%;
    min-width: 0;
    height: 100%;
    overflow: hidden;

    :deep(.n-spin-container),
    :deep(.n-spin-content) {
      width: 100%;
      min-width: 0;
      height: 100%;
    }
  }

  .organization-directory {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 100%;
    background: #fff;
    --bg-content-color: #fff;
    --card-bg-color: #f3f7fd;
    --text-color: #17243b;
    --text-secondary-color: #69788f;
    --text-muted-color: #8795a9;
    --divider-color: #e5ecf5;
    --primary-color: #347ad9;
    --green: #29ae7b;
  }

  .organization-header {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 86px;
    padding: 16px 22px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--divider-color);
    background: #f7faff;

    &__avatar {
      width: 52px;
      height: 52px;
      border-radius: 10px;
      flex-shrink: 0;
    }

    &__tag {
      padding: 4px 9px;
      border-radius: 999px;
      color: #3275cf;
      background: #e6f1ff;
      font-size: 12px;
    }

    &__main {
      min-width: 0;
      flex: 1;

      p {
        display: flex;
        gap: 7px;
        align-items: center;
        margin: 7px 0 0;
        color: var(--text-secondary-color);
        font-size: 12px;
      }
    }

    &__title-row {
      display: flex;
      align-items: center;
      gap: 8px;

      h1 {
        margin: 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-color);
        font-size: 19px;
        font-weight: 650;
      }
    }

    &__local-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      color: var(--text-secondary-color);
      background: #eaf5f2;
      font-size: 12px;
      white-space: nowrap;
    }

    &__local-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 18%, transparent);
    }
  }

  .organization-body {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .organization-directory--profile {
    .organization-tree-pane {
      width: 250px;
      min-width: 220px;
    }
    .organization-member__contact {
      display: none;
    }
  }

  .organization-header__my-profile {
    flex-shrink: 0;
    padding: 8px 13px;
    border: 1px solid #c8dcf7;
    border-radius: 7px;
    background: #fff;
    color: #3275cf;
    cursor: pointer;
    font-size: 12px;
  }

  .organization-tree-pane {
    display: flex;
    flex-direction: column;
    width: clamp(260px, 34%, 330px);
    min-width: 240px;
    min-height: 0;
    padding: 16px 12px 12px;
    box-sizing: border-box;
    border-right: 1px solid var(--divider-color);
    background: #fbfcff;

    &__title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 5px 10px;
      color: var(--text-muted-color);
      font-size: 12px;

      span:last-child {
        color: var(--text-secondary-color);
      }
    }
  }

  .organization-search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    margin-bottom: 12px;
    padding: 0 10px;
    border: 1px solid #dce5f1;
    border-radius: 7px;
    color: #8795a9;
    background: #fff;

    &:focus-within {
      border-color: #6aa7e8;
      box-shadow: 0 0 0 3px rgb(106 167 232 / 14%);
    }

    svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    input {
      width: 100%;
      min-width: 0;
      border: 0;
      outline: 0;
      color: #17243b;
      background: transparent;
      font: inherit;
      font-size: 13px;

      &::placeholder {
        color: #9aa7b8;
      }
    }
  }

  .organization-tree-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    scrollbar-width: thin;
  }

  .organization-root,
  .organization-tree__row {
    display: flex;
    align-items: center;
    width: 100%;
    height: 42px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    outline: none;
    color: var(--text-color);
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-align: left;

    &:hover {
      background: color-mix(in srgb, var(--card-bg-color) 72%, transparent);
    }
  }

  .organization-root {
    font-weight: 600;

    &__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 25px;
      height: 25px;
      margin: 0 7px 0 3px;
      border-radius: 6px;
      color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 13%, transparent);

      svg {
        width: 16px;
        height: 16px;
      }
    }
  }

  .organization-arrow {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    color: var(--text-secondary-color);
    transform: rotate(0deg);
    transition: transform 0.16s ease;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .organization-tree {
    &__row {
      &.active {
        border-color: color-mix(in srgb, var(--primary-color) 35%, transparent);
        color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 10%, transparent);
      }
    }

    &__arrow-slot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 24px;
      flex-shrink: 0;
    }

    &__folder {
      width: 18px;
      height: 18px;
      margin: 0 8px 0 2px;
      flex-shrink: 0;
      color: currentColor;
    }

    &__name {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }

    &__count {
      margin-left: 7px;
      flex-shrink: 0;
      color: var(--text-secondary-color);
      font-size: 11px;
    }

    &__empty {
      padding: 30px 10px;
      color: var(--text-secondary-color);
      font-size: 12px;
      text-align: center;
    }
  }

  .organization-members-pane {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;

    &__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 18px;
      padding: 20px 22px 14px;
      border-bottom: 1px solid var(--divider-color);
    }

    &__heading {
      min-width: 0;
    }

    &__path {
      margin-bottom: 7px;
      overflow: hidden;
      color: var(--text-secondary-color);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__title-row {
      display: flex;
      align-items: baseline;
      gap: 9px;

      h2 {
        margin: 0;
        color: var(--text-color);
        font-size: 18px;
        font-weight: 650;
      }

      span {
        color: var(--text-secondary-color);
        font-size: 12px;
      }
    }
  }

  .organization-member-search {
    width: min(220px, 42%);
    flex-shrink: 0;
    margin-bottom: 0;
  }

  .organization-members-scroll {
    flex: 1;
    min-height: 0;
  }

  .organization-member-list {
    padding: 8px 12px 18px;
  }

  .organization-member {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 68px;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    outline: none;
    color: var(--text-color);
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-align: left;

    &:hover {
      border-color: color-mix(in srgb, var(--primary-color) 22%, transparent);
      background: color-mix(in srgb, var(--card-bg-color) 72%, transparent);

      .organization-member__action {
        opacity: 1;
        transform: translateX(0);
      }
    }

    &.active {
      border-color: #c8dcf7;
      background: #eef5ff;
    }

    &__avatar {
      width: 42px;
      height: 42px;
      margin-right: 11px;
      border-radius: 8px;
      flex-shrink: 0;
    }

    &__info {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      gap: 6px;
    }

    &__name-row {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 7px;

      strong {
        overflow: hidden;
        font-size: 14px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__meta {
      overflow: hidden;
      color: var(--text-secondary-color);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__role {
      padding: 3px 8px;
      border-radius: 999px;
      color: #17865d;
      background: #e6f6ef;
      font-size: 11px;
      white-space: nowrap;
    }

    &__contact {
      display: flex;
      width: 170px;
      min-width: 0;
      flex-direction: column;
      gap: 5px;
      color: var(--text-secondary-color);
      font-size: 11px;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__action {
      margin-left: 12px;
      color: var(--primary-color);
      font-size: 12px;
      opacity: 0;
      transform: translateX(4px);
      transition:
        opacity 0.16s ease,
        transform 0.16s ease;
      white-space: nowrap;
    }
  }

  .organization-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 180px;
    flex-direction: column;
    gap: 12px;
    color: var(--text-secondary-color);

    svg {
      width: 44px;
      height: 44px;
      opacity: 0.22;
    }

    p {
      margin: 0;
      font-size: 13px;
    }

    &--select {
      flex: 1;
    }
  }

  @media (max-width: 980px) {
    .organization-header__local-badge,
    .organization-member__contact {
      display: none;
    }

    .organization-tree-pane {
      width: 260px;
      min-width: 220px;
    }
  }
</style>
